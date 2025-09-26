const paymentService = require('../../src/services/paymentService');
const axios = require('axios');
const crypto = require('crypto');
const Payment = require('../../src/models/Payment');
const Order = require('../../src/models/Order');

// Mock des dépendances
jest.mock('axios');
jest.mock('crypto');

describe('Payment Service', () => {
  let mockOrder, mockPayment;

  beforeEach(() => {
    // Mock data
    mockOrder = {
      id: 1,
      userId: 1,
      storeId: 1,
      totalAmount: 25000,
      status: 'pending',
      items: [
        {
          productId: 1,
          quantity: 1,
          price: 25000
        }
      ]
    };

    mockPayment = {
      id: 1,
      orderId: mockOrder.id,
      amount: 25000,
      paymentMethod: 'tmoney',
      status: 'pending',
      transactionId: 'PAY-20241201-001',
      currency: 'FCFA'
    };

    // Mock crypto
    crypto.createHash = jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mocked-hash')
    });

    crypto.randomBytes = jest.fn().mockReturnValue(Buffer.from('random-bytes'));

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('initializePayment', () => {
    it('should initialize TMoney payment', async () => {
      const paymentData = {
        orderId: mockOrder.id,
        amount: 25000,
        paymentMethod: 'tmoney',
        customerPhone: '+22770123456'
      };

      // Mock TMoney API response
      axios.post.mockResolvedValue({
        status: 200,
        data: {
          status: 'success',
          transaction_id: 'TMONEY-123456',
          payment_url: 'https://tmoney.tg/pay/123456',
          expires_at: '2024-12-01T23:59:59Z'
        }
      });

      const result = await paymentService.initializePayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.data.paymentUrl).toBeDefined();
      expect(result.data.externalTransactionId).toBe('TMONEY-123456');
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('tmoney'),
        expect.objectContaining({
          amount: 25000,
          currency: 'FCFA',
          phone: '+22770123456'
        }),
        expect.any(Object)
      );
    });

    it('should initialize Orange Money payment', async () => {
      const paymentData = {
        orderId: mockOrder.id,
        amount: 30000,
        paymentMethod: 'orange_money',
        customerPhone: '+22770654321'
      };

      axios.post.mockResolvedValue({
        status: 200,
        data: {
          status: 'PENDING',
          transaction_id: 'OM-789012',
          reference: 'REF-OM-789012'
        }
      });

      const result = await paymentService.initializePayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.data.externalTransactionId).toBe('OM-789012');
    });

    it('should initialize Flooz payment', async () => {
      const paymentData = {
        orderId: mockOrder.id,
        amount: 15000,
        paymentMethod: 'flooz',
        customerPhone: '+22791234567'
      };

      axios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          transaction_id: 'FLOOZ-345678',
          ussd_code: '*155*1*345678#'
        }
      });

      const result = await paymentService.initializePayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.data.ussdCode).toBe('*155*1*345678#');
    });

    it('should handle invalid payment method', async () => {
      const paymentData = {
        orderId: mockOrder.id,
        amount: 25000,
        paymentMethod: 'invalid_method',
        customerPhone: '+22770123456'
      };

      const result = await paymentService.initializePayment(paymentData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported payment method');
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        orderId: mockOrder.id,
        amount: 25000
        // Missing paymentMethod and customerPhone
      };

      const result = await paymentService.initializePayment(incompleteData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should handle API errors', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      const paymentData = {
        orderId: mockOrder.id,
        amount: 25000,
        paymentMethod: 'tmoney',
        customerPhone: '+22770123456'
      };

      const result = await paymentService.initializePayment(paymentData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('verifyPayment', () => {
    it('should verify TMoney payment status', async () => {
      const transactionId = 'TMONEY-123456';

      axios.get.mockResolvedValue({
        status: 200,
        data: {
          status: 'SUCCESS',
          transaction_id: transactionId,
          amount: 25000,
          fees: 125,
          timestamp: '2024-12-01T12:00:00Z'
        }
      });

      const result = await paymentService.verifyPayment(transactionId, 'tmoney');

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(result.amount).toBe(25000);
      expect(result.fees).toBe(125);
    });

    it('should verify Orange Money payment status', async () => {
      const transactionId = 'OM-789012';

      axios.get.mockResolvedValue({
        status: 200,
        data: {
          status: 'SUCCESSFUL',
          transaction_id: transactionId,
          amount: 30000,
          commission: 150
        }
      });

      const result = await paymentService.verifyPayment(transactionId, 'orange_money');

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESSFUL');
    });

    it('should handle failed payment verification', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: {
          status: 'FAILED',
          transaction_id: 'TMONEY-FAILED',
          error_message: 'Insufficient funds'
        }
      });

      const result = await paymentService.verifyPayment('TMONEY-FAILED', 'tmoney');

      expect(result.success).toBe(true);
      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toBe('Insufficient funds');
    });
  });

  describe('processWebhook', () => {
    it('should process TMoney webhook', async () => {
      const webhookData = {
        transaction_id: 'PAY-20241201-001',
        external_transaction_id: 'TMONEY-123456',
        status: 'SUCCESS',
        amount: 25000,
        fees: 125,
        timestamp: '2024-12-01T12:00:00Z',
        signature: 'webhook-signature'
      };

      // Mock webhook signature validation
      paymentService.validateWebhookSignature = jest.fn().mockReturnValue(true);

      // Mock Payment.findByTransactionId
      Payment.findByTransactionId = jest.fn().mockResolvedValue(mockPayment);
      Payment.updateStatus = jest.fn().mockResolvedValue({
        ...mockPayment,
        status: 'completed',
        externalTransactionId: 'TMONEY-123456'
      });

      const result = await paymentService.processWebhook('tmoney', webhookData);

      expect(result.success).toBe(true);
      expect(Payment.updateStatus).toHaveBeenCalledWith(
        mockPayment.id,
        'completed',
        'TMONEY-123456'
      );
    });

    it('should validate webhook signature', async () => {
      const webhookData = {
        transaction_id: 'PAY-20241201-001',
        status: 'SUCCESS',
        signature: 'invalid-signature'
      };

      paymentService.validateWebhookSignature = jest.fn().mockReturnValue(false);

      const result = await paymentService.processWebhook('tmoney', webhookData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid signature');
    });

    it('should handle webhook for non-existent payment', async () => {
      const webhookData = {
        transaction_id: 'NON-EXISTENT',
        status: 'SUCCESS',
        signature: 'valid-signature'
      };

      paymentService.validateWebhookSignature = jest.fn().mockReturnValue(true);
      Payment.findByTransactionId = jest.fn().mockResolvedValue(null);

      const result = await paymentService.processWebhook('tmoney', webhookData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Payment not found');
    });
  });

  describe('refundPayment', () => {
    it('should process refund for TMoney payment', async () => {
      const refundData = {
        paymentId: mockPayment.id,
        amount: 15000, // Partial refund
        reason: 'Customer request'
      };

      axios.post.mockResolvedValue({
        status: 200,
        data: {
          status: 'SUCCESS',
          refund_id: 'REFUND-123456',
          amount: 15000
        }
      });

      Payment.findById = jest.fn().mockResolvedValue({
        ...mockPayment,
        status: 'completed',
        externalTransactionId: 'TMONEY-123456'
      });

      Payment.processRefund = jest.fn().mockResolvedValue({
        ...mockPayment,
        refundAmount: 15000,
        refundedAt: new Date()
      });

      const result = await paymentService.refundPayment(refundData);

      expect(result.success).toBe(true);
      expect(result.refundId).toBe('REFUND-123456');
    });

    it('should validate refund amount', async () => {
      const refundData = {
        paymentId: mockPayment.id,
        amount: 30000, // More than payment amount
        reason: 'Invalid refund'
      };

      Payment.findById = jest.fn().mockResolvedValue(mockPayment);

      const result = await paymentService.refundPayment(refundData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds');
    });

    it('should handle refund API errors', async () => {
      const refundData = {
        paymentId: mockPayment.id,
        amount: 10000,
        reason: 'API error test'
      };

      Payment.findById = jest.fn().mockResolvedValue({
        ...mockPayment,
        status: 'completed'
      });

      axios.post.mockRejectedValue(new Error('Refund API unavailable'));

      const result = await paymentService.refundPayment(refundData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Refund API unavailable');
    });
  });

  describe('calculateFees', () => {
    it('should calculate TMoney fees correctly', () => {
      const fees1000 = paymentService.calculateFees(1000, 'tmoney');
      const fees10000 = paymentService.calculateFees(10000, 'tmoney');
      const fees100000 = paymentService.calculateFees(100000, 'tmoney');

      expect(fees1000).toBeGreaterThan(0);
      expect(fees10000).toBeGreaterThan(fees1000);
      expect(fees100000).toBeGreaterThan(fees10000);

      // Fees should not exceed 5% of transaction amount
      expect(fees100000).toBeLessThan(100000 * 0.05);
    });

    it('should calculate Orange Money fees correctly', () => {
      const fees5000 = paymentService.calculateFees(5000, 'orange_money');
      const fees50000 = paymentService.calculateFees(50000, 'orange_money');

      expect(fees5000).toBeGreaterThan(0);
      expect(fees50000).toBeGreaterThan(fees5000);
    });

    it('should have minimum fee threshold', () => {
      const minFee = paymentService.calculateFees(100, 'tmoney');
      
      expect(minFee).toBeGreaterThanOrEqual(25); // Minimum 25 FCFA
    });

    it('should handle unsupported payment methods', () => {
      const fees = paymentService.calculateFees(10000, 'unsupported_method');
      
      expect(fees).toBe(0);
    });
  });

  describe('generatePaymentReference', () => {
    it('should generate unique payment reference', () => {
      const ref1 = paymentService.generatePaymentReference();
      const ref2 = paymentService.generatePaymentReference();

      expect(ref1).toBeDefined();
      expect(ref2).toBeDefined();
      expect(ref1).not.toBe(ref2);
      expect(ref1).toMatch(/^PAY-\d{8}-[A-Z0-9]{6}$/);
    });

    it('should include date in reference', () => {
      const reference = paymentService.generatePaymentReference();
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      
      expect(reference).toContain(today);
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate correct signature', () => {
      const payload = {
        transaction_id: 'TEST-123',
        status: 'SUCCESS',
        amount: 25000
      };

      const secret = 'webhook-secret-key';
      const validSignature = crypto.createHash('sha256')
        .update(JSON.stringify(payload) + secret)
        .digest('hex');

      const isValid = paymentService.validateWebhookSignature(
        payload, 
        validSignature, 
        secret
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = {
        transaction_id: 'TEST-123',
        status: 'SUCCESS',
        amount: 25000
      };

      const isValid = paymentService.validateWebhookSignature(
        payload,
        'invalid-signature',
        'webhook-secret-key'
      );

      expect(isValid).toBe(false);
    });
  });

  describe('getPaymentStatus', () => {
    it('should return payment status and history', async () => {
      const paymentId = 1;

      Payment.findById = jest.fn().mockResolvedValue({
        ...mockPayment,
        status: 'completed',
        statusHistory: [
          { status: 'pending', timestamp: '2024-12-01T10:00:00Z' },
          { status: 'completed', timestamp: '2024-12-01T10:05:00Z' }
        ]
      });

      const result = await paymentService.getPaymentStatus(paymentId);

      expect(result.success).toBe(true);
      expect(result.payment.status).toBe('completed');
      expect(result.payment.statusHistory).toHaveLength(2);
    });

    it('should handle non-existent payment', async () => {
      Payment.findById = jest.fn().mockResolvedValue(null);

      const result = await paymentService.getPaymentStatus(999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Payment not found');
    });
  });

  describe('retryFailedPayment', () => {
    it('should retry failed payment', async () => {
      const paymentId = 1;

      Payment.findById = jest.fn().mockResolvedValue({
        ...mockPayment,
        status: 'failed',
        paymentMethod: 'tmoney'
      });

      axios.post.mockResolvedValue({
        status: 200,
        data: {
          status: 'success',
          transaction_id: 'TMONEY-RETRY-123'
        }
      });

      Payment.update = jest.fn().mockResolvedValue({
        ...mockPayment,
        status: 'pending',
        retryCount: 1
      });

      const result = await paymentService.retryFailedPayment(paymentId);

      expect(result.success).toBe(true);
      expect(Payment.update).toHaveBeenCalled();
    });

    it('should limit retry attempts', async () => {
      Payment.findById = jest.fn().mockResolvedValue({
        ...mockPayment,
        status: 'failed',
        retryCount: 3 // Maximum retries reached
      });

      const result = await paymentService.retryFailedPayment(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum retry attempts');
    });
  });

  describe('analytics and reporting', () => {
    it('should get payment statistics', async () => {
      Payment.getStatistics = jest.fn().mockResolvedValue({
        totalPayments: 150,
        totalAmount: 3750000,
        successfulPayments: 140,
        failedPayments: 10,
        averageAmount: 25000,
        methodDistribution: {
          tmoney: 60,
          orange_money: 50,
          flooz: 40
        }
      });

      const stats = await paymentService.getPaymentStatistics();

      expect(stats.totalPayments).toBe(150);
      expect(stats.successRate).toBeCloseTo(93.33);
      expect(stats.methodDistribution).toBeDefined();
    });

    it('should get payment trends', async () => {
      const dateRange = {
        startDate: '2024-11-01',
        endDate: '2024-11-30'
      };

      Payment.getPaymentTrends = jest.fn().mockResolvedValue([
        { date: '2024-11-01', count: 5, amount: 125000 },
        { date: '2024-11-02', count: 8, amount: 200000 }
      ]);

      const trends = await paymentService.getPaymentTrends(dateRange);

      expect(trends).toHaveLength(2);
      expect(trends[0].date).toBe('2024-11-01');
    });
  });

  describe('error handling and logging', () => {
    it('should log payment initialization', async () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      axios.post.mockResolvedValue({
        status: 200,
        data: { status: 'success', transaction_id: 'LOG-TEST-123' }
      });

      await paymentService.initializePayment({
        orderId: 1,
        amount: 25000,
        paymentMethod: 'tmoney',
        customerPhone: '+22770123456'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Payment initialized')
      );

      consoleSpy.mockRestore();
    });

    it('should log payment failures', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      axios.post.mockRejectedValue(new Error('Payment API down'));

      await paymentService.initializePayment({
        orderId: 1,
        amount: 25000,
        paymentMethod: 'tmoney',
        customerPhone: '+22770123456'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Payment initialization failed')
      );

      consoleSpy.mockRestore();
    });
  });
});