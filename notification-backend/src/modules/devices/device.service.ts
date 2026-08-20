import type { DeviceToken } from '@prisma/client';
import { AppError } from '../../shared/errors';
import { maskToken } from '../../shared/utils';
import type { DeviceRepository } from './device.repository';
import type { DeviceTokenView, RegisterDeviceInput, RegisterDeviceResult } from './device.types';

export class DeviceService {
  constructor(private readonly deviceRepository: DeviceRepository) {}

  async registerDevice(input: RegisterDeviceInput): Promise<RegisterDeviceResult> {
    const { device, created } = await this.deviceRepository.upsertForUser({
      userId: input.userId,
      token: input.token,
      deviceId: input.deviceId,
      deviceName: input.deviceName,
      appVersion: input.appVersion,
      notificationsEnabled: input.notificationsEnabled ?? true,
    });
    return { device, created };
  }

  async listDevicesForUser(userId: string): Promise<DeviceTokenView[]> {
    const devices = await this.deviceRepository.listActiveForUser(userId);
    return devices.map(toView);
  }

  async unregisterDevice(userId: string, token: string): Promise<void> {
    const deactivated = await this.deviceRepository.deactivateOwnedByUser(
      userId,
      token,
      'USER_REQUESTED_REMOVAL',
    );
    if (!deactivated) {
      throw AppError.notFound('Device token not found for this user');
    }
  }
}

function toView(device: DeviceToken): DeviceTokenView {
  return {
    id: device.id,
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    appVersion: device.appVersion,
    notificationsEnabled: device.notificationsEnabled,
    active: device.active,
    maskedToken: maskToken(device.token),
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
    lastSeenAt: device.lastSeenAt,
  };
}
