import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createMockPrisma } from '../helpers/mock-prisma';

const mockPrisma = createMockPrisma();
let firebaseReady = true;

vi.mock('../../src/config/database', () => ({
  prisma: mockPrisma,
  checkDatabaseReady: vi.fn(async () => {
    try {
      await mockPrisma.$queryRaw();
      return true;
    } catch {
      return false;
    }
  }),
  disconnectDatabase: vi.fn(),
}));

vi.mock('../../src/config/firebase', () => ({
  initializeFirebase: vi.fn(),
  isFirebaseReady: vi.fn(() => firebaseReady),
  getFirebaseMessaging: vi.fn(),
}));

describe('health endpoints', () => {
  beforeEach(() => {
    firebaseReady = true;
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  });

  it('GET /health returns 200 without touching dependencies', async () => {
    const { createApp } = await import('../../src/app');
    const response = await request(createApp()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /ready returns 200 when database and firebase are ready', async () => {
    const { createApp } = await import('../../src/app');
    const response = await request(createApp()).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body.checks).toEqual({ database: 'ok', firebase: 'ok' });
  });

  it('GET /ready returns 503 when firebase is not ready', async () => {
    firebaseReady = false;
    const { createApp } = await import('../../src/app');
    const response = await request(createApp()).get('/ready');
    expect(response.status).toBe(503);
    expect(response.body.checks.firebase).toBe('unavailable');
  });
});
