/**
 * ASCEND AI PROTOCOL - Backend Adapter
 * Phase 26: Safe backend mode selection.
 */

import {
    getSupabaseClient,
    isSupabaseConfigured,
    testSupabaseConnection,
    hasActiveSupabaseSession,
    getSupabaseSessionSnapshot,
    getSupabaseAuthState
} from './supabaseClient.js';
import {
    getCurrentUser,
    saveCurrentUser,
    clearCurrentUser,
    createPendingMergeBundle,
    getPendingMergeState as getStoredPendingMergeState,
    getPendingMergeBundle,
    getPendingMergePersistenceState as getStoredPendingMergePersistenceState,
    markPendingMergePersisted as markStoredPendingMergePersisted,
    markPendingMergePersistenceFailed,
    getUserPersistenceData,
    restoreUserProtocolState,
    hydratePendingMergeBundle,
    getSyncState as getStoredSyncState,
    saveSyncState,
    getCloudPersistenceMode
} from './storageAdapter.js';
import {
    saveCloudUserProfile as persistCloudUserProfile,
    saveCloudProtocolSnapshot as persistCloudProtocolSnapshot,
    saveCloudProtocolHistory as persistCloudProtocolHistory,
    saveCloudMemories as persistCloudMemories,
    saveCloudProgressLogs as persistCloudProgressLogs,
    saveCloudPendingMergeBundle as persistCloudPendingMergeBundle
} from './cloudPersistence.js';

const TABLES = {
    ACTIVE_PROTOCOLS: 'user_active_protocols',
    PROTOCOL_HISTORIES: 'user_protocol_histories',
    USER_MEMORIES: 'user_protocol_memories',
    USER_PROGRESS_LOGS: 'user_progress_logs',
    PENDING_MERGES: 'user_pending_merges'
};

let restoreBackendSessionPromise = null;

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

function inferCloudProvider(user) {
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

function normalizeBackendUser(user) {
    if (!user || !user.id) return null;
    const provider = inferCloudProvider(user);
    const isAdmin = Boolean(
        user.app_metadata?.is_admin === true || user.raw_app_meta_data?.is_admin === true
    );

    return {
        id: String(user.id),
        email: String(user.email || '').trim().toLowerCase(),
        provider,
        isAdmin,
        createdAt: typeof user.created_at === 'string' && user.created_at.trim()
            ? user.created_at.trim()
            : typeof user.createdAt === 'string' && user.createdAt.trim()
                ? user.createdAt.trim()
                : typeof user.createdAt === 'number'
                    ? user.createdAt
                    : Date.now()
    };
}

function createPersistenceResult(ok, entity, mode, extra = {}) {
    return { ok, entity, mode, ...extra };
}

function cloneValue(value, fallback = null) {
    if (value == null) return fallback;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return fallback;
    }
}

function createSyncResult(source = 'local', overrides = {}) {
    return {
        enabled: source !== 'local',
        source,
        hasSession: source !== 'local',
        lastSyncAt: null,
        pendingMerge: false,
        degraded: source === 'cloud-fallback-local',
        reason: null,
        ...overrides
    };
}

async function readCloudRecord(client, table, matchKey, matchValue, selectClause = '*') {
    try {
        const { data, error } = await client
            .from(table)
            .select(selectClause)
            .eq(matchKey, String(matchValue))
            .maybeSingle();

        if (error) {
            return { ok: false, reason: error.message || 'cloud_read_failed', data: null };
        }

        return { ok: true, data: cloneValue(data, null) };
    } catch (error) {
        return { ok: false, reason: error?.message || 'cloud_read_failed', data: null };
    }
}

