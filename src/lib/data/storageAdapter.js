/**
 * ASCEND AI PROTOCOL - Storage Adapter
 * Phase 24: Local persistence abstraction without changing current UI behavior.
 */

import { isSupabaseConfigured, hasActiveSupabaseSession } from './supabaseClient.js';

const KEYS = {
    CURRENT_USER: 'ascend_current_user',
    USERS: 'ascend_users',
    PROTOCOL_DB: 'ascend_protocol_v4_db',
    PENDING_MERGES: 'ascend_pending_merges',
    SYNC_STATE: 'ascend_sync_state',
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

function cloneValue(value, fallback = null) {
    if (value == null) return fallback;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return fallback;
    }
}

function stableSerialize(value) {
    try {
        return JSON.stringify(value);
    } catch {
        return '';
    }
}

function normalizeProviderAlias(provider) {
    const normalized = String(provider || '').trim().toLowerCase();
    if (normalized === 'sms') return 'phone';
    return normalized;
}

function normalizeProvider(provider) {
    const normalized = normalizeProviderAlias(provider);
    return ['local', 'google', 'apple', 'facebook', 'phone'].includes(normalized)
        ? normalized
        : 'local';
}

function inferUserProvider(user) {
    const providerCandidates = [
        user?.provider,
        user?.app_metadata?.provider,
        ...(Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers : []),
        ...(Array.isArray(user?.identities) ? user.identities.map((identity) => identity?.provider) : []),
        user?.user_metadata?.provider,
        user?.phone ? 'phone' : ''
    ];

    for (const candidate of providerCandidates) {
        const normalized = normalizeProvider(candidate);
        if (normalized !== 'local') return normalized;
    }

    return 'local';
}

/** Admin role: only from Supabase app metadata (or persisted snapshot of it). Never user_metadata. */
function resolveIsAdminFlag(user, provider) {
    if (!user || typeof user !== 'object') return false;
    if (provider === 'local') return false;
    if (user.app_metadata && user.app_metadata.is_admin === true) return true;
    if (user.raw_app_meta_data && user.raw_app_meta_data.is_admin === true) return true;
    if (user.isAdmin === true) return true;
    return false;
}

function normalizeCreatedAt(user, provider) {
    if (provider === 'local') {
        if (typeof user.createdAt === 'number' && Number.isFinite(user.createdAt)) return user.createdAt;
        if (typeof user.created_at === 'number' && Number.isFinite(user.created_at)) return user.created_at;
        return Date.now();
    }

    if (typeof user.createdAt === 'string' && user.createdAt.trim()) return user.createdAt.trim();
    if (typeof user.created_at === 'string' && user.created_at.trim()) return user.created_at.trim();
    if (typeof user.createdAt === 'number' && Number.isFinite(user.createdAt)) return user.createdAt;
    if (typeof user.created_at === 'number' && Number.isFinite(user.created_at)) return user.created_at;
    return Date.now();
}

function normalizeUser(user) {
    if (!user || !user.id) return null;
    const provider = inferUserProvider(user);

    return {
        id: String(user.id),
        email: String(user.email || '').trim().toLowerCase(),
        provider,
        isAdmin: resolveIsAdminFlag(user, provider),
        createdAt: normalizeCreatedAt(user, provider)
    };
}

function normalizeLocalUser(user) {
    const normalized = normalizeUser(user);
    return normalized && normalized.provider === 'local' ? normalized : null;
}

function isMeaningfulObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0);
}

function getPendingMergeRecords() {
    const records = readJson(KEYS.PENDING_MERGES, {});
    return records && typeof records === 'object' ? records : {};
}

function savePendingMergeRecords(records) {
    if (!records || typeof records !== 'object') return;
    writeJson(KEYS.PENDING_MERGES, records);
}

function createPendingMergePersistenceState(overrides = {}) {
    return {
        status: 'pending',
        persistedAt: null,
        persistedFingerprint: '',
        lastAttemptAt: null,
        lastError: null,
        ...overrides
    };
}

function createSyncState(overrides = {}) {
    return {
        enabled: false,
        source: 'local',
        hasSession: false,
        lastSyncAt: null,
        pendingMerge: false,
        degraded: false,
        reason: null,
        ...overrides
    };
}

