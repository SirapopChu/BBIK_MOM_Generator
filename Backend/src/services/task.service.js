/**
 * Simple in-memory task manager with history.
 * In a production env, this would use Redis or a Database.
 */

const tasks = [];
const logs  = new Map();
const results = new Map(); // Store generated buffers/data

// Helper to keep history limited
const MAX_HISTORY = 50;

export const createTask = (title, type = 'docx_generation') => {
    const taskId = `TASK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newTask = {
        id: taskId,
        title,
        type,
        status: 'processing',
        currentStep: 'upload',
        progress: 5,
        timestamp: new Date().toISOString(),
        completedAt: null,
        error: null
    };

    tasks.unshift(newTask);
    if (tasks.length > MAX_HISTORY) {
        const removed = tasks.pop();
        if (removed) {
            logs.delete(removed.id);
            results.delete(removed.id);
        }
    }

    logs.set(taskId, [
        { time: new Date().toLocaleTimeString(), msg: `Task '${title}' initialized.` }
    ]);

    return taskId;
};

export const updateTask = (taskId, updates, resultData = null) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    Object.assign(task, updates);
    if (resultData) {
        results.set(taskId, resultData);
    }

    if (updates.status === 'completed' || updates.status === 'failed') {
        task.completedAt = new Date().toISOString();
        task.progress = updates.status === 'completed' ? 100 : task.progress;
    }
};

export const cancelTask = (taskId) => {
    updateTask(taskId, { status: 'cancelled', currentStep: 'cancelled' });
    addLog(taskId, 'Task was cancelled by the user.');
};

export const deleteTask = (taskId) => {
    const index = tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
        tasks.splice(index, 1);
        logs.delete(taskId);
        results.delete(taskId);
        return true;
    }
    return false;
};

export const clearHistory = () => {
    const toRemove = tasks.filter(t => t.status !== 'processing' && t.status !== 'queued');
    toRemove.forEach(t => {
        const index = tasks.findIndex(task => task.id === t.id);
        if (index !== -1) tasks.splice(index, 1);
        logs.delete(t.id);
        results.delete(t.id);
    });
};

export const getTaskResult = (taskId) => results.get(taskId);

export const addLog = (taskId, msg) => {
    const taskLogs = logs.get(taskId);
    if (!taskLogs) return;

    taskLogs.push({
        time: new Date().toLocaleTimeString(),
        msg
    });

    // Limit logs per task if needed
    if (taskLogs.length > 100) taskLogs.shift();
};

export const getTasks = () => tasks;

export const getTaskLogs = (taskId) => logs.get(taskId) || [];

export const getTaskById = (taskId) => tasks.find(t => t.id === taskId);