function normalizeCloudProtocolObject(protocol, userId, memories = {}) {
    const cloned = cloneValue(protocol, null);
    if (!cloned || typeof cloned !== 'object') return null;

    cloned.userId = userId ?? cloned.userId ?? null;
    cloned.created_at = cloned.created_at ?? cloned.createdAt ?? Date.now();
    cloned.updated_at = cloned.updated_at ?? cloned.updatedAt ?? cloned.created_at;
    cloned.status = cloned.status || 'active';

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

function hydrateCloudProtocolBundle(userId, payloads = {}) {
    const memoryRow = payloads.memories || {};
    const sharedMemories = {
        nutritionMemory: cloneValue(memoryRow.nutrition_memory, null),
        supplementMemory: cloneValue(memoryRow.supplement_memory, null),
        adaptationSummary: cloneValue(memoryRow.adaptation_summary, null)
    };
    const activeProtocol = normalizeCloudProtocolObject(
        payloads.activeProtocol?.active_protocol ?? null,
        userId,
        sharedMemories
    );
    const protocolHistory = Array.isArray(payloads.protocolHistory?.protocol_history)
        ? payloads.protocolHistory.protocol_history
            .map((entry) => normalizeCloudProtocolObject(entry, userId, {}))
            .filter(Boolean)
        : [];
    const progressLogs = Array.isArray(payloads.progressLogs?.progress_logs)
        ? cloneValue(payloads.progressLogs.progress_logs, [])
        : [];
    const pendingMergeBundle = cloneValue(payloads.pendingMerge?.bundle, null);

    return {
        activeProtocol,
        protocolHistory,
        nutritionMemory: sharedMemories.nutritionMemory,
        supplementMemory: sharedMemories.supplementMemory,
        adaptationSummary: sharedMemories.adaptationSummary,
        progressLogs,
        pendingMergeBundle,
        pendingMergePersistence: pendingMergeBundle
            ? {
                status: payloads.pendingMerge?.status || 'pending',
                persistedAt: payloads.pendingMerge?.persisted_at
                    ? Date.parse(payloads.pendingMerge.persisted_at)
                    : null,
                persistedFingerprint: payloads.pendingMerge?.fingerprint || '',
                lastAttemptAt: payloads.pendingMerge?.updated_at
                    ? Date.parse(payloads.pendingMerge.updated_at)
                    : null,
                lastError: null
            }
            : null
    };
}

async function readCloudUserData(userId) {
    const client = getSupabaseClient();
    if (!client) {
        return { ok: false, reason: 'supabase_client_unavailable', source: 'cloud-fallback-local', data: null };
    }

    const [
        activeProtocol,
        protocolHistory,
        memories,
        progressLogs,
        pendingMerge
    ] = await Promise.all([
        readCloudRecord(client, TABLES.ACTIVE_PROTOCOLS, 'user_id', userId, 'active_protocol, updated_at'),
        readCloudRecord(client, TABLES.PROTOCOL_HISTORIES, 'user_id', userId, 'protocol_history, updated_at'),
        readCloudRecord(client, TABLES.USER_MEMORIES, 'user_id', userId, 'nutrition_memory, supplement_memory, adaptation_summary, updated_at'),
        readCloudRecord(client, TABLES.USER_PROGRESS_LOGS, 'user_id', userId, 'progress_logs, updated_at'),
        readCloudRecord(client, TABLES.PENDING_MERGES, 'cloud_user_id', userId, 'bundle, status, fingerprint, persisted_at, updated_at')
    ]);

    const failedRead = [activeProtocol, protocolHistory, memories, progressLogs, pendingMerge].find((result) => !result.ok);
    if (failedRead) {
        return {
            ok: false,
            reason: failedRead.reason || 'cloud_read_failed',
            source: 'cloud-fallback-local',
            data: null
        };
    }

    return {
        ok: true,
        source: 'cloud',
        data: hydrateCloudProtocolBundle(userId, {
            activeProtocol: activeProtocol.data,
            protocolHistory: protocolHistory.data,
            memories: memories.data,
            progressLogs: progressLogs.data,
            pendingMerge: pendingMerge.data
        })
    };
}

async function resolvePersistableCloudUser(preferredUser = null) {
    if (preferredUser?.id && hasActiveSupabaseSession()) {
        return normalizeBackendUser(preferredUser);
    }

    const currentUser = getCurrentBackendUser();
    if (currentUser?.id && hasActiveSupabaseSession()) {
        return normalizeBackendUser(currentUser);
    }

    const restored = await restoreBackendSession();
    if (restored?.mode !== 'cloud' || !restored.user?.id) return null;
    return normalizeBackendUser(restored.user);
}

export function getBackendMode() {
    if (!isSupabaseConfigured()) return 'local';
    if (getSupabaseAuthState().status === 'error') return 'local';
    return hasActiveSupabaseSession() ? 'cloud' : 'local';
}

export function getStorageMode() {
    return getBackendMode();
}

export function isCloudAvailable() {
    return getBackendMode() === 'cloud';
}

export function isSupabaseAvailable() {
    return isCloudAvailable();
}

export function getBackendClient() {
    return getSupabaseClient();
}

export function getCurrentBackendUser() {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;
    if (hasActiveSupabaseSession()) return currentUser;
    return currentUser.provider === 'local' ? currentUser : null;
}

export async function restoreBackendSession() {
    if (restoreBackendSessionPromise) {
        return restoreBackendSessionPromise;
    }

    restoreBackendSessionPromise = (async () => {
    const currentUser = getCurrentUser();
    const localUser = currentUser?.provider === 'local' ? currentUser : null;

    if (!isSupabaseConfigured()) {
        return { mode: 'local', user: localUser };
    }

    const client = getSupabaseClient();
    if (!client) {
        return { mode: 'local', user: localUser };
    }

    try {
        const snapshot = await getSupabaseSessionSnapshot();
        if (snapshot.mode !== 'cloud' || !snapshot.user) {
            const currentUser = getCurrentUser();
            if (currentUser && currentUser.provider !== 'local') {
                clearCurrentUser();
            }
            return {
                mode: 'local',
                user: localUser || null,
                reason: snapshot.reason || 'no_active_session'
            };
        }

        const user = normalizeBackendUser(snapshot.user);
        if (user) {
            saveCurrentUser(user);
            createPendingMergeBundle(user, localUser);
        }
        return { mode: user && user.provider !== 'local' ? 'cloud' : 'local', user };
    } catch (error) {
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.provider !== 'local') {
            clearCurrentUser();
        }
        return {
            mode: 'local',
            user: localUser,
            reason: error?.message || 'session_restore_failed'
        };
    }
    })();

    try {
        return await restoreBackendSessionPromise;
    } finally {
        restoreBackendSessionPromise = null;
    }
}

