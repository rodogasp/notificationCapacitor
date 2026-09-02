export const APP_CONFIG = {
  appName: 'FCM Test App',
  deviceId: 'capacitor-android-test-device',
  deviceName: 'Capacitor Android Test',
  appVersion: '1.0.0',
  // Must match the backend's FCM_ANDROID_CHANNEL_ID (see notification-backend/.env)
  channelId: 'default_channel',
  channelName: 'Default',
  backendPath: '/api/v1/devices',
  requestTimeoutMs: 30000,
};

// Dev-only convenience token for the local test backend (sub: user-1, role:
// notification:send, signed with the local-dev JWT_PUBLIC_KEY shared secret).
// Never wire a hardcoded token like this into a production app.
export const DEV_TEST_BEARER_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlcyI6WyJub3RpZmljYXRpb246c2VuZCJdLCJpYXQiOjE3ODcyMzM2OTcsImV4cCI6MjEwMjU5MzY5NywiYXVkIjoibm90aWZpY2F0aW9uLWJhY2tlbmQtbG9jYWwiLCJpc3MiOiJodHRwczovL2xvY2FsLWRldi1pc3N1ZXIvIiwic3ViIjoidXNlci0xIn0.DlBew_LVvgjVNUYFQLAgSEbqexX1XWDE0Z3RKBp-jcs';

export const STORAGE_KEYS = {
  backendUrl: 'fcm-test-backend-url',
  bearerToken: 'fcm-test-bearer-token',
  fcmToken: 'fcm-test-registration-token',
  registeredToken: 'fcm-test-last-registered-token',
};
