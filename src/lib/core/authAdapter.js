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
    createUser as localCreateUser,
    loginUser as localLoginUser,
    logoutUser as localLogoutUser,
    getCurrentUser as getLocalCurrentUser
} from './auth.js';

let restoreSessionPromise = null;
let signOutPromise = null;

// FUTURE: route to cloud auth here (e.g. Supabase session + merge with local user).

export function createUser(email) {
    return localCreateUser(email);
}

export function loginUser(email) {
    return localLoginUser(email);
}

export function logoutUser() {
    localLogoutUser();
}

export function getCurrentUser() {
    return getLocalCurrentUser();
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
        const localUser = getLocalCurrentUser();
        await restoreCurrentUserData();
        return localUser;
    })();

    try {
        return await restoreSessionPromise;
    } finally {
        restoreSessionPromise = null;
    }
}

export function getSessionUser() {
    return null;
}

export function isCurrentUserAdmin() {
    return false;
}

export function getCurrentSyncState() {
    return getBackendSyncState();
}

export async function signInWithGoogle() {
    return { ok: false, mode: 'local', provider: 'google', reason: 'cloud_auth_not_configured' };
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
        localLogoutUser();
        clearCurrentUser();
        return { ok: true, mode: 'local' };
    })();

    try {
        return await signOutPromise;
    } finally {
        signOutPromise = null;
    }
}
