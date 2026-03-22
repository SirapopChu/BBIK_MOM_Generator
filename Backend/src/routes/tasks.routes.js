import { Router } from 'express';
import * as taskService from '../services/task.service.js';

const router = Router();

// GET /api/tasks - List all tasks (active & historical)
router.get('/', async (req, res) => {
    const tasks = await taskService.getTasks(req.user.id);
    res.json({ tasks });
});

// GET /api/tasks/:id/logs - Get specific logs for a task
router.get('/:id/logs', async (req, res) => {
    const taskId = req.params.id;
    const logs   = await taskService.getTaskLogs(taskId);
    
    if (!logs || !logs.length) {
        return res.json({ logs: [] });
    }
    
    res.json({ logs });
});

// GET /api/tasks/:id - Specific task status
router.get('/:id', async (req, res) => {
    const task = await taskService.getTaskById(req.params.id, req.user.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
});

// GET /api/tasks/:id/download - Download specific result of a task
router.get('/:id/download', async (req, res) => {
    const taskId = req.params.id;
    const task = await taskService.getTaskById(taskId, req.user.id);
    const result = await taskService.getTaskResult(taskId);
    
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
router.post('/:id/cancel', async (req, res) => {
    await taskService.cancelTask(req.params.id);
    res.json({ success: true });
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
    const task = await taskService.getTaskById(req.params.id, req.user.id);
    if (!task) return res.status(404).json({ error: 'Task not found or access denied' });
    
    const deleted = await taskService.deleteTask(req.params.id);
    res.json({ success: deleted });
});

// DELETE /api/tasks - Clear history
router.delete('/', async (req, res) => {
    await taskService.clearHistory(req.user.id);
    res.json({ success: true });
});

export default router;
