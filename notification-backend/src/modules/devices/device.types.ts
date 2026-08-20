import type { DeviceToken } from '@prisma/client';

export interface DeviceTokenView {
  id: string;
  deviceId: string | null;
  deviceName: string | null;
  appVersion: string | null;
  notificationsEnabled: boolean;
  active: boolean;
  maskedToken: string;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
}

export interface RegisterDeviceInput {
  userId: string;
  token: string;
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
  notificationsEnabled?: boolean;
}

export interface RegisterDeviceResult {
  device: DeviceToken;
  created: boolean;
}
