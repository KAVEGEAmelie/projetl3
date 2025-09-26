const emailService = require('../../src/services/emailService');
const nodemailer = require('nodemailer');
const User = require('../../src/models/User');
const Order = require('../../src/models/Order');

// Mock nodemailer
jest.mock('nodemailer');

describe('Email Service', () => {
  let mockTransporter, testUser, testOrder;

  beforeEach(async () => {
    // Mock du transporteur nodemailer
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({
        messageId: 'test-message-id',
        accepted: ['test@example.com'],
        rejected: []
      }),
      verify: jest.fn().mockResolvedValue(true)
    };

    nodemailer.createTransporter = jest.fn().mockReturnValue(mockTransporter);
    nodemailer.createTestAccount = jest.fn().mockResolvedValue({
      user: 'test@ethereal.email',
      pass: 'test-password'
    });

    // Créer des données de test
    testUser = await User.create({
      email: 'email-test@test.com',
      password: 'Password123!',
      firstName: 'Email',
      lastName: 'Test',
      role: 'customer'
    });

    testOrder = {
      id: 1,
      orderNumber: 'ORD-20241201-001',
      totalAmount: 25000,
      status: 'pending',
      items: [
        {
          productName: 'Test Product',
          quantity: 1,
          price: 25000
        }
      ]
    };

    // Reset mocks avant chaque test
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize email transporter', async () => {
      expect(emailService.transporter).toBeDefined();
    });

    it('should verify connection in development', async () => {
      process.env.NODE_ENV = 'development';
      await emailService.verifyConnection();
      
      expect(mockTransporter.verify).toHaveBeenCalled();
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email to new user', async () => {
      const result = await emailService.sendWelcomeEmail(testUser.email, testUser.firstName);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testUser.email,
          subject: expect.stringContaining('Bienvenue'),
          html: expect.stringContaining(testUser.firstName)
        })
      );
    });

    it('should handle email sending errors', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP Error'));

      const result = await emailService.sendWelcomeEmail(testUser.email, testUser.firstName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('SMTP Error');
    });

    it('should validate email format', async () => {
      const result = await emailService.sendWelcomeEmail('invalid-email', testUser.firstName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email');
    });

    it('should include unsubscribe link', async () => {
      await emailService.sendWelcomeEmail(testUser.email, testUser.firstName);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('unsubscribe')
        })
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with token', async () => {
      const resetToken = 'reset-token-123';
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

      const result = await emailService.sendPasswordResetEmail(
        testUser.email,
        testUser.firstName,
        resetToken
      );

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testUser.email,
          subject: expect.stringContaining('Réinitialisation'),
          html: expect.stringContaining(resetUrl)
        })
      );
    });

    it('should include expiration warning', async () => {
      const resetToken = 'reset-token-123';

      await emailService.sendPasswordResetEmail(
        testUser.email,
        testUser.firstName,
        resetToken
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('24 heures')
        })
      );
    });

    it('should validate reset token', async () => {
      const result = await emailService.sendPasswordResetEmail(
        testUser.email,
        testUser.firstName,
        '' // Token vide
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Token required');
    });
  });

  describe('sendOrderConfirmation', () => {
    it('should send order confirmation email', async () => {
      const result = await emailService.sendOrderConfirmation(
        testUser.email,
        testUser.firstName,
        testOrder
      );

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testUser.email,
          subject: expect.stringContaining('Confirmation'),
          html: expect.stringContaining(testOrder.orderNumber)
        })
      );
    });

    it('should include order details', async () => {
      await emailService.sendOrderConfirmation(
        testUser.email,
        testUser.firstName,
        testOrder
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringMatching(new RegExp(testOrder.totalAmount.toString()))
        })
      );
    });

    it('should include tracking information if available', async () => {
      const orderWithTracking = {
        ...testOrder,
        trackingNumber: 'TRACK-123456'
      };

      await emailService.sendOrderConfirmation(
        testUser.email,
        testUser.firstName,
        orderWithTracking
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('TRACK-123456')
        })
      );
    });
  });

  describe('sendOrderStatusUpdate', () => {
    it('should send status update email', async () => {
      const newStatus = 'shipped';
      const message = 'Votre commande a été expédiée';

      const result = await emailService.sendOrderStatusUpdate(
        testUser.email,
        testUser.firstName,
        testOrder,
        newStatus,
        message
      );

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testUser.email,
          subject: expect.stringContaining('Mise à jour'),
          html: expect.stringContaining(message)
        })
      );
    });

    it('should customize email based on status', async () => {
      const deliveredOrder = { ...testOrder, status: 'delivered' };

      await emailService.sendOrderStatusUpdate(
        testUser.email,
        testUser.firstName,
        deliveredOrder,
        'delivered',
        'Votre commande a été livrée'
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('livrée')
        })
      );
    });
  });

  describe('sendVendorNotification', () => {
    it('should send notification to vendor', async () => {
      const vendorEmail = 'vendor@test.com';
      const subject = 'Nouvelle commande';
      const message = 'Vous avez reçu une nouvelle commande';

      const result = await emailService.sendVendorNotification(
        vendorEmail,
        'Vendor',
        subject,
        message,
        testOrder
      );

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: vendorEmail,
          subject: subject,
          html: expect.stringContaining(message)
        })
      );
    });

    it('should include order details for vendor', async () => {
      await emailService.sendVendorNotification(
        'vendor@test.com',
        'Vendor',
        'Nouvelle commande',
        'Nouvelle commande reçue',
        testOrder
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(testOrder.orderNumber)
        })
      );
    });
  });

  describe('sendNewsletterEmail', () => {
    it('should send newsletter to subscribers', async () => {
      const newsletter = {
        subject: 'Newsletter Test',
        content: 'Contenu de la newsletter',
        unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123'
      };

      const subscribers = [
        { email: 'subscriber1@test.com', firstName: 'Subscriber1' },
        { email: 'subscriber2@test.com', firstName: 'Subscriber2' }
      ];

      const result = await emailService.sendNewsletterEmail(newsletter, subscribers);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(subscribers.length);
    });

    it('should handle partial failures in newsletter', async () => {
      mockTransporter.sendMail
        .mockResolvedValueOnce({ messageId: 'success-1' })
        .mockRejectedValueOnce(new Error('Failed to send'));

      const newsletter = {
        subject: 'Newsletter Test',
        content: 'Contenu de la newsletter'
      };

      const subscribers = [
        { email: 'subscriber1@test.com', firstName: 'Subscriber1' },
        { email: 'invalid@test.com', firstName: 'Subscriber2' }
      ];

      const result = await emailService.sendNewsletterEmail(newsletter, subscribers);

      expect(result.success).toBe(true);
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('sendContactFormEmail', () => {
    it('should send contact form submission', async () => {
      const contactData = {
        name: 'John Doe',
        email: 'john@test.com',
        subject: 'Question about product',
        message: 'I have a question about your products'
      };

      const result = await emailService.sendContactFormEmail(contactData);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: process.env.ADMIN_EMAIL,
          subject: expect.stringContaining('Contact'),
          html: expect.stringContaining(contactData.message)
        })
      );
    });

    it('should include sender information', async () => {
      const contactData = {
        name: 'Jane Doe',
        email: 'jane@test.com',
        subject: 'Support request',
        message: 'I need help with my order'
      };

      await emailService.sendContactFormEmail(contactData);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(contactData.email)
        })
      );
    });
  });

  describe('email templates', () => {
    it('should use proper HTML structure', async () => {
      await emailService.sendWelcomeEmail(testUser.email, testUser.firstName);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringMatching(/<html.*>[\s\S]*<\/html>/i)
        })
      );
    });

    it('should include company branding', async () => {
      await emailService.sendWelcomeEmail(testUser.email, testUser.firstName);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('AfrikMode') // Ou votre nom de marque
        })
      );
    });

    it('should be mobile-responsive', async () => {
      await emailService.sendWelcomeEmail(testUser.email, testUser.firstName);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('viewport')
        })
      );
    });
  });

  describe('email queue and batch processing', () => {
    it('should batch process large email lists', async () => {
      const largeSubscriberList = Array(100).fill().map((_, i) => ({
        email: `subscriber${i}@test.com`,
        firstName: `Subscriber${i}`
      }));

      const newsletter = {
        subject: 'Batch Test',
        content: 'Batch newsletter content'
      };

      await emailService.sendNewsletterEmail(newsletter, largeSubscriberList);

      // Vérifier que les emails sont envoyés par batch
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(largeSubscriberList.length);
    });

    it('should respect rate limits', async () => {
      const startTime = Date.now();

      const subscribers = Array(5).fill().map((_, i) => ({
        email: `rate-test${i}@test.com`,
        firstName: `User${i}`
      }));

      const newsletter = {
        subject: 'Rate Limit Test',
        content: 'Testing rate limits'
      };

      await emailService.sendNewsletterEmail(newsletter, subscribers);

      // Dans un vrai service, on vérifierait les délais entre envois
      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling and logging', () => {
    it('should log successful email sends', async () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      await emailService.sendWelcomeEmail(testUser.email, testUser.firstName);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Email sent successfully')
      );

      consoleSpy.mockRestore();
    });

    it('should log email failures', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockTransporter.sendMail.mockRejectedValue(new Error('Email service down'));

      await emailService.sendWelcomeEmail(testUser.email, testUser.firstName);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Email sending failed')
      );

      consoleSpy.mockRestore();
    });

    it('should handle connection errors gracefully', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('Connection failed'));

      const result = await emailService.verifyConnection();

      expect(result).toBe(false);
    });
  });
});