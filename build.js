import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load local env files for `npm run build` / Cursor workflows.
// Order: .env.local first (primary), then .env fills any missing keys (override: false).
// Vercel/production: variables come from process.env already — these files may be absent.
function loadProjectEnvFiles() {
    const root = process.cwd();
    const localPath = path.join(root, '.env.local');
    const envPath = path.join(root, '.env');

    if (fs.existsSync(localPath)) {
        dotenv.config({ path: localPath });
    }
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, override: false });
    }
}

loadProjectEnvFiles();

// This script runs during the Vercel build process.
// It takes the environment variables securely configured in the Vercel dashboard
// and explicitly writes them to a static config.js file so the frontend can read them.
//
// Must match keys read by src/lib/data/supabaseClient.js (SUPABASE_PUBLIC_KEY || SUPABASE_ANON_KEY).

const env = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_PUBLIC_KEY: process.env.SUPABASE_PUBLIC_KEY || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    AUTH_REDIRECT_URL: process.env.AUTH_REDIRECT_URL || process.env.APP_URL || ''
};

const configContent = `// SYSTEM GENERATED FILE - DO NOT EDIT MANUALLY
window.ENV = ${JSON.stringify(env, null, 4)};
`;

fs.writeFileSync('config.js', configContent);
console.log('Build Success: config.js generated with environment variables.');
