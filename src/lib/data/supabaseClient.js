/**
 * ASCEND AI PROTOCOL - Supabase Client Foundation
 * Phase 26: Safe, non-destructive Supabase scaffolding.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let cachedClient = null;

function getEnvValue(key) {
    if (typeof window === 'undefined' || !window.ENV) return '';
    return String(window.ENV[key] || '').trim();
}

function sanitizeEnvValue(value) {
    if (!value || value === 'LOCAL_DEV_REPLACE_ME') return '';
    return value;
}

export function isSupabaseConfigured() {
    const url = sanitizeEnvValue(getEnvValue('SUPABASE_URL'));
    const anonKey = sanitizeEnvValue(getEnvValue('SUPABASE_ANON_KEY'));
    return Boolean(url && anonKey);
}

export function getSupabaseClient() {
    if (!isSupabaseConfigured()) return null;
    if (cachedClient) return cachedClient;

    try {
        const url = sanitizeEnvValue(getEnvValue('SUPABASE_URL'));
        const anonKey = sanitizeEnvValue(getEnvValue('SUPABASE_ANON_KEY'));
        cachedClient = createClient(url, anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        return cachedClient;
    } catch (error) {
        console.warn('[SupabaseClient] Failed to initialize:', error);
        return null;
    }
}

export async function testSupabaseConnection() {
    const client = getSupabaseClient();
    if (!client) {
        return { ok: false, message: 'Supabase not configured. Falling back to local mode.' };
    }

    try {
        const { error } = await client.auth.getSession();
        if (error) {
            return { ok: false, message: `Supabase auth session check failed: ${error.message}` };
        }
        return { ok: true, message: 'Supabase connection OK' };
    } catch (error) {
        return { ok: false, message: `Supabase connection failed: ${error.message || String(error)}` };
    }
}