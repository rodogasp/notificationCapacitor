import type {
  DispatchSummary,
  NotificationContentInput,
  PerTargetDeliveryResult,
} from './notification.types';

export interface TopicSendResult {
  success: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
  permanentFailure?: boolean;
}

/**
 * Abstraction over how notifications are actually delivered. The current
 * implementation sends synchronously via the Firebase Admin SDK; a future
 * version could implement the same interface backed by a queue (e.g. Google
 * Pub/Sub, Cloud Tasks, RabbitMQ) without changing NotificationService.
 */
export interface NotificationDispatcher {
  sendToTokens(
    tokens: Array<{ deviceTokenId: string; token: string }>,
    content: NotificationContentInput,
  ): Promise<DispatchSummary>;

  sendToTopic(topic: string, content: NotificationContentInput): Promise<TopicSendResult>;
}

export type { PerTargetDeliveryResult };
