const request = require('supertest');
const app = require('../../src/server');
const User = require('../../src/models/User');
const Store = require('../../src/models/Store');
const Product = require('../../src/models/Product');
const Category = require('../../src/models/Category');
const Order = require('../../src/models/Order');
const jwt = require('jsonwebtoken');

describe('Order Controller', () => {
  let customerUser, vendorUser, anotherCustomer, adminUser;
  let customerToken, vendorToken, anotherCustomerToken, adminToken;
  let store, category, product1, product2, order;

  beforeEach(async () => {
    // Créer les utilisateurs
    customerUser = await User.create({
      email: 'customer@test.com',
      password: 'Password123!',
      firstName: 'Customer',
      lastName: 'User',
      role: 'customer'
    });

    anotherCustomer = await User.create({
      email: 'customer2@test.com',
      password: 'Password123!',
      firstName: 'Customer2',
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

    anotherCustomerToken = jwt.sign(
      { userId: anotherCustomer.id, email: anotherCustomer.email, role: anotherCustomer.role },
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

    // Créer la catégorie
    category = await Category.create({
      name: 'Vêtements',
      description: 'Vêtements africains'
    });

    // Créer la boutique
    store = await Store.create({
      name: 'Boutique Test',
      description: 'Boutique pour tests de commandes',
      ownerId: vendorUser.id,
      city: 'Lomé',
      address: '123 Test Street'
    });

    // Créer les produits
    product1 = await Product.create({
      name: 'Produit 1',
      description: 'Premier produit',
      storeId: store.id,
      categoryId: category.id,
      price: 15000,
      stockQuantity: 20
    });

    product2 = await Product.create({
      name: 'Produit 2',
      description: 'Deuxième produit',
      storeId: store.id,
      categoryId: category.id,
      price: 25000,
      stockQuantity: 15
    });

    // Créer une commande test
    order = await Order.create({
      userId: customerUser.id,
      storeId: store.id,
      items: [
        {
          productId: product1.id,
          quantity: 2,
          price: product1.price
        }
      ],
      shippingAddress: {
        firstName: 'Customer',
        lastName: 'User',
        address: '456 Customer Street',
        city: 'Lomé',
        phone: '+22770123456'
      }
    });
  });

  describe('POST /orders', () => {
    it('should create a new order', async () => {
      const orderData = {
        items: [
          {
            productId: product1.id,
            quantity: 1
          },
          {
            productId: product2.id,
            quantity: 2
          }
        ],
        shippingAddress: {
          firstName: 'Test',
          lastName: 'Customer',
          address: '789 Test Street',
          city: 'Lomé',
          phone: '+22771234567'
        },
        notes: 'Livraison rapide svp'
      };

      const response = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order).toBeDefined();
      expect(response.body.data.order.items).toHaveLength(2);
      expect(response.body.data.order.totalAmount).toBe(65000); // 15000 + (25000 * 2)
      expect(response.body.data.order.status).toBe('pending');
    });

    it('should validate product availability', async () => {
      const orderData = {
        items: [
          {
            productId: product1.id,
            quantity: 100 // Plus que le stock disponible
          }
        ],
        shippingAddress: {
          firstName: 'Test',
          lastName: 'Customer',
          address: '789 Test Street',
          city: 'Lomé',
          phone: '+22771234567'
        }
      };

      const response = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('stock');
    });

    it('should validate shipping address', async () => {
      const orderData = {
        items: [
          {
            productId: product1.id,
            quantity: 1
          }
        ],
        shippingAddress: {
          // Manque des champs requis
          firstName: 'Test'
        }
      };

      const response = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('address');
    });

    it('should not allow empty orders', async () => {
      const orderData = {
        items: [],
        shippingAddress: {
          firstName: 'Test',
          lastName: 'Customer',
          address: '789 Test Street',
          city: 'Lomé',
          phone: '+22771234567'
        }
      };

      const response = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('items');
    });

    it('should require authentication', async () => {
      const orderData = {
        items: [
          {
            productId: product1.id,
            quantity: 1
          }
        ],
        shippingAddress: {
          firstName: 'Test',
          lastName: 'Customer',
          address: '789 Test Street',
          city: 'Lomé',
          phone: '+22771234567'
        }
      };

      const response = await request(app)
        .post('/orders')
        .send(orderData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /orders', () => {
    it('should return user orders', async () => {
      const response = await request(app)
        .get('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
      expect(response.body.data.orders.length).toBeGreaterThan(0);
      expect(response.body.data.orders[0].userId).toBe(customerUser.id);
    });

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/orders?status=pending')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders.every(o => o.status === 'pending')).toBe(true);
    });

    it('should return orders for admin (all users)', async () => {
      const response = await request(app)
        .get('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
      // Admin peut voir toutes les commandes
    });

    it('should return store orders for vendor', async () => {
      const response = await request(app)
        .get('/orders')
        .set('Authorization', `Bearer ${vendorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeDefined();
      expect(response.body.data.orders.every(o => o.storeId === store.id)).toBe(true);
    });

    it('should apply pagination', async () => {
      const response = await request(app)
        .get('/orders?page=1&limit=5')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
    });
  });

  describe('GET /orders/:id', () => {
    it('should return order details for owner', async () => {
      const response = await request(app)
        .get(`/orders/${order.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order.id).toBe(order.id);
      expect(response.body.data.order.items).toBeDefined();
      expect(response.body.data.order.shippingAddress).toBeDefined();
    });

    it('should return order details for vendor', async () => {
      const response = await request(app)
        .get(`/orders/${order.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order.id).toBe(order.id);
    });

    it('should deny access to other customers', async () => {
      const response = await request(app)
        .get(`/orders/${order.id}`)
        .set('Authorization', `Bearer ${anotherCustomerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should allow admin access to any order', async () => {
      const response = await request(app)
        .get(`/orders/${order.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .get('/orders/99999')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /orders/:id/status', () => {
    it('should allow vendor to update order status', async () => {
      const statusData = {
        status: 'confirmed',
        notes: 'Commande confirmée'
      };

      const response = await request(app)
        .put(`/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(statusData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order.status).toBe('confirmed');
    });

    it('should allow admin to update any order status', async () => {
      const statusData = {
        status: 'shipped',
        trackingNumber: 'TRACK123456'
      };

      const response = await request(app)
        .put(`/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(statusData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order.status).toBe('shipped');
      expect(response.body.data.order.trackingNumber).toBe('TRACK123456');
    });

    it('should not allow customer to update order status', async () => {
      const statusData = {
        status: 'delivered'
      };

      const response = await request(app)
        .put(`/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(statusData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should validate status transitions', async () => {
      const statusData = {
        status: 'delivered' // Passage direct de pending à delivered non autorisé
      };

      const response = await request(app)
        .put(`/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(statusData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('transition');
    });
  });

  describe('POST /orders/:id/cancel', () => {
    it('should allow customer to cancel pending order', async () => {
      const cancelData = {
        reason: 'Plus besoin du produit'
      };

      const response = await request(app)
        .post(`/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(cancelData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order.status).toBe('cancelled');
      expect(response.body.data.order.cancellationReason).toBe(cancelData.reason);
    });

    it('should restore stock on cancellation', async () => {
      const initialStock = product1.stockQuantity;

      await request(app)
        .post(`/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Test cancellation' })
        .expect(200);

      const updatedProduct = await Product.findById(product1.id);
      expect(updatedProduct.stockQuantity).toBe(initialStock + 2); // 2 était la quantité commandée
    });

    it('should not allow cancellation of shipped orders', async () => {
      // D'abord expédier la commande
      await Order.updateStatus(order.id, 'shipped');

      const response = await request(app)
        .post(`/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Too late' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('cannot be cancelled');
    });

    it('should allow vendor to cancel order', async () => {
      const cancelData = {
        reason: 'Rupture de stock'
      };

      const response = await request(app)
        .post(`/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(cancelData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /orders/:id/tracking', () => {
    it('should return order tracking information', async () => {
      // D'abord ajouter des informations de suivi
      await Order.updateStatus(order.id, 'shipped', 'TRACK123456');

      const response = await request(app)
        .get(`/orders/${order.id}/tracking`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tracking).toBeDefined();
      expect(response.body.data.tracking.trackingNumber).toBe('TRACK123456');
      expect(response.body.data.tracking.history).toBeDefined();
    });

    it('should return tracking for vendor', async () => {
      const response = await request(app)
        .get(`/orders/${order.id}/tracking`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should deny tracking access to other customers', async () => {
      const response = await request(app)
        .get(`/orders/${order.id}/tracking`)
        .set('Authorization', `Bearer ${anotherCustomerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /orders/:id/rate', () => {
    it('should allow customer to rate delivered order', async () => {
      // Marquer la commande comme livrée
      await Order.updateStatus(order.id, 'delivered');

      const ratingData = {
        rating: 5,
        comment: 'Excellente commande!'
      };

      const response = await request(app)
        .post(`/orders/${order.id}/rate`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(ratingData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order.customerRating).toBe(5);
    });

    it('should not allow rating of non-delivered orders', async () => {
      const ratingData = {
        rating: 5,
        comment: 'Trop tôt'
      };

      const response = await request(app)
        .post(`/orders/${order.id}/rate`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(ratingData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('delivered');
    });

    it('should validate rating range', async () => {
      await Order.updateStatus(order.id, 'delivered');

      const ratingData = {
        rating: 6, // Hors limite
        comment: 'Note invalide'
      };

      const response = await request(app)
        .post(`/orders/${order.id}/rate`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(ratingData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /orders/statistics', () => {
    it('should return order statistics for admin', async () => {
      const response = await request(app)
        .get('/orders/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.statistics).toBeDefined();
      expect(response.body.data.statistics.totalOrders).toBeDefined();
      expect(response.body.data.statistics.totalRevenue).toBeDefined();
    });

    it('should return vendor-specific statistics', async () => {
      const response = await request(app)
        .get('/orders/statistics')
        .set('Authorization', `Bearer ${vendorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.statistics).toBeDefined();
      // Statistiques filtrées pour la boutique du vendeur
    });

    it('should deny access to customer', async () => {
      const response = await request(app)
        .get('/orders/statistics')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /orders/:id/refund', () => {
    it('should allow admin to process refund', async () => {
      // Marquer la commande comme payée et livrée
      await Order.updateStatus(order.id, 'delivered');

      const refundData = {
        amount: 15000, // Remboursement partiel
        reason: 'Produit défectueux'
      };

      const response = await request(app)
        .post(`/orders/${order.id}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(refundData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.refund).toBeDefined();
    });

    it('should not allow refund of non-paid orders', async () => {
      const refundData = {
        amount: 15000,
        reason: 'Test'
      };

      const response = await request(app)
        .post(`/orders/${order.id}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(refundData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Order workflow integration', () => {
    it('should handle complete order workflow', async () => {
      // 1. Créer une commande
      const orderData = {
        items: [
          {
            productId: product1.id,
            quantity: 1
          }
        ],
        shippingAddress: {
          firstName: 'Workflow',
          lastName: 'Test',
          address: '123 Workflow Street',
          city: 'Lomé',
          phone: '+22771111111'
        }
      };

      const createResponse = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData)
        .expect(201);

      const createdOrderId = createResponse.body.data.order.id;

      // 2. Vendeur confirme la commande
      await request(app)
        .put(`/orders/${createdOrderId}/status`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ status: 'confirmed' })
        .expect(200);

      // 3. Vendeur expédie la commande
      await request(app)
        .put(`/orders/${createdOrderId}/status`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ 
          status: 'shipped',
          trackingNumber: 'WORKFLOW123'
        })
        .expect(200);

      // 4. Admin marque comme livrée
      await request(app)
        .put(`/orders/${createdOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'delivered' })
        .expect(200);

      // 5. Client note la commande
      const rateResponse = await request(app)
        .post(`/orders/${createdOrderId}/rate`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          rating: 5,
          comment: 'Parfait!'
        })
        .expect(200);

      expect(rateResponse.body.data.order.customerRating).toBe(5);
    });
  });
});