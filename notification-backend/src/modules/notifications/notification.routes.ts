import { Router } from 'express';
import { authenticate } from '../../middleware/authentication';
import { requireNotificationRole } from '../../middleware/authorization';
import { prisma } from '../../config/database';
import { DeviceRepository } from '../devices/device.repository';
import { NotificationRepository } from './notification.repository';
import { FirebaseNotificationDispatcher } from './firebase-notification-dispatcher';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

const notificationRepository = new NotificationRepository(prisma);
const deviceRepository = new DeviceRepository(prisma);
const dispatcher = new FirebaseNotificationDispatcher();
const notificationService = new NotificationService(
  notificationRepository,
  deviceRepository,
  dispatcher,
);
export const notificationController = new NotificationController(notificationService);

export const notificationRouter = Router();

notificationRouter.use(authenticate, requireNotificationRole);
notificationRouter.post('/users/:userId', notificationController.sendToUser);
notificationRouter.post('/devices', notificationController.sendToDevice);
notificationRouter.post('/topics/:topic', notificationController.sendToTopic);
notificationRouter.get('/:notificationId', notificationController.getNotification);
