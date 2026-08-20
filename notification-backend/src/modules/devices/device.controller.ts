import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors';
import { asyncHandler } from '../../middleware/error-handler';
import type { DeviceService } from './device.service';
import { registerDeviceSchema, unregisterDeviceBodySchema } from './device.schemas';

export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  register = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const body = registerDeviceSchema.parse(req.body);
    const userId = requireUserId(req);

    const { device, created } = await this.deviceService.registerDevice({
      userId,
      token: body.token,
      deviceId: body.deviceId,
      deviceName: body.deviceName,
      appVersion: body.appVersion,
      notificationsEnabled: body.notificationsEnabled,
    });

    res.status(created ? 201 : 200).json({
      id: device.id,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      appVersion: device.appVersion,
      notificationsEnabled: device.notificationsEnabled,
      active: device.active,
      lastSeenAt: device.lastSeenAt,
    });
  });

  list = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const userId = requireUserId(req);
    const devices = await this.deviceService.listDevicesForUser(userId);
    res.status(200).json({ devices });
  });

  /**
   * FCM tokens may contain characters (e.g. "/") that are unsafe as raw URL
   * path segments even when percent-encoded by some clients, so the
   * preferred integration is POST /api/v1/devices/unregister with a JSON
   * body. This path-param variant remains for convenience and expects the
   * token to be percent-encoded by the caller.
   */
  removeByPathParam = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const userId = requireUserId(req);
    const token = decodeURIComponent(req.params.token ?? '');
    if (!token) {
      throw AppError.validation('Token path parameter is required');
    }
    await this.deviceService.unregisterDevice(userId, token);
    res.status(204).send();
  });

  unregister = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const userId = requireUserId(req);
    const body = unregisterDeviceBodySchema.parse(req.body);
    await this.deviceService.unregisterDevice(userId, body.token);
    res.status(204).send();
  });
}

function requireUserId(req: Request): string {
  if (!req.user) {
    throw AppError.unauthorized();
  }
  return req.user.userId;
}
