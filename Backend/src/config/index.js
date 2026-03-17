import 'dotenv/config';

export const config = {
    anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model:  process.env.ANTHROPIC_MODEL || 'claude-opus-4-5',
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
    },
    server: {
        port:    parseInt(process.env.PORT || '3001', 10),
        nodeEnv: process.env.NODE_ENV || 'development',
    },
    cors: {
        allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
    },
    paths: {
        logo: process.env.LOGO_PATH || './assets/Bluebik_Logo_2025_Horizontal_Primary_Logo_Black.png',
    },
};

// Validate required env vars on startup
const required   = ['ANTHROPIC_API_KEY'];
const optional   = ['OPENAI_API_KEY'];
const missing    = required.filter(k => !process.env[k]);
const missingOpt = optional.filter(k => !process.env[k] || (process.env[k] || '').includes('your_'));

if (missing.length > 0) {
    console.error(`❌  Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
}

if (missingOpt.length > 0) {
    console.warn(`⚠️   Optional env vars not set: ${missingOpt.join(', ')}`);
    console.warn(`     Transcription endpoint will return errors until OPENAI_API_KEY is configured.\n`);
}
