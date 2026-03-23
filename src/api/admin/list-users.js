/**
 * GET /api/admin/list-users
 * Lists Supabase Auth users (admin API). Requires caller JWT with app_metadata.is_admin === true.
 * Uses service role only on the server — never exposed to the browser.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();

function mapUser(row) {
    const meta = row.app_metadata || {};
    const umeta = row.user_metadata || {};
    let provider = meta.provider;
    if (!provider && Array.isArray(row.identities) && row.identities.length > 0) {
        provider = row.identities[0]?.provider;
    }
    if (!provider) provider = 'email';
    const displayName = umeta.full_name || umeta.name || umeta.display_name || umeta.preferred_username || '';
    return {
        id: row.id,
        email: row.email || '',
        displayName: typeof displayName === 'string' ? displayName : '',
        provider: String(provider),
        role: meta.is_admin === true ? 'admin' : 'user',
        createdAt: row.created_at || null
    };
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'GET') {
        res.status(405).json({ ok: false, error: 'Method not allowed' });
        return;
    }

    if (!supabaseUrl || !serviceKey) {
        res.status(503).json({ ok: false, error: 'Server not configured for admin list' });
        return;
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
        res.status(401).json({ ok: false, error: 'Missing authorization' });
        return;
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData?.user) {
        res.status(401).json({ ok: false, error: 'Invalid session' });
        return;
    }

    if (userData.user.app_metadata?.is_admin !== true) {
        res.status(403).json({ ok: false, error: 'Forbidden' });
        return;
    }

    const allUsers = [];
    let page = 1;
    const perPage = 200;
    while (page <= 50) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (error) {
            res.status(500).json({ ok: false, error: error.message || 'list_users_failed' });
            return;
        }
        const batch = data?.users || [];
        allUsers.push(...batch);
        if (batch.length < perPage) break;
        page += 1;
    }

    const users = allUsers.map(mapUser);
    res.status(200).json({ ok: true, users });
}
