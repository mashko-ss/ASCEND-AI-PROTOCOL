/**
 * ASCEND AI PROTOCOL - Supabase Client Foundation
 * Phase 26: Safe, non-destructive Supabase scaffolding.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let cachedClient = null;
let authListenerInitialized = false;
let knownSessionState = 'unknown';

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

export function isSupabaseConfigured() {
    return getSupabaseConfig().isValid;
}

function setKnownSessionState(session) {
    knownSessionState = session?.user?.id ? 'authenticated' : 'signed_out';
}

function ensureAuthStateListener(client) {
    if (!client || authListenerInitialized || typeof client.auth?.onAuthStateChange !== 'function') {
        return;
    }

    try {
        client.auth.onAuthStateChange((_event, session) => {
            setKnownSessionState(session);
        });
        authListenerInitialized = true;
    } catch (error) {
        console.warn('[SupabaseClient] Failed to subscribe to auth state:', error);
    }
}

export function getSupabaseClient() {
    if (cachedClient) return cachedClient;
    if (typeof window === 'undefined') return null;

    const config = getSupabaseConfig();
    if (!config.isValid) return null;

    try {
        cachedClient = createClient(config.url, config.publicKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        ensureAuthStateListener(cachedClient);
        return cachedClient;
    } catch (error) {
        console.warn('[SupabaseClient] Failed to initialize:', error);
        return null;
    }
}

export function hasActiveSupabaseSession() {
    return isSupabaseConfigured() && knownSessionState === 'authenticated';
}

export async function getSupabaseSessionSnapshot() {
    if (!isSupabaseConfigured()) {
        return { ok: false, mode: 'local', user: null, reason: 'supabase_not_configured' };
    }

    const client = getSupabaseClient();
    if (!client) {
        return { ok: false, mode: 'local', user: null, reason: 'supabase_client_unavailable' };
    }

    ensureAuthStateListener(client);

    try {
        const { data, error } = await client.auth.getSession();
        if (error) {
            knownSessionState = 'signed_out';
            return {
                ok: false,
                mode: 'local',
                user: null,
                reason: error.message || 'session_check_failed'
            };
        }

        const session = data?.session || null;
        setKnownSessionState(session);

        if (session?.user?.id) {
            return { ok: true, mode: 'cloud', user: session.user };
        }

        return { ok: true, mode: 'local', user: null, reason: 'no_active_session' };
    } catch (error) {
        knownSessionState = 'signed_out';
        return {
            ok: false,
            mode: 'local',
            user: null,
            reason: error?.message || 'session_check_failed'
        };
    }
}

export async function testSupabaseConnection() {
    const { ok, mode, reason } = await getSupabaseSessionSnapshot();
    return reason ? { ok, mode, reason } : { ok, mode };
}