function normalizePendingMergeRecord(record) {
    if (!record || typeof record !== 'object') return null;

    return {
        fingerprint: typeof record.fingerprint === 'string' ? record.fingerprint : '',
        bundle: record.bundle && typeof record.bundle === 'object' ? record.bundle : null,
        persistence: createPendingMergePersistenceState(record.persistence)
    };
}

function getSyncStateRecords() {
    const records = readJson(KEYS.SYNC_STATE, {});
    return records && typeof records === 'object' ? records : {};
}

function saveSyncStateRecords(records) {
    if (!records || typeof records !== 'object') return;
    writeJson(KEYS.SYNC_STATE, records);
}

function dedupeProtocolHistory(history) {
    const seen = new Set();
    const deduped = [];

    for (const entry of Array.isArray(history) ? history : []) {
        const cloned = cloneValue(entry, null);
        if (!cloned || typeof cloned !== 'object') continue;

        const signature = stableSerialize(cloned);
        if (!signature || seen.has(signature)) continue;

        seen.add(signature);
        deduped.push(cloned);
    }

    return deduped;
}

function getMemoryValue(protocol, key) {
    const value = protocol?.aiResult?.[key];
    return isMeaningfulObject(value) ? cloneValue(value, null) : null;
}

function firstMeaningfulMemory(protocols, key) {
    for (const protocol of protocols) {
        const value = getMemoryValue(protocol, key);
        if (value) return value;
    }

    return null;
}

function applyMemoriesToProtocol(protocol, memories = {}) {
    if (!protocol || typeof protocol !== 'object') return protocol ?? null;

    const cloned = cloneValue(protocol, null);
    if (!cloned || typeof cloned !== 'object') return null;

    if (!cloned.aiResult || typeof cloned.aiResult !== 'object') {
        cloned.aiResult = {};
    }

    if (memories.nutritionMemory != null) {
        cloned.aiResult.nutritionMemory = cloneValue(memories.nutritionMemory, null);
    }

    if (memories.supplementMemory != null) {
        cloned.aiResult.supplementMemory = cloneValue(memories.supplementMemory, null);
    }

    if (memories.adaptationSummary != null) {
        cloned.aiResult.adaptationSummary = cloneValue(memories.adaptationSummary, null);
    }

    return cloned;
}

function getLocalUserMergeData(userId) {
    if (!userId) {
        return {
            activeProtocol: null,
            protocolHistory: [],
            nutritionMemory: null,
            supplementMemory: null,
            adaptationSummary: null
        };
    }

    const activeProtocol = cloneValue(getActiveProtocol(userId), null);
    const protocolHistory = dedupeProtocolHistory(getProtocolHistory(userId));
    const protocols = [activeProtocol, ...protocolHistory].filter(Boolean);
    const progressLogs = cloneValue(getProgressEntries(userId), []);

    const data = {
        activeProtocol,
        protocolHistory,
        nutritionMemory: firstMeaningfulMemory(protocols, 'nutritionMemory'),
        supplementMemory: firstMeaningfulMemory(protocols, 'supplementMemory'),
        adaptationSummary: firstMeaningfulMemory(protocols, 'adaptationSummary')
    };

    if (Array.isArray(progressLogs) && progressLogs.length > 0) {
        data.progressLogs = progressLogs;
    }

    return data;
}

export function getUserPersistenceData(userId) {
    const data = getLocalUserMergeData(userId);
    return {
        activeProtocol: cloneValue(data.activeProtocol, null),
        protocolHistory: cloneValue(data.protocolHistory, []),
        nutritionMemory: cloneValue(data.nutritionMemory, null),
        supplementMemory: cloneValue(data.supplementMemory, null),
        adaptationSummary: cloneValue(data.adaptationSummary, null),
        progressLogs: cloneValue(data.progressLogs, [])
    };
}

function hasMeaningfulMergeData(data) {
    return Boolean(
        isMeaningfulObject(data?.activeProtocol)
        || (Array.isArray(data?.protocolHistory) && data.protocolHistory.length > 0)
        || isMeaningfulObject(data?.nutritionMemory)
        || isMeaningfulObject(data?.supplementMemory)
        || isMeaningfulObject(data?.adaptationSummary)
        || (Array.isArray(data?.progressLogs) && data.progressLogs.length > 0)
    );
}

