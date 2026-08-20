export type NotificationDataValue = string | number | boolean;

export interface NotificationContentInput {
  title?: string;
  body?: string;
  data?: Record<string, NotificationDataValue>;
  androidTtlSeconds?: number;
  androidCollapseKey?: string;
}

export interface BuiltFcmMessage {
  notification?: { title?: string; body?: string };
  data: Record<string, string>;
  android: {
    priority: 'high' | 'normal';
    notification: {
      channelId: string;
      sound: string;
    };
    ttl?: number;
    collapseKey?: string;
  };
}

export interface PerTargetDeliveryResult {
  deviceTokenId?: string;
  token?: string;
  success: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
  permanentFailure?: boolean;
}

export interface DispatchSummary {
  successCount: number;
  failureCount: number;
  results: PerTargetDeliveryResult[];
}

export type NotificationTargetType = 'USER' | 'DEVICE' | 'TOPIC';
