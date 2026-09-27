const crypto = require('crypto');

// In-memory storage
const users = new Map();
const usersByEmail = new Map();
const usersByUsername = new Map();

class UserRepository {
  /**
   * Create a new user
   */
  async create(userData) {
    const user = {
      id: crypto.randomUUID(),
      username: userData.username,
      email: userData.email,
      passwordHash: userData.passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    users.set(user.id, user);
    usersByEmail.set(user.email, user);
    usersByUsername.set(user.username, user);
    return user;
  }

  /**
   * Find user by email
   */
  async findByEmail(email) {
    return usersByEmail.get(email);
  }

  /**
   * Find user by username
   */
  async findByUsername(username) {
    return usersByUsername.get(username);
  }

  /**
   * Find user by ID
   */
  async findById(id) {
    return users.get(id);
  }
}

module.exports = new UserRepository();