function buildLocalMergeCandidate(user) {
    const normalizedUser = normalizeLocalUser(user);
    if (!normalizedUser) return null;

    const data = getLocalUserMergeData(normalizedUser.id);
    if (!hasMeaningfulMergeData(data)) return null;

    return { user: normalizedUser, data };
}

function resolveLocalMergeCandidate(cloudUser, preferredLocalUser = null) {
    const candidates = [];
    const pushCandidate = (user) => {
        const normalized = normalizeLocalUser(user);
        if (!normalized || candidates.some((entry) => entry.id === normalized.id)) return;
        candidates.push(normalized);
    };

    pushCandidate(preferredLocalUser);

    const currentUser = getCurrentUser();
    if (currentUser?.provider === 'local') {
        pushCandidate(currentUser);
    }

    for (const user of getUsers()) {
        pushCandidate(user);
    }

    const meaningfulCandidates = candidates
        .map(buildLocalMergeCandidate)
        .filter(Boolean);

    if (meaningfulCandidates.length === 0) return null;

    if (preferredLocalUser) {
        const preferred = normalizeLocalUser(preferredLocalUser);
        const matchedPreferred = meaningfulCandidates.find((candidate) => candidate.user.id === preferred?.id);
        if (matchedPreferred) return matchedPreferred;
    }

    const currentLocal = normalizeLocalUser(currentUser);
    const currentCandidate = meaningfulCandidates.find((candidate) => candidate.user.id === currentLocal?.id);
    if (currentCandidate) return currentCandidate;

    const emailMatches = meaningfulCandidates.filter(
        (candidate) => candidate.user.email && candidate.user.email === cloudUser?.email
    );
    if (emailMatches.length === 1) return emailMatches[0];

    return meaningfulCandidates.length === 1 ? meaningfulCandidates[0] : null;
}

function buildPendingMergeBundle(localUser, cloudUser, data) {
    return {
        version: 1,
        createdAt: Date.now(),
        status: 'pending',
        localUser: normalizeLocalUser(localUser),
        cloudUser: normalizeUser(cloudUser),
        data: {
            activeProtocol: cloneValue(data?.activeProtocol, null),
            protocolHistory: cloneValue(data?.protocolHistory, []),
            nutritionMemory: cloneValue(data?.nutritionMemory, null),
            supplementMemory: cloneValue(data?.supplementMemory, null),
            adaptationSummary: cloneValue(data?.adaptationSummary, null),
            ...(Array.isArray(data?.progressLogs) && data.progressLogs.length > 0
                ? { progressLogs: cloneValue(data.progressLogs, []) }
                : {})
        }
    };
}