export async function preparePendingMergeForCurrentCloudUser() {
    const restored = await restoreBackendSession();
    if (!restored?.user || restored.mode !== 'cloud') return null;
    return createPendingMergeBundle(restored.user);
}

export function getPendingMergeState() {
    const currentUser = getCurrentBackendUser();
    return currentUser && hasActiveSupabaseSession()
        ? getStoredPendingMergeState(currentUser.id)
        : { hasPending: false, status: 'none', bundle: null };
}

export function hasPendingMergeForCurrentUser() {
    return getPendingMergeState().hasPending;
}

export function getPendingMergePersistenceState() {
    const currentUser = getCurrentBackendUser();
    return currentUser && hasActiveSupabaseSession()
        ? getStoredPendingMergePersistenceState(currentUser.id)
        : {
            hasPending: false,
            status: 'none',
            isPersisted: false,
            lastError: null,
            persistedAt: null,
            fingerprint: '',
            persistedFingerprint: ''
        };
}

export function hasCloudPersistence() {
    return isSupabaseAvailable();
}

export function getDataSourceMode() {
    const currentUser = getCurrentBackendUser();
    if (!currentUser?.id) return 'local';
    if (!hasActiveSupabaseSession()) return 'local';

    const syncState = getStoredSyncState(currentUser.id);
    if (syncState.source === 'cloud-fallback-local') {
        return syncState.source;
    }

    return 'cloud';
}

export function isBackendSourceOfTruth() {
    return getDataSourceMode() === 'cloud';
}

