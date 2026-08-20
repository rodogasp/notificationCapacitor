import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireNotificationRole } from '../../src/middleware/authorization';

function buildReq(user?: { userId: string; roles: string[] }): Request {
  return { user } as unknown as Request;
}

describe('requireNotificationRole', () => {
  it('rejects unauthenticated requests', () => {
    const next = vi.fn();
    requireNotificationRole(buildReq(undefined), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
  });

  it('rejects users missing the required role', () => {
    const next = vi.fn();
    requireNotificationRole(
      buildReq({ userId: 'u1', roles: ['some:other'] }),
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('allows users with the required role', () => {
    const next = vi.fn();
    requireNotificationRole(
      buildReq({ userId: 'u1', roles: ['notification:send'] }),
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });
});
