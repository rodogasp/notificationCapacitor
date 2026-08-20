import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.fcmtest',
  appName: 'FCM Test App',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
};

export default config;
