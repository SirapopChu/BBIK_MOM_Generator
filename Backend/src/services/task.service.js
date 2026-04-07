import { query } from '../config/database.js';

class TaskRepository {
    // ── Factories ─────────────────────────────────────────────

    async create(title, userId, type = 'docx_generation') {
        const taskId = `TASK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        await query(
            'INSERT INTO tasks (id, user_id, title, type, status, current_step, progress) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [taskId, userId, title, type, 'processing', 'upload', 5]
        );

        await this.addLog(taskId, `Task '${title}' initialized.`);
        return taskId;
    }

    // ── Reads ─────────────────────────────────────────────────

    async getAll(userId) {
        const { rows } = await query('SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return rows.map(this._mapTask);
    }

    async getById(taskId, userId) {
        const { rows } = await query('SELECT * FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
        return rows[0] ? this._mapTask(rows[0]) : undefined;
    }

    async getLogs(taskId, userId) {
        const { rows } = await query(
            `SELECT tl.time, tl.msg
             FROM task_logs tl
             JOIN tasks t ON t.id = tl.task_id
             WHERE tl.task_id = $1 AND t.user_id = $2
             ORDER BY tl.id ASC`,
            [taskId, userId]
        );
        return rows;
    }

    async getResult(taskId, userId) {
        const { rows } = await query('SELECT data FROM task_results WHERE task_id = $1', [taskId]);
        if (!rows[0]) return undefined;
        const { rows: taskRows } = await query('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
        return taskRows[0] ? rows[0].data : undefined;
    }

    // ── Mutations ─────────────────────────────────────────────

    async update(taskId, updates, resultData = null) {
        const fields = [];
        const values = [];
        let index = 1;

        if (updates.status) {
            fields.push(`status = $${index++}`);
            values.push(updates.status);
            if (updates.status === 'completed' || updates.status === 'failed') {
                fields.push(`completed_at = CURRENT_TIMESTAMP`);
            }
        }
        if (updates.currentStep) {
            fields.push(`current_step = $${index++}`);
            values.push(updates.currentStep);
        }
        if (updates.progress !== undefined) {
            fields.push(`progress = $${index++}`);
            values.push(updates.progress);
        }
        if (updates.error) {
            fields.push(`error = $${index++}`);
            values.push(updates.error);
        }

        if (fields.length > 0) {
            values.push(taskId);
            await query(
                `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${index}`,
                values
            );
        }

        if (resultData) {
            await query(
                'INSERT INTO task_results (task_id, data) VALUES ($1, $2) ON CONFLICT (task_id) DO UPDATE SET data = $2',
                [taskId, resultData]
            );
        }
    }

    async addLog(taskId, msg) {
        const time = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false });
        await query(
            'INSERT INTO task_logs (task_id, time, msg) VALUES ($1, $2, $3)',
            [taskId, time, msg]
        );
    }

    async cancel(taskId, userId) {
        const { rowCount } = await query(
            'UPDATE tasks SET status = $1, current_step = $2 WHERE id = $3 AND user_id = $4',
            ['cancelled', 'cancelled', taskId, userId]
        );
        if (!rowCount) return false;
        await this.addLog(taskId, 'Task was cancelled by the user.');
        return true;
    }

    async deleteTask(taskId, userId) {
        const { rowCount } = await query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
        return rowCount > 0;
    }

    async clearHistory(userId) {
        await query("DELETE FROM tasks WHERE user_id = $1 AND status NOT IN ('processing', 'queued')", [userId]);
    }

    _mapTask(row) {
        return {
            id:          row.id,
            title:       row.title,
            type:        row.type,
            status:      row.status,
            currentStep: row.current_step,
            progress:    row.progress,
            timestamp:   row.created_at,
            completedAt: row.completed_at,
            error:       row.error
        };
    }
}

// Singleton: one repository instance covers the process lifetime.
const repository = new TaskRepository();

// ── Public API (compatibility shim — keeps existing call sites unchanged) ────

export const createTask    = (title, userId, type)       => repository.create(title, userId, type);
export const updateTask    = (taskId, updates, result)   => repository.update(taskId, updates, result);
export const cancelTask    = (taskId, userId)            => repository.cancel(taskId, userId);
export const deleteTask    = (taskId, userId)            => repository.deleteTask(taskId, userId);
export const clearHistory  = (userId)                    => repository.clearHistory(userId);
export const addLog        = (taskId, msg)               => repository.addLog(taskId, msg);
export const getTasks      = (userId)                    => repository.getAll(userId);
export const getTaskById   = (taskId, userId)            => repository.getById(taskId, userId);
export const getTaskLogs   = (taskId, userId)            => repository.getLogs(taskId, userId);
export const getTaskResult = (taskId, userId)            => repository.getResult(taskId, userId);
