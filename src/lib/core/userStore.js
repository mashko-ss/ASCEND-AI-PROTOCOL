/**
 * ASCEND AI PROTOCOL - User Store
 * Phase 18: Local user persistence. Pure logic, no UI.
 */

const USERS_KEY = 'ascend_users';

/**
 * Get all users from storage.
 * @returns {Array<{ id: string, email: string, createdAt: number }>}
 */
export function getAllUsers() {
    try {
        const raw = localStorage.getItem(USERS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Save a user (upsert by id).
 * @param {{ id: string, email: string, createdAt: number }} user
 */
export function saveUser(user) {
    if (!user || !user.id) return;
    const users = getAllUsers();
    const idx = users.findIndex(u => u.id === user.id);
    const toSave = {
        id: String(user.id),
        email: String(user.email || '').trim().toLowerCase(),
        createdAt: typeof user.createdAt === 'number' ? user.createdAt : Date.now()
    };
    if (idx >= 0) {
        users[idx] = toSave;
    } else {
        users.push(toSave);
    }
    try {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (e) {
        console.warn('[UserStore] Save failed:', e);
    }
}

/**
 * Find user by email (case-insensitive).
 * @param {string} email
 * @returns {{ id: string, email: string, createdAt: number }|null}
 */
export function findUserByEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const normalized = String(email).trim().toLowerCase();
    const users = getAllUsers();
    return users.find(u => (u.email || '').toLowerCase() === normalized) || null;
}
