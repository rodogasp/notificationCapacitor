/**
 * Optional local development seed. Safe to run repeatedly (upserts only).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const device = await prisma.deviceToken.upsert({
    where: { token: 'seed-dev-token-0000000000000000000000000000000000000000' },
    update: {},
    create: {
      userId: 'seed-user-1',
      token: 'seed-dev-token-0000000000000000000000000000000000000000',
      platform: 'ANDROID',
      deviceId: 'seed-device-1',
      deviceName: 'Seed Pixel',
      appVersion: '1.0.0',
      notificationsEnabled: true,
      active: true,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded device token: ${device.id}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
