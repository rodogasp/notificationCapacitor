import { Router } from 'express';
import { authenticate } from '../../middleware/authentication';
import { prisma } from '../../config/database';
import { DeviceRepository } from './device.repository';
import { DeviceService } from './device.service';
import { DeviceController } from './device.controller';

const deviceRepository = new DeviceRepository(prisma);
const deviceService = new DeviceService(deviceRepository);
export const deviceController = new DeviceController(deviceService);

export const deviceRouter = Router();

deviceRouter.use(authenticate);
deviceRouter.post('/', deviceController.register);
deviceRouter.get('/', deviceController.list);
deviceRouter.post('/unregister', deviceController.unregister);
deviceRouter.delete('/:token', deviceController.removeByPathParam);
