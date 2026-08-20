import { z } from 'zod';

const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 1000;
const MAX_DATA_PAYLOAD_BYTES = 4000; // FCM data payload safety limit (~4KB)

const notificationContentSchema = z
  .object({
    title: z.string().min(1).max(MAX_TITLE_LENGTH).optional(),
    body: z.string().min(1).max(MAX_BODY_LENGTH).optional(),
  })
  .strict()
  .optional();

// Only primitive values are accepted; nested objects/arrays are rejected so
// clients cannot smuggle unbounded or unserializable structures.
const dataPayloadSchema = z
  .record(z.union([z.string(), z.number(), z.boolean()]))
  .refine((data) => JSON.stringify(data).length <= MAX_DATA_PAYLOAD_BYTES, {
    message: `data payload exceeds ${MAX_DATA_PAYLOAD_BYTES} bytes`,
  })
  .optional();

const androidOptionsSchema = z
  .object({
    ttlSeconds: z.number().int().positive().max(2_419_200).optional(), // FCM max TTL is 4 weeks
    collapseKey: z.string().min(1).max(255).optional(),
  })
  .strict()
  .optional();

const hasNotificationOrData = (value: {
  notification?: { title?: string; body?: string };
  data?: Record<string, unknown>;
}): boolean =>
  Boolean(value.notification?.title) ||
  Boolean(value.notification?.body) ||
  Boolean(value.data && Object.keys(value.data).length > 0);

const NOTIFICATION_OR_DATA_MESSAGE =
  'At least one of notification.title, notification.body, or a non-empty data object is required';

export const sendMessageBodySchema = z
  .object({
    notification: notificationContentSchema,
    data: dataPayloadSchema,
    android: androidOptionsSchema,
  })
  .strict()
  .refine(hasNotificationOrData, { message: NOTIFICATION_OR_DATA_MESSAGE });

export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;

export const sendToDeviceBodySchema = z
  .object({
    token: z.string().min(1).max(4096),
    notification: notificationContentSchema,
    data: dataPayloadSchema,
    android: androidOptionsSchema,
  })
  .strict()
  .refine(hasNotificationOrData, { message: NOTIFICATION_OR_DATA_MESSAGE });

export const userIdParamSchema = z.object({
  userId: z.string().min(1).max(255),
});

// Matches FCM topic naming rules: [a-zA-Z0-9-_.~%]{1,900}
const TOPIC_PATTERN = /^[a-zA-Z0-9-_.~%]{1,900}$/;

export const topicParamSchema = z.object({
  topic: z.string().regex(TOPIC_PATTERN, 'Invalid or unsafe topic name'),
});

export const notificationIdParamSchema = z.object({
  notificationId: z.string().uuid('notificationId must be a valid UUID'),
});
