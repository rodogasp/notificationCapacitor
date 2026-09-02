import type { NextFunction, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/error-handler';
import type { NotificationService } from './notification.service';
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
  sendMessageBodySchema,
  sendToDeviceBodySchema,
  topicParamSchema,
  userIdParamSchema,
} from './notification.schemas';

const IDEMPOTENCY_HEADER = 'idempotency-key';

export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  sendToUser = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { userId } = userIdParamSchema.parse(req.params);
    const body = sendMessageBodySchema.parse(req.body);
    const idempotencyKey = req.header(IDEMPOTENCY_HEADER);
    const requestedBy = req.user?.userId ?? 'unknown';

    const result = await this.notificationService.sendToUser(
      requestedBy,
      userId,
      {
        title: body.notification?.title,
        body: body.notification?.body,
        data: body.data,
        androidTtlSeconds: body.android?.ttlSeconds,
        androidCollapseKey: body.android?.collapseKey,
      },
      idempotencyKey,
    );

    res.status(200).json(result);
  });

  sendToDevice = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const body = sendToDeviceBodySchema.parse(req.body);
    const idempotencyKey = req.header(IDEMPOTENCY_HEADER);
    const requestedBy = req.user?.userId ?? 'unknown';

    const result = await this.notificationService.sendToDevice(
      requestedBy,
      body.token,
      {
        title: body.notification?.title,
        body: body.notification?.body,
        data: body.data,
        androidTtlSeconds: body.android?.ttlSeconds,
        androidCollapseKey: body.android?.collapseKey,
      },
      idempotencyKey,
    );

    res.status(200).json(result);
  });

  sendToTopic = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { topic } = topicParamSchema.parse(req.params);
    const body = sendMessageBodySchema.parse(req.body);
    const idempotencyKey = req.header(IDEMPOTENCY_HEADER);
    const requestedBy = req.user?.userId ?? 'unknown';

    const result = await this.notificationService.sendToTopic(
      requestedBy,
      topic,
      {
        title: body.notification?.title,
        body: body.notification?.body,
        data: body.data,
        androidTtlSeconds: body.android?.ttlSeconds,
        androidCollapseKey: body.android?.collapseKey,
      },
      idempotencyKey,
    );

    res.status(200).json(result);
  });

  getNotification = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { notificationId } = notificationIdParamSchema.parse(req.params);
    const notification = await this.notificationService.getNotification(notificationId);

    res.status(200).json({
      id: notification.id,
      requestedBy: notification.requestedBy,
      targetType: notification.targetType,
      targetValue: notification.targetValue,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      status: notification.status,
      successCount: notification.successCount,
      failureCount: notification.failureCount,
      createdAt: notification.createdAt,
      sentAt: notification.sentAt,
      failureReason: notification.failureReason,
      deliveries: notification.deliveries.map((delivery) => ({
        id: delivery.id,
        deviceTokenId: delivery.deviceTokenId,
        fcmMessageId: delivery.fcmMessageId,
        status: delivery.status,
        errorCode: delivery.errorCode,
        errorMessage: delivery.errorMessage,
        createdAt: delivery.createdAt,
      })),
    });
  });

  list = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { limit } = listNotificationsQuerySchema.parse(req.query);
    const notifications = await this.notificationService.listNotifications(limit);

    res.status(200).json({
      notifications: notifications.map((notification) => ({
        id: notification.id,
        requestedBy: notification.requestedBy,
        targetType: notification.targetType,
        targetValue: notification.targetValue,
        title: notification.title,
        body: notification.body,
        status: notification.status,
        successCount: notification.successCount,
        failureCount: notification.failureCount,
        createdAt: notification.createdAt,
        sentAt: notification.sentAt,
        failureReason: notification.failureReason,
      })),
    });
  });
}
