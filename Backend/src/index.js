import express            from 'express';
import cors               from 'cors';
import { config } from './config/index.js';
import minutesRouter      from './routes/minutes.routes.js';
import transcribeRouter   from './routes/transcribe.routes.js';
import tasksRouter         from './routes/tasks.routes.js';
import authRouter         from './routes/auth.routes.js';
import { errorHandler }   from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { initDb }           from './config/database.js';
import UserRepository   from './repositories/UserRepository.js';

// Initialize Database & Seed
const startApp = async () => {
    try {
        await initDb();
        
        // Seed initial user if not exists
        const testEmail = 'test@bbik.com';
        const existing = await UserRepository.findByEmail(testEmail);
        if (!existing) {
            console.log(`[Seed] Creating default test user: ${testEmail}`);
            await UserRepository.create(testEmail, 'password123', 'BBIK Test User');
        }
    } catch (err) {
        console.error('Startup Error:', err);
    }
};

startApp();

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: config.cors.allowedOrigins }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
    res.json({ 
        status: 'ok', 
        env: config.server.nodeEnv, 
        ts: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' }) 
    })
);

app.use('/api/auth',       authRouter);

// Protected Routes
app.use('/api/minutes',    authMiddleware, minutesRouter);
app.use('/api/transcribe', authMiddleware, transcribeRouter);
app.use('/api/tasks',      authMiddleware, tasksRouter);

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler (must be last)
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(config.server.port, () => {
    const ts = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' });
    console.log(`[${ts}] Server running on http://localhost:${config.server.port}`);
    console.log(`[${ts}] Env: ${config.server.nodeEnv} | Claude model: ${config.anthropic.model}`);
    console.log(`[${ts}] Endpoints: GET /health | POST /api/transcribe | POST /api/minutes/* | GET /api/tasks/*`);
});
