import { registerPlugin } from '@capacitor/core';

export type CallVibration = 'off' | 'short' | 'medium' | 'long';

export interface CallNotificationSettings {
  channelId: string;
  muted: boolean;
  vibration: CallVibration;
  ringtoneUri: string | null;
}

interface CallNotificationSettingsPlugin {
  deleteFcmToken(): Promise<void>;
  getSettings(): Promise<CallNotificationSettings>;
  applySettings(options: Omit<CallNotificationSettings, 'channelId'>): Promise<CallNotificationSettings>;
  pickRingtone(): Promise<{ uri: string | null }>;
  setPushWebSocketBackend(options: { backendUrl: string }): Promise<{ websocketUrl: string | null }>;
  isCallActive(): Promise<{ active: boolean }>;
  getCallId(): Promise<{ callId: string | null }>;
}

export const CallNotificationSettings = registerPlugin<CallNotificationSettingsPlugin>(
  'CallNotificationSettings',
);