import { describe, expect, it, vi } from 'vitest';
import { DeviceService } from '../../src/modules/devices/device.service';
import type { DeviceRepository } from '../../src/modules/devices/device.repository';

function buildDevice(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'device-id-1',
    userId: 'user-1',
    token: 'abcdefghijklmnopqrstuvwxyz',
    platform: 'ANDROID',
    deviceId: 'device-1',
    deviceName: 'Pixel',
    appVersion: '1.0.0',
    notificationsEnabled: true,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSeenAt: new Date(),
    invalidatedAt: null,
    invalidationReason: null,
    ...overrides,
  };
}

describe('DeviceService', () => {
  it('registers a device and reports creation', async () => {
    const repository = {
      upsertForUser: vi.fn().mockResolvedValue({ device: buildDevice(), created: true }),
    } as unknown as DeviceRepository;
    const service = new DeviceService(repository);

    const result = await service.registerDevice({ userId: 'user-1', token: 'abc' });

    expect(result.created).toBe(true);
    expect(repository.upsertForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', token: 'abc', notificationsEnabled: true }),
    );
  });

  it('masks tokens when listing devices', async () => {
    const repository = {
      listActiveForUser: vi.fn().mockResolvedValue([buildDevice()]),
    } as unknown as DeviceRepository;
    const service = new DeviceService(repository);

    const views = await service.listDevicesForUser('user-1');

    expect(views).toHaveLength(1);
    expect(views[0].maskedToken).not.toBe(buildDevice().token);
    expect(views[0].maskedToken).toContain('...');
    expect((views[0] as unknown as { token?: string }).token).toBeUndefined();
  });

  it('throws NOT_FOUND when unregistering a token the user does not own', async () => {
    const repository = {
      deactivateOwnedByUser: vi.fn().mockResolvedValue(false),
    } as unknown as DeviceRepository;
    const service = new DeviceService(repository);

    await expect(service.unregisterDevice('user-1', 'someone-elses-token')).rejects.toThrow(
      /not found/i,
    );
  });

  it('succeeds when unregistering an owned token', async () => {
    const repository = {
      deactivateOwnedByUser: vi.fn().mockResolvedValue(true),
    } as unknown as DeviceRepository;
    const service = new DeviceService(repository);

    await expect(service.unregisterDevice('user-1', 'my-token')).resolves.toBeUndefined();
  });
});
