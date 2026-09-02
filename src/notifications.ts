import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type Channel } from '@capacitor/local-notifications';
import {
  PushNotifications,
  type PushNotificationSchema,
  type Token,
} from '@capacitor/push-notifications';
import { APP_CONFIG } from './config';
import { CallNotificationSettings } from './call-notification-settings';
import type { AppLogger } from './logger';

export interface NotificationController {
  initialize(onToken: (token: string) => void, log: AppLogger): Promise<boolean>;
  sendLocalTest(log: AppLogger): Promise<void>;
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

export function createNotificationController(): NotificationController {
  return {
    async initialize(onToken, log) {
      log.info('=== FCM initialization started ===');
      log.debug('Platform info', {
        platform: Capacitor.getPlatform(),
        isNativePlatform: Capacitor.isNativePlatform(),
        userAgent: navigator.userAgent,
      });

      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        log.warn('Native Android Capacitor app is required for FCM registration. Aborting.');
        return false;
      }

      try {
        const t0 = performance.now();

        const pushPermission = await PushNotifications.checkPermissions();
        log.debug('Push permission check result', pushPermission);
        const requestedPushPermission = pushPermission.receive === 'prompt'
          ? await PushNotifications.requestPermissions()
          : pushPermission;
        log.info(`Push permission: ${requestedPushPermission.receive}`);
        if (requestedPushPermission.receive !== 'granted') {
          log.warn('Push permission denied. Initialization stopped.', requestedPushPermission);
          return false;
        }

        const localPermission = await LocalNotifications.checkPermissions();
        log.debug('Local notification permission check result', localPermission);
        const requestedLocalPermission = localPermission.display === 'prompt'
          ? await LocalNotifications.requestPermissions()
          : localPermission;
        log.info(`Local notification permission: ${requestedLocalPermission.display}`);
        if (requestedLocalPermission.display !== 'granted') {
          log.warn('Local notification permission denied.', requestedLocalPermission);
          return false;
        }

        const channelConfig: Channel = {
          id: APP_CONFIG.channelId,
          name: APP_CONFIG.channelName,
          description: 'FCM test notifications',
          importance: 5,
          visibility: 1,
          sound: 'default',
        };
        log.debug('Creating Android notification channel', channelConfig);
        await LocalNotifications.createChannel(channelConfig);
        log.info(`Android notification channel ready: ${APP_CONFIG.channelId}`);

        if (!listenersInstalled) {
          log.debug('Installing push/local notification listeners...');
          listenerHandles = await Promise.all([
            PushNotifications.addListener('registration', (token: Token) => {
              log.info(`FCM registration event received (token length ${token.value.length})`);
              log.debug('FCM token prefix/suffix', {
                prefix: token.value.slice(0, 8),
                suffix: token.value.slice(-6),
              });
              onToken(token.value);
            }),
            PushNotifications.addListener('registrationError', (error) => {
              log.error('FCM registration error event', error);
            }),
            PushNotifications.addListener('pushNotificationReceived', async (push) => {
              log.info('Foreground push notification received');
              log.debug('Full push payload (foreground)', push);
              log.debug('Push data payload', push.data || {});
              // Display is fully owned by the native MyFirebaseMessagingService (full-screen
              // CallStyle notification), which fires for this same message. Scheduling a second,
              // plain LocalNotifications entry here would show a duplicate/conflicting notification.
            }),
            PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
              log.info('Notification tapped/action performed');
              log.debug('Full notification action event', event);
            }),
          ]);
          listenersInstalled = true;
          log.info('Push notification listeners installed.', {
            listenerCount: listenerHandles.length,
          });
        } else {
          log.debug('Push notification listeners were already installed; skipping re-install.');
        }

        log.info('Calling PushNotifications.register()...');
        log.info('Deleting the previous FCM token before registration...');
        await CallNotificationSettings.deleteFcmToken();
        await PushNotifications.register();
        const elapsedMs = Math.round(performance.now() - t0);
        log.info(`=== FCM initialization completed in ${elapsedMs}ms ===`);
        return true;
      } catch (error) {
        log.error('Notification initialization error', error);
        return false;
      }
    },

    async sendLocalTest(log) {
      log.info('Scheduling local test notification (no network involved)...');
      try {
        const scheduled = {
          id: notificationId(),
          title: 'Local test',
          body: 'Local notifications are working.',
          channelId: APP_CONFIG.channelId,
          schedule: { at: new Date(Date.now() + 50) },
        };
        await LocalNotifications.schedule({ notifications: [scheduled] });
        log.info('Local test notification scheduled.', { id: scheduled.id });
      } catch (error) {
        log.error('Local test notification error', error);
      }
    },
  };
}

export async function removeNotificationListeners(): Promise<void> {
  await Promise.all(listenerHandles.map((handle) => handle.remove()));
  listenerHandles = [];
  listenersInstalled = false;
}
