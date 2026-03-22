/**
 * ASCEND AI PROTOCOL - Local Auth
 * Phase 18: Multi-user local auth. No UI logic.
 */

import { getAllUsers, saveUser, findUserByEmail } from './userStore.js';
import { getCurrentUser as storageGetCurrentUser, saveCurrentUser as storageSaveCurrentUser, clearCurrentUser as storageClearCurrentUser } from '../data/storageAdapter.js';

function generateId() {
    return String(Date.now()) + '_' + Math.random().toString(36).slice(2, 10);
}

function normalizeLocalUser(user) {
    if (!user || !user.id) return null;
    if (user.provider && user.provider !== 'local') return null;
    return {
        id: String(user.id),
        email: String(user.email || '').trim().toLowerCase(),
        provider: 'local',
        isAdmin: false,
        createdAt: typeof user.createdAt === 'number'
            ? user.createdAt
            : typeof user.created_at === 'number'
                ? user.created_at
                : Date.now()
    };
}

export function createUser(email) {
    if (!email || typeof email !== 'string') return null;
    const trimmed = String(email).trim().toLowerCase();
    if (!trimmed) return null;

    if (findUserByEmail(trimmed)) return null;

    const user = normalizeLocalUser({
        id: generateId(),
        email: trimmed,
        createdAt: Date.now()
    });
    saveUser(user);
    storageSaveCurrentUser(user);
    return user;
}

export function loginUser(email) {
    if (!email || typeof email !== 'string') return null;
    const user = findUserByEmail(email);
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