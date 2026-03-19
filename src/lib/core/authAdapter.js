/**
 * ASCEND AI PROTOCOL - Auth Adapter
 * Phase 27: Safe auth scaffolding for local + cloud auth.
 */

import {
    getSupabaseClient,
    isSupabaseConfigured,
    hasActiveSupabaseSession,
    getSupabaseSessionSnapshot,
    getSupabaseAuthState
} from '../data/supabaseClient.js';
import {
    saveCurrentUser,
    clearCurrentUser,
    getCurrentUser as getStoredCurrentUser,
    createPendingMergeBundle,
    getPendingMergeState as getStoredPendingMergeState
} from '../data/storageAdapter.js';
import { restoreCurrentUserData, getCurrentSyncState as getBackendSyncState } from '../data/backendAdapter.js';
import {
    createUser,
    loginUser,
    logoutUser,
    getCurrentUser as getLocalCurrentUser
} from './auth.js';

const LOCAL_DEV_URL = 'http://localhost:3000';
const OAUTH_PROVIDERS = ['google', 'facebook', 'apple'];
let restoreSessionPromise = null;
let signOutPromise = null;

function normalizeProviderAlias(provider) {
    const normalized = String(provider || '').trim().toLowerCase();
    if (normalized === 'sms') return 'phone';
    return normalized;
}

function normalizeProvider(provider) {
    const normalized = normalizeProviderAlias(provider);
    return ['local', 'google', 'apple', 'facebook', 'phone'].includes(normalized)
        ? normalized
        : 'local';
}

function inferCloudProvider(user) {
    const providerCandidates = [
        user?.app_metadata?.provider,
        ...(Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers : []),
        ...(Array.isArray(user?.identities) ? user.identities.map((identity) => identity?.provider) : []),
        user?.user_metadata?.provider,
        user?.phone ? 'phone' : ''
    ];

    for (const candidate of providerCandidates) {
        const normalized = normalizeProvider(candidate);
        if (normalized !== 'local') return normalized;
    }

    return 'local';
}

function normalizeCloudUser(user) {
    if (!user || !user.id) return null;
    const provider = inferCloudProvider(user);
    return {
        id: String(user.id),
        email: String(user.email || '').trim().toLowerCase(),
        provider,
        createdAt: typeof user.created_at === 'string' && user.created_at.trim()
            ? user.created_at.trim()
            : typeof user.createdAt === 'string' && user.createdAt.trim()
                ? user.createdAt.trim()
                : typeof user.createdAt === 'number'
                    ? user.createdAt
                    : Date.now()
    };
}

export function getAuthMode() {
    if (!isSupabaseConfigured()) return 'local';
    if (getSupabaseAuthState().status === 'error') return 'local';
    return hasActiveSupabaseSession() ? 'cloud' : 'local';
}

export function isCloudAuthAvailable() {
    return isSupabaseConfigured() && Boolean(getSupabaseClient());
}

export function getSessionUser() {
    const currentUser = getStoredCurrentUser();
    if (!currentUser) return null;
    return hasActiveSupabaseSession() ? currentUser : null;
}

export async function restoreSession() {
    if (restoreSessionPromise) {
        return restoreSessionPromise;
    }

    restoreSessionPromise = (async () => {
    const localUser = getLocalCurrentUser();
    if (!isSupabaseConfigured()) return localUser;

    const client = getSupabaseClient();
    if (!client) return localUser;

    try {
        const snapshot = await getSupabaseSessionSnapshot();
        if (snapshot.mode !== 'cloud' || !snapshot.user) {
            const currentUser = getStoredCurrentUser();
            if (currentUser && currentUser.provider !== 'local') {
                clearCurrentUser();
            }
            return localUser || null;
        }

        const user = normalizeCloudUser(snapshot.user);
        if (user) {
            saveCurrentUser(user);
            createPendingMergeBundle(user, localUser);
            await restoreCurrentUserData();
        }
        return user || null;
    } catch (error) {
        console.warn('[AuthAdapter] restoreSession failed:', error);
        const currentUser = getStoredCurrentUser();
        if (currentUser && currentUser.provider !== 'local') {
            clearCurrentUser();
        }
        return localUser || null;
    }
    })();

    try {
        return await restoreSessionPromise;
    } finally {
        restoreSessionPromise = null;
    }
}

export async function preparePendingMergeForCurrentCloudUser(preferredLocalUser = null) {
    let cloudUser = getSessionUser();

    if (!cloudUser && isSupabaseConfigured()) {
        const snapshot = await getSupabaseSessionSnapshot();
        if (snapshot.mode === 'cloud' && snapshot.user) {
            cloudUser = normalizeCloudUser(snapshot.user);
            if (cloudUser) {
                saveCurrentUser(cloudUser);
            }
        }
    }

    if (!cloudUser) return null;
    return createPendingMergeBundle(cloudUser, preferredLocalUser);
}