export function getCurrentSyncState() {
    const currentUser = getCurrentBackendUser();
    if (!currentUser?.id) {
        return createSyncResult('local', {
            enabled: getCloudPersistenceMode() !== 'local-only',
            hasSession: false
        });
    }

    const stored = getStoredSyncState(currentUser.id);
    return createSyncResult(getDataSourceMode(), {
        ...stored,
        enabled: getCloudPersistenceMode() !== 'local-only',
        hasSession: hasActiveSupabaseSession(),
        pendingMerge: hasPendingMergeForCurrentUser()
    });
}

export function hasPendingMergeForCurrentCloudUser() {
    return hasActiveSupabaseSession() && hasPendingMergeForCurrentUser();
}

export function getPendingMergeStateForCurrentUser() {
    return getPendingMergeState();
}

export async function saveCloudUserProfile(user = null) {
    const cloudUser = await resolvePersistableCloudUser(user);
    if (!cloudUser) {
        return createPersistenceResult(false, 'user_profile', 'local', { reason: 'cloud_user_unavailable' });
    }

    return persistCloudUserProfile(cloudUser);
}

export async function saveCloudProtocolSnapshot(userId = null) {
    const cloudUser = await resolvePersistableCloudUser();
    if (!cloudUser) {
        return createPersistenceResult(false, 'active_protocol', 'local', { reason: 'cloud_user_unavailable' });
    }

    const targetUserId = userId || cloudUser.id;
    const data = getUserPersistenceData(targetUserId);
    return persistCloudProtocolSnapshot(targetUserId, data.activeProtocol);
}

export async function saveCloudProtocolHistory(userId = null) {
    const cloudUser = await resolvePersistableCloudUser();
    if (!cloudUser) {
        return createPersistenceResult(false, 'protocol_history', 'local', { reason: 'cloud_user_unavailable' });
    }

    const targetUserId = userId || cloudUser.id;
    const data = getUserPersistenceData(targetUserId);
    return persistCloudProtocolHistory(targetUserId, data.protocolHistory);
}

export async function saveCloudMemories(userId = null) {
    const cloudUser = await resolvePersistableCloudUser();
    if (!cloudUser) {
        return createPersistenceResult(false, 'memories', 'local', { reason: 'cloud_user_unavailable' });
    }

    const targetUserId = userId || cloudUser.id;
    const data = getUserPersistenceData(targetUserId);
    return persistCloudMemories(targetUserId, {
        nutritionMemory: data.nutritionMemory,
        supplementMemory: data.supplementMemory,
        adaptationSummary: data.adaptationSummary
    });
}

export async function saveCloudProgressLogs(userId = null) {
    const cloudUser = await resolvePersistableCloudUser();
    if (!cloudUser) {
        return createPersistenceResult(false, 'progress_logs', 'local', { reason: 'cloud_user_unavailable' });
    }

    const targetUserId = userId || cloudUser.id;
    const data = getUserPersistenceData(targetUserId);
    return persistCloudProgressLogs(targetUserId, data.progressLogs);
}

export async function savePendingMergeBundle(cloudUserId = null) {
    const cloudUser = await resolvePersistableCloudUser();
    const resolvedCloudUserId = cloudUserId || cloudUser?.id || null;
    if (!resolvedCloudUserId) {
        return createPersistenceResult(false, 'pending_merge', 'local', { reason: 'cloud_user_unavailable' });
    }

    const bundle = getPendingMergeBundle(resolvedCloudUserId);
    if (!bundle) {
        return createPersistenceResult(false, 'pending_merge', 'local', { reason: 'no_pending_merge' });
    }

    const persistenceState = getStoredPendingMergePersistenceState(resolvedCloudUserId);
    if (persistenceState.isPersisted && persistenceState.fingerprint === persistenceState.persistedFingerprint) {
        return createPersistenceResult(true, 'pending_merge', 'cloud', {
            reason: 'already_persisted',
            cloudUserId: resolvedCloudUserId
        });
    }

    const result = await persistCloudPendingMergeBundle(bundle, persistenceState);
    if (!result.ok) {
        markPendingMergePersistenceFailed(resolvedCloudUserId, result.reason || 'pending_merge_persist_failed');
        return { ...result, cloudUserId: resolvedCloudUserId };
    }

    markStoredPendingMergePersisted(resolvedCloudUserId, persistenceState.fingerprint);
    return {
        ...result,
        cloudUserId: resolvedCloudUserId,
        persistence: getStoredPendingMergePersistenceState(resolvedCloudUserId)
    };
}

