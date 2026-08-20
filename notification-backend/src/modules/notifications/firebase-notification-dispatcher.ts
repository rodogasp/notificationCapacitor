import type { messaging } from 'firebase-admin';
import { getFirebaseMessaging } from '../../config/firebase';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { classifyFcmError } from '../../shared/utils';
import { maskToken } from '../../shared/utils';
import { buildAndroidMessageContent } from './fcm-message-builder';
import type { NotificationDispatcher, TopicSendResult } from './notification-dispatcher';
import type {
  DispatchSummary,
  NotificationContentInput,
  PerTargetDeliveryResult,
} from './notification.types';

// Current Firebase Admin SDK limit for a single multicast request.
const MULTICAST_BATCH_SIZE = 500;

export class FirebaseNotificationDispatcher implements NotificationDispatcher {
  async sendToTokens(
    tokens: Array<{ deviceTokenId: string; token: string }>,
    content: NotificationContentInput,
  ): Promise<DispatchSummary> {
    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0, results: [] };
    }

    const messageContent = buildAndroidMessageContent(content, env.FCM_ANDROID_CHANNEL_ID);
    const messaging = getFirebaseMessaging();
    const results: PerTargetDeliveryResult[] = [];

    for (const batch of chunk(tokens, MULTICAST_BATCH_SIZE)) {
      const message: messaging.MulticastMessage = {
        tokens: batch.map((entry) => entry.token),
        notification: messageContent.notification,
        data: messageContent.data,
        android: messageContent.android,
      };

      try {
        const response = await messaging.sendEachForMulticast(message);
        response.responses.forEach((individual, index) => {
          const target = batch[index];
          if (individual.success) {
            results.push({
              deviceTokenId: target.deviceTokenId,
              token: target.token,
              success: true,
              messageId: individual.messageId,
            });
            return;
          }

          const classified = classifyFcmError(individual.error);
          logger.warn(
            {
              token: maskToken(target.token),
              errorCode: classified.code,
              classification: classified.classification,
            },
            'FCM delivery failed for token',
          );
          results.push({
            deviceTokenId: target.deviceTokenId,
            token: target.token,
            success: false,
            errorCode: classified.code,
            errorMessage: classified.message,
            permanentFailure: classified.classification === 'PERMANENT',
          });
        });
      } catch (error) {
        // Whole-batch failure (e.g. network/auth issue): treat every token in
        // the batch as a transient failure so it can be retried later.
        const classified = classifyFcmError(error);
        logger.error({ errorCode: classified.code }, 'FCM multicast batch request failed');
        for (const target of batch) {
          results.push({
            deviceTokenId: target.deviceTokenId,
            token: target.token,
            success: false,
            errorCode: classified.code,
            errorMessage: classified.message,
            permanentFailure: false,
          });
        }
      }
    }

    const successCount = results.filter((result) => result.success).length;
    return { successCount, failureCount: results.length - successCount, results };
  }

  async sendToTopic(topic: string, content: NotificationContentInput): Promise<TopicSendResult> {
    const messageContent = buildAndroidMessageContent(content, env.FCM_ANDROID_CHANNEL_ID);
    const messaging = getFirebaseMessaging();

    const message: messaging.Message = {
      topic,
      notification: messageContent.notification,
      data: messageContent.data,
      android: messageContent.android,
    };

    try {
      const messageId = await messaging.send(message);
      return { success: true, messageId };
    } catch (error) {
      const classified = classifyFcmError(error);
      logger.warn(
        { topic, errorCode: classified.code, classification: classified.classification },
        'FCM topic send failed',
      );
      return {
        success: false,
        errorCode: classified.code,
        errorMessage: classified.message,
        permanentFailure: classified.classification === 'PERMANENT',
      };
    }
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}
