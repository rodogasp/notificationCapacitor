import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  PushNotifications,
  type PushNotificationSchema,
  type Token,
} from '@capacitor/push-notifications';
import { APP_CONFIG } from './config';
import type { LogWriter } from './logger';

export interface NotificationController {
  initialize(onToken: (token: string) => void, log: LogWriter): Promise<boolean>;
  sendLocalTest(log: LogWriter): Promise<void>;
}

let listenersInstalled = false;
let listenerHandles: Array<{ remove: () => Promise<void> }> = [];

export function notificationText(push: PushNotificationSchema): { title: string; body: string } {
  return {
    title: push.title || 'FCM Test',
    body: push.body || 'Push message received',
  };
}

function notificationId(): number {
  return Math.floor(Date.now() % 2147483000) || 1;
}

function readable(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function createNotificationController(): NotificationController {
  return {
    async initialize(onToken, log) {
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        log('Native Android Capacitor app is required for FCM registration.');
        return false;
      }
      try {
        const pushPermission = await PushNotifications.checkPermissions();
        log(`Notification permission status: ${pushPermission.receive}`);
        const requestedPushPermission = pushPermission.receive === 'prompt'
          ? await PushNotifications.requestPermissions()
          : pushPermission;
        log(`Push permission result: ${requestedPushPermission.receive}`);
        if (requestedPushPermission.receive !== 'granted') {
          log('Push permission denied. Initialization stopped.');
          return false;
        }

        const localPermission = await LocalNotifications.checkPermissions();
        log(`Local notification permission status: ${localPermission.display}`);
        const requestedLocalPermission = localPermission.display === 'prompt'
          ? await LocalNotifications.requestPermissions()
          : localPermission;
        log(`Local notification permission result: ${requestedLocalPermission.display}`);
        if (requestedLocalPermission.display !== 'granted') {
          log('Local notification permission denied.');
          return false;
        }

        await LocalNotifications.createChannel({
          id: APP_CONFIG.channelId,
          name: APP_CONFIG.channelName,
          description: 'FCM test notifications',
          importance: 5,
          visibility: 1,
          sound: 'default',
        });
        log(`Android notification channel ready: ${APP_CONFIG.channelId}`);

        if (!listenersInstalled) {
          listenerHandles = await Promise.all([
            PushNotifications.addListener('registration', (token: Token) => {
              log('FCM token received.');
              onToken(token.value);
            }),
            PushNotifications.addListener('registrationError', (error) => {
              log(`Registration error: ${readable(error)}`);
            }),
            PushNotifications.addListener('pushNotificationReceived', async (push) => {
              const { title, body } = notificationText(push);
              log(`Foreground FCM message received: ${readable(push)}`);
              log(`Push notification title: ${title}`);
              log(`Push notification body: ${body}`);
              log(`Push notification data: ${readable(push.data || {})}`);
              try {
                await LocalNotifications.schedule({
                  notifications: [{
                    id: notificationId(),
                    title,
                    body,
                    extra: push.data || {},
                    channelId: APP_CONFIG.channelId,
                    schedule: { at: new Date(Date.now() + 50) },
                  }],
                });
                log('Local notification scheduled for foreground FCM message.');
              } catch (error) {
                log(`Local notification scheduling error: ${String(error)}`);
              }
            }),
            PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
              log(`Notification clicked: ${readable(event)}`);
            }),
          ]);
          listenersInstalled = true;
          log('Push notification listeners installed.');
        } else {
          log('Push notification listeners already installed.');
        }

        log('Push registration started.');
        await PushNotifications.register();
        return true;
      } catch (error) {
        log(`Notification initialization error: ${String(error)}`);
        return false;
      }
    },

    async sendLocalTest(log) {
      try {
        await LocalNotifications.schedule({
          notifications: [{
            id: notificationId(),
            title: 'Local test',
            body: 'Local notifications are working.',
            channelId: APP_CONFIG.channelId,
            schedule: { at: new Date(Date.now() + 50) },
          }],
        });
        log('Local test notification scheduled. This did not contact Firebase or the backend.');
      } catch (error) {
        log(`Local test notification error: ${String(error)}`);
      }
    },
  };
}

export async function removeNotificationListeners(): Promise<void> {
  await Promise.all(listenerHandles.map((handle) => handle.remove()));
  listenerHandles = [];
  listenersInstalled = false;
}
