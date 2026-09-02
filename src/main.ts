import { Capacitor } from '@capacitor/core';
import { APP_CONFIG, DEV_TEST_BEARER_TOKEN, STORAGE_KEYS } from './config';
import { registerDevice } from './backend-client';
import { CallNotificationSettings, type CallVibration } from './call-notification-settings';
import { createLogger } from './logger';
import { createNotificationController } from './notifications';
import { WebSocketMonitor } from './websocket-monitor';
import './style.css';

const tokenInput = document.querySelector<HTMLInputElement>('#fcm-token')!;
const backendUrlInput = document.querySelector<HTMLInputElement>('#backend-url')!;
const bearerTokenInput = document.querySelector<HTMLInputElement>('#bearer-token')!;
const status = document.querySelector<HTMLElement>('#status')!;
const logArea = document.querySelector<HTMLTextAreaElement>('#logs')!;
const callSettings = document.querySelector<HTMLElement>('#call-settings')!;
const callVibration = document.querySelector<HTMLSelectElement>('#call-vibration')!;
const callMuted = document.querySelector<HTMLInputElement>('#call-muted')!;
const callRingtoneLabel = document.querySelector<HTMLElement>('#call-ringtone-label')!;
const logger = createLogger((line) => {
  logArea.value += `${line}\n`;
  logArea.scrollTop = logArea.scrollHeight;
});
const notifications = createNotificationController();
const websocketMonitor = new WebSocketMonitor(() => backendUrlInput.value, logger);
let currentToken = '';
let initialized = false;
let ringtoneUri: string | null = null;

tokenInput.value = currentToken;
backendUrlInput.value = localStorage.getItem(STORAGE_KEYS.backendUrl) || 'http://10.4.4.198:3000';
bearerTokenInput.value = localStorage.getItem(STORAGE_KEYS.bearerToken) || DEV_TEST_BEARER_TOKEN;

function setStatus(message: string) {
  status.textContent = message;
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.backendUrl, backendUrlInput.value.trim());
  localStorage.setItem(STORAGE_KEYS.bearerToken, bearerTokenInput.value);
  if (Capacitor.isNativePlatform() && backendUrlInput.value.trim()) {
    void CallNotificationSettings.setPushWebSocketBackend({ backendUrl: backendUrlInput.value.trim() })
      .then(({ websocketUrl }) => logger.debug('Native push WebSocket URL saved.', { websocketUrl }))
      .catch((error) => logger.error('Could not save native push WebSocket URL', error));
  }
}

function setToken(token: string) {
  currentToken = token;
  tokenInput.value = token;
  localStorage.setItem(STORAGE_KEYS.fcmToken, token);
  logger.info(`FCM token received: ${token.slice(0, 8)}...${token.slice(-6)}`);
  if (initialized && backendUrlInput.value.trim()) void registerTokenWithBackend(true);
}

async function registerTokenWithBackend(force = true) {
  saveSettings();
  if (!currentToken) return logger.error('Cannot register token: no FCM token is available.');
  if (!backendUrlInput.value.trim()) return logger.info('Backend URL is empty; token registration skipped.');
  if (!bearerTokenInput.value.trim()) {
    bearerTokenInput.value = DEV_TEST_BEARER_TOKEN;
    saveSettings();
    logger.warn('Bearer token was empty; restored the local development test token.');
  }
  const registrationKey = `${backendUrlInput.value.trim()}|${currentToken}`;
  if (!force && localStorage.getItem(STORAGE_KEYS.registeredToken) === registrationKey) {
    logger.info('The unchanged token is already registered with this backend.');
    return;
  }
  logger.info('Token registration request started.', {
    backendUrl: backendUrlInput.value.trim(),
    hasBearerToken: Boolean(bearerTokenInput.value.trim()),
    deviceId: APP_CONFIG.deviceId,
  });
  try {
    const response = await registerDevice(
      backendUrlInput.value,
      bearerTokenInput.value,
      {
        token: currentToken,
        deviceId: APP_CONFIG.deviceId,
        deviceName: APP_CONFIG.deviceName,
        appVersion: APP_CONFIG.appVersion,
        notificationsEnabled: true,
      },
      APP_CONFIG.requestTimeoutMs,
      logger,
    );
    localStorage.setItem(STORAGE_KEYS.registeredToken, registrationKey);
    logger.info(`Token registration succeeded (HTTP ${response.status})`, response.body);
  } catch (error) {
    logger.error('Backend registration error', error);
  }
}

