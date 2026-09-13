interface RateRecord {
  count: number;
  resetAt: number;
  lockedUntil?: number;
}

export class RateLimiter {
  private ipJoinAttempts: Map<string, RateRecord> = new Map();
  private ipCreateAttempts: Map<string, RateRecord> = new Map();
  private sessionMessages: Map<string, RateRecord> = new Map();

  constructor() {
    // Periodically sweep old records every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  /**
   * Check and record a join attempt for an IP.
   * Max 5 failed attempts per minute. If exceeded, lockout for 1 minute.
   */
  public canAttemptJoin(ip: string): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    const record = this.ipJoinAttempts.get(ip);

    if (record) {
      if (record.lockedUntil && record.lockedUntil > now) {
        return { allowed: false, retryAfterMs: record.lockedUntil - now };
      }
      if (now > record.resetAt) {
        this.ipJoinAttempts.set(ip, { count: 0, resetAt: now + 60 * 1000 });
      }
    } else {
      this.ipJoinAttempts.set(ip, { count: 0, resetAt: now + 60 * 1000 });
    }

    return { allowed: true };
  }

  /**
   * Register a failed join attempt.
   */
  public recordFailedJoin(ip: string): void {
    const now = Date.now();
    let record = this.ipJoinAttempts.get(ip);
    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + 60 * 1000 };
    } else {
      record.count++;
      if (record.count >= 5) {
        // Lockout for 60 seconds
        record.lockedUntil = now + 60 * 1000;
      }
    }
    this.ipJoinAttempts.set(ip, record);
  }

  /**
   * Reset join failed attempts upon successful join.
   */
  public resetFailedJoin(ip: string): void {
    this.ipJoinAttempts.delete(ip);
  }

  /**
   * Rate limit room creation per IP (max 10 creations / minute).
   */
  public canCreateRoom(ip: string): boolean {
    const now = Date.now();
    let record = this.ipCreateAttempts.get(ip);
    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + 60 * 1000 };
      this.ipCreateAttempts.set(ip, record);
      return true;
    }
    if (record.count >= 10) {
      return false;
    }
    record.count++;
    return true;
  }

  /**
   * Rate limit messages sent per session (max 60 messages / minute).
   */
  public canSendMessage(token: string): boolean {
    const now = Date.now();
    let record = this.sessionMessages.get(token);
    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + 60 * 1000 };
      this.sessionMessages.set(token, record);
      return true;
    }
    if (record.count >= 60) {
      return false;
    }
    record.count++;
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, rec] of this.ipJoinAttempts.entries()) {
      if (now > rec.resetAt && (!rec.lockedUntil || now > rec.lockedUntil)) {
        this.ipJoinAttempts.delete(ip);
      }
    }
    for (const [ip, rec] of this.ipCreateAttempts.entries()) {
      if (now > rec.resetAt) {
        this.ipCreateAttempts.delete(ip);
      }
    }
    for (const [token, rec] of this.sessionMessages.entries()) {
      if (now > rec.resetAt) {
        this.sessionMessages.delete(token);
      }
    }
  }
}
