import { query } from '../config/database.js';
import bcrypt from 'bcryptjs';

class UserRepository {
    async create(email, password, name) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const { rows } = await query(
            'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
            [email, hashedPassword, name]
        );
        return rows[0];
    }

    async findByEmail(email) {
        const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
        return rows[0];
    }

    async findById(id) {
        const { rows } = await query('SELECT id, email, name FROM users WHERE id = $1', [id]);
        return rows[0];
    }

    async validatePassword(user, password) {
        return bcrypt.compare(password, user.password);
    }
}

export default new UserRepository();
