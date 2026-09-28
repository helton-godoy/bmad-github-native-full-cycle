const userRepository = require('../../src/repositories/user.repository');

describe('UserRepository', () => {
  describe('create', () => {
    it('should create and return a user with id, timestamps, and provided data', async () => {
      const userData = {
        username: 'alice_' + Date.now(),
        email: 'alice_' + Date.now() + '@example.com',
        passwordHash: 'hashed_secret_123',
      };

      const beforeTime = new Date().toISOString();
      const createdUser = await userRepository.create(userData);
      const afterTime = new Date().toISOString();

      expect(createdUser).toHaveProperty('id');
      expect(typeof createdUser.id).toBe('string');
      expect(createdUser.username).toBe(userData.username);
      expect(createdUser.email).toBe(userData.email);
      expect(createdUser.passwordHash).toBe(userData.passwordHash);

      expect(createdUser).toHaveProperty('createdAt');
      expect(createdUser).toHaveProperty('updatedAt');
      expect(createdUser.createdAt).toBe(createdUser.updatedAt);
      expect(createdUser.createdAt >= beforeTime).toBe(true);
      expect(createdUser.createdAt <= afterTime).toBe(true);
    });

    it('should index created user by id, email, and username', async () => {
      const userData = {
        username: 'bob_' + Date.now(),
        email: 'bob_' + Date.now() + '@example.com',
        passwordHash: 'hashed_secret_456',
      };

      const createdUser = await userRepository.create(userData);

      const foundById = await userRepository.findById(createdUser.id);
      const foundByEmail = await userRepository.findByEmail(userData.email);
      const foundByUsername = await userRepository.findByUsername(userData.username);

      expect(foundById).toBe(createdUser);
      expect(foundByEmail).toBe(createdUser);
      expect(foundByUsername).toBe(createdUser);
    });
  });

  describe('findByEmail', () => {
    it('should return user when matching email exists', async () => {
      const userData = {
        username: 'charlie_' + Date.now(),
        email: 'charlie_' + Date.now() + '@example.com',
        passwordHash: 'hashed_secret_789',
      };

      const createdUser = await userRepository.create(userData);
      const found = await userRepository.findByEmail(userData.email);

      expect(found).toBe(createdUser);
    });

    it('should return undefined if user with email does not exist', async () => {
      const email = 'nonexistent-' + Date.now() + '@example.com';
      const user = await userRepository.findByEmail(email);
      expect(user).toBeUndefined();
    });
  });

  describe('findByUsername', () => {
    it('should return user when matching username exists', async () => {
      const userData = {
        username: 'dave_' + Date.now(),
        email: 'dave_' + Date.now() + '@example.com',
        passwordHash: 'hashed_secret_321',
      };

      const createdUser = await userRepository.create(userData);
      const found = await userRepository.findByUsername(userData.username);

      expect(found).toBe(createdUser);
    });

    it('should return undefined if user with username does not exist', async () => {
      const username = 'nonexistentuser-' + Date.now();
      const user = await userRepository.findByUsername(username);
      expect(user).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('should return user when matching id exists', async () => {
      const userData = {
        username: 'eve_' + Date.now(),
        email: 'eve_' + Date.now() + '@example.com',
        passwordHash: 'hashed_secret_654',
      };

      const createdUser = await userRepository.create(userData);
      const found = await userRepository.findById(createdUser.id);

      expect(found).toBe(createdUser);
    });

    it('should return undefined if user with id does not exist', async () => {
      const id = 'non-existent-id-' + Date.now();
      const user = await userRepository.findById(id);
      expect(user).toBeUndefined();
    });
  });
});
