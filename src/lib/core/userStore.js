/**
 * ASCEND AI PROTOCOL - User Store
 * Phase 18: Local user persistence. No UI logic.
 */

import { getUsers, saveUsers } from '../data/storageAdapter.js';

function normalizeLocalUser(user) {
    if (!user || !user.id) return null;
    return {
        id: String(user.id),
        email: String(user.email || '').trim().toLowerCase(),
        provider: 'local',
        createdAt: typeof user.createdAt === 'number' ? user.createdAt : Date.now()
    };
}

export function getAllUsers() {
    return getUsers().map(normalizeLocalUser).filter(Boolean);
}

export function saveUser(user) {
    const normalized = normalizeLocalUser(user);
    if (!normalized) return;
    const users = getAllUsers();
    const idx = users.findIndex((entry) => entry.id === normalized.id);
    if (idx >= 0) users[idx] = normalized;
    else users.push(normalized);
    saveUsers(users);
}

export function findUserByEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const normalizedEmail = String(email).trim().toLowerCase();
    return getAllUsers().find((user) => user.email === normalizedEmail) || null;
}