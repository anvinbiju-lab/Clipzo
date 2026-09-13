import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../server/rate-limiter';

describe('RateLimiter', () => {
  it('should allow initial join attempts', () => {
    const limiter = new RateLimiter();
    const result = limiter.canAttemptJoin('192.168.1.1');
    expect(result.allowed).toBe(true);
  });

  it('should lock out IP after 5 failed join attempts', () => {
    const limiter = new RateLimiter();
    const testIp = '10.0.0.1';

    for (let i = 0; i < 5; i++) {
      limiter.recordFailedJoin(testIp);
    }

    const check = limiter.canAttemptJoin(testIp);
    expect(check.allowed).toBe(false);
    expect(check.retryAfterMs).toBeGreaterThan(0);
  });

  it('should reset failed join count on successful join', () => {
    const limiter = new RateLimiter();
    const testIp = '10.0.0.2';

    limiter.recordFailedJoin(testIp);
    limiter.recordFailedJoin(testIp);
    limiter.resetFailedJoin(testIp);

    const check = limiter.canAttemptJoin(testIp);
    expect(check.allowed).toBe(true);
  });

  it('should rate limit room creation per IP', () => {
    const limiter = new RateLimiter();
    const testIp = '10.0.0.3';

    for (let i = 0; i < 10; i++) {
      expect(limiter.canCreateRoom(testIp)).toBe(true);
    }
    // 11th should be denied
    expect(limiter.canCreateRoom(testIp)).toBe(false);
  });

  it('should rate limit messages per session', () => {
    const limiter = new RateLimiter();
    const token = 'session-test-token-123';

    for (let i = 0; i < 60; i++) {
      expect(limiter.canSendMessage(token)).toBe(true);
    }
    // 61st message exceeds rate limit
    expect(limiter.canSendMessage(token)).toBe(false);
  });
});
