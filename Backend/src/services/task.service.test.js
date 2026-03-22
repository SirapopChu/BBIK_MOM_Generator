import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as taskService from './task.service.js';
import { query } from '../config/database.js';

// Mock the database query function
vi.mock('../config/database.js', () => ({
  query: vi.fn(),
}));

describe('TaskService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new task and return taskId', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // create doesn't care about result rows

    const taskId = await taskService.createTask('Test Meeting', 'workflow');
    
    expect(taskId).toMatch(/^TASK-\d+-\d+$/);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tasks'),
      expect.arrayContaining([taskId, 'Test Meeting', 'workflow'])
    );
  });

  it('should retrieve a task by ID', async () => {
    const mockTask = { id: 'uuid', title: 'Test', status: 'processing' };
    query.mockResolvedValueOnce({ rows: [mockTask] });

    const task = await taskService.getTaskById('uuid');
    
    expect(task).toEqual(expect.objectContaining({
      id: 'uuid',
      title: 'Test',
      status: 'processing'
    }));
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM tasks WHERE id = $1'),
      ['uuid']
    );
  });

  it('should return undefined if task not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const task = await taskService.getTaskById('none');
    
    expect(task).toBeUndefined();
  });
});
