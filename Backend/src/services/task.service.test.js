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
    const mockTaskUserId = 'user-123'; // ประกาศตัวแปรไว้ใช้
    const mockTask = { id: 'uuid', title: 'Test', status: 'processing' };
    query.mockResolvedValueOnce({ rows: [mockTask] });

    // ส่ง id และ userId เข้าไปใน service
    const task = await taskService.getTaskById('uuid', mockTaskUserId);
    
    expect(task).toEqual(expect.objectContaining({
      id: 'uuid',
      status: 'processing'
    }));

    // แก้ไขตรงนี้: ต้องตรงกับที่ Service เรียกใช้จริง
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM tasks WHERE id = $1 AND user_id = $2'),
      ['uuid', mockTaskUserId] 
    );
});

  it('should return undefined if task not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const task = await taskService.getTaskById('none');
    
    expect(task).toBeUndefined();
  });
});
