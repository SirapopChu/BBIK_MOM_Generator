import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as taskService from '../services/task.service.js';
import tasksRouter from '../routes/tasks.routes.js'; // Assuming router is default export
import express from 'express';
import request from 'supertest';

// Mock the entire task service module
vi.mock('../services/task.service.js');

const app = express();
app.use(express.json());
// Middleware to simulate a logged-in user for testing
app.use((req, res, next) => {
    req.user = { id: 'user-123' };
    next();
});
app.use('/api/tasks', tasksRouter);


describe('Tasks API Routes', () => {

    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('GET /api/tasks/:id', () => {
        it('should return a task if found', async () => {
            const mockTask = { id: 'task-abc', title: 'Test Task', user_id: 'user-123' };
            taskService.getTaskById.mockResolvedValue(mockTask);

            const response = await request(app).get('/api/tasks/task-abc');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ task: mockTask });
            expect(taskService.getTaskById).toHaveBeenCalledWith('task-abc', 'user-123');
        });

        it('should return 404 if task is not found', async () => {
            taskService.getTaskById.mockResolvedValue(undefined);

            const response = await request(app).get('/api/tasks/task-def');

            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: 'Task not found' });
        });
    });

    describe('GET /api/tasks', () => {
        it('should return a list of tasks for the user', async () => {
            const mockTasks = [{ id: 'task-1' }, { id: 'task-2' }];
            taskService.getTasks.mockResolvedValue(mockTasks);

            const response = await request(app).get('/api/tasks');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ tasks: mockTasks });
            expect(taskService.getTasks).toHaveBeenCalledWith('user-123');
        });
    });

    describe('DELETE /api/tasks/:id', () => {
        it('should delete a task if found and return success', async () => {
            const mockTask = { id: 'task-to-delete', user_id: 'user-123' };
            taskService.getTaskById.mockResolvedValue(mockTask);
            taskService.deleteTask.mockResolvedValue(true);

            const response = await request(app).delete('/api/tasks/task-to-delete');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true });
            expect(taskService.getTaskById).toHaveBeenCalledWith('task-to-delete', 'user-123');
            expect(taskService.deleteTask).toHaveBeenCalledWith('task-to-delete');
        });

        it('should return 404 if task to delete is not found', async () => {
            taskService.getTaskById.mockResolvedValue(undefined);

            const response = await request(app).delete('/api/tasks/task-not-found');

            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: 'Task not found or access denied' });
            expect(taskService.deleteTask).not.toHaveBeenCalled();
        });
    });
    
    describe('POST /api/tasks/:id/cancel', () => {
        it('should call cancelTask service and return success', async () => {
            taskService.cancelTask.mockResolvedValue();

            const response = await request(app).post('/api/tasks/task-to-cancel/cancel');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true });
            expect(taskService.cancelTask).toHaveBeenCalledWith('task-to-cancel');
        });
    });
});
