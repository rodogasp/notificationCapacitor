export type FcmErrorClassification = 'PERMANENT' | 'TRANSIENT';

/**
 * FCM error codes that indicate the registration token itself is permanently
 * unusable and the corresponding device should be deactivated.
 */
const PERMANENT_ERROR_CODES = new Set<string>([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
  'messaging/mismatched-credential',
  'messaging/sender-id-mismatch',
]);

/**
 * FCM error codes that indicate a transient problem (network, quota,
 * upstream availability) unrelated to the validity of the token.
 */
const TRANSIENT_ERROR_CODES = new Set<string>([
  'messaging/server-unavailable',
  'messaging/internal-error',
  'messaging/quota-exceeded',
  'messaging/authentication-error',
  'messaging/unknown-error',
  'messaging/message-rate-exceeded',
  'messaging/device-message-rate-exceeded',
  'messaging/topics-message-rate-exceeded',
]);

export interface ClassifiedFcmError {
  code: string;
  classification: FcmErrorClassification;
  message: string;
}

/**
 * Classifies an error thrown/returned by the Firebase Admin SDK as either
 * PERMANENT (the token should be deactivated) or TRANSIENT (safe to retry).
 * Unknown/unrecognized codes are treated as TRANSIENT to avoid incorrectly
 * deactivating a token due to an unmapped error.
 */
export function classifyFcmError(error: unknown): ClassifiedFcmError {
  const code = extractErrorCode(error);
  const message = extractErrorMessage(error);

  if (PERMANENT_ERROR_CODES.has(code)) {
    return { code, classification: 'PERMANENT', message };
  }
  if (TRANSIENT_ERROR_CODES.has(code)) {
    return { code, classification: 'TRANSIENT', message };
  }
  return { code: code || 'messaging/unknown-error', classification: 'TRANSIENT', message };
}

function extractErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') {
      return code;
    }
  }
  return '';
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return 'Unknown FCM error';
}
