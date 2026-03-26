/**
 * ASCEND AI PROTOCOL — Supabase client (scaffold only)
 *
 * Reads SUPABASE_URL and SUPABASE_PUBLIC_KEY from the environment.
 * Does not instantiate a client or open network connections in this phase.
 *
 * Reference when wiring cloud: https://zfpqdsdawjiwsxtfbgjf.supabase.co
 * Project ref: zfpqdsdawjiwsxtfbgjf
 */

let warnedMissingConfig = false;

function getEnvObject() {
    if (typeof window === 'undefined' || !window || typeof window.ENV !== 'object' || !window.ENV) {
        return {};
    }
    return window.ENV;
}

function getEnvValue(key) {
    const windowValue = getEnvObject()[key];
    if (typeof windowValue === 'string' && windowValue.trim()) {
        return windowValue.trim();
    }

    const importMetaValue = import.meta?.env?.[key];
    if (typeof importMetaValue === 'string' && importMetaValue.trim()) {
        return importMetaValue.trim();
    }

    const processValue = globalThis?.process?.env?.[key];
    return typeof processValue === 'string' ? processValue.trim() : '';
}

function sanitizeEnvValue(value) {
    if (!value || value === 'LOCAL_DEV_REPLACE_ME') return '';
    return value;
}

function getSupabaseConfig() {
    const url = sanitizeEnvValue(getEnvValue('SUPABASE_URL'));
    const publicKey = sanitizeEnvValue(
        getEnvValue('SUPABASE_PUBLIC_KEY') || getEnvValue('SUPABASE_ANON_KEY')
    );

    return {
        url,
        publicKey,
        isValid: Boolean(url && publicKey && /^https?:\/\//.test(url))
    };
}

function warnMissingConfigOnce() {
    if (warnedMissingConfig) return;
    warnedMissingConfig = true;
    const { url, publicKey } = getSupabaseConfig();
    if (!url || !publicKey) {
        console.warn(
            '[SupabaseClient] SUPABASE_URL and SUPABASE_PUBLIC_KEY are not both set; running in local mode.'
        );
    }
}

/**
 * Returns true only when both URL and public key are present and the URL looks valid.
 * Does not throw if variables are missing.
 */
export function isSupabaseConfigured() {
    const valid = getSupabaseConfig().isValid;
    if (!valid) {
        warnMissingConfigOnce();
    }
    return valid;
}

/**
 * Compatibility stub: no client is created in this phase.
 * // FUTURE: initialize Supabase client here when ready (createClient + options).
 */
export function getSupabaseClient() {
    return null;
}

/** No live session without a client; safe for local-only mode. */
export function hasActiveSupabaseSession() {
    return false;
}

export function getSupabaseAuthState() {
    return {
        status: 'signed_out',
        hasSession: false,
        degraded: false,
        reason: null,
        lastCheckedAt: null
    };
}

/**
 * Resolves without network I/O. Callers expecting a cloud session receive local mode.
 * // FUTURE: use getSupabaseClient() and session APIs when the client exists.
 */
export async function getSupabaseSessionSnapshot() {
    if (!isSupabaseConfigured()) {
        return {
            ok: false,
            mode: 'local',
            user: null,
            reason: 'supabase_not_configured'
        };
    }
    return {
        ok: true,
        mode: 'local',
        user: null,
        reason: 'no_active_session'
    };
}

export async function testSupabaseConnection() {
    const snap = await getSupabaseSessionSnapshot();
    return snap.reason ? { ok: snap.ok, mode: snap.mode, reason: snap.reason } : { ok: snap.ok, mode: snap.mode };
}
