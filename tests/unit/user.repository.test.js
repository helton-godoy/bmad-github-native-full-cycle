const userRepository = require('../../src/repositories/user.repository');

describe('UserRepository', () => {
  describe('findByEmail', () => {
    it('should return undefined if user with email does not exist', async () => {
      const email = 'nonexistent-' + Date.now() + '@example.com';
      const user = await userRepository.findByEmail(email);
      expect(user).toBeUndefined();
    });
  });

  describe('findByUsername', () => {
    it('should return undefined if user with username does not exist', async () => {
      const username = 'nonexistentuser-' + Date.now();
      const user = await userRepository.findByUsername(username);
      expect(user).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('should return undefined if user with id does not exist', async () => {
      const id = 'non-existent-id-' + Date.now();
      const user = await userRepository.findById(id);
      expect(user).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should create and return a new user', async () => {
      const userData = {
        username: 'testuser-' + Date.now(),
        email: 'test-' + Date.now() + '@example.com',
        passwordHash: 'hashedpassword'
      };
      const user = await userRepository.create(userData);

      expect(user).toHaveProperty('id');
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);

      // Verify it can be found now
      const found = await userRepository.findByEmail(userData.email);
      expect(found).toEqual(user);
    });
  });
});
