import { vi } from 'vitest';

/**
 * Minimal Prisma client double covering only the methods exercised by the
 * device/notification repositories in integration tests.
 */
export function createMockPrisma() {
  return {
    deviceToken: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    notificationDelivery: {
      createMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $disconnect: vi.fn(),
  };
}
