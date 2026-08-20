import type { NotificationContentInput } from './notification.types';

/**
 * Builds the internal, allowlisted representation of an FCM Android message.
 * Only fields explicitly modeled here are ever sent to Firebase; arbitrary
 * client-supplied Firebase Admin message properties are never forwarded.
 */
export function buildAndroidMessageContent(
  input: NotificationContentInput,
  channelId: string,
): {
  notification?: { title?: string; body?: string };
  data: Record<string, string>;
  android: {
    priority: 'high' | 'normal';
    notification: { channelId: string; sound: string };
    ttl?: number;
    collapseKey?: string;
  };
} {
  const notification =
    input.title || input.body ? { title: input.title, body: input.body } : undefined;

  const data = toStringDataPayload(input.data ?? {});

  // Data-only or notification+data messages are sent with high priority so
  // Android delivers them promptly; adjust here if a lower-priority use case emerges.
  const priority: 'high' | 'normal' = 'high';

  return {
    notification,
    data,
    android: {
      priority,
      notification: {
        channelId,
        sound: 'default',
      },
      ttl: input.androidTtlSeconds !== undefined ? input.androidTtlSeconds * 1000 : undefined,
      collapseKey: input.androidCollapseKey,
    },
  };
}

/**
 * FCM data payloads must be a flat map of string -> string. Every accepted
 * value is converted to its string representation before sending.
 */
export function toStringDataPayload(
  data: Record<string, string | number | boolean>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = String(value);
  }
  return result;
}
