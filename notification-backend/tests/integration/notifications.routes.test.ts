import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createMockPrisma } from '../helpers/mock-prisma';
import { signTestToken } from '../helpers/jwt';

const mockPrisma = createMockPrisma();
const mockMessaging = {
  sendEachForMulticast: vi.fn(),
  send: vi.fn(),
};

vi.mock('../../src/config/database', () => ({
  prisma: mockPrisma,
  checkDatabaseReady: vi.fn(async () => true),
  disconnectDatabase: vi.fn(),
}));

vi.mock('../../src/config/firebase', () => ({
  initializeFirebase: vi.fn(),
  isFirebaseReady: vi.fn(() => true),
  getFirebaseMessaging: vi.fn(() => mockMessaging),
}));

function buildNotificationRow(overrides: Partial<Record<string, unknown>> = {}) {
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
    requestHash: 'hash',
    createdAt: new Date(),
    sentAt: null,
    failureReason: null,
    ...overrides,
  };
}

describe('POST /api/v1/notifications/users/:userId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const { createApp } = await import('../../src/app');
    const response = await request(createApp())
      .post('/api/v1/notifications/users/user-1')
      .send({ notification: { title: 'Hi' } });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects authenticated users without the notification role with 403', async () => {
    const { createApp } = await import('../../src/app');
    const token = signTestToken({ userId: 'user-x', roles: [] });

    const response = await request(createApp())
      .post('/api/v1/notifications/users/user-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ notification: { title: 'Hi' } });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('sends to all active devices and returns success/failure counts', async () => {
    mockPrisma.notification.findUnique.mockResolvedValue(null);
    mockPrisma.notification.create.mockResolvedValue(buildNotificationRow());
    mockPrisma.notification.update.mockResolvedValue(buildNotificationRow({ status: 'SENT' }));
    mockPrisma.notificationDelivery.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.deviceToken.findMany.mockResolvedValue([
      { id: 'd1', token: 't1', userId: 'user-1', active: true, notificationsEnabled: true },
    ]);
    mockMessaging.sendEachForMulticast.mockResolvedValue({
      responses: [{ success: true, messageId: 'msg-1' }],
    });

    const { createApp } = await import('../../src/app');
    const token = signTestToken({ userId: 'admin-1', roles: ['notification:send'] });

    const response = await request(createApp())
      .post('/api/v1/notifications/users/user-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ notification: { title: 'Order updated', body: 'Your order is ready' } });

    expect(response.status).toBe(200);
    expect(response.body.successCount).toBe(1);
    expect(response.body.failureCount).toBe(0);
    expect(response.body.notificationId).toBe('notif-1');
  });

  it('returns a useful response when the user has no active devices', async () => {
    mockPrisma.notification.findUnique.mockResolvedValue(null);
    mockPrisma.notification.create.mockResolvedValue(buildNotificationRow());
    mockPrisma.notification.update.mockResolvedValue(buildNotificationRow({ status: 'FAILED' }));
    mockPrisma.deviceToken.findMany.mockResolvedValue([]);

    const { createApp } = await import('../../src/app');
    const token = signTestToken({ userId: 'admin-1', roles: ['notification:send'] });

    const response = await request(createApp())
      .post('/api/v1/notifications/users/user-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ notification: { title: 'Hi' } });

    expect(response.status).toBe(200);
    expect(response.body.totalTargets).toBe(0);
    expect(response.body.message).toMatch(/no active/i);
  });
});

describe('error response consistency', () => {
  it('uses the standard error envelope for 404s', async () => {
    const { createApp } = await import('../../src/app');
    const response = await request(createApp()).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error.code', 'NOT_FOUND');
    expect(response.body).toHaveProperty('error.requestId');
  });
});
