import './config/index.js';          // validates env vars first
import express from 'express';
import cors    from 'cors';
import { config } from './config/index.js';
import minutesRouter    from './routes/minutes.routes.js';
import transcribeRouter from './routes/transcribe.routes.js';
import tasksRouter from './routes/tasks.routes.js';

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: config.cors.allowedOrigins }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ──────────────────────────────────────────────────
app.get('/health', (_req, res) =>
    res.json({ status: 'ok', env: config.server.nodeEnv, ts: new Date().toISOString() })
);

app.use('/api/minutes',    minutesRouter);
app.use('/api/transcribe', transcribeRouter);
app.use('/api/tasks',      tasksRouter);

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
    console.error('[Unhandled Error]', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ── Start ───────────────────────────────────────────────────
app.listen(config.server.port, () => {
    console.log(`\n🚀  Server running on http://localhost:${config.server.port}`);
    console.log(`📋  Env          : ${config.server.nodeEnv}`);
    console.log(`🤖  Claude Model : ${config.anthropic.model}`);
    console.log(`\n  Endpoints:`);
    console.log(`   GET  /health`);
    console.log(`   POST /api/transcribe`);
    console.log(`   POST /api/minutes/generate`);
    console.log(`   POST /api/minutes/export-docx`);
    console.log(`   GET  /api/tasks`);
    console.log(`   GET  /api/tasks/:id/logs\n`);
});
