import type { DeviceToken, PrismaClient } from '@prisma/client';

export class DeviceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByToken(token: string): Promise<DeviceToken | null> {
    return this.prisma.deviceToken.findUnique({ where: { token } });
  }

  async upsertForUser(params: {
    userId: string;
    token: string;
    deviceId?: string;
    deviceName?: string;
    appVersion?: string;
    notificationsEnabled: boolean;
  }): Promise<{ device: DeviceToken; created: boolean }> {
    const existing = await this.prisma.deviceToken.findUnique({ where: { token: params.token } });

    const device = await this.prisma.deviceToken.upsert({
      where: { token: params.token },
      create: {
        userId: params.userId,
        token: params.token,
        deviceId: params.deviceId,
        deviceName: params.deviceName,
        appVersion: params.appVersion,
        notificationsEnabled: params.notificationsEnabled,
        active: true,
        lastSeenAt: new Date(),
      },
      update: {
        // Reassign safely if the token now belongs to a different authenticated account.
        userId: params.userId,
        deviceId: params.deviceId,
        deviceName: params.deviceName,
        appVersion: params.appVersion,
        notificationsEnabled: params.notificationsEnabled,
        active: true,
        invalidatedAt: null,
        invalidationReason: null,
        lastSeenAt: new Date(),
      },
    });

    return { device, created: existing === null };
  }

  async listActiveForUser(userId: string): Promise<DeviceToken[]> {
    return this.prisma.deviceToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listSendableForUser(userId: string): Promise<DeviceToken[]> {
    return this.prisma.deviceToken.findMany({
      where: { userId, active: true, notificationsEnabled: true },
    });
  }

  async deactivateOwnedByUser(userId: string, token: string, reason: string): Promise<boolean> {
    const result = await this.prisma.deviceToken.updateMany({
      where: { userId, token, active: true },
      data: { active: false, invalidatedAt: new Date(), invalidationReason: reason },
    });
    return result.count > 0;
  }

  async deactivateById(id: string, reason: string): Promise<void> {
    await this.prisma.deviceToken.update({
      where: { id },
      data: { active: false, invalidatedAt: new Date(), invalidationReason: reason },
    });
  }
}
