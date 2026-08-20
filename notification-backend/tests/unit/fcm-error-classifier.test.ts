import { describe, expect, it } from 'vitest';
import { classifyFcmError } from '../../src/shared/utils/fcm-error-classifier';

describe('classifyFcmError', () => {
  it('classifies invalid/unregistered tokens as permanent', () => {
    expect(classifyFcmError({ code: 'messaging/invalid-registration-token' }).classification).toBe(
      'PERMANENT',
    );
    expect(
      classifyFcmError({ code: 'messaging/registration-token-not-registered' }).classification,
    ).toBe('PERMANENT');
  });

  it('classifies quota/server errors as transient', () => {
    expect(classifyFcmError({ code: 'messaging/server-unavailable' }).classification).toBe(
      'TRANSIENT',
    );
    expect(classifyFcmError({ code: 'messaging/quota-exceeded' }).classification).toBe('TRANSIENT');
  });

  it('treats unknown error codes as transient to avoid wrongly deactivating tokens', () => {
    expect(classifyFcmError({ code: 'messaging/some-new-error' }).classification).toBe('TRANSIENT');
  });

  it('extracts a safe message even from non-Error values', () => {
    const result = classifyFcmError('plain string error');
    expect(result.message).toBe('Unknown FCM error');
  });
});
