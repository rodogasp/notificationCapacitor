import { Capacitor } from '@capacitor/core';
import { APP_CONFIG, STORAGE_KEYS } from './config';
import { registerDevice } from './backend-client';
import { createLogger } from './logger';
import { createNotificationController } from './notifications';
import './style.css';

const tokenInput = document.querySelector<HTMLInputElement>('#fcm-token')!;
const backendUrlInput = document.querySelector<HTMLInputElement>('#backend-url')!;
const bearerTokenInput = document.querySelector<HTMLInputElement>('#bearer-token')!;
const status = document.querySelector<HTMLElement>('#status')!;
const logArea = document.querySelector<HTMLTextAreaElement>('#logs')!;
const logger = createLogger((line) => {
  logArea.value += `${line}\n`;
  logArea.scrollTop = logArea.scrollHeight;
});
const notifications = createNotificationController();
let currentToken = localStorage.getItem(STORAGE_KEYS.fcmToken) || '';
let initialized = false;

tokenInput.value = currentToken;
backendUrlInput.value = localStorage.getItem(STORAGE_KEYS.backendUrl) || '';
bearerTokenInput.value = localStorage.getItem(STORAGE_KEYS.bearerToken) || '';

function setStatus(message: string) {
  status.textContent = message;
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.backendUrl, backendUrlInput.value.trim());
  localStorage.setItem(STORAGE_KEYS.bearerToken, bearerTokenInput.value);
}

function setToken(token: string) {
  currentToken = token;
  tokenInput.value = token;
  localStorage.setItem(STORAGE_KEYS.fcmToken, token);
  logger.info(`FCM token received: ${token.slice(0, 8)}...${token.slice(-6)}`);
}

async function registerTokenWithBackend(force = true) {
  saveSettings();
  if (!currentToken) return logger.error('Cannot register token: no FCM token is available.');
  if (!backendUrlInput.value.trim()) return logger.info('Backend URL is empty; token registration skipped.');
  const registrationKey = `${backendUrlInput.value.trim()}|${currentToken}`;
  if (!force && localStorage.getItem(STORAGE_KEYS.registeredToken) === registrationKey) {
    logger.info('The unchanged token is already registered with this backend.');
    return;
  }
  logger.info('Token registration request started.');
  try {
    const response = await registerDevice(backendUrlInput.value, bearerTokenInput.value, {
      token: currentToken,
      deviceId: APP_CONFIG.deviceId,
      deviceName: APP_CONFIG.deviceName,
      appVersion: APP_CONFIG.appVersion,
      notificationsEnabled: true,
    });
    localStorage.setItem(STORAGE_KEYS.registeredToken, registrationKey);
    logger.info(`Backend response status: ${response.status}`);
    logger.info('Backend response body:', response.body);
  } catch (error) {
    logger.error('Backend registration error:', error);
  }
}

async function initialize() {
  saveSettings();
  logger.info('Notification initialization started.');
  logger.info(`Running platform: ${Capacitor.getPlatform()}`);
  initialized = await notifications.initialize(setToken, (message, value) => logger.info(message, value));
  setStatus(initialized ? 'Initialized' : 'Initialization stopped');
  if (initialized && backendUrlInput.value.trim()) await registerTokenWithBackend(false);
}

async function copyToken() {
  if (!currentToken) return logger.info('There is no FCM token to copy.');
  try {
    await navigator.clipboard.writeText(currentToken);
    logger.info('FCM token copied to clipboard.');
  } catch (error) {
    logger.error('Clipboard error:', error);
  }
}

function bind(id: string, handler: () => void | Promise<void>) {
  document.querySelector<HTMLButtonElement>(`#${id}`)?.addEventListener('click', () => void handler());
}

logger.info('Application started.');
if (!Capacitor.isNativePlatform()) {
  setStatus('Browser preview');
  logger.info('Native Android Capacitor app is required for FCM testing. Logs remain available in this browser.');
} else {
  setStatus('Ready');
}

bind('initialize', initialize);
bind('register-token', () => registerTokenWithBackend(true));
bind('copy-token', copyToken);
bind('local-test', () => notifications.sendLocalTest((message, value) => logger.info(message, value)));
bind('clear-logs', () => { logArea.value = ''; });
backendUrlInput.addEventListener('change', saveSettings);
bearerTokenInput.addEventListener('change', saveSettings);
