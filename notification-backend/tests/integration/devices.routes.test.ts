import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createMockPrisma } from '../helpers/mock-prisma';
import { signTestToken } from '../helpers/jwt';

const mockPrisma = createMockPrisma();

vi.mock('../../src/config/database', () => ({
  prisma: mockPrisma,
  checkDatabaseReady: vi.fn(async () => true),
  disconnectDatabase: vi.fn(),
}));

vi.mock('../../src/config/firebase', () => ({
  initializeFirebase: vi.fn(),
  isFirebaseReady: vi.fn(() => true),
  getFirebaseMessaging: vi.fn(),
}));

function buildDeviceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'device-id-1',
    userId: 'user-1',
    token: 'fcm-registration-token-value',
    platform: 'ANDROID',
    deviceId: 'android-device-id',
    deviceName: 'Pixel 9',
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

describe('POST /api/v1/devices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without a bearer token with 401', async () => {
    const { createApp } = await import('../../src/app');
    const response = await request(createApp()).post('/api/v1/devices').send({ token: 'abc' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(response.body.error.requestId).toBeTruthy();
  });

  it('registers a new device and returns 201', async () => {
    mockPrisma.deviceToken.findUnique.mockResolvedValue(null);
    mockPrisma.deviceToken.upsert.mockResolvedValue(buildDeviceRow());

    const { createApp } = await import('../../src/app');
    const token = signTestToken({ userId: 'user-1' });

    const response = await request(createApp())
      .post('/api/v1/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        token: 'fcm-registration-token-value',
        deviceId: 'android-device-id',
        deviceName: 'Pixel 9',
        appVersion: '1.0.0',
        notificationsEnabled: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe('device-id-1');
  });

  it('returns 200 when the device already existed', async () => {
    mockPrisma.deviceToken.findUnique.mockResolvedValue(buildDeviceRow());
    mockPrisma.deviceToken.upsert.mockResolvedValue(buildDeviceRow());

    const { createApp } = await import('../../src/app');
    const token = signTestToken({ userId: 'user-1' });

    const response = await request(createApp())
      .post('/api/v1/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'fcm-registration-token-value' });

    expect(response.status).toBe(200);
  });

  it('rejects an invalid payload with 400 and the standard error envelope', async () => {
    const { createApp } = await import('../../src/app');
    const token = signTestToken({ userId: 'user-1' });

    const response = await request(createApp())
      .post('/api/v1/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({ notAToken: true });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.error.details)).toBe(true);
  });
});

describe('GET /api/v1/devices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only masked tokens for the authenticated user', async () => {
    mockPrisma.deviceToken.findMany.mockResolvedValue([buildDeviceRow()]);
    const { createApp } = await import('../../src/app');
    const token = signTestToken({ userId: 'user-1' });

    const response = await request(createApp())
      .get('/api/v1/devices')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.devices).toHaveLength(1);
    expect(response.body.devices[0].maskedToken).not.toBe(buildDeviceRow().token);
    expect(JSON.stringify(response.body)).not.toContain(buildDeviceRow().token);
  });
});
