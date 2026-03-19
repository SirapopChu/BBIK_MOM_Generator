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

// GET /api/tasks/:id/download - Download specific result of a task
router.get('/:id/download', (req, res) => {
    const taskId = req.params.id;
    const task = taskService.getTaskById(taskId);
    const result = taskService.getTaskResult(taskId);

    if (!task || !result) {
        return res.status(404).json({ error: 'Result not found or task not finished' });
    }

    const filename = task.title ? `${task.title.replace(/\s+/g, '_')}.docx` : 'meeting_minutes.docx';
    const encodedFilename = encodeURIComponent(filename);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.send(result);
});

// POST /api/tasks/:id/cancel
router.post('/:id/cancel', (req, res) => {
    taskService.cancelTask(req.params.id);
    res.json({ success: true });
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
    taskService.deleteTask(req.params.id);
    res.json({ success: true });
});

// DELETE /api/tasks - Clear history
router.delete('/', (req, res) => {
    taskService.clearHistory();
    res.json({ success: true });
});

export default router;
