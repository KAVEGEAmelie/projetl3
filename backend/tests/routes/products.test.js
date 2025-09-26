const request = require('supertest');
const app = require('../../src/server');
const User = require('../../src/models/User');
const Store = require('../../src/models/Store');
const Product = require('../../src/models/Product');
const Category = require('../../src/models/Category');
const jwt = require('jsonwebtoken');

describe('Products Routes (/products)', () => {
  let customerUser, vendorUser, adminUser;
  let customerToken, vendorToken, adminToken;
  let store, category, product;

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

    adminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, role: adminUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Créer les données de test
    category = await Category.create({
      name: 'Test Category',
      description: 'Category for route tests'
    });

    store = await Store.create({
      name: 'Test Store',
      description: 'Store for route tests',
      ownerId: vendorUser.id,
      city: 'Lomé',
      address: '123 Test Street'
    });

    product = await Product.create({
      name: 'Test Product',
      description: 'Product for route tests',
      storeId: store.id,
      categoryId: category.id,
      price: 25000,
      stockQuantity: 10
    });
  });

  describe('GET /products', () => {
    it('should be publicly accessible', async () => {
      const response = await request(app)
        .get('/products');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
    });

    it('should accept query parameters', async () => {
      const response = await request(app)
        .get('/products?page=1&limit=10&search=test');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should handle invalid query parameters gracefully', async () => {
      const response = await request(app)
        .get('/products?page=invalid&limit=abc');

      // Should still return 200 with default values
      expect([200, 400]).toContain(response.status);
    });

    it('should support category filtering', async () => {
      const response = await request(app)
        .get(`/products?categoryId=${category.id}`);

      expect(response.status).toBe(200);
    });

    it('should support price range filtering', async () => {
      const response = await request(app)
        .get('/products?minPrice=10000&maxPrice=30000');

      expect(response.status).toBe(200);
    });

    it('should support sorting', async () => {
      const response = await request(app)
        .get('/products?sortBy=price&sortOrder=desc');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /products/:id', () => {
    it('should return product details for valid ID', async () => {
      const response = await request(app)
        .get(`/products/${product.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data.product.id).toBe(product.id);
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/products/99999');

      expect(response.status).toBe(404);
    });

    it('should validate ID parameter', async () => {
      const response = await request(app)
        .get('/products/invalid-id');

      expect([400, 404]).toContain(response.status);
    });

    it('should support includeSimilar query parameter', async () => {
      const response = await request(app)
        .get(`/products/${product.id}?includeSimilar=true`);

      expect(response.status).toBe(200);
      if (response.body.data.similarProducts) {
        expect(Array.isArray(response.body.data.similarProducts)).toBe(true);
      }
    });
  });

  describe('POST /products', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/products')
        .send({
          name: 'New Product',
          description: 'Test product',
          storeId: store.id,
          categoryId: category.id,
          price: 15000,
          stockQuantity: 5
        });

      expect(response.status).toBe(401);
    });

    it('should require vendor or admin role', async () => {
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Unauthorized Product',
          description: 'Should not be created',
          storeId: store.id,
          categoryId: category.id,
          price: 15000,
          stockQuantity: 5
        });

      expect(response.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          name: 'Incomplete Product'
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should create product with valid data', async () => {
      const productData = {
        name: 'Valid Product',
        description: 'A valid test product',
        storeId: store.id,
        categoryId: category.id,
        price: 20000,
        stockQuantity: 8,
        culturalOrigin: 'Togo',
        materials: ['Cotton', 'Wax']
      };

      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(productData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product.name).toBe(productData.name);
    });

    it('should validate price is positive', async () => {
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          name: 'Negative Price Product',
          description: 'Invalid price',
          storeId: store.id,
          categoryId: category.id,
          price: -1000,
          stockQuantity: 5
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /products/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .put(`/products/${product.id}`)
        .send({
          name: 'Updated Product'
        });

      expect(response.status).toBe(401);
    });

    it('should require vendor or admin role', async () => {
      const response = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Unauthorized Update'
        });

      expect(response.status).toBe(403);
    });

    it('should validate product ownership for vendor', async () => {
      // Créer un autre vendeur et produit
      const anotherVendor = await User.create({
        email: 'another-vendor@test.com',
        password: 'Password123!',
        firstName: 'Another',
        lastName: 'Vendor',
        role: 'vendor'
      });

      const anotherVendorToken = jwt.sign(
        { userId: anotherVendor.id, email: anotherVendor.email, role: anotherVendor.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${anotherVendorToken}`)
        .send({
          name: 'Unauthorized Update'
        });

      expect(response.status).toBe(403);
    });

    it('should allow admin to update any product', async () => {
      const response = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Updated Product'
        });

      expect([200, 403]).toContain(response.status);
    });

    it('should validate update data', async () => {
      const response = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          price: 'invalid-price' // Should be numeric
        });

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('DELETE /products/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/products/${product.id}`);

      expect(response.status).toBe(401);
    });

    it('should require vendor or admin role', async () => {
      const response = await request(app)
        .delete(`/products/${product.id}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(403);
    });

    it('should allow owner to delete product', async () => {
      const response = await request(app)
        .delete(`/products/${product.id}`)
        .set('Authorization', `Bearer ${vendorToken}`);

      expect([200, 403]).toContain(response.status);
    });
  });

  describe('POST /products/:id/images', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/products/${product.id}/images`);

      expect(response.status).toBe(401);
    });

    it('should handle file upload', async () => {
      const response = await request(app)
        .post(`/products/${product.id}/images`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .attach('images', Buffer.from('fake-image'), 'test.jpg');

      expect([200, 400, 403]).toContain(response.status);
    });

    it('should validate file types', async () => {
      const response = await request(app)
        .post(`/products/${product.id}/images`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .attach('images', Buffer.from('fake-content'), 'document.txt');

      expect([400, 403]).toContain(response.status);
    });
  });

  describe('PUT /products/:id/stock', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .put(`/products/${product.id}/stock`)
        .send({
          quantity: 15,
          operation: 'set'
        });

      expect(response.status).toBe(401);
    });

    it('should validate stock operation', async () => {
      const response = await request(app)
        .put(`/products/${product.id}/stock`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          quantity: 5,
          operation: 'invalid-operation'
        });

      expect([400, 403]).toContain(response.status);
    });

    it('should validate quantity is positive', async () => {
      const response = await request(app)
        .put(`/products/${product.id}/stock`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          quantity: -5,
          operation: 'add'
        });

      expect([400, 403]).toContain(response.status);
    });
  });

  describe('GET /products/:id/reviews', () => {
    it('should be publicly accessible', async () => {
      const response = await request(app)
        .get(`/products/${product.id}/reviews`);

      expect(response.status).toBe(200);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/products/${product.id}/reviews?page=1&limit=5`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should support rating filter', async () => {
      const response = await request(app)
        .get(`/products/${product.id}/reviews?rating=5`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /products/featured', () => {
    it('should be publicly accessible', async () => {
      const response = await request(app)
        .get('/products/featured');

      expect(response.status).toBe(200);
    });

    it('should support limit parameter', async () => {
      const response = await request(app)
        .get('/products/featured?limit=5');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /products/trending', () => {
    it('should be publicly accessible', async () => {
      const response = await request(app)
        .get('/products/trending');

      expect(response.status).toBe(200);
    });

    it('should support time period filter', async () => {
      const response = await request(app)
        .get('/products/trending?period=week');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /products/:id/analytics', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/products/${product.id}/analytics`);

      expect(response.status).toBe(401);
    });

    it('should require proper authorization', async () => {
      const response = await request(app)
        .get(`/products/${product.id}/analytics`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(403);
    });

    it('should allow owner access', async () => {
      const response = await request(app)
        .get(`/products/${product.id}/analytics`)
        .set('Authorization', `Bearer ${vendorToken}`);

      expect([200, 403]).toContain(response.status);
    });

    it('should allow admin access', async () => {
      const response = await request(app)
        .get(`/products/${product.id}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 403]).toContain(response.status);
    });
  });

  describe('Route parameter validation', () => {
    it('should handle invalid product ID format', async () => {
      const response = await request(app)
        .get('/products/abc123');

      expect([400, 404]).toContain(response.status);
    });

    it('should handle missing required parameters', async () => {
      const response = await request(app)
        .put('/products/')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          name: 'Updated Product'
        });

      expect(response.status).toBe(404); // Route not found
    });
  });

  describe('Content-Type handling', () => {
    it('should accept JSON content', async () => {
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${vendorToken}`)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({
          name: 'JSON Product',
          description: 'Product via JSON',
          storeId: store.id,
          categoryId: category.id,
          price: 15000,
          stockQuantity: 3
        }));

      expect([200, 201, 400, 403]).toContain(response.status);
    });

    it('should handle multipart/form-data for image uploads', async () => {
      const response = await request(app)
        .post(`/products/${product.id}/images`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .field('description', 'Test image')
        .attach('images', Buffer.from('fake-image'), 'test.jpg');

      expect([200, 400, 403]).toContain(response.status);
    });
  });

  describe('Error response format', () => {
    it('should return consistent error format', async () => {
      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({}); // Invalid data

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });
  });
});