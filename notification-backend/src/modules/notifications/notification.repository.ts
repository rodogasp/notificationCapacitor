import type {
  Notification,
  NotificationDelivery,
  NotificationTargetType,
  PrismaClient,
} from '@prisma/client';

export interface CreateNotificationInput {
  requestedBy: string;
  targetType: NotificationTargetType;
  targetValue: string;
  title?: string;
  body?: string;
  data: Record<string, unknown>;
  idempotencyKey?: string;
  requestHash?: string;
}

export interface RecordDeliveryInput {
  notificationId: string;
  deviceTokenId?: string;
  fcmMessageId?: string;
  status: 'SUCCESS' | 'FAILED';
  errorCode?: string;
  errorMessage?: string;
}

export type NotificationWithDeliveries = Notification & { deliveries: NotificationDelivery[] };

export class NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByIdempotencyKey(idempotencyKey: string): Promise<NotificationWithDeliveries | null> {
    return this.prisma.notification.findUnique({
      where: { idempotencyKey },
      include: { deliveries: true },
    });
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    return this.prisma.notification.create({
      data: {
        requestedBy: input.requestedBy,
        targetType: input.targetType,
        targetValue: input.targetValue,
        title: input.title,
        body: input.body,
        data: input.data as never,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        status: 'PENDING',
      },
    });
  }

  async recordDeliveries(inputs: RecordDeliveryInput[]): Promise<void> {
    if (inputs.length === 0) {
      return;
    }
    await this.prisma.notificationDelivery.createMany({
      data: inputs.map((input) => ({
        notificationId: input.notificationId,
        deviceTokenId: input.deviceTokenId,
        fcmMessageId: input.fcmMessageId,
        status: input.status,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      })),
    });
  }

  async completeNotification(
    notificationId: string,
    result: { successCount: number; failureCount: number; failureReason?: string },
  ): Promise<Notification> {
    const status =
      result.failureCount === 0 && result.successCount > 0
        ? 'SENT'
        : result.successCount > 0
          ? 'PARTIAL'
          : 'FAILED';

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status,
        successCount: result.successCount,
        failureCount: result.failureCount,
        failureReason: result.failureReason,
        sentAt: new Date(),
      },
    });
  }

  async findByIdWithDeliveries(notificationId: string): Promise<NotificationWithDeliveries | null> {
    return this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { deliveries: true },
    });
  }

  async listRecent(limit: number): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
