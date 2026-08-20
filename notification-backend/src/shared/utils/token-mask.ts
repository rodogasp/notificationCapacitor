/**
 * Masks a sensitive token so it can be safely logged/returned, showing only a
 * small prefix and suffix, e.g. "abcd...wxyz". Never log full FCM tokens.
 */
export function maskToken(token: string, visible = 4): string {
  if (!token) {
    return '';
  }
  if (token.length <= visible * 2) {
    return '*'.repeat(token.length);
  }
  const prefix = token.slice(0, visible);
  const suffix = token.slice(-visible);
  return `${prefix}...${suffix}`;
}
