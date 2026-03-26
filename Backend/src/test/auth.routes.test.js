import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authMiddleware, generateToken } from '../middleware/auth.middleware.js';

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks and setup fresh objects for each test
    vi.resetAllMocks();
    req = {
      headers: {},
    };
    res = {
      status: vi.fn(() => res),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  it('should call next() if token is valid', () => {
    const userPayload = { id: 'user1', email: 'test@example.com' };
    req.headers.authorization = 'Bearer valid-token';
    jwt.verify.mockReturnValue(userPayload);

    authMiddleware(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String));
    expect(req.user).toEqual(userPayload);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 401 if no authorization header is provided', () => {
    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if header does not start with "Bearer "', () => {
    req.headers.authorization = 'Basic some-other-token';
    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid or expired', () => {
    req.headers.authorization = 'Bearer invalid-token';
    jwt.verify.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Token Generation', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should generate a token with correct user payload and secret', () => {
        const user = { id: 'user1', email: 'test@example.com', name: 'Test User' };
        jwt.sign.mockReturnValue('mock-jwt-token');

        const token = generateToken(user);

        expect(jwt.sign).toHaveBeenCalledWith(
            { id: user.id, email: user.email, name: user.name },
            expect.any(String),
            { expiresIn: '7d' }
        );
        expect(token).toBe('mock-jwt-token');
    });
});
