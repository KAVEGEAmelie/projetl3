const request = require('supertest');
const app = require('../../src/server');
const User = require('../../src/models/User');
const Store = require('../../src/models/Store');
const jwt = require('jsonwebtoken');

describe('User Controller', () => {
  let customerUser, vendorUser, adminUser, store;
  let customerToken, vendorToken, adminToken;

  beforeEach(async () => {
    // Créer un client
    customerUser = await User.create({
      email: 'customer@test.com',
      password: 'Password123!',
      firstName: 'Customer',
      lastName: 'User',
      role: 'customer',
      phone: '+22770123456'
    });

    customerToken = jwt.sign(
      { userId: customerUser.id, email: customerUser.email, role: customerUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Créer un vendeur
    vendorUser = await User.create({
      email: 'vendor@test.com',
      password: 'Password123!',
      firstName: 'Vendor',
      lastName: 'User',
      role: 'vendor',
      phone: '+22771234567'
    });

    vendorToken = jwt.sign(
      { userId: vendorUser.id, email: vendorUser.email, role: vendorUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Créer un admin
    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'Password123!',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin'
    });

    adminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, role: adminUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Créer une boutique pour le vendeur
    store = await Store.create({
      name: 'Test Store',
      description: 'Store for user tests',
      ownerId: vendorUser.id,
      city: 'Lomé',
      address: '123 Test Street'
    });
  });

  describe('GET /users', () => {
    it('should return all users for admin', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(3);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/users?role=vendor')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(1);
      expect(response.body.data.users[0].role).toBe('vendor');
    });

    it('should search users by name', async () => {
      const response = await request(app)
        .get('/users?search=Customer')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.users[0].firstName).toContain('Customer');
    });

    it('should deny access to non-admin users', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should apply pagination', async () => {
      const response = await request(app)
        .get('/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
    });
  });

  describe('GET /users/:id', () => {
    it('should return user profile for admin', async () => {
      const response = await request(app)
        .get(`/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(customerUser.id);
      expect(response.body.data.user.email).toBe(customerUser.email);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should return own profile for authenticated user', async () => {
      const response = await request(app)
        .get(`/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(customerUser.id);
    });

    it('should deny access to other user profiles for non-admin', async () => {
      const response = await request(app)
        .get(`/users/${vendorUser.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/users/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /users/:id', () => {
    it('should update user profile for admin', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        phone: '+22799999999'
      };

      const response = await request(app)
        .put(`/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.firstName).toBe('Updated');
      expect(response.body.data.user.lastName).toBe('Name');
    });

    it('should allow user to update own profile', async () => {
      const updateData = {
        firstName: 'SelfUpdated',
        phone: '+22788888888'
      };

      const response = await request(app)
        .put(`/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.firstName).toBe('SelfUpdated');
    });

    it('should not allow role change by non-admin', async () => {
      const updateData = {
        role: 'admin'
      };

      const response = await request(app)
        .put(`/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.user.role).toBe('customer'); // Role unchanged
    });

    it('should allow admin to change user role', async () => {
      const updateData = {
        role: 'vendor'
      };

      const response = await request(app)
        .put(`/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('vendor');
    });

    it('should deny access to update other user profiles for non-admin', async () => {
      const updateData = {
        firstName: 'Unauthorized'
      };

      const response = await request(app)
        .put(`/users/${vendorUser.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /users/:id', () => {
    it('should suspend user for admin', async () => {
      const response = await request(app)
        .delete(`/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Vérifier que l'utilisateur est suspendu
      const suspendedUser = await User.findById(customerUser.id);
      expect(suspendedUser.status).toBe('suspended');
    });

    it('should not allow user to delete own account', async () => {
      const response = await request(app)
        .delete(`/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should deny access to non-admin users', async () => {
      const response = await request(app)
        .delete(`/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /users/:id/stores', () => {
    it('should return stores owned by vendor', async () => {
      const response = await request(app)
        .get(`/users/${vendorUser.id}/stores`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stores).toHaveLength(1);
      expect(response.body.data.stores[0].ownerId).toBe(vendorUser.id);
    });

    it('should return empty array for customer', async () => {
      const response = await request(app)
        .get(`/users/${customerUser.id}/stores`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stores).toHaveLength(0);
    });
  });

  describe('GET /users/:id/orders', () => {
    it('should return orders for user (admin access)', async () => {
      const response = await request(app)
        .get(`/users/${customerUser.id}/orders`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
    });

    it('should return own orders for authenticated user', async () => {
      const response = await request(app)
        .get(`/users/${customerUser.id}/orders`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
    });

    it('should deny access to other user orders for non-admin', async () => {
      const response = await request(app)
        .get(`/users/${vendorUser.id}/orders`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /users/:id/suspend', () => {
    it('should suspend user with reason for admin', async () => {
      const suspendData = {
        reason: 'Violation des conditions d\'utilisation',
        duration: 30 // 30 jours
      };

      const response = await request(app)
        .post(`/users/${customerUser.id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(suspendData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Vérifier la suspension
      const suspendedUser = await User.findById(customerUser.id);
      expect(suspendedUser.status).toBe('suspended');
      expect(suspendedUser.suspensionReason).toBe(suspendData.reason);
    });

    it('should deny access to non-admin users', async () => {
      const response = await request(app)
        .post(`/users/${customerUser.id}/suspend`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Test' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /users/:id/activate', () => {
    it('should reactivate suspended user for admin', async () => {
      // D'abord suspendre l'utilisateur
      await User.updateStatus(customerUser.id, 'suspended', 'Test suspension');

      const response = await request(app)
        .post(`/users/${customerUser.id}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Vérifier la réactivation
      const activatedUser = await User.findById(customerUser.id);
      expect(activatedUser.status).toBe('active');
    });
  });

  describe('GET /users/statistics', () => {
    it('should return user statistics for admin', async () => {
      const response = await request(app)
        .get('/users/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.statistics).toBeDefined();
      expect(response.body.data.statistics.totalUsers).toBeGreaterThan(0);
      expect(response.body.data.statistics.activeUsers).toBeDefined();
      expect(response.body.data.statistics.usersByRole).toBeDefined();
    });

    it('should deny access to non-admin users', async () => {
      const response = await request(app)
        .get('/users/statistics')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /users/:id/avatar', () => {
    it('should upload avatar for user', async () => {
      const response = await request(app)
        .post(`/users/${customerUser.id}/avatar`)
        .set('Authorization', `Bearer ${customerToken}`)
        .attach('avatar', Buffer.from('fake-image-content'), 'avatar.jpg')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.avatar).toBeDefined();
    });

    it('should validate file type', async () => {
      const response = await request(app)
        .post(`/users/${customerUser.id}/avatar`)
        .set('Authorization', `Bearer ${customerToken}`)
        .attach('avatar', Buffer.from('fake-content'), 'document.txt')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('type');
    });
  });

  describe('Authentication middleware', () => {
    it('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get(`/users/${customerUser.id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: customerUser.id, email: customerUser.email, role: customerUser.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // Token expiré
      );

      const response = await request(app)
        .get(`/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});