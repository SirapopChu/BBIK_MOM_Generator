import pkg from 'pg';
const { Pool } = pkg;

/**
 * PostgreSQL Connection Pool
 * 
 * Uses DATABASE_URL from environment. In Docker, this is provided 
 * via docker-compose. For local dev, it falls back to a default.
 */
// DB_SSL=false → force-disable SSL (e.g. local Docker with NODE_ENV=production)
// DB_SSL=true  → force-enable SSL
// unset        → auto: enable only in production
const sslEnv = process.env.DB_SSL;
const useSSL = sslEnv === 'false' ? false
             : sslEnv === 'true'  ? { rejectUnauthorized: false }
             : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false }
             : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/mom_generator',
  ssl: useSSL,
});

/**
 * Initialize Database Schema
 * 
 * Creates the necessary tables if they don't exist.
 * This is a simple "on-startup" migration for prototype speed.
 */
export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        current_step TEXT,
        progress INTEGER DEFAULT 0,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );

      -- Migration: Add user_id to tasks if it doesn't exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='user_id') THEN
          ALTER TABLE tasks ADD COLUMN user_id INTEGER REFERENCES users(id);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS task_logs (
        id SERIAL PRIMARY KEY,
        task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
        time TEXT NOT NULL,
        msg TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS task_results (
        task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
        data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database schema verified.');
  } catch (err) {
    console.error('Database initialization failed:', err);
  } finally {
    client.release();
  }
}

export const query = (text, params) => pool.query(text, params);
