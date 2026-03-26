/**
 * ASCEND AI PROTOCOL - Backend adapter
 *
 * Bridges local storage with optional Supabase persistence.
 */

import {
    getCurrentUser,
    getUserPersistenceData,
    createPendingMergeBundle,
    getPendingMergeState as getStoredPendingMergeState,
    getPendingMergePersistenceState,
    hydratePendingMergeBundle,
    markPendingMergePersisted,
    markPendingMergePersistenceFailed,
    restoreUserProtocolState,
    getSyncState as getStoredSyncState,
    saveSyncState,
    getCloudPersistenceMode
} from './storageAdapter.js';
import { getSupabaseSessionSnapshot, getSupabaseAuthState } from './supabaseClient.js';
import {
    loadCloudPersistenceBundle,
    saveCloudUserProfile,
    saveCloudPendingMergeBundle,
    saveCloudPersistenceBundle,
    hasCloudPersistenceData
} from './cloudPersistence.js';

function createSyncResult(source = 'local', overrides = {}) {
    return {
        enabled: false,
        source,
        hasSession: false,
        lastSyncAt: null,
        pendingMerge: false,
        degraded: false,
        reason: null,
        ...overrides
    };
}

function createEmptyPendingMergeState() {
    return { hasPending: false, status: 'none', bundle: null };
}

function pendingMergeForCloudUser(cloudUserId) {
    if (!cloudUserId) return createEmptyPendingMergeState();
    return getStoredPendingMergeState(cloudUserId);
}

function getLocalPersistenceData(user) {
    return user?.id ? getUserPersistenceData(user.id) : getUserPersistenceData(null);
}

function firstReason(...values) {
    return values.find((value) => typeof value === 'string' && value.trim()) || null;
}

function buildLocalRestoreResult(localUser, overrides = {}) {
    const data = getLocalPersistenceData(localUser);
    const syncState = createSyncResult('local', {
        enabled: getCloudPersistenceMode() !== 'local-only',
        hasSession: false,
        pendingMerge: false,
        ...overrides.syncState
    });

    if (localUser?.id) {
        saveSyncState(localUser.id, syncState);
    }

    return {
        ok: true,
        mode: 'local',
        source: syncState.source,
        user: localUser,
        data,
        pendingMergeState: createEmptyPendingMergeState(),
        syncState
    };
}

async function persistPendingMergeRecord(bundle) {
    if (!bundle?.cloudUser?.id) {
        return { ok: false, reason: 'pending_merge_required' };
    }

    const cloudUserId = String(bundle.cloudUser.id);
    const persistenceState = getPendingMergePersistenceState(cloudUserId);
    const result = await saveCloudPendingMergeBundle(bundle, persistenceState);

    if (result.ok) {
        markPendingMergePersisted(cloudUserId, persistenceState.fingerprint);
    } else {
        markPendingMergePersistenceFailed(cloudUserId, result.reason);
    }

    return result;
}

export async function restoreCurrentUserData(preferredLocalUser = null) {
    const snapshot = await getSupabaseSessionSnapshot();
    const currentUser = getCurrentUser();

    if (!snapshot?.user) {
        return buildLocalRestoreResult(currentUser, {
            syncState: {
                degraded: snapshot?.ok === false,
                reason: snapshot?.ok === false ? snapshot.reason || 'session_snapshot_failed' : null
            }
        });
    }

    const cloudUser = snapshot.user;
    const cloudUserId = String(cloudUser.id);
    const localCandidate = preferredLocalUser?.provider === 'local' ? preferredLocalUser : null;

    const profileSave = await saveCloudUserProfile(cloudUser);
    const cloudBundle = await loadCloudPersistenceBundle(cloudUserId);

    if (cloudBundle.pendingMergeBundle) {
        hydratePendingMergeBundle(cloudBundle.pendingMergeBundle, cloudBundle.pendingMergePersistence || {});
    }

    const generatedPendingMerge = createPendingMergeBundle(cloudUser, localCandidate);
    const persistedPendingMerge = pendingMergeForCloudUser(cloudUserId);
    const pendingMergeBundle = persistedPendingMerge.bundle || generatedPendingMerge || null;

    let pendingMergeSave = null;
    if (pendingMergeBundle) {
        pendingMergeSave = await persistPendingMergeRecord(pendingMergeBundle);
    }

    const cloudData = cloudBundle.data || getUserPersistenceData(null);
    const fallbackData = pendingMergeBundle?.data || getLocalPersistenceData(currentUser);
    const shouldUseCloudData = hasCloudPersistenceData(cloudData);
    const shouldUseFallbackData = hasCloudPersistenceData(fallbackData);
    const restoreData = shouldUseCloudData ? cloudData : fallbackData;
    const source = shouldUseCloudData
        ? 'cloud'
        : shouldUseFallbackData
            ? 'cloud-fallback-local'
            : 'cloud';

    if (hasCloudPersistenceData(restoreData)) {
        restoreUserProtocolState(cloudUserId, restoreData);
    }

    let bundleSeedResult = null;
    if (!shouldUseCloudData && shouldUseFallbackData) {
        bundleSeedResult = await saveCloudPersistenceBundle(cloudUser, fallbackData, {
            pendingMergeBundle,
            pendingMergePersistenceState: getPendingMergePersistenceState(cloudUserId)
        });
    }

    const finalData = getUserPersistenceData(cloudUserId);
    const pendingMergeState = pendingMergeForCloudUser(cloudUserId);
    const degraded = Boolean(
        profileSave.ok === false
        || cloudBundle.ok === false
        || pendingMergeSave?.ok === false
        || bundleSeedResult?.ok === false
    );
    const reason = firstReason(
        profileSave.ok === false ? profileSave.reason : null,
        cloudBundle.ok === false ? cloudBundle.reason : null,
        pendingMergeSave?.ok === false ? pendingMergeSave.reason : null,
        bundleSeedResult?.ok === false ? bundleSeedResult.reason : null
    );
    const syncState = createSyncResult(source, {
        enabled: getCloudPersistenceMode() !== 'local-only',
        hasSession: true,
        lastSyncAt: Date.now(),
        pendingMerge: pendingMergeState.hasPending,
        degraded,
        reason
    });

    saveSyncState(cloudUserId, syncState);

    return {
        ok: !degraded,
        mode: 'cloud',
        source,
        user: cloudUser,
        data: finalData,
        pendingMergeState,
        syncState
    };
}

export function getCurrentSyncState() {
    const currentUser = getCurrentUser();
    const authState = getSupabaseAuthState();
    const source = authState.hasSession ? 'cloud' : 'local';

    if (!currentUser?.id) {
        return createSyncResult(source, {
            enabled: getCloudPersistenceMode() !== 'local-only',
            hasSession: authState.hasSession,
            degraded: authState.degraded,
            reason: authState.reason
        });
    }

    const stored = getStoredSyncState(currentUser.id);
    const merge = authState.hasSession
        ? pendingMergeForCloudUser(currentUser.id)
        : createEmptyPendingMergeState();
    const resolvedSource = authState.hasSession
        ? (stored.source || source)
        : 'local';

    return createSyncResult(resolvedSource, {
        ...stored,
        source: resolvedSource,
        enabled: getCloudPersistenceMode() !== 'local-only',
        hasSession: authState.hasSession,
        pendingMerge: merge.hasPending,
        degraded: authState.degraded || stored.degraded,
        reason: authState.reason || stored.reason
    });
}