function getPendingMergeFingerprint(bundle) {
    if (!bundle) return '';

    return stableSerialize({
        version: bundle.version,
        status: bundle.status,
        localUser: bundle.localUser,
        cloudUser: bundle.cloudUser,
        data: bundle.data
    });
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

export function getStorageMode() {
    if (!isSupabaseConfigured()) return 'local';
    if (!hasActiveSupabaseSession()) return 'local';

    const currentUser = getCurrentUser();
    const syncState = currentUser?.id ? getSyncState(currentUser.id) : createSyncState();
    return syncState.source === 'cloud-fallback-local' ? 'local' : 'cloud';
}

export function isCloudStorageAvailable() {
    return getStorageMode() === 'cloud';
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

export function getUserSlot(userId) {
    if (!userId) return null;
    return getProtocolState().users?.[userId] ?? null;
}

export function ensureUserSlot(userId, email = '') {
    if (!userId) return null;
    const state = getProtocolState();
    if (!state.users) state.users = {};
    if (!state.users[userId]) {
        state.users[userId] = {
            email: String(email || userId).trim().toLowerCase(),
            assessment_state: { step: 0, data: {} },
            active_protocol: null,
            history: [],
            telemetry: []
        };
        saveProtocolState(state);
    }
    return state.users[userId];
}

export function getActiveProtocol(userId) {
    if (!userId) return null;
    return getUserSlot(userId)?.active_protocol ?? null;
}

export function saveActiveProtocol(userId, protocol) {
    if (!userId) return;
    const state = getProtocolState();
    ensureUserSlot(userId);
    state.users[userId].active_protocol = protocol;
    saveProtocolState(state);
}

export function getProtocolHistory(userId) {
    if (!userId) return [];
    const history = getUserSlot(userId)?.history;
    return Array.isArray(history) ? history : [];
}

export function saveProtocolHistory(userId, history) {
    if (!userId) return;
    const state = getProtocolState();
    ensureUserSlot(userId);
    state.users[userId].history = Array.isArray(history) ? history : [];
    saveProtocolState(state);
}

export function getAssessmentState(userId) {
    return getUserSlot(userId)?.assessment_state ?? { step: 0, data: {} };
}

export function saveAssessmentState(userId, assessmentState) {
    if (!userId) return;
    const state = getProtocolState();
    ensureUserSlot(userId);
    state.users[userId].assessment_state = assessmentState && typeof assessmentState === 'object'
        ? assessmentState
        : { step: 0, data: {} };
    saveProtocolState(state);
}

export function getTelemetry(userId) {
    if (!userId) return [];
    const telemetry = getUserSlot(userId)?.telemetry;
    return Array.isArray(telemetry) ? telemetry : [];
}

export function appendTelemetry(userId, log) {
    if (!userId) return;
    const state = getProtocolState();
    ensureUserSlot(userId);
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

export function createPendingMergeBundle(cloudUser, preferredLocalUser = null) {
    const normalizedCloudUser = normalizeUser(cloudUser);
    if (!normalizedCloudUser?.id) return null;

    const candidate = resolveLocalMergeCandidate(normalizedCloudUser, preferredLocalUser);
    if (!candidate) return null;

    const bundle = buildPendingMergeBundle(candidate.user, normalizedCloudUser, candidate.data);
    const fingerprint = getPendingMergeFingerprint(bundle);
    const records = getPendingMergeRecords();
    const existing = normalizePendingMergeRecord(records[normalizedCloudUser.id]);

    if (existing?.fingerprint === fingerprint && existing?.bundle) {
        return cloneValue(existing.bundle, null);
    }

    records[normalizedCloudUser.id] = {
        fingerprint,
        bundle,
        persistence: createPendingMergePersistenceState()
    };
    savePendingMergeRecords(records);

    return cloneValue(bundle, null);
}

export function getPendingMergeBundle(cloudUserId) {
    if (!cloudUserId) return null;
    const record = normalizePendingMergeRecord(getPendingMergeRecords()[String(cloudUserId)]);
    return cloneValue(record?.bundle, null);
}

export function hasPendingMergeBundle(cloudUserId) {
    return getMergeStatus(cloudUserId) === 'pending';
}

export function clearPendingMergeBundle(cloudUserId) {
    if (!cloudUserId) return;
    const records = getPendingMergeRecords();
    delete records[String(cloudUserId)];
    savePendingMergeRecords(records);
}

export function getMergeStatus(cloudUserId) {
    return getPendingMergeBundle(cloudUserId)?.status || 'none';
}

export function getPendingMergeState(cloudUserId) {
    const record = cloudUserId ? normalizePendingMergeRecord(getPendingMergeRecords()[String(cloudUserId)]) : null;
    const bundle = cloneValue(record?.bundle, null);
    return {
        hasPending: Boolean(bundle && bundle.status === 'pending'),
        status: bundle?.status || 'none',
        bundle
    };
}

export function markPendingMergePersisted(cloudUserId, fingerprint = '') {
    if (!cloudUserId) return null;

    const records = getPendingMergeRecords();
    const record = normalizePendingMergeRecord(records[String(cloudUserId)]);
    if (!record?.bundle) return null;

    records[String(cloudUserId)] = {
        ...record,
        persistence: createPendingMergePersistenceState({
            ...record.persistence,
            status: 'persisted',
            persistedAt: Date.now(),
            persistedFingerprint: fingerprint || record.fingerprint,
            lastAttemptAt: Date.now(),
            lastError: null
        })
    };
    savePendingMergeRecords(records);

    return getPendingMergePersistenceState(cloudUserId);
}

export function hydratePendingMergeBundle(bundle, persistence = {}) {
    if (!bundle?.cloudUser?.id) return null;

    const cloudUserId = String(bundle.cloudUser.id);
    const normalizedBundle = cloneValue(bundle, null);
    if (!normalizedBundle) return null;

    const fingerprint = getPendingMergeFingerprint(normalizedBundle);
    const records = getPendingMergeRecords();
    records[cloudUserId] = {
        fingerprint,
        bundle: normalizedBundle,
        persistence: createPendingMergePersistenceState({
            status: persistence.status || 'pending',
            persistedAt: persistence.persistedAt || null,
            persistedFingerprint: persistence.persistedFingerprint || '',
            lastAttemptAt: persistence.lastAttemptAt || null,
            lastError: persistence.lastError || null
        })
    };
    savePendingMergeRecords(records);

    return getPendingMergeState(cloudUserId);
}

export function markPendingMergePersistenceFailed(cloudUserId, reason = 'persistence_failed') {
    if (!cloudUserId) return null;

    const records = getPendingMergeRecords();
    const record = normalizePendingMergeRecord(records[String(cloudUserId)]);
    if (!record?.bundle) return null;

    records[String(cloudUserId)] = {
        ...record,
        persistence: createPendingMergePersistenceState({
            ...record.persistence,
            status: 'error',
            lastAttemptAt: Date.now(),
            lastError: reason || 'persistence_failed'
        })
    };
    savePendingMergeRecords(records);

    return getPendingMergePersistenceState(cloudUserId);
}

export function getPendingMergePersistenceState(cloudUserId) {
    if (!cloudUserId) {
        return {
            hasPending: false,
            status: 'none',
            isPersisted: false,
            lastError: null,
            persistedAt: null,
            fingerprint: '',
            persistedFingerprint: ''
        };
    }

    const record = normalizePendingMergeRecord(getPendingMergeRecords()[String(cloudUserId)]);
    if (!record?.bundle) {
        return {
            hasPending: false,
            status: 'none',
            isPersisted: false,
            lastError: null,
            persistedAt: null,
            fingerprint: '',
            persistedFingerprint: ''
        };
    }

    return {
        hasPending: record.bundle.status === 'pending',
        status: record.persistence.status || 'pending',
        isPersisted: record.persistence.status === 'persisted'
            && record.persistence.persistedFingerprint === record.fingerprint,
        lastError: record.persistence.lastError || null,
        persistedAt: record.persistence.persistedAt || null,
        fingerprint: record.fingerprint,
        persistedFingerprint: record.persistence.persistedFingerprint || ''
    };
}

export function getCloudPersistenceMode() {
    if (!isSupabaseConfigured()) return 'local-only';
    return hasActiveSupabaseSession() ? 'cloud-active' : 'cloud-ready';
}

export function hasCloudPersistence() {
    return getCloudPersistenceMode() !== 'local-only';
}

export function canPersistCurrentUserData() {
    return getCloudPersistenceMode() === 'cloud-active' && Boolean(getCurrentUser()?.id);
}

export function getStorageDataSourceMode() {
    const currentUser = getCurrentUser();
    if (!currentUser?.id) return 'local';

    const syncState = getSyncState(currentUser.id);
    return syncState.source === 'cloud' || syncState.source === 'cloud-fallback-local'
        ? syncState.source
        : 'local';
}

export function restoreUserProtocolState(userId, data = {}) {
    if (!userId) return null;

    const memories = {
        nutritionMemory: data.nutritionMemory ?? null,
        supplementMemory: data.supplementMemory ?? null,
        adaptationSummary: data.adaptationSummary ?? null
    };

    const activeProtocol = applyMemoriesToProtocol(data.activeProtocol, memories);
    const protocolHistory = dedupeProtocolHistory(
        Array.isArray(data.protocolHistory) ? data.protocolHistory : []
    ).map((entry) => applyMemoriesToProtocol(entry, {})).filter(Boolean);
    const progressLogs = Array.isArray(data.progressLogs) ? cloneValue(data.progressLogs, []) : [];

    saveActiveProtocol(userId, activeProtocol ?? null);
    saveProtocolHistory(userId, protocolHistory);
    saveProgressEntries(userId, progressLogs);

    return getUserPersistenceData(userId);
}

export function getSyncState(userId) {
    if (!userId) return createSyncState();
    return createSyncState(getSyncStateRecords()[String(userId)]);
}

export function saveSyncState(userId, state = {}) {
    if (!userId) return createSyncState();

    const records = getSyncStateRecords();
    records[String(userId)] = createSyncState(state);
    saveSyncStateRecords(records);

    return getSyncState(userId);
}