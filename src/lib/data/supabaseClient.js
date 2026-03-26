/**
 * ASCEND AI PROTOCOL - Supabase client
 * Browser-side client for auth/session-aware flows.
 */

let warnedMissingConfig = false;
let clientInstance = null;
let authListenerAttached = false;
let cachedSession = null;
let cachedUser = null;

const authState = {
    status: 'signed_out',
    hasSession: false,
    degraded: false,
    reason: null,
    lastCheckedAt: null
};

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

function canUseBrowserClient() {
    return typeof window !== 'undefined';
}

function getCreateClientFactory() {
    const factory = globalThis?.supabase?.createClient;
    return typeof factory === 'function' ? factory : null;
}

function updateAuthState(session, overrides = {}) {
    authState.status = session ? 'signed_in' : 'signed_out';
    authState.hasSession = Boolean(session);
    authState.degraded = overrides.degraded ?? false;
    authState.reason = overrides.reason ?? (session ? null : 'no_active_session');
    authState.lastCheckedAt = overrides.lastCheckedAt ?? Date.now();
}

async function getVerifiedUser(client, session) {
    if (!session?.access_token) return session?.user || null;

    try {
        const { data, error } = await client.auth.getUser(session.access_token);
        if (error) throw error;
        return data?.user || session.user || null;
    } catch (error) {
        updateAuthState(session, {
            degraded: true,
            reason: error?.message || 'get_user_failed',
            lastCheckedAt: Date.now()
        });
        return session.user || null;
    }
}

function attachAuthListener(client) {
    if (!client || authListenerAttached) return;
    authListenerAttached = true;

    client.auth.onAuthStateChange((_event, session) => {
        cachedSession = session || null;
        cachedUser = session?.user || null;
        updateAuthState(session || null, {
            degraded: false,
            reason: session ? null : 'no_active_session',
            lastCheckedAt: Date.now()
        });
    });
}

export function getSupabaseConfig() {
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

export function isSupabaseConfigured() {
    const valid = getSupabaseConfig().isValid;
    if (!valid) {
        warnMissingConfigOnce();
    }
    return valid;
}

export function getSupabaseClient() {
    if (!canUseBrowserClient() || !isSupabaseConfigured()) return null;
    if (clientInstance) return clientInstance;

    const createClient = getCreateClientFactory();
    if (!createClient) {
        console.warn('[SupabaseClient] Browser bundle not loaded; running in local mode.');
        return null;
    }

    const { url, publicKey } = getSupabaseConfig();
    clientInstance = createClient(url, publicKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            flowType: 'pkce',
            storageKey: 'ascend-ai-protocol-auth'
        }
    });

    attachAuthListener(clientInstance);
    return clientInstance;
}

export function hasActiveSupabaseSession() {
    return authState.hasSession;
}

export function getSupabaseAuthState() {
    return { ...authState };
}

export async function consumeSupabaseOAuthCodeIfPresent() {
    const client = getSupabaseClient();
    if (!client || typeof window === 'undefined') {
        return { ok: false, reason: 'supabase_client_unavailable' };
    }

    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (!code) {
        return { ok: true, reason: 'no_code' };
    }

    try {
        const { data, error } = await client.auth.exchangeCodeForSession(code);
        if (error) {
            return { ok: false, reason: error.message || 'exchange_code_failed' };
        }

        url.searchParams.delete('code');
        url.searchParams.delete('state');
        if (typeof window.history?.replaceState === 'function') {
            window.history.replaceState({}, document.title, url.toString());
        }

        cachedSession = data?.session || null;
        cachedUser = data?.user || data?.session?.user || null;
        updateAuthState(cachedSession, {
            degraded: false,
            reason: cachedSession ? null : 'no_active_session',
            lastCheckedAt: Date.now()
        });

        return { ok: true, reason: 'code_exchanged', session: cachedSession, user: cachedUser };
    } catch (error) {
        return { ok: false, reason: error?.message || 'exchange_code_failed' };
    }
}

export async function getSupabaseSessionSnapshot() {
    if (!isSupabaseConfigured()) {
        return {
            ok: false,
            mode: 'local',
            session: null,
            user: null,
            reason: 'supabase_not_configured'
        };
    }

    const client = getSupabaseClient();
    if (!client) {
        return {
            ok: false,
            mode: 'local',
            session: null,
            user: null,
            reason: 'supabase_client_unavailable'
        };
    }

    try {
        const { data, error } = await client.auth.getSession();
        if (error) {
            updateAuthState(null, {
                degraded: true,
                reason: error.message || 'get_session_failed',
                lastCheckedAt: Date.now()
            });
            return {
                ok: false,
                mode: 'local',
                session: null,
                user: null,
                reason: error.message || 'get_session_failed'
            };
        }

        const session = data?.session || null;
        if (!session) {
            cachedSession = null;
            cachedUser = null;
            updateAuthState(null, {
                degraded: false,
                reason: 'no_active_session',
                lastCheckedAt: Date.now()
            });
            return {
                ok: true,
                mode: 'cloud',
                session: null,
                user: null,
                reason: 'no_active_session'
            };
        }

        const user = await getVerifiedUser(client, session);
        cachedSession = session;
        cachedUser = user;
        updateAuthState(session, {
            degraded: false,
            reason: null,
            lastCheckedAt: Date.now()
        });

        return {
            ok: true,
            mode: 'cloud',
            session,
            user,
            reason: null
        };
    } catch (error) {
        updateAuthState(null, {
            degraded: true,
            reason: error?.message || 'session_snapshot_failed',
            lastCheckedAt: Date.now()
        });
        return {
            ok: false,
            mode: 'local',
            session: null,
            user: null,
            reason: error?.message || 'session_snapshot_failed'
        };
    }
}

export async function testSupabaseConnection() {
    const snap = await getSupabaseSessionSnapshot();
    return snap.reason ? { ok: snap.ok, mode: snap.mode, reason: snap.reason } : { ok: snap.ok, mode: snap.mode };
}
