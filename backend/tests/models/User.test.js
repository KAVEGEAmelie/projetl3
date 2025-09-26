const User = require('../../src/models/User');
const bcrypt = require('bcrypt');

describe('User Model', () => {
  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        role: 'customer'
      };

      const user = await User.create(userData);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.firstName).toBe(userData.firstName);
      expect(user.lastName).toBe(userData.lastName);
      expect(user.role).toBe(userData.role);
      expect(user.password).not.toBe(userData.password); // Should be hashed
      expect(user.isActive).toBe(true);
      expect(user.emailVerified).toBe(false);
    });

    it('should hash password before saving', async () => {
      const userData = {
        email: 'hash@test.com',
        password: 'TestPassword123!',
        firstName: 'Hash',
        lastName: 'Test'
      };

      const user = await User.create(userData);
      const isValidPassword = await bcrypt.compare(userData.password, user.password);
      
      expect(isValidPassword).toBe(true);
    });

    it('should generate unique slug from name', async () => {
      const userData1 = {
        email: 'user1@test.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Smith'
      };

      const userData2 = {
        email: 'user2@test.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Smith'
      };

      const user1 = await User.create(userData1);
      const user2 = await User.create(userData2);

      expect(user1.slug).toBe('john-smith');
      expect(user2.slug).toBe('john-smith-1');
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        email: 'duplicate@test.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      };

      await User.create(userData);
      
      await expect(User.create(userData)).rejects.toThrow();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const userData = {
        email: 'find@test.com',
        password: 'Password123!',
        firstName: 'Find',
        lastName: 'Test'
      };

      const createdUser = await User.create(userData);
      const foundUser = await User.findByEmail('find@test.com');

      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(createdUser.id);
      expect(foundUser.email).toBe(userData.email);
    });

    it('should return null for non-existent email', async () => {
      const user = await User.findByEmail('nonexistent@test.com');
      expect(user).toBeNull();
    });
  });

  describe('updateById', () => {
    it('should update user data', async () => {
      const userData = {
        email: 'update@test.com',
        password: 'Password123!',
        firstName: 'Update',
        lastName: 'Test'
      };

      const user = await User.create(userData);
      const updates = {
        firstName: 'Updated',
        bio: 'Updated bio'
      };

      const updatedUser = await User.updateById(user.id, updates);

      expect(updatedUser.firstName).toBe('Updated');
      expect(updatedUser.bio).toBe('Updated bio');
      expect(updatedUser.lastName).toBe('Test'); // Should remain unchanged
    });

    it('should not update email or password through regular update', async () => {
      const userData = {
        email: 'security@test.com',
        password: 'Password123!',
        firstName: 'Security',
        lastName: 'Test'
      };

      const user = await User.create(userData);
      const maliciousUpdates = {
        email: 'hacked@evil.com',
        password: 'hacked123',
        role: 'admin'
      };

      const updatedUser = await User.updateById(user.id, maliciousUpdates);

      expect(updatedUser.email).toBe(userData.email);
      expect(updatedUser.role).toBe('customer'); // Default role
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const userData = {
        email: 'verify@test.com',
        password,
        firstName: 'Verify',
        lastName: 'Test'
      };

      const user = await User.create(userData);
      const isValid = await User.verifyPassword(user.id, password);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const userData = {
        email: 'wrong@test.com',
        password: 'CorrectPassword123!',
        firstName: 'Wrong',
        lastName: 'Test'
      };

      const user = await User.create(userData);
      const isValid = await User.verifyPassword(user.id, 'WrongPassword123!');

      expect(isValid).toBe(false);
    });
  });

  describe('updatePassword', () => {
    it('should update password with proper hashing', async () => {
      const userData = {
        email: 'password@test.com',
        password: 'OldPassword123!',
        firstName: 'Password',
        lastName: 'Test'
      };

      const user = await User.create(userData);
      const newPassword = 'NewPassword123!';
      
      const updatedUser = await User.updatePassword(user.id, newPassword);
      
      expect(updatedUser.password).not.toBe(newPassword);
      expect(updatedUser.password).not.toBe(user.password);
      
      const isValidNew = await bcrypt.compare(newPassword, updatedUser.password);
      expect(isValidNew).toBe(true);
    });
  });

  describe('findByRole', () => {
    it('should find users by role', async () => {
      await User.create({
        email: 'admin1@test.com',
        password: 'Password123!',
        firstName: 'Admin1',
        lastName: 'Test',
        role: 'admin'
      });

      await User.create({
        email: 'admin2@test.com',
        password: 'Password123!',
        firstName: 'Admin2',
        lastName: 'Test',
        role: 'admin'
      });

      await User.create({
        email: 'customer@test.com',
        password: 'Password123!',
        firstName: 'Customer',
        lastName: 'Test',
        role: 'customer'
      });

      const admins = await User.findByRole('admin');
      const customers = await User.findByRole('customer');

      expect(admins).toHaveLength(2);
      expect(customers).toHaveLength(1);
      expect(admins.every(user => user.role === 'admin')).toBe(true);
      expect(customers.every(user => user.role === 'customer')).toBe(true);
    });
  });

  describe('delete', () => {
    it('should soft delete user', async () => {
      const userData = {
        email: 'delete@test.com',
        password: 'Password123!',
        firstName: 'Delete',
        lastName: 'Test'
      };

      const user = await User.create(userData);
      const result = await User.deleteById(user.id);

      expect(result).toBe(true);

      const deletedUser = await User.findById(user.id);
      expect(deletedUser).toBeNull();
    });
  });

  describe('getStatistics', () => {
    it('should return user statistics', async () => {
      // Créer quelques utilisateurs avec différents rôles et statuts
      await User.create({
        email: 'stats1@test.com',
        password: 'Password123!',
        firstName: 'Stats1',
        lastName: 'Test',
        role: 'customer'
      });

      await User.create({
        email: 'stats2@test.com',
        password: 'Password123!',
        firstName: 'Stats2',
        lastName: 'Test',
        role: 'vendor'
      });

      const stats = await User.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalUsers).toBeGreaterThan(0);
      expect(stats.activeUsers).toBeGreaterThan(0);
      expect(stats.roleDistribution).toBeDefined();
      expect(Array.isArray(stats.roleDistribution)).toBe(true);
    });
  });
});