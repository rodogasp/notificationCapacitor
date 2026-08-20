import admin from 'firebase-admin';
import { env } from './env';
import { logger } from './logger';

let initialized = false;
let initializationError: Error | null = null;

/**
 * Initializes the Firebase Admin SDK exactly once, using the credential mode
 * selected via FIREBASE_CREDENTIALS_MODE:
 *  - adc:  Application Default Credentials (recommended for production, e.g. GCP/Cloud Run/GKE)
 *  - file: local service-account JSON file referenced by GOOGLE_APPLICATION_CREDENTIALS
 *  - json: inline service-account JSON (useful for CI/local secrets-manager injection)
 */
export function initializeFirebase(): void {
  if (initialized) {
    return;
  }

  try {
    if (admin.apps.length > 0) {
      initialized = true;
      return;
    }

    let credential: admin.credential.Credential;

    switch (env.FIREBASE_CREDENTIALS_MODE) {
      case 'file': {
        // GOOGLE_APPLICATION_CREDENTIALS is read directly by applicationDefault()
        credential = admin.credential.applicationDefault();
        break;
      }
      case 'json': {
        const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON as string) as Record<
          string,
          unknown
        >;
        credential = admin.credential.cert(serviceAccount as admin.ServiceAccount);
        break;
      }
      case 'adc':
      default: {
        credential = admin.credential.applicationDefault();
        break;
      }
    }

    admin.initializeApp({
      credential,
      projectId: env.FIREBASE_PROJECT_ID,
    });

    initialized = true;
    logger.info({ mode: env.FIREBASE_CREDENTIALS_MODE }, 'Firebase Admin SDK initialized');
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error('Unknown Firebase init error');
    logger.error({ err: initializationError.message }, 'Failed to initialize Firebase Admin SDK');
  }
}

export function isFirebaseReady(): boolean {
  return initialized && initializationError === null;
}

export function getFirebaseMessaging(): admin.messaging.Messaging {
  if (!initialized) {
    throw new Error('Firebase Admin SDK has not been initialized');
  }
  return admin.messaging();
}
