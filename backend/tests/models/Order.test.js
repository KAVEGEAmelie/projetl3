const Order = require('../../src/models/Order');
const User = require('../../src/models/User');
const Store = require('../../src/models/Store');
const Product = require('../../src/models/Product');
const Category = require('../../src/models/Category');

describe('Order Model', () => {
  let customer, vendor, store, category, product;

  beforeEach(async () => {
    // Créer un client
    customer = await User.create({
      email: 'customer@test.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Customer',
      role: 'customer'
    });

    // Créer un vendeur
    vendor = await User.create({
      email: 'vendor@test.com',
      password: 'Password123!',
      firstName: 'Jane',
      lastName: 'Vendor',
      role: 'vendor'
    });

    // Créer une boutique
    store = await Store.create({
      name: 'Order Test Store',
      description: 'Store for order tests',
      ownerId: vendor.id,
      city: 'Lomé',
      address: '123 Order Street'
    });

    // Créer une catégorie
    category = await Category.create({
      name: 'Order Category',
      description: 'Category for order tests'
    });

    // Créer un produit
    product = await Product.create({
      name: 'Order Test Product',
      description: 'Product for order tests',
      storeId: store.id,
      categoryId: category.id,
      price: 25000,
      stockQuantity: 10
    });
  });

  describe('create', () => {
    it('should create a new order', async () => {
      const orderData = {
        userId: customer.id,
        storeId: store.id,
        items: [
          {
            productId: product.id,
            quantity: 2,
            price: product.price
          }
        ],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Customer',
          address: '456 Customer Street',
          city: 'Lomé',
          phone: '+22870123456'
        },
        paymentMethod: 'mobile_money',
        shippingMethod: 'standard'
      };

      const order = await Order.create(orderData);

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.orderNumber).toBeDefined();
      expect(order.orderNumber).toMatch(/^ORD-\d{8}-\d+$/);
      expect(order.userId).toBe(customer.id);
      expect(order.storeId).toBe(store.id);
      expect(order.status).toBe('pending');
      expect(order.totalAmount).toBe(50000); // 2 × 25000
      expect(order.paymentMethod).toBe('mobile_money');
      expect(order.shippingMethod).toBe('standard');
    });

    it('should calculate shipping fees', async () => {
      // Mettre à jour la boutique avec des frais de livraison
      await Store.updateById(store.id, { deliveryFee: 2000 });

      const orderData = {
        userId: customer.id,
        storeId: store.id,
        items: [
          {
            productId: product.id,
            quantity: 1,
            price: product.price
          }
        ],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Customer',
          address: '456 Customer Street',
          city: 'Lomé',
          phone: '+22770123456'
        }
      };

      const order = await Order.create(orderData);

      expect(order.shippingFee).toBe(2000);
      expect(order.totalAmount).toBe(27000); // 25000 + 2000
    });

    it('should create order items', async () => {
      const orderData = {
        userId: customer.id,
        storeId: store.id,
        items: [
          {
            productId: product.id,
            quantity: 2,
            price: product.price
          }
        ],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Customer',
          address: '456 Customer Street',
          city: 'Lomé',
          phone: '+22770123456'
        }
      };

      const order = await Order.create(orderData);
      const orderItems = await Order.getOrderItems(order.id);

      expect(orderItems).toHaveLength(1);
      expect(orderItems[0].productId).toBe(product.id);
      expect(orderItems[0].quantity).toBe(2);
      expect(orderItems[0].price).toBe(product.price);
    });
  });

  describe('findByUser', () => {
    it('should find orders by user', async () => {
      const orderData1 = {
        userId: customer.id,
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, price: product.price }],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Customer',
          address: '456 Customer Street',
          city: 'Lomé',
          phone: '+22770123456'
        }
      };

      const orderData2 = {
        userId: customer.id,
        storeId: store.id,
        items: [{ productId: product.id, quantity: 2, price: product.price }],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Customer',
          address: '456 Customer Street',
          city: 'Lomé',
          phone: '+22770123456'
        }
      };

      await Order.create(orderData1);
      await Order.create(orderData2);

      const orders = await Order.findByUser(customer.id);

      expect(orders).toHaveLength(2);
      expect(orders.every(order => order.userId === customer.id)).toBe(true);
    });
  });

  describe('findByStore', () => {
    it('should find orders by store', async () => {
      const orderData = {
        userId: customer.id,
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, price: product.price }],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Customer',
          address: '456 Customer Street',
          city: 'Lomé',
          phone: '+22770123456'
        }
      };

      await Order.create(orderData);

      const orders = await Order.findByStore(store.id);

      expect(orders).toHaveLength(1);
      expect(orders[0].storeId).toBe(store.id);
    });
  });

  describe('updateStatus', () => {
    it('should update order status', async () => {
      const orderData = {
        userId: customer.id,
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, price: product.price }],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Customer',
          address: '456 Customer Street',
          city: 'Lomé',
          phone: '+22770123456'
        }
      };

      const order = await Order.create(orderData);
      expect(order.status).toBe('pending');

      const updatedOrder = await Order.updateStatus(order.id, 'confirmed');

      expect(updatedOrder.status).toBe('confirmed');
      expect(updatedOrder.confirmedAt).toBeDefined();
    });

    it('should track status change timestamps', async () => {
      const orderData = {
        userId: customer.id,
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, price: product.price }],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Customer',
          address: '456 Customer Street',
          city: 'Lomé',
          phone: '+22770123456'
        }
      };

      const order = await Order.create(orderData);

      // Confirmer la commande
      await Order.updateStatus(order.id, 'confirmed');
      const confirmedOrder = await Order.findById(order.id);
      expect(confirmedOrder.confirmedAt).toBeDefined();

      // Expédier la commande
      await Order.updateStatus(order.id, 'shipped');
      const shippedOrder = await Order.findById(order.id);
      expect(shippedOrder.shippedAt).toBeDefined();

      // Livrer la commande
      await Order.updateStatus(order.id, 'delivered');
      const deliveredOrder = await Order.findById(order.id);
      expect(deliveredOrder.deliveredAt).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('should cancel an order', async () => {
      const orderData = {
        userId: customer.id,
        storeId: store.id,
        items: [{ productId: product.id, quantity: 2, price: product.price }],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Customer',
          address: '456 Customer Street',
          city: 'Lomé',
          phone: '+22770123456'
        }
      };

      const order = await Order.create(orderData);

      // Vérifier que le stock a été réduit
      const updatedProduct = await Product.findById(product.id);
      expect(updatedProduct.stockQuantity).toBe(8); // 10 - 2

      const cancelledOrder = await Order.cancel(order.id, 'Customer request');

      expect(cancelledOrder.status).toBe('cancelled');
      expect(cancelledOrder.cancelledAt).toBeDefined();
      expect(cancelledOrder.cancellationReason).toBe('Customer request');

      // Vérifier que le stock a été restauré
      const restoredProduct = await Product.findById(product.id);
      expect(restoredProduct.stockQuantity).toBe(10);
    });

    it('should not cancel already shipped order', async () => {
      const orderData = {
        userId: customer.id,
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, price: product.price }],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Customer',
          address: '456 Customer Street',
          city: 'Lomé',
          phone: '+22770123456'
        }
      };

      const order = await Order.create(orderData);
      await Order.updateStatus(order.id, 'shipped');

      await expect(Order.cancel(order.id, 'Too late')).rejects.toThrow();
    });
  });

  describe('addTracking', () => {
    it('should add tracking information', async () => {
      const orderData = {
        userId: customer.id,
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, price: product.price }],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Customer',
          address: '456 Customer Street',
          city: 'Lomé',
          phone: '+22770123456'
        }
      };

      const order = await Order.create(orderData);
      await Order.updateStatus(order.id, 'shipped');

      const trackingData = {
        trackingNumber: 'TRK123456789',
        carrier: 'DHL',
        trackingUrl: 'https://dhl.com/track/TRK123456789'
      };

      const updatedOrder = await Order.addTracking(order.id, trackingData);

      expect(updatedOrder.trackingNumber).toBe(trackingData.trackingNumber);
      expect(updatedOrder.carrier).toBe(trackingData.carrier);
      expect(updatedOrder.trackingUrl).toBe(trackingData.trackingUrl);
    });
  });

  describe('getStatistics', () => {
    it('should return order statistics', async () => {
      const orderData1 = {
        userId: customer.id,
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, price: product.price }],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Customer',
          address: '456 Customer Street',
          city: 'Lomé',
          phone: '+22770123456'
        }
      };

      const orderData2 = {
        userId: customer.id,
        storeId: store.id,
        items: [{ productId: product.id, quantity: 2, price: product.price }],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Customer',
          address: '456 Customer Street',
          city: 'Lomé',
          phone: '+22770123456'
        }
      };

      const order1 = await Order.create(orderData1);
      const order2 = await Order.create(orderData2);

      // Livrer une commande
      await Order.updateStatus(order1.id, 'delivered');

      const stats = await Order.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalOrders).toBeGreaterThan(0);
      expect(stats.completedOrders).toBeGreaterThan(0);
      expect(stats.totalRevenue).toBeGreaterThan(0);
      expect(stats.averageOrderValue).toBeGreaterThan(0);
    });
  });

  describe('findByOrderNumber', () => {
    it('should find order by order number', async () => {
      const orderData = {
        userId: customer.id,
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, price: product.price }],
        shippingAddress: {
          firstName: 'John',
          lastName: 'Customer',
          address: '456 Customer Street',
          city: 'Lomé',
          phone: '+22770123456'
        }
      };

      const createdOrder = await Order.create(orderData);
      const foundOrder = await Order.findByOrderNumber(createdOrder.orderNumber);

      expect(foundOrder).toBeDefined();
      expect(foundOrder.id).toBe(createdOrder.id);
      expect(foundOrder.orderNumber).toBe(createdOrder.orderNumber);
    });
  });
});