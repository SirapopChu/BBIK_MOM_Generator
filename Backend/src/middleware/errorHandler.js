/**
 * Global Express error handler (SRP: single responsibility middleware).
 * Must be registered AFTER all routes: app.use(errorHandler).
 *
 * @param {Error}    err
 * @param {import('express').Request}  _req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(err, _req, res, _next) {
    const ts = new Date().toISOString();
    console.error(`[${ts}] [Unhandled Error]`, err.message);
    res.status(err.status ?? 500).json({ error: err.message || 'Internal server error' });
}
