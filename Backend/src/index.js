import './config/index.js';                     // validates env vars first
import express              from 'express';
import cors                 from 'cors';
import { config }           from './config/index.js';
import { errorHandler }     from './middleware/errorHandler.js';
import minutesRouter        from './routes/minutes.routes.js';
import transcribeRouter     from './routes/transcribe.routes.js';
import tasksRouter          from './routes/tasks.routes.js';

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: config.cors.allowedOrigins }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
    res.json({ status: 'ok', env: config.server.nodeEnv, ts: new Date().toISOString() })
);

app.use('/api/minutes',    minutesRouter);
app.use('/api/transcribe', transcribeRouter);
app.use('/api/tasks',      tasksRouter);

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler (must be last)
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(config.server.port, () => {
    const ts = new Date().toISOString();
    console.log(`[${ts}] Server running on http://localhost:${config.server.port}`);
    console.log(`[${ts}] Env: ${config.server.nodeEnv} | Claude model: ${config.anthropic.model}`);
    console.log(`[${ts}] Endpoints: GET /health | POST /api/transcribe | POST /api/minutes/* | GET /api/tasks/*`);
});