async function initialize() {
  saveSettings();
  logger.info('Notification initialization started.');
  logger.debug('App/device info at initialize()', {
    platform: Capacitor.getPlatform(),
    isNativePlatform: Capacitor.isNativePlatform(),
  });
  initialized = await notifications.initialize(setToken, logger);
  setStatus(initialized ? 'Initialized' : 'Initialization stopped');
  if (initialized && backendUrlInput.value.trim()) await registerTokenWithBackend(false);
}

async function copyToken() {
  if (!currentToken) return logger.info('There is no FCM token to copy.');
  try {
    await navigator.clipboard.writeText(currentToken);
    logger.info('FCM token copied to clipboard.');
  } catch (error) {
    logger.error('Clipboard error', error);
  }
}

async function loadCallSettings() {
  if (!Capacitor.isNativePlatform()) {
    callSettings.hidden = true;
    return;
  }
  try {
    const settings = await CallNotificationSettings.getSettings();
    callVibration.value = settings.vibration;
    callMuted.checked = settings.muted;
    ringtoneUri = settings.ringtoneUri;
    callRingtoneLabel.textContent = ringtoneUri || 'Default ringtone';
    logger.info('Incoming call notification settings loaded.', settings);
  } catch (error) {
    logger.error('Could not load incoming call settings', error);
  }
}

async function pickCallRingtone() {
  try {
    const selection = await CallNotificationSettings.pickRingtone();
    ringtoneUri = selection.uri;
    callRingtoneLabel.textContent = ringtoneUri || 'Silent ringtone selected';
    logger.info('Incoming call ringtone selected.', { ringtoneUri });
  } catch (error) {
    logger.error('Ringtone picker failed', error);
  }
}

async function applyCallSettings() {
  try {
    const settings = await CallNotificationSettings.applySettings({
      muted: callMuted.checked,
      vibration: callVibration.value as CallVibration,
      ringtoneUri,
    });
    ringtoneUri = settings.ringtoneUri;
    callRingtoneLabel.textContent = ringtoneUri || 'Default ringtone';
    logger.info('Incoming call settings applied. A fresh Android channel is now active.', settings);
  } catch (error) {
    logger.error('Could not apply incoming call settings', error);
  }
}

function bind(id: string, handler: () => void | Promise<void>) {
  document.querySelector<HTMLButtonElement>(`#${id}`)?.addEventListener('click', () => {
    logger.debug(`Button clicked: #${id}`);
    void handler();
  });
}

logger.info('Application started.');
logger.debug('Startup state', {
  storedBackendUrl: backendUrlInput.value,
  storedFcmToken: currentToken ? `${currentToken.slice(0, 8)}...${currentToken.slice(-6)}` : null,
});
if (!Capacitor.isNativePlatform()) {
  setStatus('Browser preview');
  logger.info('Native Android Capacitor app is required for FCM testing. Logs remain available in this browser.');
} else {
  setStatus('Ready');
  saveSettings();
  void loadCallSettings();
  void websocketMonitor.initialize();
  void initialize();
}

window.addEventListener('error', (event) => {
  logger.error('Uncaught window error', event.error ?? event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', event.reason);
});

bind('initialize', initialize);
bind('register-token', () => registerTokenWithBackend(true));
bind('copy-token', copyToken);
bind('local-test', () => notifications.sendLocalTest(logger));
bind('call-pick-ringtone', pickCallRingtone);
bind('call-apply-settings', applyCallSettings);
bind('use-test-token', () => {
  bearerTokenInput.value = DEV_TEST_BEARER_TOKEN;
  saveSettings();
  logger.info('Dev test bearer token filled in. Do not use this in production builds.');
});
bind('clear-logs', () => { logArea.value = ''; });
backendUrlInput.addEventListener('change', saveSettings);
bearerTokenInput.addEventListener('change', saveSettings);
