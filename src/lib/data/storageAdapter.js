/**
 * ASCEND AI PROTOCOL - Storage Adapter
 * Phase 24: Local persistence abstraction without changing current UI behavior.
 */

const KEYS = {
    CURRENT_USER: 'ascend_current_user',
    USERS: 'ascend_users',
    PROTOCOL_DB: 'ascend_protocol_v4_db',
    PROGRESS: (userId) => `ascend_progress_${userId || 'default'}`,
    INJURY_RECOVERY: (userId) => `ascend_injury_recovery_${userId || 'default'}`
};

function readJson(key, fallback = null) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn('[StorageAdapter] Save failed:', error);
    }
}

function removeKey(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.warn('[StorageAdapter] Remove failed:', error);
    }
}

function normalizeUser(user) {
    if (!user || !user.id) return null;
    return {
        id: String(user.id),
        email: String(user.email || '').trim().toLowerCase(),
        provider: user.provider || 'local',
        createdAt: typeof user.createdAt === 'number' ? user.createdAt : Date.now()
    };
}

export function init() {
    const state = getProtocolState();
    if (!state || typeof state !== 'object') {
        saveProtocolState({ users: {}, currentUser: null });
    }
}

export function getCurrentUser() {
    return normalizeUser(readJson(KEYS.CURRENT_USER, null));
}

export function saveCurrentUser(user) {
    const normalized = normalizeUser(user);
    if (!normalized) return;
    writeJson(KEYS.CURRENT_USER, normalized);
}

export function clearCurrentUser() {
    removeKey(KEYS.CURRENT_USER);
}

export function getUsers() {
    const users = readJson(KEYS.USERS, []);
    return Array.isArray(users) ? users.map(normalizeUser).filter(Boolean) : [];
}

export function saveUsers(users) {
    if (!Array.isArray(users)) return;
    writeJson(KEYS.USERS, users.map(normalizeUser).filter(Boolean));
}

export function findUserByEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const normalized = String(email).trim().toLowerCase();
    return getUsers().find((user) => user.email === normalized) || null;
}

export function getProtocolState() {
    const state = readJson(KEYS.PROTOCOL_DB, { users: {}, currentUser: null });
    return state && typeof state === 'object' ? state : { users: {}, currentUser: null };
}

export function saveProtocolState(state) {
    if (!state || typeof state !== 'object') return;
    writeJson(KEYS.PROTOCOL_DB, state);
}

export function getActiveProtocol(userId) {
    if (!userId) return null;
    return getProtocolState().users?.[userId]?.active_protocol ?? null;
}

export function saveActiveProtocol(userId, protocol) {
    if (!userId) return;
    const state = getProtocolState();
    if (!state.users) state.users = {};
    if (!state.users[userId]) state.users[userId] = { email: userId, history: [], telemetry: [] };
    state.users[userId].active_protocol = protocol;
    saveProtocolState(state);
}

export function getProtocolHistory(userId) {
    if (!userId) return [];
    const history = getProtocolState().users?.[userId]?.history;
    return Array.isArray(history) ? history : [];
}

export function saveProtocolHistory(userId, history) {
    if (!userId) return;
    const state = getProtocolState();
    if (!state.users) state.users = {};
    if (!state.users[userId]) state.users[userId] = { email: userId, history: [], telemetry: [] };
    state.users[userId].history = Array.isArray(history) ? history : [];
    saveProtocolState(state);
}

export function getTelemetry(userId) {
    if (!userId) return [];
    const telemetry = getProtocolState().users?.[userId]?.telemetry;
    return Array.isArray(telemetry) ? telemetry : [];
}

export function appendTelemetry(userId, log) {
    if (!userId) return;
    const state = getProtocolState();
    if (!state.users) state.users = {};
    if (!state.users[userId]) state.users[userId] = { email: userId, history: [], telemetry: [] };
    const telemetry = Array.isArray(state.users[userId].telemetry) ? state.users[userId].telemetry : [];
    state.users[userId].telemetry = [log, ...telemetry];
    saveProtocolState(state);
}

export function getProgressEntries(userId) {
    const entries = readJson(KEYS.PROGRESS(userId), []);
    return Array.isArray(entries) ? entries : [];
}

export function saveProgressEntries(userId, entries) {
    if (!userId) return;
    writeJson(KEYS.PROGRESS(userId), Array.isArray(entries) ? entries : []);
}

export function getInjuryState(userId) {
    return readJson(KEYS.INJURY_RECOVERY(userId), null);
}

export function saveInjuryState(userId, state) {
    if (!userId) return;
    writeJson(KEYS.INJURY_RECOVERY(userId), state && typeof state === 'object' ? state : {});
}