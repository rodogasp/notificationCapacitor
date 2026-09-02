import { createHash } from 'node:crypto';
import type { Notification, NotificationDelivery, NotificationTargetType } from '@prisma/client';
import { AppError } from '../../shared/errors';
import { logger } from '../../config/logger';
import type { DeviceRepository } from '../devices/device.repository';
import type { NotificationDispatcher } from './notification-dispatcher';
import type { NotificationRepository, NotificationWithDeliveries } from './notification.repository';
import type { NotificationContentInput } from './notification.types';

export interface SendResult {
  notificationId: string;
  status: string;
  successCount: number;
  failureCount: number;
  totalTargets: number;
  message?: string;
}

export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly deviceRepository: DeviceRepository,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async sendToUser(
    requestedBy: string,
    targetUserId: string,
    content: NotificationContentInput,
    idempotencyKey?: string,
  ): Promise<SendResult> {
    return this.withIdempotency(
      requestedBy,
      'USER',
      targetUserId,
      content,
      idempotencyKey,
      async (notification) => {
        const devices = await this.deviceRepository.listSendableForUser(targetUserId);

        if (devices.length === 0) {
          await this.notificationRepository.completeNotification(notification.id, {
            successCount: 0,
            failureCount: 0,
            failureReason: 'NO_ACTIVE_DEVICES',
          });
          return {
            notificationId: notification.id,
            status: 'FAILED',
            successCount: 0,
            failureCount: 0,
            totalTargets: 0,
            message: 'User has no active, notification-enabled devices',
          };
        }

        const summary = await this.dispatcher.sendToTokens(
          devices.map((device) => ({ deviceTokenId: device.id, token: device.token })),
          content,
        );

        await this.persistDeliveriesAndDeactivateInvalidTokens(notification.id, summary.results);

        await this.notificationRepository.completeNotification(notification.id, {
          successCount: summary.successCount,
          failureCount: summary.failureCount,
        });

        logger.info(
          {
            notificationId: notification.id,
            targetType: 'USER',
            targetCount: devices.length,
            successCount: summary.successCount,
            failureCount: summary.failureCount,
          },
          'Notification dispatch completed',
        );

        return {
          notificationId: notification.id,
          status:
            summary.failureCount === 0 ? 'SENT' : summary.successCount === 0 ? 'FAILED' : 'PARTIAL',
          successCount: summary.successCount,
          failureCount: summary.failureCount,
          totalTargets: devices.length,
        };
      },
    );
  }

  async sendToDevice(
    requestedBy: string,
    token: string,
    content: NotificationContentInput,
    idempotencyKey?: string,
  ): Promise<SendResult> {
    return this.withIdempotency(
      requestedBy,
      'DEVICE',
      token,
      content,
      idempotencyKey,
      async (notification) => {
        const device = await this.deviceRepository.findByToken(token);
        const summary = await this.dispatcher.sendToTokens(
          [{ deviceTokenId: device?.id ?? '', token }],
          content,
        );

        await this.persistDeliveriesAndDeactivateInvalidTokens(notification.id, summary.results);

        await this.notificationRepository.completeNotification(notification.id, {
          successCount: summary.successCount,
          failureCount: summary.failureCount,
        });

        logger.info(
          {
            notificationId: notification.id,
            targetType: 'DEVICE',
            targetCount: 1,
            successCount: summary.successCount,
            failureCount: summary.failureCount,
          },
          'Notification dispatch completed',
        );

        return {
          notificationId: notification.id,
          status: summary.successCount > 0 ? 'SENT' : 'FAILED',
          successCount: summary.successCount,
          failureCount: summary.failureCount,
          totalTargets: 1,
        };
      },
    );
  }

  async sendToTopic(
    requestedBy: string,
    topic: string,
    content: NotificationContentInput,
    idempotencyKey?: string,
  ): Promise<SendResult> {
    return this.withIdempotency(
      requestedBy,
      'TOPIC',
      topic,
      content,
      idempotencyKey,
      async (notification) => {
        const result = await this.dispatcher.sendToTopic(topic, content);

        await this.notificationRepository.recordDeliveries([
          {
            notificationId: notification.id,
            fcmMessageId: result.messageId,
            status: result.success ? 'SUCCESS' : 'FAILED',
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
          },
        ]);

        await this.notificationRepository.completeNotification(notification.id, {
          successCount: result.success ? 1 : 0,
          failureCount: result.success ? 0 : 1,
          failureReason: result.success ? undefined : result.errorCode,
        });

        logger.info(
          {
            notificationId: notification.id,
            targetType: 'TOPIC',
            targetCount: 1,
            successCount: result.success ? 1 : 0,
            failureCount: result.success ? 0 : 1,
          },
          'Notification dispatch completed',
        );

        return {
          notificationId: notification.id,
          status: result.success ? 'SENT' : 'FAILED',
          successCount: result.success ? 1 : 0,
          failureCount: result.success ? 0 : 1,
          totalTargets: 1,
        };
      },
    );
  }

  async getNotification(notificationId: string): Promise<NotificationWithDeliveries> {
    const notification = await this.notificationRepository.findByIdWithDeliveries(notificationId);
    if (!notification) {
      throw AppError.notFound('Notification not found');
    }
    return notification;
  }

  async listNotifications(limit: number): Promise<Notification[]> {
    return this.notificationRepository.listRecent(limit);
  }

  private async persistDeliveriesAndDeactivateInvalidTokens(
    notificationId: string,
    results: Array<{
      deviceTokenId?: string;
      success: boolean;
      messageId?: string;
      errorCode?: string;
      errorMessage?: string;
      permanentFailure?: boolean;
    }>,
  ): Promise<void> {
    await this.notificationRepository.recordDeliveries(
      results.map((result) => ({
        notificationId,
        deviceTokenId: result.deviceTokenId || undefined,
        fcmMessageId: result.messageId,
        status: result.success ? 'SUCCESS' : 'FAILED',
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      })),
    );

    for (const result of results) {
      if (!result.success && result.permanentFailure && result.deviceTokenId) {
        await this.deviceRepository.deactivateById(
          result.deviceTokenId,
          sanitizeInvalidationReason(result.errorCode),
        );
      }
    }
  }

  private async withIdempotency(
    requestedBy: string,
    targetType: NotificationTargetType,
    targetValue: string,
    content: NotificationContentInput,
    idempotencyKey: string | undefined,
    execute: (notification: Notification) => Promise<SendResult>,
  ): Promise<SendResult> {
    const requestHash = hashRequest(targetType, targetValue, content);

    if (idempotencyKey) {
      const existing = await this.notificationRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw AppError.conflict('Idempotency key was already used with a different request body');
        }
        return toSendResult(existing);
      }
    }

    const notification = await this.notificationRepository.create({
      requestedBy,
      targetType,
      targetValue,
      title: content.title,
      body: content.body,
      data: content.data ?? {},
      idempotencyKey,
      requestHash,
    });

    try {
      return await execute(notification);
    } catch (error) {
      await this.notificationRepository.completeNotification(notification.id, {
        successCount: 0,
        failureCount: 0,
        failureReason: 'DISPATCH_ERROR',
      });
      throw error;
    }
  }
}

function toSendResult(notification: NotificationWithDeliveries): SendResult {
  return {
    notificationId: notification.id,
    status: notification.status,
    successCount: notification.successCount,
    failureCount: notification.failureCount,
    totalTargets: notification.deliveries.length,
  };
}

function hashRequest(
  targetType: string,
  targetValue: string,
  content: NotificationContentInput,
): string {
  const payload = JSON.stringify({ targetType, targetValue, content });
  return createHash('sha256').update(payload).digest('hex');
}

function sanitizeInvalidationReason(errorCode: string | undefined): string {
  return errorCode
    ? `FCM_${errorCode.replace('messaging/', '').toUpperCase()}`
    : 'FCM_TOKEN_INVALID';
}

export type { NotificationDelivery };
