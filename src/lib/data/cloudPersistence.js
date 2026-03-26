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

function resolveUserId(context, explicitUserId = null) {
    const value = explicitUserId ?? context?.user?.id ?? '';
    return value ? String(value) : '';
}

function normalizeCloudProfile(row) {
    if (!row || typeof row !== 'object') return null;

    return {
        id: String(row.user_id || ''),
        email: String(row.email || '').trim().toLowerCase(),
        provider: String(row.provider || 'local'),
        createdAt: row.created_at ?? null,
        updatedAt: row.updated_at ?? null
    };
}

function normalizeCloudProtocolRow(row) {
    return cloneValue(row?.active_protocol, null);
}

function normalizeCloudHistoryRow(row) {
    return Array.isArray(row?.protocol_history) ? cloneValue(row.protocol_history, []) : [];
}

function normalizeCloudMemoriesRow(row) {
    return {
        nutritionMemory: cloneValue(row?.nutrition_memory, null),
        supplementMemory: cloneValue(row?.supplement_memory, null),
        adaptationSummary: cloneValue(row?.adaptation_summary, null)
    };
}

function normalizeCloudProgressRow(row) {
    return Array.isArray(row?.progress_logs) ? cloneValue(row.progress_logs, []) : [];
}

function normalizeCloudPendingMergeRow(row) {
    return {
        bundle: cloneValue(row?.bundle, null),
        persistence: {
            status: String(row?.status || 'pending'),
            persistedAt: row?.persisted_at || null,
            persistedFingerprint: String(row?.fingerprint || ''),
            lastAttemptAt: row?.updated_at || null,
            lastError: null
        }
    };
}

function buildPersistenceData(protocolResult, historyResult, memoriesResult, progressResult) {
    const memories = memoriesResult?.memories || {
        nutritionMemory: null,
        supplementMemory: null,
        adaptationSummary: null
    };

    return {
        activeProtocol: protocolResult?.activeProtocol ?? null,
        protocolHistory: historyResult?.protocolHistory ?? [],
        nutritionMemory: memories.nutritionMemory ?? null,
        supplementMemory: memories.supplementMemory ?? null,
        adaptationSummary: memories.adaptationSummary ?? null,
        progressLogs: progressResult?.progressLogs ?? []
    };
}

function firstFailureReason(...results) {
    return results.find((result) => result && result.ok === false)?.reason || null;
}

