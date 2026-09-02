import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'notification.test',
  appName: 'FCM Test App',
  webDir: 'www',
  server: {
    androidScheme: 'http',
  },
};

export default config;
