import express from 'express';
import UserRepository from '../repositories/UserRepository.js';
import { generateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 */
router.post('/register', async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const existing = await UserRepository.findByEmail(email);
        if (existing) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const user = await UserRepository.create(email, password, name);
        const token = generateToken(user);

        res.status(201).json({ user, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await UserRepository.findByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await UserRepository.validatePassword(user, password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(user);
        const { password: _, ...userData } = user;

        res.json({ user: userData, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
