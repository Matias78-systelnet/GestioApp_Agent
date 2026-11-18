import { randomBytes } from 'node:crypto';

export class SessionStore {
  constructor({ ttlMs = 30 * 60 * 1000, now = Date.now } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.sessions = new Map();
  }

  create(user) {
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(token, { user, expiresAt: this.now() + this.ttlMs });
    return token;
  }

  get(token) {
    if (typeof token !== 'string') return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= this.now()) {
      this.sessions.delete(token);
      return null;
    }
    return session.user;
  }

  revoke(token) {
    if (typeof token === 'string') this.sessions.delete(token);
  }
}