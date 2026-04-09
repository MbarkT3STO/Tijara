/**
 * Authentication service.
 * Handles login, logout, registration, and session persistence.
 * Passwords are hashed with SHA-256 via the Web Crypto API (no extra deps).
 * Session is stored in localStorage (survives app restarts).
 */

import { repository } from '@data/excelRepository';
import type { User, UserRole } from '@core/types';
import { generateId, getCurrentISODate } from '@shared/utils/helpers';

const SESSION_KEY = 'tijara-session';

/** Logged-in session stored in localStorage */
interface Session {
  userId: string;
}

/** Hash a plain-text password with SHA-256 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

class AuthService {
  private currentUser: User | null = null;

  // ── Session ───────────────────────────────────────────────────────────────

  /** Restore session from localStorage on app start */
  restoreSession(): User | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw) as Session;
      const user = repository.getById('users', session.userId);
      if (user && user.active) {
        this.currentUser = user;
        return user;
      }
    } catch {
      // invalid session
    }
    localStorage.removeItem(SESSION_KEY);
    return null;
  }

  /** Persist session to localStorage */
  private saveSession(user: User): void {
    const session: Session = { userId: user.id };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  /** Clear session */
  private clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
  }

  // ── Auth actions ──────────────────────────────────────────────────────────

  /**
   * Attempt to log in with email + password.
   * Returns the user on success, throws a descriptive error on failure.
   */
  async login(email: string, password: string): Promise<User> {
    const users = repository.getAll('users');
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) throw new Error('AUTH_NO_ACCOUNT');
    if (!user.active) throw new Error('AUTH_DEACTIVATED');

    const hash = await hashPassword(password);
    if (user.passwordHash !== hash) throw new Error('AUTH_WRONG_PASSWORD');

    // Update lastLogin
    repository.update('users', user.id, { lastLogin: getCurrentISODate() });
    const updated = repository.getById('users', user.id)!;
    this.currentUser = updated;
    this.saveSession(updated);
    return updated;
  }

  /**
   * Register a new account.
   * The very first user registered is automatically assigned the admin role.
   */
  async register(
    name: string,
    email: string,
    password: string,
    role: UserRole = 'sales'
  ): Promise<User> {
    const users = repository.getAll('users');

    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('AUTH_EMAIL_EXISTS');
    }

    const passwordHash = await hashPassword(password);
    const isFirstUser = users.length === 0;

    const user: User = {
      id: generateId(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: isFirstUser ? 'admin' : role,
      active: true,
      createdAt: getCurrentISODate(),
      lastLogin: getCurrentISODate(),
    };

    repository.insert('users', user);
    this.currentUser = user;
    this.saveSession(user);
    return user;
  }

  /** Log out the current user */
  logout(): void {
    this.currentUser = null;
    this.clearSession();
  }

  /** Get the currently logged-in user */
  getUser(): User | null {
    return this.currentUser;
  }

  /** Check if anyone is logged in */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Change the current user's password.
   * Requires the old password for verification.
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    if (!this.currentUser) throw new Error('AUTH_NOT_AUTHENTICATED');
    const oldHash = await hashPassword(oldPassword);
    if (this.currentUser.passwordHash !== oldHash) throw new Error('AUTH_WRONG_CURRENT_PASSWORD');
    const newHash = await hashPassword(newPassword);
    repository.update('users', this.currentUser.id, { passwordHash: newHash });
    this.currentUser = repository.getById('users', this.currentUser.id)!;
  }

  /**
   * Admin: reset another user's password directly (no old password needed).
   */
  async adminResetPassword(userId: string, newPassword: string): Promise<void> {
    const hash = await hashPassword(newPassword);
    repository.update('users', userId, { passwordHash: hash });
  }
}

/** Singleton auth service */
export const authService = new AuthService();
