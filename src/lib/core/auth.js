/**
 * ASCEND AI PROTOCOL - Local Auth
 * Phase 18: Multi-user local auth. No UI logic.
 */

import { getAllUsers, saveUser, findUserByEmail } from './userStore.js';
import { getCurrentUser as storageGetCurrentUser, saveCurrentUser as storageSaveCurrentUser, clearCurrentUser as storageClearCurrentUser } from '../data/storageAdapter.js';

const CREDENTIALS_KEY = 'ascend_local_auth_credentials';

function generateId() {
    return String(Date.now()) + '_' + Math.random().toString(36).slice(2, 10);
}

function readCredentials() {
    try {
        const raw = localStorage.getItem(CREDENTIALS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function saveCredentials(credentials) {
    try {
        localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials && typeof credentials === 'object' ? credentials : {}));
    } catch {
        /* ignore */
    }
}

function normalizeLocalUser(user) {
    if (!user || !user.id) return null;
    if (user.provider && user.provider !== 'local') return null;
    return {
        id: String(user.id),
        email: String(user.email || '').trim().toLowerCase(),
        provider: 'local',
        isAdmin: false,
        username: typeof user.username === 'string' && user.username.trim() ? user.username.trim() : '',
        createdAt: typeof user.createdAt === 'number'
            ? user.createdAt
            : typeof user.created_at === 'number'
                ? user.created_at
                : Date.now()
    };
}

export function createUser(email, password = '', options = {}) {
    if (!email || typeof email !== 'string') return null;
    const trimmed = String(email).trim().toLowerCase();
    if (!trimmed) return null;
    if (typeof password !== 'string' || !password.trim()) return null;

    if (findUserByEmail(trimmed)) return null;

    const user = normalizeLocalUser({
        id: options?.userId ? String(options.userId) : generateId(),
        email: trimmed,
        username: typeof options?.username === 'string' ? options.username : '',
        createdAt: Date.now()
    });
    saveUser(user);
    const credentials = readCredentials();
    credentials[trimmed] = password;
    saveCredentials(credentials);
    storageSaveCurrentUser(user);
    return user;
}

export function loginUser(email, password = '') {
    if (!email || typeof email !== 'string') return null;
    if (typeof password !== 'string' || !password.trim()) return null;
    const normalizedEmail = String(email).trim().toLowerCase();
    const credentials = readCredentials();
    if (credentials[normalizedEmail] !== password) return null;
    const user = findUserByEmail(normalizedEmail);
    if (!user) return null;
    const normalized = normalizeLocalUser(user);
    storageSaveCurrentUser(normalized);
    return normalized;
}

export function logoutUser() {
    storageClearCurrentUser();
}

export function getCurrentUser() {
    const user = storageGetCurrentUser();
    return normalizeLocalUser(user);
}

export { getAllUsers };
