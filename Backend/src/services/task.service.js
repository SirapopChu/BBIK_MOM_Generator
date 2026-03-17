/**
 * Simple in-memory task manager with history.
 * In a production env, this would use Redis or a Database.
 */

const tasks = [];
const logs  = new Map();

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
        completedAt: null
    };

    tasks.unshift(newTask);
    if (tasks.length > MAX_HISTORY) tasks.pop();

    logs.set(taskId, [
        { time: new Date().toLocaleTimeString(), msg: `Task '${title}' initialized.` }
    ]);

    return taskId;
};

export const updateTask = (taskId, updates) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    Object.assign(task, updates);
    if (updates.status === 'completed' || updates.status === 'failed') {
        task.completedAt = new Date().toISOString();
        task.progress = updates.status === 'completed' ? 100 : task.progress;
    }
};

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
