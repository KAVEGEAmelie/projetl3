const Payment = require('../../src/models/Payment');
const Order = require('../../src/models/Order');
const User = require('../../src/models/User');
const Store = require('../../src/models/Store');
const Product = require('../../src/models/Product');
const Category = require('../../src/models/Category');

describe('Payment Model', () => {
  let customer, vendor, store, category, product, order;

  beforeEach(async () => {
    // Créer un client
    customer = await User.create({
      email: 'payment-customer@test.com',
      password: 'Password123!',
      firstName: 'Payment',
      lastName: 'Customer',
      role: 'customer'
    });

    // Créer un vendeur
    vendor = await User.create({
      email: 'payment-vendor@test.com',
      password: 'Password123!',
      firstName: 'Payment',
      lastName: 'Vendor',
      role: 'vendor'
    });

    // Créer une boutique
    store = await Store.create({
      name: 'Payment Test Store',
      description: 'Store for payment tests',
      ownerId: vendor.id,
      city: 'Lomé',
      address: '123 Payment Street'
    });

    // Créer une catégorie
    category = await Category.create({
      name: 'Payment Category',
      description: 'Category for payment tests'
    });

    // Créer un produit
    product = await Product.create({
      name: 'Payment Test Product',
      description: 'Product for payment tests',
      storeId: store.id,
      categoryId: category.id,
      price: 25000,
      stockQuantity: 10
    });

    // Créer une commande
    order = await Order.create({
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
        firstName: 'Payment',
        lastName: 'Customer',
        address: '456 Payment Street',
        city: 'Lomé',
        phone: '+22770123456'
      }
    });
  });

  describe('create', () => {
    it('should create a new payment', async () => {
      const paymentData = {
        orderId: order.id,
        amount: order.totalAmount,
        paymentMethod: 'tmoney',
        currency: 'FCFA'
      };

      const payment = await Payment.create(paymentData);

      expect(payment).toBeDefined();
      expect(payment.id).toBeDefined();
      expect(payment.transactionId).toBeDefined();
      expect(payment.transactionId).toMatch(/^PAY-\d{8}-\w+$/);
      expect(payment.orderId).toBe(order.id);
      expect(payment.amount).toBe(order.totalAmount);
      expect(payment.paymentMethod).toBe('tmoney');
      expect(payment.status).toBe('pending');
      expect(payment.currency).toBe('FCFA');
    });

    it('should calculate fees for mobile money', async () => {
      const paymentData = {
        orderId: order.id,
        amount: 25000,
        paymentMethod: 'tmoney',
        currency: 'FCFA'
      };

      const payment = await Payment.create(paymentData);

      expect(payment.feeAmount).toBeGreaterThan(0);
      expect(payment.feeAmount).toBeLessThan(payment.amount);
    });

    it('should generate unique transaction ID', async () => {
      const paymentData1 = {
        orderId: order.id,
        amount: 25000,
        paymentMethod: 'orange_money',
        currency: 'FCFA'
      };

      const paymentData2 = {
        orderId: order.id,
        amount: 25000,
        paymentMethod: 'flooz',
        currency: 'FCFA'
      };

      const payment1 = await Payment.create(paymentData1);
      const payment2 = await Payment.create(paymentData2);

      expect(payment1.transactionId).not.toBe(payment2.transactionId);
    });
  });

  describe('findByTransactionId', () => {
    it('should find payment by transaction ID', async () => {
      const paymentData = {
        orderId: order.id,
        amount: 25000,
        paymentMethod: 'tmoney',
        currency: 'FCFA'
      };

      const createdPayment = await Payment.create(paymentData);
      const foundPayment = await Payment.findByTransactionId(createdPayment.transactionId);

      expect(foundPayment).toBeDefined();
      expect(foundPayment.id).toBe(createdPayment.id);
      expect(foundPayment.transactionId).toBe(createdPayment.transactionId);
    });

    it('should return null for non-existent transaction ID', async () => {
      const payment = await Payment.findByTransactionId('PAY-99999999-INVALID');
      expect(payment).toBeNull();
    });
  });

  describe('findByOrder', () => {
    it('should find payments by order', async () => {
      const paymentData = {
        orderId: order.id,
        amount: 25000,
        paymentMethod: 'tmoney',
        currency: 'FCFA'
      };

      await Payment.create(paymentData);

      const payments = await Payment.findByOrder(order.id);

      expect(payments).toHaveLength(1);
      expect(payments[0].orderId).toBe(order.id);
    });
  });

  describe('updateStatus', () => {
    it('should update payment status to completed', async () => {
      const paymentData = {
        orderId: order.id,
        amount: 25000,
        paymentMethod: 'tmoney',
        currency: 'FCFA'
      };

      const payment = await Payment.create(paymentData);
      expect(payment.status).toBe('pending');

      const completedPayment = await Payment.updateStatus(
        payment.id, 
        'completed',
        'EXTERNAL-TXN-123'
      );

      expect(completedPayment.status).toBe('completed');
      expect(completedPayment.completedAt).toBeDefined();
      expect(completedPayment.externalTransactionId).toBe('EXTERNAL-TXN-123');
    });

    it('should update payment status to failed', async () => {
      const paymentData = {
        orderId: order.id,
        amount: 25000,
        paymentMethod: 'orange_money',
        currency: 'FCFA'
      };

      const payment = await Payment.create(paymentData);

      const failedPayment = await Payment.updateStatus(
        payment.id,
        'failed',
        null,
        'Insufficient funds'
      );

      expect(failedPayment.status).toBe('failed');
      expect(failedPayment.failedAt).toBeDefined();
      expect(failedPayment.failureReason).toBe('Insufficient funds');
    });
  });

  describe('processRefund', () => {
    it('should process a refund', async () => {
      const paymentData = {
        orderId: order.id,
        amount: 25000,
        paymentMethod: 'tmoney',
        currency: 'FCFA'
      };

      const payment = await Payment.create(paymentData);
      await Payment.updateStatus(payment.id, 'completed', 'EXTERNAL-TXN-123');

      const refundedPayment = await Payment.processRefund(
        payment.id,
        15000,
        'Partial refund requested'
      );

      expect(refundedPayment.refundAmount).toBe(15000);
      expect(refundedPayment.refundReason).toBe('Partial refund requested');
      expect(refundedPayment.refundedAt).toBeDefined();
    });

    it('should not refund more than paid amount', async () => {
      const paymentData = {
        orderId: order.id,
        amount: 25000,
        paymentMethod: 'flooz',
        currency: 'FCFA'
      };

      const payment = await Payment.create(paymentData);
      await Payment.updateStatus(payment.id, 'completed', 'EXTERNAL-TXN-456');

      await expect(Payment.processRefund(payment.id, 30000, 'Invalid refund'))
        .rejects.toThrow();
    });

    it('should not refund pending payment', async () => {
      const paymentData = {
        orderId: order.id,
        amount: 25000,
        paymentMethod: 'mtn_money',
        currency: 'FCFA'
      };

      const payment = await Payment.create(paymentData);

      await expect(Payment.processRefund(payment.id, 10000, 'Cannot refund pending'))
        .rejects.toThrow();
    });
  });

  describe('findByUser', () => {
    it('should find payments by user', async () => {
      const paymentData = {
        orderId: order.id,
        amount: 25000,
        paymentMethod: 'tmoney',
        currency: 'FCFA'
      };

      await Payment.create(paymentData);

      const userPayments = await Payment.findByUser(customer.id);

      expect(userPayments).toHaveLength(1);
      expect(userPayments[0].orderId).toBe(order.id);
    });
  });

  describe('findByStore', () => {
    it('should find payments by store', async () => {
      const paymentData = {
        orderId: order.id,
        amount: 25000,
        paymentMethod: 'orange_money',
        currency: 'FCFA'
      };

      await Payment.create(paymentData);

      const storePayments = await Payment.findByStore(store.id);

      expect(storePayments).toHaveLength(1);
      expect(storePayments[0].orderId).toBe(order.id);
    });
  });

  describe('getStatistics', () => {
    it('should return payment statistics', async () => {
      const paymentData1 = {
        orderId: order.id,
        amount: 25000,
        paymentMethod: 'tmoney',
        currency: 'FCFA'
      };

      const paymentData2 = {
        orderId: order.id,
        amount: 30000,
        paymentMethod: 'orange_money',
        currency: 'FCFA'
      };

      const payment1 = await Payment.create(paymentData1);
      const payment2 = await Payment.create(paymentData2);

      // Compléter un paiement
      await Payment.updateStatus(payment1.id, 'completed', 'EXT-123');

      const stats = await Payment.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalPayments).toBeGreaterThan(0);
      expect(stats.completedPayments).toBeGreaterThan(0);
      expect(stats.totalAmount).toBeGreaterThan(0);
      expect(stats.totalFees).toBeGreaterThan(0);
      expect(stats.methodDistribution).toBeDefined();
    });
  });

  describe('webhook processing', () => {
    it('should process TMoney webhook', async () => {
      const paymentData = {
        orderId: order.id,
        amount: 25000,
        paymentMethod: 'tmoney',
        currency: 'FCFA'
      };

      const payment = await Payment.create(paymentData);

      const webhookData = {
        transaction_id: payment.transactionId,
        external_id: 'TMONEY-123456',
        status: 'SUCCESS',
        amount: 25000,
        fees: 125,
        reference: payment.transactionId
      };

      const processedPayment = await Payment.processWebhook('tmoney', webhookData);

      expect(processedPayment.status).toBe('completed');
      expect(processedPayment.externalTransactionId).toBe('TMONEY-123456');
    });

    it('should process failed webhook', async () => {
      const paymentData = {
        orderId: order.id,
        amount: 25000,
        paymentMethod: 'orange_money',
        currency: 'FCFA'
      };

      const payment = await Payment.create(paymentData);

      const webhookData = {
        transaction_id: payment.transactionId,
        external_id: 'OM-FAILED-123',
        status: 'FAILED',
        error_message: 'Insufficient balance'
      };

      const processedPayment = await Payment.processWebhook('orange_money', webhookData);

      expect(processedPayment.status).toBe('failed');
      expect(processedPayment.failureReason).toBe('Insufficient balance');
    });
  });

  describe('calculateFees', () => {
    it('should calculate correct fees for different amounts', async () => {
      // Test avec différents montants
      const fees1000 = await Payment.calculateFees(1000, 'tmoney');
      const fees10000 = await Payment.calculateFees(10000, 'tmoney');
      const fees100000 = await Payment.calculateFees(100000, 'tmoney');

      expect(fees1000).toBeGreaterThan(0);
      expect(fees10000).toBeGreaterThan(fees1000);
      expect(fees100000).toBeGreaterThan(fees10000);

      // Les frais ne doivent pas dépasser 5% du montant
      expect(fees100000).toBeLessThan(100000 * 0.05);
    });
  });
});