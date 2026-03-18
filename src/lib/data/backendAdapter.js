/**
 * ASCEND AI PROTOCOL - Backend Adapter
 * Phase 26: Safe backend mode selection.
 */

import { getSupabaseClient, isSupabaseConfigured, testSupabaseConnection } from './supabaseClient.js';

export function getBackendMode() {
    return isSupabaseConfigured() ? 'supabase' : 'local';
}

export function isSupabaseAvailable() {
    return isSupabaseConfigured() && Boolean(getSupabaseClient());
}

export function getBackendClient() {
    return getSupabaseClient();
}

export async function testBackendConnection() {
    if (!isSupabaseConfigured()) {
        return { ok: true, message: 'Local mode active. Supabase not configured.' };
    }
    return testSupabaseConnection();
}