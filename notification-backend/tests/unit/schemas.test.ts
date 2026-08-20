import { describe, expect, it } from 'vitest';
import { registerDeviceSchema } from '../../src/modules/devices/device.schemas';
import {
  sendMessageBodySchema,
  sendToDeviceBodySchema,
  topicParamSchema,
} from '../../src/modules/notifications/notification.schemas';

describe('registerDeviceSchema', () => {
  it('accepts a valid payload', () => {
    const result = registerDeviceSchema.parse({
      token: 'fcm-token',
      deviceId: 'device-1',
      deviceName: 'Pixel 9',
      appVersion: '1.0.0',
      notificationsEnabled: true,
    });
    expect(result.token).toBe('fcm-token');
  });

  it('rejects unknown fields', () => {
    expect(() => registerDeviceSchema.parse({ token: 'fcm-token', extra: 'nope' })).toThrow();
  });

  it('rejects a missing token', () => {
    expect(() => registerDeviceSchema.parse({})).toThrow();
  });
});

describe('sendMessageBodySchema', () => {
  it('requires at least a notification title/body or data', () => {
    expect(() => sendMessageBodySchema.parse({})).toThrow();
  });

  it('accepts a notification-only payload', () => {
    const result = sendMessageBodySchema.parse({ notification: { title: 'Hi' } });
    expect(result.notification?.title).toBe('Hi');
  });

  it('accepts a data-only payload', () => {
    const result = sendMessageBodySchema.parse({ data: { type: 'TEST' } });
    expect(result.data).toEqual({ type: 'TEST' });
  });

  it('rejects nested objects inside data', () => {
    expect(() => sendMessageBodySchema.parse({ data: { nested: { a: 1 } } })).toThrow();
  });

  it('rejects unknown top-level fields', () => {
    expect(() =>
      sendMessageBodySchema.parse({ data: { type: 'TEST' }, unexpected: true }),
    ).toThrow();
  });
});

describe('sendToDeviceBodySchema', () => {
  it('requires a token', () => {
    expect(() => sendToDeviceBodySchema.parse({ notification: { title: 'Hi' } })).toThrow();
  });

  it('accepts a valid device send payload', () => {
    const result = sendToDeviceBodySchema.parse({
      token: 'fcm-token',
      notification: { title: 'Hi' },
    });
    expect(result.token).toBe('fcm-token');
  });
});

describe('topicParamSchema', () => {
  it('accepts safe topic names', () => {
    expect(() => topicParamSchema.parse({ topic: 'news-updates_v1.0' })).not.toThrow();
  });

  it('rejects unsafe topic names', () => {
    expect(() => topicParamSchema.parse({ topic: 'invalid topic!' })).toThrow();
    expect(() => topicParamSchema.parse({ topic: '../etc/passwd' })).toThrow();
  });
});
