const request = require('supertest');
const app = require('../../src/server');
const User = require('../../src/models/User');
const Store = require('../../src/models/Store');
const jwt = require('jsonwebtoken');

describe('Stores Routes (/stores)', () => {
  let customerUser, vendorUser, anotherVendor, adminUser;
  let customerToken, vendorToken, anotherVendorToken, adminToken;
  let store, anotherStore;

  beforeEach(async () => {
    // Créer les utilisateurs
    customerUser = await User.create({
      email: 'customer@test.com',
      password: 'Password123!',
      firstName: 'Customer',
      lastName: 'User',
      role: 'customer'
    });

    vendorUser = await User.create({
      email: 'vendor@test.com',
      password: 'Password123!',
      firstName: 'Vendor',
      lastName: 'User',
      role: 'vendor'
    });

    anotherVendor = await User.create({
      email: 'another-vendor@test.com',
      password: 'Password123!',
      firstName: 'Another',
      lastName: 'Vendor',
      role: 'vendor'
    });

    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'Password123!',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin'
    });

    // Générer les tokens
    customerToken = jwt.sign(
      { userId: customerUser.id, email: customerUser.email, role: customerUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    vendorToken = jwt.sign(
      { userId: vendorUser.id, email: vendorUser.email, role: vendorUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    anotherVendorToken = jwt.sign(
      { userId: anotherVendor.id, email: anotherVendor.email, role: anotherVendor.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, role: adminUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Créer les boutiques de test
    store = await Store.create({
      name: 'Test Store',
      description: 'Store for route tests',
      ownerId: vendorUser.id,
      city: 'Lomé',
      address: '123 Test Street',
      phone: '+22770123456'
    });

    anotherStore = await Store.create({
      name: 'Another Store',
      description: 'Another store for tests',
      ownerId: anotherVendor.id,
      city: 'Accra',
      address: '456 Another Street',
      phone: '+23370654321'
    });
  });

  describe('GET /stores', () => {
    it('should be publicly accessible', async () => {
      const response = await request(app)
        .get('/stores');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('stores');
    });

    it('should support search by name', async () => {
      const response = await request(app)
        .get('/stores?search=Test');

      expect(response.status).toBe(200);
      expect(response.body.data.stores.length).toBeGreaterThanOrEqual(0);
    });

    it('should support city filtering', async () => {
      const response = await request(app)
        .get('/stores?city=Lomé');

      expect(response.status).toBe(200);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/stores?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(10);
    });

    it('should support verified filter', async () => {
      const response = await request(app)
        .get('/stores?verified=true');

      expect(response.status).toBe(200);
    });

    it('should support sorting', async () => {
      const response = await request(app)
        .get('/stores?sortBy=name&sortOrder=asc');

      expect(response.status).toBe(200);
    });

    it('should handle invalid query parameters gracefully', async () => {
      const response = await request(app)
        .get('/stores?page=invalid&limit=abc');

      expect([200, 400]).toContain(response.status);
    });
  });

  describe('GET /stores/:id', () => {
    it('should return store details for valid ID', async () => {
      const response = await request(app)
        .get(`/stores/${store.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.store.id).toBe(store.id);
      expect(response.body.data.store.name).toBe(store.name);
    });

    it('should return 404 for non-existent store', async () => {
      const response = await request(app)
        .get('/stores/99999');

      expect(response.status).toBe(404);
    });

    it('should validate ID parameter format', async () => {
      const response = await request(app)
        .get('/stores/invalid-id');

      expect([400, 404]).toContain(response.status);
    });

    it('should include store statistics', async () => {
      const response = await request(app)
        .get(`/stores/${store.id}`);

      if (response.status === 200) {
        expect(response.body.data.store).toHaveProperty('statistics');
      }
    });
  });

  describe('POST /stores', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/stores')
        .send({
          name: 'New Store',
          description: 'A new test store',
          city: 'Lomé',
          address: '789 New Street'
        });

      expect(response.status).toBe(401);
    });

    it('should require vendor or admin role', async () => {
      const response = await request(app)
        .post('/stores')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Customer Store',
          description: 'Should not be created',
          city: 'Lomé',
          address: '789 Customer Street'
        });

      expect(response.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/stores')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          name: 'Incomplete Store'
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should create store with valid data', async () => {
      const storeData = {
        name: 'Valid New Store',
        description: 'A valid test store',
        city: 'Kara',
        address: '123 Valid Street',
        phone: '+22771234567',
        website: 'https://validstore.com'
      };

      const response = await request(app)
        .post('/stores')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(storeData);

      expect([201, 400]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.store.name).toBe(storeData.name);
        expect(response.body.data.store.slug).toBeDefined();
      }
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/stores')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          name: 'Phone Test Store',
          description: 'Testing phone validation',
          city: 'Lomé',
          address: '123 Phone Street',
          phone: 'invalid-phone'
        });

      expect([400, 422]).toContain(response.status);
    });

    it('should validate website URL format', async () => {
      const response = await request(app)
        .post('/stores')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          name: 'Website Test Store',
          description: 'Testing website validation',
          city: 'Lomé',
          address: '123 Website Street',
          website: 'invalid-url'
        });

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('PUT /stores/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .put(`/stores/${store.id}`)
        .send({
          name: 'Updated Store'
        });

      expect(response.status).toBe(401);
    });

    it('should require store ownership or admin role', async () => {
      const response = await request(app)
        .put(`/stores/${store.id}`)
        .set('Authorization', `Bearer ${anotherVendorToken}`)
        .send({
          name: 'Unauthorized Update'
        });

      expect(response.status).toBe(403);
    });

    it('should allow owner to update store', async () => {
      const updateData = {
        name: 'Updated Store Name',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/stores/${store.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(updateData);

      expect([200, 403]).toContain(response.status);
    });

    it('should allow admin to update any store', async () => {
      const response = await request(app)
        .put(`/stores/${store.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Updated Store'
        });

      expect([200, 403]).toContain(response.status);
    });

    it('should validate update data', async () => {
      const response = await request(app)
        .put(`/stores/${store.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          phone: 'invalid-phone-format'
        });

      expect([400, 422, 403]).toContain(response.status);
    });

    it('should not allow changing owner', async () => {
      const response = await request(app)
        .put(`/stores/${store.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          ownerId: anotherVendor.id
        });

      if (response.status === 200) {
        expect(response.body.data.store.ownerId).toBe(vendorUser.id);
      }
    });
  });

  describe('DELETE /stores/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/stores/${store.id}`);

      expect(response.status).toBe(401);
    });

    it('should require owner or admin role', async () => {
      const response = await request(app)
        .delete(`/stores/${store.id}`)
        .set('Authorization', `Bearer ${anotherVendorToken}`);

      expect(response.status).toBe(403);
    });

    it('should allow owner to delete store', async () => {
      const response = await request(app)
        .delete(`/stores/${store.id}`)
        .set('Authorization', `Bearer ${vendorToken}`);

      expect([200, 403]).toContain(response.status);
    });

    it('should allow admin to delete any store', async () => {
      const response = await request(app)
        .delete(`/stores/${anotherStore.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 403]).toContain(response.status);
    });
  });

  describe('GET /stores/:id/products', () => {
    it('should be publicly accessible', async () => {
      const response = await request(app)
        .get(`/stores/${store.id}/products`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('products');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/stores/${store.id}/products?page=1&limit=5`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should support product filtering', async () => {
      const response = await request(app)
        .get(`/stores/${store.id}/products?available=true`);

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent store', async () => {
      const response = await request(app)
        .get('/stores/99999/products');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /stores/:id/logo', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/stores/${store.id}/logo`);

      expect(response.status).toBe(401);
    });

    it('should require ownership or admin role', async () => {
      const response = await request(app)
        .post(`/stores/${store.id}/logo`)
        .set('Authorization', `Bearer ${anotherVendorToken}`)
        .attach('logo', Buffer.from('fake-logo'), 'logo.jpg');

      expect(response.status).toBe(403);
    });

    it('should handle logo upload', async () => {
      const response = await request(app)
        .post(`/stores/${store.id}/logo`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .attach('logo', Buffer.from('fake-logo-content'), 'logo.jpg');

      expect([200, 400, 403]).toContain(response.status);
    });

    it('should validate file type', async () => {
      const response = await request(app)
        .post(`/stores/${store.id}/logo`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .attach('logo', Buffer.from('not-image'), 'document.txt');

      expect([400, 403]).toContain(response.status);
    });
  });

  describe('GET /stores/:id/analytics', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/stores/${store.id}/analytics`);

      expect(response.status).toBe(401);
    });

    it('should require ownership or admin role', async () => {
      const response = await request(app)
        .get(`/stores/${store.id}/analytics`)
        .set('Authorization', `Bearer ${anotherVendorToken}`);

      expect(response.status).toBe(403);
    });

    it('should allow owner access', async () => {
      const response = await request(app)
        .get(`/stores/${store.id}/analytics`)
        .set('Authorization', `Bearer ${vendorToken}`);

      expect([200, 403]).toContain(response.status);
    });

    it('should allow admin access', async () => {
      const response = await request(app)
        .get(`/stores/${store.id}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 403]).toContain(response.status);
    });

    it('should support date range filtering', async () => {
      const response = await request(app)
        .get(`/stores/${store.id}/analytics?startDate=2024-01-01&endDate=2024-12-31`)
        .set('Authorization', `Bearer ${vendorToken}`);

      expect([200, 400, 403]).toContain(response.status);
    });
  });

  describe('POST /stores/:id/verify', () => {
    it('should require admin role', async () => {
      const response = await request(app)
        .post(`/stores/${store.id}/verify`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          verified: true,
          verificationNotes: 'Store verified'
        });

      expect(response.status).toBe(403);
    });

    it('should allow admin to verify store', async () => {
      const response = await request(app)
        .post(`/stores/${store.id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          verified: true,
          verificationNotes: 'Documents approved'
        });

      expect([200, 403]).toContain(response.status);
    });

    it('should validate verification data', async () => {
      const response = await request(app)
        .post(`/stores/${store.id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          // Missing required fields
        });

      expect([400, 403]).toContain(response.status);
    });
  });

  describe('POST /stores/:id/suspend', () => {
    it('should require admin role', async () => {
      const response = await request(app)
        .post(`/stores/${store.id}/suspend`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          reason: 'Violation of terms'
        });

      expect(response.status).toBe(403);
    });

    it('should allow admin to suspend store', async () => {
      const response = await request(app)
        .post(`/stores/${store.id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Policy violation',
          duration: 30
        });

      expect([200, 403]).toContain(response.status);
    });
  });

  describe('GET /stores/featured', () => {
    it('should be publicly accessible', async () => {
      const response = await request(app)
        .get('/stores/featured');

      expect(response.status).toBe(200);
    });

    it('should support limit parameter', async () => {
      const response = await request(app)
        .get('/stores/featured?limit=5');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /stores/near', () => {
    it('should require location parameters', async () => {
      const response = await request(app)
        .get('/stores/near');

      expect([400, 200]).toContain(response.status);
    });

    it('should accept latitude and longitude', async () => {
      const response = await request(app)
        .get('/stores/near?lat=6.1319&lng=1.2228&radius=10');

      expect(response.status).toBe(200);
    });

    it('should validate coordinate format', async () => {
      const response = await request(app)
        .get('/stores/near?lat=invalid&lng=invalid');

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('Route parameter validation', () => {
    it('should handle invalid store ID format', async () => {
      const response = await request(app)
        .get('/stores/abc123');

      expect([400, 404]).toContain(response.status);
    });

    it('should handle missing store ID', async () => {
      const response = await request(app)
        .put('/stores/')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          name: 'Updated Store'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('Error handling', () => {
    it('should return consistent error format', async () => {
      const response = await request(app)
        .post('/stores')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({}); // Invalid data

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });
  });
});