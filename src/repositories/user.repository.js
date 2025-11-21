const { v4: uuidv4 } = require('crypto');

// In-memory storage
const users = new Map();

class UserRepository {
    /**
     * Create a new user
     */
    async create(userData) {
        const user = {
            id: uuidv4(),
            username: userData.username,
            email: userData.email,
            passwordHash: userData.passwordHash,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        users.set(user.id, user);
        return user;
    }

    /**
     * Find user by email
     */
    async findByEmail(email) {
        return Array.from(users.values()).find(u => u.email === email);
    }

    /**
     * Find user by username
     */
    async findByUsername(username) {
        return Array.from(users.values()).find(u => u.username === username);
    }

    /**
     * Find user by ID
     */
    async findById(id) {
        return users.get(id);
    }
}

module.exports = new UserRepository();
