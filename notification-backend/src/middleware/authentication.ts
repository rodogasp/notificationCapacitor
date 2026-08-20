import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtHeader, type SigningKeyCallback } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { AppError } from '../shared/errors';
import { env } from '../config/env';
import type { AuthenticatedUser } from '../shared/types';

const jwks = env.JWT_JWKS_URL
  ? jwksClient({
      jwksUri: env.JWT_JWKS_URL,
      cache: true,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
    })
  : null;

function getSigningKey(header: JwtHeader, callback: SigningKeyCallback): void {
  if (jwks) {
    jwks.getSigningKey(header.kid, (err, key) => {
      if (err || !key) {
        callback(err ?? new Error('Signing key not found'));
        return;
      }
      callback(null, key.getPublicKey());
    });
    return;
  }
  callback(null, env.JWT_PUBLIC_KEY);
}

function verifyToken(token: string): Promise<jwt.JwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        algorithms: ['RS256', 'RS384', 'RS512', 'HS256'],
      },
      (err, decoded) => {
        if (err || !decoded || typeof decoded === 'string') {
          reject(err ?? new Error('Invalid token payload'));
          return;
        }
        resolve(decoded);
      },
    );
  });
}

function extractRoles(payload: jwt.JwtPayload): string[] {
  const roles = new Set<string>();

  if (Array.isArray(payload.roles)) {
    for (const role of payload.roles) {
      if (typeof role === 'string') roles.add(role);
    }
  }
  if (Array.isArray(payload.permissions)) {
    for (const permission of payload.permissions) {
      if (typeof permission === 'string') roles.add(permission);
    }
  }
  if (typeof payload.scope === 'string') {
    for (const scope of payload.scope.split(' ')) {
      if (scope) roles.add(scope);
    }
  }

  return Array.from(roles);
}

/**
 * Verifies the JWT bearer token: signature, issuer, audience, and expiry.
 * Populates req.user with the userId (subject) and roles/scopes. Rejects
 * missing or invalid tokens with 401.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    next(AppError.unauthorized('Missing or malformed Authorization header'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next(AppError.unauthorized('Missing bearer token'));
    return;
  }

  try {
    const payload = await verifyToken(token);
    const userId = payload.sub;
    if (!userId || typeof userId !== 'string') {
      next(AppError.unauthorized('Token is missing a subject claim'));
      return;
    }

    const user: AuthenticatedUser = {
      userId,
      roles: extractRoles(payload),
    };
    req.user = user;
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired token'));
  }
}
