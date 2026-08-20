import { describe, expect, it } from 'vitest';
import { maskToken } from '../../src/shared/utils/token-mask';

describe('maskToken', () => {
  it('shows only a prefix and suffix for long tokens', () => {
    const token = 'abcdefghijklmnopqrstuvwxyz0123456789';
    expect(maskToken(token)).toBe('abcd...6789');
  });

  it('fully masks short tokens', () => {
    expect(maskToken('abcd')).toBe('****');
  });

  it('returns an empty string for empty input', () => {
    expect(maskToken('')).toBe('');
  });

  it('never includes the full token in the output', () => {
    const token = 'super-secret-fcm-registration-token-value';
    expect(maskToken(token)).not.toContain(token);
  });
});
