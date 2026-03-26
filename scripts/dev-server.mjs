import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 3000);
const host = '0.0.0.0';

function loadProjectEnv() {
    const localPath = path.join(projectRoot, '.env.local');
    const envPath = path.join(projectRoot, '.env');

    if (existsSync(localPath)) {
        dotenv.config({ path: localPath });
    }
    if (existsSync(envPath)) {
        dotenv.config({ path: envPath, override: false });
    }
}

loadProjectEnv();

const [{ default: generatePlanHandler }, { default: listUsersHandler }] = await Promise.all([
    import('../src/api/ai/generate-plan.js'),
    import('../src/api/admin/list-users.js')
]);

const apiRoutes = new Map([
    ['/api/ai/generate-plan', generatePlanHandler],
    ['/api/admin/list-users', listUsersHandler]
]);

const contentTypes = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.gif', 'image/gif'],
    ['.html', 'text/html; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.jpeg', 'image/jpeg'],
    ['.jpg', 'image/jpeg'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.txt', 'text/plain; charset=utf-8'],
    ['.webmanifest', 'application/manifest+json; charset=utf-8'],
    ['.woff', 'font/woff'],
    ['.woff2', 'font/woff2']
]);

function setNoStoreHeaders(res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
}

function sendJson(res, statusCode, payload) {
    setNoStoreHeaders(res);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}

async function readRequestBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    if (chunks.length === 0) {
        return {};
    }

    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw.trim()) {
        return {};
    }

    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('application/json')) {
        return JSON.parse(raw);
    }

    return raw;
}

function attachResponseHelpers(res) {
    res.status = (statusCode) => {
        res.statusCode = statusCode;
        return res;
    };

    res.json = (payload) => {
        if (!res.headersSent) {
            setNoStoreHeaders(res);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        res.end(JSON.stringify(payload));
    };
}

async function handleApiRequest(req, res, pathname) {
    const handler = apiRoutes.get(pathname);
    if (!handler) {
        sendJson(res, 404, { ok: false, error: 'Not found' });
        return;
    }

    try {
        req.body = await readRequestBody(req);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'Invalid request body' });
        return;
    }

    attachResponseHelpers(res);

    try {
        await handler(req, res);
        if (!res.writableEnded) {
            res.end();
        }
    } catch (error) {
        console.error('[ASCEND] API error:', error);
        if (!res.headersSent) {
            sendJson(res, 500, { ok: false, error: error?.message || 'Internal server error' });
        } else if (!res.writableEnded) {
            res.end();
        }
    }
}

function resolveStaticPath(pathname) {
    const decodedPath = decodeURIComponent(pathname);
    const normalized = path.normalize(decodedPath).replace(/^([/\\])+/, '');
    const absolutePath = path.join(projectRoot, normalized);

    if (!absolutePath.startsWith(projectRoot)) {
        return null;
    }

    return absolutePath;
}

async function serveStaticFile(req, res, filePath) {
    try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
            sendJson(res, 404, { ok: false, error: 'Not found' });
            return;
        }

        setNoStoreHeaders(res);
        const contentType = contentTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);

        if (req.method === 'HEAD') {
            res.end();
            return;
        }

        createReadStream(filePath).pipe(res);
    } catch (error) {
        if (error?.code === 'ENOENT') {
            sendJson(res, 404, { ok: false, error: 'Not found' });
            return;
        }

        console.error('[ASCEND] Static file error:', error);
        sendJson(res, 500, { ok: false, error: 'Failed to read file' });
    }
}

async function handleStaticRequest(req, res, pathname) {
    const requestedPath = resolveStaticPath(pathname);
    const hasExtension = path.extname(pathname) !== '';

    if (requestedPath && existsSync(requestedPath)) {
        try {
            const stats = await fs.stat(requestedPath);
            if (stats.isFile()) {
                await serveStaticFile(req, res, requestedPath);
                return;
            }
        } catch {
            /* fall through to SPA shell */
        }
    }

    if (!hasExtension) {
        await serveStaticFile(req, res, path.join(projectRoot, 'index.html'));
        return;
    }

    sendJson(res, 404, { ok: false, error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `localhost:${port}`}`);
    const pathname = requestUrl.pathname;

    if (pathname.startsWith('/api/')) {
        await handleApiRequest(req, res, pathname);
        return;
    }

    await handleStaticRequest(req, res, pathname);
});

server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
        console.error(`[ASCEND] Port ${port} is already in use. Stop the previous dev server and try again.`);
        process.exitCode = 1;
        return;
    }

    console.error('[ASCEND] Dev server failed:', error);
    process.exitCode = 1;
});

server.listen(port, host, () => {
    const redirectUrl = process.env.AUTH_REDIRECT_URL || `http://localhost:${port}/`;
    console.log(`[ASCEND] Dev server ready at http://localhost:${port}`);
    console.log(`[ASCEND] Google OAuth redirect URL: ${redirectUrl}`);
});
