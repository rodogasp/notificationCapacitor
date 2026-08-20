import { describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../../src/modules/notifications/notification.service';
import type { NotificationRepository } from '../../src/modules/notifications/notification.repository';
import type { DeviceRepository } from '../../src/modules/devices/device.repository';
import type { NotificationDispatcher } from '../../src/modules/notifications/notification-dispatcher';

function buildNotification(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'notif-1',
    requestedBy: 'admin-1',
    targetType: 'USER',
    targetValue: 'user-1',
    title: 'Hi',
    body: null,
    data: {},
    status: 'PENDING',
    successCount: 0,
    failureCount: 0,
    idempotencyKey: null,
    requestHash: null,
    createdAt: new Date(),
    sentAt: null,
    failureReason: null,
    ...overrides,
  };
}

describe('NotificationService.sendToUser', () => {
  it('returns a useful response when the user has no active devices', async () => {
    const notificationRepository = {
      findByIdempotencyKey: vi.fn(),
      create: vi.fn().mockResolvedValue(buildNotification()),
      completeNotification: vi.fn().mockResolvedValue(buildNotification({ status: 'FAILED' })),
      recordDeliveries: vi.fn(),
    } as unknown as NotificationRepository;
    const deviceRepository = {
      listSendableForUser: vi.fn().mockResolvedValue([]),
    } as unknown as DeviceRepository;
    const dispatcher = {
      sendToTokens: vi.fn(),
      sendToTopic: vi.fn(),
    } as unknown as NotificationDispatcher;

    const service = new NotificationService(notificationRepository, deviceRepository, dispatcher);
    const result = await service.sendToUser('admin-1', 'user-1', { title: 'Hi' });

    expect(result.totalTargets).toBe(0);
    expect(result.message).toMatch(/no active/i);
    expect(dispatcher.sendToTokens).not.toHaveBeenCalled();
  });

  it('batches all sendable devices to the dispatcher and reports success/failure counts', async () => {
    const devices = [
      { id: 'd1', token: 't1' },
      { id: 'd2', token: 't2' },
    ];
    const notificationRepository = {
      findByIdempotencyKey: vi.fn(),
      create: vi.fn().mockResolvedValue(buildNotification()),
      completeNotification: vi.fn().mockResolvedValue(buildNotification({ status: 'PARTIAL' })),
      recordDeliveries: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationRepository;
    const deviceRepository = {
      listSendableForUser: vi.fn().mockResolvedValue(devices),
      deactivateById: vi.fn().mockResolvedValue(undefined),
    } as unknown as DeviceRepository;
    const dispatcher = {
      sendToTokens: vi.fn().mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        results: [
          { deviceTokenId: 'd1', token: 't1', success: true, messageId: 'msg-1' },
          {
            deviceTokenId: 'd2',
            token: 't2',
            success: false,
            errorCode: 'messaging/registration-token-not-registered',
            errorMessage: 'gone',
            permanentFailure: true,
          },
        ],
      }),
      sendToTopic: vi.fn(),
    } as unknown as NotificationDispatcher;

    const service = new NotificationService(notificationRepository, deviceRepository, dispatcher);
    const result = await service.sendToUser('admin-1', 'user-1', { title: 'Hi' });

    expect(dispatcher.sendToTokens).toHaveBeenCalledWith(
      [
        { deviceTokenId: 'd1', token: 't1' },
        { deviceTokenId: 'd2', token: 't2' },
      ],
      expect.objectContaining({ title: 'Hi' }),
    );
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    // Permanently-failed token must be deactivated automatically.
    expect(deviceRepository.deactivateById).toHaveBeenCalledWith(
      'd2',
      expect.stringContaining('FCM_'),
    );
  });

  it('does not deactivate tokens for transient failures', async () => {
    const notificationRepository = {
      findByIdempotencyKey: vi.fn(),
      create: vi.fn().mockResolvedValue(buildNotification()),
      completeNotification: vi.fn().mockResolvedValue(buildNotification()),
      recordDeliveries: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationRepository;
    const deviceRepository = {
      listSendableForUser: vi.fn().mockResolvedValue([{ id: 'd1', token: 't1' }]),
      deactivateById: vi.fn(),
    } as unknown as DeviceRepository;
    const dispatcher = {
      sendToTokens: vi.fn().mockResolvedValue({
        successCount: 0,
        failureCount: 1,
        results: [
          {
            deviceTokenId: 'd1',
            token: 't1',
            success: false,
            errorCode: 'messaging/server-unavailable',
            permanentFailure: false,
          },
        ],
      }),
      sendToTopic: vi.fn(),
    } as unknown as NotificationDispatcher;

    const service = new NotificationService(notificationRepository, deviceRepository, dispatcher);
    await service.sendToUser('admin-1', 'user-1', { title: 'Hi' });

    expect(deviceRepository.deactivateById).not.toHaveBeenCalled();
  });

  it('returns the stored result for a repeated idempotency key with the same body', async () => {
    const existing = buildNotification({
      idempotencyKey: 'key-1',
      requestHash: undefined,
      status: 'SENT',
      successCount: 1,
      failureCount: 0,
    });
    const notificationRepository = {
      findByIdempotencyKey: vi.fn().mockResolvedValue({ ...existing, deliveries: [{}] }),
      create: vi.fn(),
      completeNotification: vi.fn(),
      recordDeliveries: vi.fn(),
    } as unknown as NotificationRepository;
    const deviceRepository = { listSendableForUser: vi.fn() } as unknown as DeviceRepository;
    const dispatcher = {
      sendToTokens: vi.fn(),
      sendToTopic: vi.fn(),
    } as unknown as NotificationDispatcher;

    // Compute the hash the same way the service does by first performing a real call.
    const realRepo = {
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async (input) => buildNotification({ ...input })),
      completeNotification: vi.fn().mockResolvedValue(buildNotification()),
      recordDeliveries: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationRepository;
    const realDeviceRepo = {
      listSendableForUser: vi.fn().mockResolvedValue([]),
    } as unknown as DeviceRepository;
    const primingService = new NotificationService(realRepo, realDeviceRepo, dispatcher);
    await primingService.sendToUser('admin-1', 'user-1', { title: 'Hi' }, 'key-1');
    const requestHash = (realRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0].requestHash;

    notificationRepository.findByIdempotencyKey = vi
      .fn()
      .mockResolvedValue({ ...existing, requestHash, deliveries: [{}] });

    const service = new NotificationService(notificationRepository, deviceRepository, dispatcher);
    const result = await service.sendToUser('admin-1', 'user-1', { title: 'Hi' }, 'key-1');

    expect(result.notificationId).toBe(existing.id);
    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it('rejects reuse of the same idempotency key with a different request body', async () => {
    const existing = buildNotification({ idempotencyKey: 'key-1', requestHash: 'different-hash' });
    const notificationRepository = {
      findByIdempotencyKey: vi.fn().mockResolvedValue({ ...existing, deliveries: [] }),
      create: vi.fn(),
      completeNotification: vi.fn(),
      recordDeliveries: vi.fn(),
    } as unknown as NotificationRepository;
    const deviceRepository = { listSendableForUser: vi.fn() } as unknown as DeviceRepository;
    const dispatcher = {
      sendToTokens: vi.fn(),
      sendToTopic: vi.fn(),
    } as unknown as NotificationDispatcher;

    const service = new NotificationService(notificationRepository, deviceRepository, dispatcher);

    await expect(
      service.sendToUser('admin-1', 'user-1', { title: 'Different title' }, 'key-1'),
    ).rejects.toThrow(/idempotency/i);
  });
});
