import { Router } from 'express';
import * as taskService from '../services/task.service.js';

const router = Router();

// GET /api/tasks - List all tasks (active & historical)
router.get('/', (req, res) => {
    res.json({ tasks: taskService.getTasks() });
});

// GET /api/tasks/:id/logs - Get specific logs for a task
router.get('/:id/logs', (req, res) => {
    const taskId = req.params.id;
    const logs   = taskService.getTaskLogs(taskId);
    
    if (!logs.length) {
        // Return 404 or empty logs
        return res.json({ logs: [] });
    }
    
    res.json({ logs });
});

// GET /api/tasks/:id - Specific task status
router.get('/:id', (req, res) => {
    const task = taskService.getTaskById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
});

export default router;
