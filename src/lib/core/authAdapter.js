/**
 * ASCEND AI PROTOCOL - Auth Adapter
 * Phase 27: Safe auth scaffolding for local + cloud auth.
 */

import { getSupabaseClient, isSupabaseConfigured } from '../data/supabaseClient.js';
import { saveCurrentUser, clearCurrentUser } from '../data/storageAdapter.js';
import { createUser, loginUser, logoutUser, getCurrentUser } from './auth.js';

function normalizeProvider(provider) {
    return ['local', 'google', 'apple', 'facebook'].includes(provider) ? provider : 'local';
}

function normalizeCloudUser(user) {
    if (!user || !user.id) return null;
    const provider = normalizeProvider(
        user.app_metadata?.provider || user.app_metadata?.providers?.[0] || 'local'
    );
    return {
        id: String(user.id),
        email: String(user.email || '').trim().toLowerCase(),
        provider,
        createdAt: typeof user.created_at === 'string' ? Date.parse(user.created_at) : Date.now()
    };
}

export function getAuthMode() {
    return isSupabaseConfigured() ? 'cloud' : 'local';
}

export function isCloudAuthAvailable() {
    return isSupabaseConfigured();
}

export function getSessionUser() {
    return getCurrentUser();
}

export async function restoreSession() {
    if (!isSupabaseConfigured()) return getCurrentUser();
    const client = getSupabaseClient();
    if (!client) return getCurrentUser();

    try {
        const { data, error } = await client.auth.getSession();
        if (error || !data?.session?.user) return getCurrentUser();
        const user = normalizeCloudUser(data.session.user);
        if (user) saveCurrentUser(user);
        return user;
    } catch (error) {
        console.warn('[AuthAdapter] restoreSession failed:', error);
        return getCurrentUser();
    }
}

export async function signInWithGoogle() {
    if (!isSupabaseConfigured()) {
        return { error: 'Cloud auth not configured' };
    }
    const client = getSupabaseClient();
    if (!client) return { error: 'Supabase client unavailable' };

    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
    });

    if (error) return { error: error.message };
    return { redirect: data?.url || redirectTo };
}

export async function signOutUser() {
    if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        if (client) {
            try {
                await client.auth.signOut();
            } catch (error) {
                console.warn('[AuthAdapter] cloud signOut failed:', error);
            }
        }
    }
    logoutUser();
    clearCurrentUser();
}

export { createUser, loginUser };