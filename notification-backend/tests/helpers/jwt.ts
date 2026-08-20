import jwt from 'jsonwebtoken';

const SECRET = 'test-shared-secret-for-hs256-signing-in-tests';

export function signTestToken(options: { userId: string; roles?: string[] }): string {
  return jwt.sign(
    {
      roles: options.roles ?? [],
    },
    SECRET,
    {
      algorithm: 'HS256',
      subject: options.userId,
      issuer: 'https://issuer.test/',
      audience: 'notification-backend-test',
      expiresIn: '1h',
    },
  );
}
