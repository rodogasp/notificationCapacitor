import { describe, expect, it } from 'vitest';
import {
  buildAndroidMessageContent,
  toStringDataPayload,
} from '../../src/modules/notifications/fcm-message-builder';

describe('toStringDataPayload', () => {
  it('converts every value to a string', () => {
    const result = toStringDataPayload({ orderId: 'order-123', count: 3, isUrgent: true });
    expect(result).toEqual({ orderId: 'order-123', count: '3', isUrgent: 'true' });
    for (const value of Object.values(result)) {
      expect(typeof value).toBe('string');
    }
  });
});

describe('buildAndroidMessageContent', () => {
  it('builds a message with the configured channel id and default sound', () => {
    const result = buildAndroidMessageContent(
      { title: 'Hi', body: 'There', data: { type: 'TEST' } },
      'orders_channel',
    );
    expect(result.notification).toEqual({ title: 'Hi', body: 'There' });
    expect(result.data).toEqual({ type: 'TEST' });
    expect(result.android.notification.channelId).toBe('orders_channel');
    expect(result.android.notification.sound).toBe('default');
    expect(result.android.priority).toBe('high');
  });

  it('omits the notification block for data-only messages', () => {
    const result = buildAndroidMessageContent({ data: { type: 'TEST' } }, 'default_channel');
    expect(result.notification).toBeUndefined();
  });

  it('converts ttlSeconds to milliseconds and forwards the collapse key', () => {
    const result = buildAndroidMessageContent(
      { title: 'Hi', androidTtlSeconds: 60, androidCollapseKey: 'promo' },
      'default_channel',
    );
    expect(result.android.ttl).toBe(60_000);
    expect(result.android.collapseKey).toBe('promo');
  });
});
