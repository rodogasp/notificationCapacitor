import { z } from 'zod';

export const registerDeviceSchema = z
  .object({
    token: z.string().min(1).max(4096),
    deviceId: z.string().min(1).max(255).optional(),
    deviceName: z.string().min(1).max(255).optional(),
    appVersion: z.string().min(1).max(50).optional(),
    notificationsEnabled: z.boolean().optional().default(true),
  })
  .strict();

export type RegisterDeviceBody = z.infer<typeof registerDeviceSchema>;

export const tokenParamSchema = z
  .object({
    token: z.string().min(1).max(4096),
  })
  .strict();

export const unregisterDeviceBodySchema = z
  .object({
    token: z.string().min(1).max(4096),
  })
  .strict();