export function getPendingMergeState() {
    const cloudUser = getSessionUser();
    return cloudUser ? getStoredPendingMergeState(cloudUser.id) : { hasPending: false, status: 'none', bundle: null };
}

export function hasPendingMergeForCurrentUser() {
    return getPendingMergeState().hasPending;
}

export function getCurrentSyncState() {
    return getBackendSyncState();
}

function getSafeRedirectTo() {
    if (typeof window !== 'undefined' && window.location) {
        const { origin, pathname } = window.location;
        if (/^https?:\/\//.test(origin)) {
            return `${origin}${pathname || ''}`;
        }
    }

    return LOCAL_DEV_URL;
}

async function signInWithOAuthProvider(provider) {
    if (!OAUTH_PROVIDERS.includes(provider)) {
        return { ok: false, mode: 'local', provider, reason: 'unsupported_provider' };
    }

    if (!isSupabaseConfigured()) {
        return { ok: false, mode: 'local', provider, reason: 'cloud_auth_not_configured' };
    }

    const client = getSupabaseClient();
    if (!client) {
        return { ok: false, mode: 'local', provider, reason: 'supabase_client_unavailable' };
    }

    const redirectTo = getSafeRedirectTo();

    try {
        const { data, error } = await client.auth.signInWithOAuth({
            provider,
            options: { redirectTo }
        });

        if (error) {
            return { ok: false, mode: 'local', provider, reason: error.message || 'oauth_sign_in_failed' };
        }

        return {
            ok: true,
            mode: 'cloud',
            provider,
            redirectUrl: data?.url || redirectTo
        };
    } catch (error) {
        return {
            ok: false,
            mode: 'local',
            provider,
            reason: error?.message || 'oauth_sign_in_unavailable'
        };
    }
}

export async function signInWithGoogle() {
    return signInWithOAuthProvider('google');
}

export async function signInWithFacebook() {
    return signInWithOAuthProvider('facebook');
}

export async function signInWithApple() {
    return signInWithOAuthProvider('apple');
}

export async function signInWithPhone(phone) {
    if (!isSupabaseConfigured()) {
        return { ok: false, mode: 'local', provider: 'phone', reason: 'cloud_auth_not_configured' };
    }

    const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';
    if (!normalizedPhone) {
        return { ok: false, mode: 'local', provider: 'phone', reason: 'phone_required' };
    }

    const client = getSupabaseClient();
    if (!client || typeof client.auth?.signInWithOtp !== 'function') {
        return { ok: false, mode: 'local', provider: 'phone', reason: 'phone_auth_unavailable' };
    }

    try {
        const { error } = await client.auth.signInWithOtp({ phone: normalizedPhone });
        if (error) {
            return { ok: false, mode: 'local', provider: 'phone', reason: error.message || 'otp_request_failed' };
        }

        return { ok: true, mode: 'cloud', provider: 'phone', reason: 'otp_requested' };
    } catch (error) {
        return {
            ok: false,
            mode: 'local',
            provider: 'phone',
            reason: error?.message || 'phone_auth_unavailable'
        };
    }
}

export async function signInWithOtp(phone) {
    return signInWithPhone(phone);
}

export async function signOutUser() {
    if (signOutPromise) {
        return signOutPromise;
    }

    signOutPromise = (async () => {
    const currentCloudUser = getSessionUser();
    let hasCloudSession = Boolean(currentCloudUser);

    if (!hasCloudSession && isSupabaseConfigured()) {
        const snapshot = await getSupabaseSessionSnapshot();
        hasCloudSession = snapshot.mode === 'cloud' && Boolean(snapshot.user);
    }

    if (hasCloudSession && isSupabaseConfigured()) {
        const client = getSupabaseClient();
        if (client) {
            try {
                const { error } = await client.auth.signOut();
                if (error) {
                    return { ok: false, mode: 'cloud', reason: error.message || 'cloud_sign_out_failed' };
                }
            } catch (error) {
                console.warn('[AuthAdapter] cloud signOut failed:', error);
                return {
                    ok: false,
                    mode: 'cloud',
                    reason: error?.message || 'cloud_sign_out_failed'
                };
            }
        }
    }
    logoutUser();
    clearCurrentUser();
    return {
        ok: true,
        mode: 'local',
        ...(hasCloudSession ? {} : { reason: 'already_signed_out' })
    };
    })();

    try {
        return await signOutPromise;
    } finally {
        signOutPromise = null;
    }
}

export { createUser, loginUser };