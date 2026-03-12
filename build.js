const fs = require('fs');

// This script runs during the Vercel build process.
// It takes the environment variables securely configured in the Vercel dashboard
// and explicitly writes them to a static config.js file so the frontend can read them.

const configContent = `// SYSTEM GENERATED FILE - DO NOT EDIT MANUALLY
window.ENV = {
    SUPABASE_URL: "${process.env.SUPABASE_URL || ''}",
    SUPABASE_ANON_KEY: "${process.env.SUPABASE_ANON_KEY || ''}"
};
`;

fs.writeFileSync('config.js', configContent);
console.log('Build Success: config.js generated with environment variables.');
