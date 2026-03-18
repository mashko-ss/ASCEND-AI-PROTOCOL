/**
 * ASCEND AI PROTOCOL - Local Auth
 * Phase 18: Multi-user auth using localStorage. Pure logic, no UI.
 */

import { getAllUsers, saveUser, findUserByEmail } from './userStore.js';

const CURRENT_USER_KEY = 'ascend_current_user';

/**
 * Generate a simple unique id.
 * @returns {string}
 */
function generateId() {
    return String(Date.now()) + '_' + Math.random().toString(36).slice(2, 10);
}

/**
 * Create a new user and set as current.
 * @param {string} email
 * @returns {{ id: string, email: string, createdAt: number }|null}
 */
export function createUser(email) {
    if (!email || typeof email !== 'string') return null;
    const trimmed = String(email).trim().toLowerCase();
    if (!trimmed) return null;

    const existing = findUserByEmail(trimmed);
    if (existing) return null;

    const user = {
        id: generateId(),
        email: trimmed,
        createdAt: Date.now()
    };
    saveUser(user);
    try {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } catch (e) {
        console.warn('[Auth] Set current user failed:', e);
    }
    return user;
}

/**
 * Log in user by email. Sets as current user.
 * @param {string} email
 * @returns {{ id: string, email: string, createdAt: number }|null}
 */
export function loginUser(email) {
    if (!email || typeof email !== 'string') return null;
    const user = findUserByEmail(email);
    if (!user) return null;
    try {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } catch (e) {
        console.warn('[Auth] Set current user failed:', e);
    }
    return user;
}

/**
 * Log out current user. Removes ascend_current_user.
 */
export function logoutUser() {
    try {
        localStorage.removeItem(CURRENT_USER_KEY);
    } catch (e) {
        console.warn('[Auth] Logout failed:', e);
    }
}

/**
 * Get current user from storage.
 * @returns {{ id: string, email: string, createdAt: number }|null}
 */
export function getCurrentUser() {
    try {
        const raw = localStorage.getItem(CURRENT_USER_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.id) return null;
        return {
            id: String(parsed.id),
            email: String(parsed.email || ''),
            createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : 0
        };
    } catch {
        return null;
    }
}