export function hasCloudPersistenceData(data) {
    return Boolean(
        data?.activeProtocol
        || (Array.isArray(data?.protocolHistory) && data.protocolHistory.length > 0)
        || data?.nutritionMemory
        || data?.supplementMemory
        || data?.adaptationSummary
        || (Array.isArray(data?.progressLogs) && data.progressLogs.length > 0)
    );
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

async function upsertCloudRow(entity, table, payload, onConflict = 'user_id', context = null) {
    const resolvedContext = context || await getPersistenceContext(entity);
    if (!resolvedContext.ok) return resolvedContext;

    try {
        const { error } = await resolvedContext.client
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

async function selectCloudRow(entity, table, matchColumn, matchValue, context = null) {
    const resolvedContext = context || await getPersistenceContext(entity);
    if (!resolvedContext.ok) return resolvedContext;

    const lookupValue = resolveUserId(resolvedContext, matchValue);
    if (!lookupValue) {
        return createResult(false, entity, 'local', { reason: `${matchColumn}_required` });
    }

    try {
        const { data, error } = await resolvedContext.client
            .from(table)
            .select('*')
            .eq(matchColumn, lookupValue)
            .maybeSingle();

        if (error) {
            return createResult(false, entity, 'cloud', {
                reason: error.message || 'cloud_select_failed'
            });
        }

        return createResult(true, entity, 'cloud', {
            found: Boolean(data),
            row: cloneValue(data, null)
        });
    } catch (error) {
        return createResult(false, entity, 'cloud', {
            reason: error?.message || 'cloud_select_failed'
        });
    }
}

export async function loadCloudUserProfile(userId = null) {
    const result = await selectCloudRow('user_profile', TABLES.USER_PROFILES, 'user_id', userId);
    return {
        ...result,
        profile: result.ok && result.found ? normalizeCloudProfile(result.row) : null
    };
}

export async function loadCloudProtocolSnapshot(userId = null) {
    const result = await selectCloudRow('active_protocol', TABLES.ACTIVE_PROTOCOLS, 'user_id', userId);
    return {
        ...result,
        activeProtocol: result.ok && result.found ? normalizeCloudProtocolRow(result.row) : null
    };
}

export async function loadCloudProtocolHistory(userId = null) {
    const result = await selectCloudRow('protocol_history', TABLES.PROTOCOL_HISTORIES, 'user_id', userId);
    return {
        ...result,
        protocolHistory: result.ok && result.found ? normalizeCloudHistoryRow(result.row) : []
    };
}

export async function loadCloudMemories(userId = null) {
    const result = await selectCloudRow('memories', TABLES.USER_MEMORIES, 'user_id', userId);
    return {
        ...result,
        memories: result.ok && result.found
            ? normalizeCloudMemoriesRow(result.row)
            : {
                nutritionMemory: null,
                supplementMemory: null,
                adaptationSummary: null
            }
    };
}

export async function loadCloudProgressLogs(userId = null) {
    const result = await selectCloudRow('progress_logs', TABLES.USER_PROGRESS_LOGS, 'user_id', userId);
    return {
        ...result,
        progressLogs: result.ok && result.found ? normalizeCloudProgressRow(result.row) : []
    };
}

export async function loadCloudPendingMergeBundle(cloudUserId = null) {
    const result = await selectCloudRow('pending_merge', TABLES.PENDING_MERGES, 'cloud_user_id', cloudUserId);
    const normalized = result.ok && result.found ? normalizeCloudPendingMergeRow(result.row) : null;
    return {
        ...result,
        bundle: normalized?.bundle || null,
        persistence: normalized?.persistence || null
    };
}

export async function loadCloudPersistenceBundle(userId = null) {
    const context = await getPersistenceContext('persistence_bundle');
    if (!context.ok) {
        return {
            ...context,
            userProfile: null,
            data: buildPersistenceData(null, null, null, null),
            pendingMergeBundle: null,
            pendingMergePersistence: null
        };
    }

    const resolvedUserId = resolveUserId(context, userId);
    if (!resolvedUserId) {
        return createResult(false, 'persistence_bundle', 'local', {
            reason: 'user_id_required',
            userProfile: null,
            data: buildPersistenceData(null, null, null, null),
            pendingMergeBundle: null,
            pendingMergePersistence: null
        });
    }

    const [
        profileResult,
        protocolResult,
        historyResult,
        memoriesResult,
        progressResult,
        pendingMergeResult
    ] = await Promise.all([
        selectCloudRow('user_profile', TABLES.USER_PROFILES, 'user_id', resolvedUserId, context),
        selectCloudRow('active_protocol', TABLES.ACTIVE_PROTOCOLS, 'user_id', resolvedUserId, context),
        selectCloudRow('protocol_history', TABLES.PROTOCOL_HISTORIES, 'user_id', resolvedUserId, context),
        selectCloudRow('memories', TABLES.USER_MEMORIES, 'user_id', resolvedUserId, context),
        selectCloudRow('progress_logs', TABLES.USER_PROGRESS_LOGS, 'user_id', resolvedUserId, context),
        selectCloudRow('pending_merge', TABLES.PENDING_MERGES, 'cloud_user_id', resolvedUserId, context)
    ]);

    const protocolPayload = {
        ...protocolResult,
        activeProtocol: protocolResult.ok && protocolResult.found
            ? normalizeCloudProtocolRow(protocolResult.row)
            : null
    };
    const historyPayload = {
        ...historyResult,
        protocolHistory: historyResult.ok && historyResult.found
            ? normalizeCloudHistoryRow(historyResult.row)
            : []
    };
    const memoriesPayload = {
        ...memoriesResult,
        memories: memoriesResult.ok && memoriesResult.found
            ? normalizeCloudMemoriesRow(memoriesResult.row)
            : {
                nutritionMemory: null,
                supplementMemory: null,
                adaptationSummary: null
            }
    };
    const progressPayload = {
        ...progressResult,
        progressLogs: progressResult.ok && progressResult.found
            ? normalizeCloudProgressRow(progressResult.row)
            : []
    };
    const normalizedPendingMerge = pendingMergeResult.ok && pendingMergeResult.found
        ? normalizeCloudPendingMergeRow(pendingMergeResult.row)
        : null;
    const reason = firstFailureReason(
        profileResult,
        protocolResult,
        historyResult,
        memoriesResult,
        progressResult,
        pendingMergeResult
    );

    return {
        ok: !reason,
        entity: 'persistence_bundle',
        mode: 'cloud',
        reason,
        userProfile: profileResult.ok && profileResult.found ? normalizeCloudProfile(profileResult.row) : null,
        data: buildPersistenceData(protocolPayload, historyPayload, memoriesPayload, progressPayload),
        pendingMergeBundle: normalizedPendingMerge?.bundle || null,
        pendingMergePersistence: normalizedPendingMerge?.persistence || null
    };
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

export async function saveCloudPersistenceBundle(userProfile, data = {}, options = {}) {
    if (!userProfile?.id) {
        return createResult(false, 'persistence_bundle', 'local', { reason: 'user_profile_required' });
    }

    const context = await getPersistenceContext('persistence_bundle');
    if (!context.ok) return context;

    const history = Array.isArray(data.protocolHistory) ? cloneValue(data.protocolHistory, []) : [];
    const progressLogs = Array.isArray(data.progressLogs) ? cloneValue(data.progressLogs, []) : [];

    const results = await Promise.all([
        upsertCloudRow('user_profile', TABLES.USER_PROFILES, {
            user_id: String(userProfile.id),
            email: String(userProfile.email || '').trim().toLowerCase(),
            provider: String(userProfile.provider || 'local'),
            created_at: userProfile.createdAt ?? null,
            updated_at: toIsoString()
        }, 'user_id', context),
        upsertCloudRow('active_protocol', TABLES.ACTIVE_PROTOCOLS, {
            user_id: String(userProfile.id),
            active_protocol: cloneValue(data.activeProtocol, null),
            updated_at: toIsoString(
                data?.activeProtocol?.updated_at || data?.activeProtocol?.updatedAt || Date.now()
            )
        }, 'user_id', context),
        upsertCloudRow('protocol_history', TABLES.PROTOCOL_HISTORIES, {
            user_id: String(userProfile.id),
            protocol_history: history,
            history_count: history.length,
            updated_at: toIsoString()
        }, 'user_id', context),
        upsertCloudRow('memories', TABLES.USER_MEMORIES, {
            user_id: String(userProfile.id),
            nutrition_memory: cloneValue(data.nutritionMemory, null),
            supplement_memory: cloneValue(data.supplementMemory, null),
            adaptation_summary: cloneValue(data.adaptationSummary, null),
            updated_at: toIsoString()
        }, 'user_id', context),
        upsertCloudRow('progress_logs', TABLES.USER_PROGRESS_LOGS, {
            user_id: String(userProfile.id),
            progress_logs: progressLogs,
            updated_at: toIsoString()
        }, 'user_id', context)
    ]);

    let pendingMergeResult = null;
    if (options.pendingMergeBundle?.cloudUser?.id) {
        pendingMergeResult = await upsertCloudRow('pending_merge', TABLES.PENDING_MERGES, {
            cloud_user_id: String(options.pendingMergeBundle.cloudUser.id),
            local_user_id: String(options.pendingMergeBundle.localUser?.id || ''),
            status: String(options.pendingMergeBundle.status || 'pending'),
            fingerprint: String(options.pendingMergePersistenceState?.fingerprint || ''),
            persisted_at: options.pendingMergePersistenceState?.persistedAt
                ? toIsoString(options.pendingMergePersistenceState.persistedAt)
                : null,
            bundle: cloneValue(options.pendingMergeBundle, null),
            updated_at: toIsoString()
        }, 'cloud_user_id', context);
    }

    const reason = firstFailureReason(...results, pendingMergeResult);
    return {
        ok: !reason,
        entity: 'persistence_bundle',
        mode: 'cloud',
        reason,
        results,
        pendingMergeResult
    };
}