export async function markPendingMergePersisted(cloudUserId = null) {
    return savePendingMergeBundle(cloudUserId);
}

export async function persistCurrentCloudUserData() {
    const cloudUser = await resolvePersistableCloudUser();
    if (!cloudUser) {
        return {
            ok: false,
            mode: 'local',
            reason: 'cloud_user_unavailable',
            results: []
        };
    }

    const results = await Promise.all([
        saveCloudUserProfile(cloudUser),
        saveCloudProtocolSnapshot(cloudUser.id),
        saveCloudProtocolHistory(cloudUser.id),
        saveCloudMemories(cloudUser.id),
        saveCloudProgressLogs(cloudUser.id),
        savePendingMergeBundle(cloudUser.id)
    ]);

    return {
        ok: results.every((result) => result.ok || result.reason === 'no_pending_merge' || result.reason === 'already_persisted'),
        mode: 'cloud',
        results
    };
}

export async function restoreCurrentUserData() {
    const cloudUser = await resolvePersistableCloudUser();
    if (!cloudUser) {
        const localUser = getCurrentUser();
        const localData = localUser?.id ? getUserPersistenceData(localUser.id) : getUserPersistenceData(null);
        return {
            ok: true,
            mode: 'local',
            source: 'local',
            user: localUser,
            data: localData,
            pendingMergeState: localUser?.id ? getStoredPendingMergeState(localUser.id) : { hasPending: false, status: 'none', bundle: null },
            syncState: createSyncResult('local', {
                enabled: getCloudPersistenceMode() !== 'local-only',
                hasSession: false,
                pendingMerge: false
            })
        };
    }

    const cloudRead = await readCloudUserData(cloudUser.id);
    if (cloudRead.ok) {
        saveCurrentUser(cloudUser);
        const hydratedData = restoreUserProtocolState(cloudUser.id, cloudRead.data);

        if (cloudRead.data.pendingMergeBundle) {
            hydratePendingMergeBundle(
                cloudRead.data.pendingMergeBundle,
                cloudRead.data.pendingMergePersistence || {}
            );
        }

        const pendingMergeState = getStoredPendingMergeState(cloudUser.id);
        const syncState = saveSyncState(cloudUser.id, {
            enabled: true,
            source: 'cloud',
            hasSession: true,
            lastSyncAt: Date.now(),
            pendingMerge: pendingMergeState.hasPending,
            degraded: false,
            reason: null
        });

        return {
            ok: true,
            mode: 'cloud',
            source: 'cloud',
            user: cloudUser,
            data: hydratedData,
            pendingMergeState,
            syncState
        };
    }

    const fallbackData = getUserPersistenceData(cloudUser.id);
    const pendingMergeState = getStoredPendingMergeState(cloudUser.id);
    const syncState = saveSyncState(cloudUser.id, {
        enabled: true,
        source: 'cloud-fallback-local',
        hasSession: true,
        lastSyncAt: null,
        pendingMerge: pendingMergeState.hasPending,
        degraded: true,
        reason: cloudRead.reason || 'cloud_read_failed'
    });

    return {
        ok: false,
        mode: 'cloud',
        source: 'cloud-fallback-local',
        user: cloudUser,
        data: fallbackData,
        reason: cloudRead.reason || 'cloud_read_failed',
        pendingMergeState,
        syncState
    };
}

export async function restoreCloudDataWithPendingMergeAwareness() {
    return restoreCurrentUserData();
}

export async function testBackendConnection() {
    if (!isSupabaseConfigured()) {
        return { ok: true, mode: 'local', reason: 'local_mode_active' };
    }
    return testSupabaseConnection();
}