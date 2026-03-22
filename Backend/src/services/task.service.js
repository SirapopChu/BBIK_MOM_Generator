/**
 * Repository Pattern: encapsulates all task persistence behind a typed interface.
 * Replaces bare module-level arrays/Maps with a class that owns its state.
 *
 * In a production environment this class would be backed by Redis or a RDBMS.
 * The interface contract stays identical — callers swap only the import.
 *
 * @typedef {{ id: string, title: string, type: string, status: string,
 *             currentStep: string, progress: number, timestamp: string,
 *             completedAt: string|null, error: string|null }} Task
 *
 * @typedef {{ time: string, msg: string }} LogEntry
 */

const MAX_HISTORY = 50;
const MAX_LOGS_PER_TASK = 100;

class TaskRepository {
    constructor() {
        /** @type {Task[]} Ordered newest-first. */
        this._tasks = [];
        /** @type {Map<string, LogEntry[]>} */
        this._logs = new Map();
        /** @type {Map<string, Buffer>} */
        this._results = new Map();
    }

    // ── Factories ─────────────────────────────────────────────

    /**
     * Creates a new task record, initialises its log, and enforces the
     * MAX_HISTORY cap by evicting the oldest completed task.
     *
     * @param {string} title
     * @param {string} [type='docx_generation']
     * @returns {string} Unique taskId
     */
    create(title, type = 'docx_generation') {
        const taskId = `TASK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        /** @type {Task} */
        const task = {
            id:          taskId,
            title,
            type,
            status:      'processing',
            currentStep: 'upload',
            progress:    5,
            timestamp:   new Date().toISOString(),
            completedAt: null,
            error:       null,
        };

        this._tasks.unshift(task);
        this._logs.set(taskId, [
            { time: new Date().toLocaleTimeString(), msg: `Task '${title}' initialized.` },
        ]);

        // Evict the oldest entry beyond the history cap.
        if (this._tasks.length > MAX_HISTORY) {
            const evicted = this._tasks.pop();
            if (evicted) {
                this._logs.delete(evicted.id);
                this._results.delete(evicted.id);
            }
        }

        return taskId;
    }

    // ── Reads ─────────────────────────────────────────────────

    /**
     * @returns {Task[]} All tasks, newest first.
     */
    getAll() {
        return this._tasks;
    }

    /**
     * @param {string} taskId
     * @returns {Task|undefined}
     */
    getById(taskId) {
        return this._tasks.find(t => t.id === taskId);
    }

    /**
     * @param {string} taskId
     * @returns {LogEntry[]}
     */
    getLogs(taskId) {
        return this._logs.get(taskId) ?? [];
    }

    /**
     * @param {string} taskId
     * @returns {Buffer|undefined}
     */
    getResult(taskId) {
        return this._results.get(taskId);
    }

    // ── Mutations ─────────────────────────────────────────────

    /**
     * Merges `updates` into the existing task record.
     * Automatically sets `completedAt` when status transitions to terminal states.
     *
     * @param {string}       taskId
     * @param {Partial<Task>} updates
     * @param {Buffer|null}  [resultData=null]
     */
    update(taskId, updates, resultData = null) {
        const task = this.getById(taskId);
        if (!task) return;

        Object.assign(task, updates);
        if (resultData) this._results.set(taskId, resultData);

        if (updates.status === 'completed' || updates.status === 'failed') {
            task.completedAt = new Date().toISOString();
            if (updates.status === 'completed') task.progress = 100;
        }
    }

    /**
     * Appends a log message to an existing task's log array.
     * Silently no-ops if the task does not exist.
     *
     * @param {string} taskId
     * @param {string} msg
     */
    addLog(taskId, msg) {
        const taskLogs = this._logs.get(taskId);
        if (!taskLogs) return;

        taskLogs.push({ time: new Date().toLocaleTimeString(), msg });

        // Prevent unbounded growth; drop the oldest log once the cap is reached.
        if (taskLogs.length > MAX_LOGS_PER_TASK) taskLogs.shift();
    }

    /**
     * Transitions a task to the 'cancelled' status.
     *
     * @param {string} taskId
     */
    cancel(taskId) {
        this.update(taskId, { status: 'cancelled', currentStep: 'cancelled' });
        this.addLog(taskId, 'Task was cancelled by the user.');
    }

    /**
     * Removes a task and all associated data.
     *
     * @param {string} taskId
     * @returns {boolean} True if the task existed and was removed.
     */
    delete(taskId) {
        const index = this._tasks.findIndex(t => t.id === taskId);
        if (index === -1) return false;

        this._tasks.splice(index, 1);
        this._logs.delete(taskId);
        this._results.delete(taskId);
        return true;
    }

    /**
     * Removes all non-active tasks and their associated data.
     * Active statuses: 'processing', 'queued'.
     */
    clearHistory() {
        const active = new Set(['processing', 'queued']);
        const toRemove = this._tasks.filter(t => !active.has(t.status));
        for (const task of toRemove) {
            this.delete(task.id);
        }
    }
}

// Singleton: one repository instance covers the process lifetime.
const repository = new TaskRepository();

// ── Public API (compatibility shim — keeps existing call sites unchanged) ────

export const createTask    = (title, type)               => repository.create(title, type);
export const updateTask    = (taskId, updates, result)   => repository.update(taskId, updates, result);
export const cancelTask    = (taskId)                    => repository.cancel(taskId);
export const deleteTask    = (taskId)                    => repository.delete(taskId);
export const clearHistory  = ()                          => repository.clearHistory();
export const addLog        = (taskId, msg)               => repository.addLog(taskId, msg);
export const getTasks      = ()                          => repository.getAll();
export const getTaskLogs   = (taskId)                    => repository.getLogs(taskId);
export const getTaskById   = (taskId)                    => repository.getById(taskId);
export const getTaskResult = (taskId)                    => repository.getResult(taskId);
