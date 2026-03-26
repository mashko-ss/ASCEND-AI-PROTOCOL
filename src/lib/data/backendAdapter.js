/**
 * ASCEND AI PROTOCOL — Backend adapter (local data bridge)
 *
 * All methods resolve to data in storageAdapter (local mode). No network calls.
 */

import {
    getCurrentUser,
    getUserPersistenceData,
    getPendingMergeState as getStoredPendingMergeState,
    getSyncState as getStoredSyncState,
    getCloudPersistenceMode
} from './storageAdapter.js';

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

function pendingMergeForUser(localUser) {
    if (!localUser?.id) {
        return { hasPending: false, status: 'none', bundle: null };
    }
    return getStoredPendingMergeState(localUser.id);
}

// FUTURE: replace with Supabase call
export async function restoreCurrentUserData() {
    const localUser = getCurrentUser();
    const localData = localUser?.id
        ? getUserPersistenceData(localUser.id)
        : getUserPersistenceData(null);

    return {
        ok: true,
        mode: 'local',
        source: 'local',
        user: localUser,
        data: localData,
        pendingMergeState: pendingMergeForUser(localUser),
        syncState: createSyncResult('local', {
            enabled: getCloudPersistenceMode() !== 'local-only',
            hasSession: false,
            pendingMerge: pendingMergeForUser(localUser).hasPending
        })
    };
}

// FUTURE: replace with Supabase call
export function getCurrentSyncState() {
    const currentUser = getCurrentUser();
    if (!currentUser?.id) {
        return createSyncResult('local', {
            enabled: getCloudPersistenceMode() !== 'local-only',
            hasSession: false
        });
    }

    const stored = getStoredSyncState(currentUser.id);
    const merge = pendingMergeForUser(currentUser);
    return createSyncResult('local', {
        ...stored,
        enabled: getCloudPersistenceMode() !== 'local-only',
        hasSession: false,
        pendingMerge: merge.hasPending
    });
}
