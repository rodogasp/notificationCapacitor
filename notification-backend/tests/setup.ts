// Populates required environment variables before any application module is
// imported by a test file, since src/config/env.ts validates eagerly.
process.env.NODE_ENV = 'test';
process.env.HOST = '127.0.0.1';
process.env.PORT = '3000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test?schema=public';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_CREDENTIALS_MODE = 'adc';
process.env.FCM_ANDROID_CHANNEL_ID = 'default_channel';
process.env.JWT_ISSUER = 'https://issuer.test/';
process.env.JWT_AUDIENCE = 'notification-backend-test';
process.env.JWT_PUBLIC_KEY = 'test-shared-secret-for-hs256-signing-in-tests';
process.env.NOTIFICATION_REQUIRED_ROLE = 'notification:send';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX = '1000';
process.env.MAX_JSON_BODY_SIZE = '100kb';
