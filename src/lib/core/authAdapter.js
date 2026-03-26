/**
 * ASCEND AI PROTOCOL — Auth adapter (local auth + future cloud hook)
 */

import {
    getCurrentUser as getStoredCurrentUser,
    saveCurrentUser,
    clearCurrentUser
} from '../data/storageAdapter.js';
import { restoreCurrentUserData, getCurrentSyncState as getBackendSyncState } from '../data/backendAdapter.js';
import {
    getSupabaseClient,
    isSupabaseConfigured,
    getSupabaseSessionSnapshot,
    consumeSupabaseOAuthCodeIfPresent,
    getSupabaseAuthState
} from '../data/supabaseClient.js';
import {
    createUser as localCreateUser,
    loginUser as localLoginUser,
    logoutUser as localLogoutUser,
    getCurrentUser as getLocalCurrentUser
} from './auth.js';

let restoreSessionPromise = null;
let signOutPromise = null;
let sessionUser = null;

function getBrowserEnvValue(key) {
    if (typeof window === 'undefined' || !window || typeof window.ENV !== 'object' || !window.ENV) {
        return '';
    }
    const value = window.ENV[key];
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeRedirectUrl(value) {
    if (!value || typeof value !== 'string') return '';
    try {
        const parsed = new URL(value.trim());
        return parsed.toString();
    } catch {
        return '';
    }
}

function resolveGoogleRedirectUrl() {
    if (typeof window === 'undefined') return undefined;

    const configured = normalizeRedirectUrl(
        getBrowserEnvValue('AUTH_REDIRECT_URL') || getBrowserEnvValue('APP_URL')
    );
    const currentUrl = normalizeRedirectUrl(`${window.location.origin}/`) || `${window.location.origin}/`;
    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    if (isLocalhost) {
        if (configured) {
            try {
                const configuredHost = new URL(configured).hostname;
                if (['localhost', '127.0.0.1'].includes(configuredHost)) {
                    return configured;
                }
            } catch {
                /* ignore invalid configured redirect */
            }
        }
        return currentUrl;
    }

    return configured || currentUrl;
}

// FUTURE: route to cloud auth here (e.g. Supabase session + merge with local user).

export function createUser(email, password = '', options = {}) {
    return localCreateUser(email, password, options);
}

export function loginUser(email, password = '') {
    return localLoginUser(email, password);
}

export function logoutUser() {
    localLogoutUser();
}

export function getCurrentUser() {
    return sessionUser || getStoredCurrentUser() || getLocalCurrentUser();
}

export async function saveUsername(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return { ok: false, reason: 'empty' };

    let base = getStoredCurrentUser();
    if (!base) {
        base = getLocalCurrentUser();
    }
    if (!base) return { ok: false, reason: 'no_user' };

    saveCurrentUser({ ...base, username: trimmed });
    return { ok: true };
}

export async function restoreSession() {
    if (restoreSessionPromise) {
        return restoreSessionPromise;
    }

    restoreSessionPromise = (async () => {
        const previousUser = getStoredCurrentUser() || getLocalCurrentUser();

        if (isSupabaseConfigured()) {
            await consumeSupabaseOAuthCodeIfPresent();
            const snapshot = await getSupabaseSessionSnapshot();
            if (snapshot?.user) {
                sessionUser = snapshot.user;
                saveCurrentUser(snapshot.user);
                await restoreCurrentUserData(previousUser);
                return snapshot.user;
            }
        }

        const localUser = getLocalCurrentUser();
        await restoreCurrentUserData(previousUser);
        sessionUser = null;
        return localUser;
    })();

    try {
        return await restoreSessionPromise;
    } finally {
        restoreSessionPromise = null;
    }
}

export function getSessionUser() {
    return sessionUser;
}

export function isCurrentUserAdmin() {
    if (sessionUser?.app_metadata?.is_admin === true) return true;
    if (sessionUser?.isAdmin === true) return true;
    return getStoredCurrentUser()?.isAdmin === true;
}

export function isCloudAuthAvailable() {
    return isSupabaseConfigured() && Boolean(getSupabaseClient());
}

export function getCurrentSyncState() {
    return getBackendSyncState();
}

export async function signInWithGoogle() {
    const client = getSupabaseClient();
    if (!client) {
        return { ok: false, mode: 'local', provider: 'google', reason: 'cloud_auth_not_configured' };
    }

    const redirectTo = resolveGoogleRedirectUrl();

    try {
        const { data, error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                skipBrowserRedirect: true
            }
        });

        if (error) {
            return { ok: false, mode: 'cloud', provider: 'google', reason: error.message || 'oauth_sign_in_unavailable' };
        }

        return {
            ok: true,
            mode: 'cloud',
            provider: 'google',
            redirectUrl: data?.url || null
        };
    } catch (error) {
        return {
            ok: false,
            mode: 'cloud',
            provider: 'google',
            reason: error?.message || 'oauth_sign_in_unavailable'
        };
    }
}

export async function signInWithFacebook() {
    return { ok: false, mode: 'local', provider: 'facebook', reason: 'cloud_auth_not_configured' };
}

export async function signInWithApple() {
    return { ok: false, mode: 'local', provider: 'apple', reason: 'cloud_auth_not_configured' };
}

export async function signInWithPhone(phone) {
    void phone;
    return { ok: false, mode: 'local', provider: 'phone', reason: 'cloud_auth_not_configured' };
}

export async function signInWithOtp(phone) {
    return signInWithPhone(phone);
}

export async function signOutUser() {
    if (signOutPromise) {
        return signOutPromise;
    }

    signOutPromise = (async () => {
        const client = getSupabaseClient();
        if (client) {
            try {
                await client.auth.signOut();
            } catch (error) {
                console.warn('[ASCEND] Supabase sign-out failed:', error);
            }
        }

        sessionUser = null;
        localLogoutUser();
        clearCurrentUser();
        return { ok: true, mode: getSupabaseAuthState().hasSession ? 'cloud' : 'local' };
    })();

    try {
        return await signOutPromise;
    } finally {
        signOutPromise = null;
    }
}
