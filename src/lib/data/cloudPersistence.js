/**
 * ASCEND AI PROTOCOL - Cloud Persistence
 * Phase 5: Safe Supabase-backed persistence helpers.
 */

import { getSupabaseClient, getSupabaseSessionSnapshot } from './supabaseClient.js';

const TABLES = {
    USER_PROFILES: 'user_profiles',
    ACTIVE_PROTOCOLS: 'user_active_protocols',
    PROTOCOL_HISTORIES: 'user_protocol_histories',
    USER_MEMORIES: 'user_protocol_memories',
    USER_PROGRESS_LOGS: 'user_progress_logs',
    PENDING_MERGES: 'user_pending_merges'
};

function cloneValue(value, fallback = null) {
    if (value == null) return fallback;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return fallback;
    }
}

function toIsoString(value = Date.now()) {
    try {
        return new Date(value).toISOString();
    } catch {
        return new Date().toISOString();
    }
}

function createResult(ok, entity, mode, extra = {}) {
    return { ok, entity, mode, ...extra };
}

async function getPersistenceContext(entity) {
    const snapshot = await getSupabaseSessionSnapshot();
    if (snapshot.mode !== 'cloud' || !snapshot.user) {
        return createResult(false, entity, 'local', {
            reason: snapshot.reason || 'no_active_session',
            client: null,
            user: null
        });
    }

    const client = getSupabaseClient();
    if (!client) {
        return createResult(false, entity, 'local', {
            reason: 'supabase_client_unavailable',
            client: null,
            user: null
        });
    }

    return createResult(true, entity, 'cloud', { client, user: snapshot.user });
}

async function upsertCloudRow(entity, table, payload, onConflict = 'user_id') {
    const context = await getPersistenceContext(entity);
    if (!context.ok) return context;

    try {
        const { error } = await context.client
            .from(table)
            .upsert(cloneValue(payload, {}), { onConflict });

        if (error) {
            return createResult(false, entity, 'cloud', { reason: error.message || 'cloud_upsert_failed' });
        }

        return createResult(true, entity, 'cloud');
    } catch (error) {
        return createResult(false, entity, 'cloud', {
            reason: error?.message || 'cloud_upsert_failed'
        });
    }
}

export async function saveCloudUserProfile(userProfile) {
    if (!userProfile?.id) {
        return createResult(false, 'user_profile', 'local', { reason: 'user_profile_required' });
    }

    return upsertCloudRow('user_profile', TABLES.USER_PROFILES, {
        user_id: String(userProfile.id),
        email: String(userProfile.email || '').trim().toLowerCase(),
        provider: String(userProfile.provider || 'local'),
        created_at: userProfile.createdAt ?? null,
        updated_at: toIsoString()
    });
}

export async function saveCloudProtocolSnapshot(userId, activeProtocol) {
    if (!userId) {
        return createResult(false, 'active_protocol', 'local', { reason: 'user_id_required' });
    }

    return upsertCloudRow('active_protocol', TABLES.ACTIVE_PROTOCOLS, {
        user_id: String(userId),
        active_protocol: cloneValue(activeProtocol, null),
        updated_at: toIsoString(
            activeProtocol?.updated_at || activeProtocol?.updatedAt || Date.now()
        )
    });
}

export async function saveCloudProtocolHistory(userId, protocolHistory) {
    if (!userId) {
        return createResult(false, 'protocol_history', 'local', { reason: 'user_id_required' });
    }

    const history = Array.isArray(protocolHistory) ? cloneValue(protocolHistory, []) : [];

    return upsertCloudRow('protocol_history', TABLES.PROTOCOL_HISTORIES, {
        user_id: String(userId),
        protocol_history: history,
        history_count: history.length,
        updated_at: toIsoString()
    });
}

export async function saveCloudMemories(userId, memories = {}) {
    if (!userId) {
        return createResult(false, 'memories', 'local', { reason: 'user_id_required' });
    }

    return upsertCloudRow('memories', TABLES.USER_MEMORIES, {
        user_id: String(userId),
        nutrition_memory: cloneValue(memories.nutritionMemory, null),
        supplement_memory: cloneValue(memories.supplementMemory, null),
        adaptation_summary: cloneValue(memories.adaptationSummary, null),
        updated_at: toIsoString()
    });
}

export async function saveCloudProgressLogs(userId, progressLogs = []) {
    if (!userId) {
        return createResult(false, 'progress_logs', 'local', { reason: 'user_id_required' });
    }

    const logs = Array.isArray(progressLogs) ? cloneValue(progressLogs, []) : [];

    return upsertCloudRow('progress_logs', TABLES.USER_PROGRESS_LOGS, {
        user_id: String(userId),
        progress_logs: logs,
        updated_at: toIsoString()
    });
}

export async function saveCloudPendingMergeBundle(bundle, persistenceState = {}) {
    if (!bundle?.cloudUser?.id) {
        return createResult(false, 'pending_merge', 'local', { reason: 'pending_merge_required' });
    }

    return upsertCloudRow('pending_merge', TABLES.PENDING_MERGES, {
        cloud_user_id: String(bundle.cloudUser.id),
        local_user_id: String(bundle.localUser?.id || ''),
        status: String(bundle.status || 'pending'),
        fingerprint: String(persistenceState.fingerprint || ''),
        persisted_at: persistenceState.persistedAt ? toIsoString(persistenceState.persistedAt) : null,
        bundle: cloneValue(bundle, null),
        updated_at: toIsoString()
    }, 'cloud_user_id');
}
