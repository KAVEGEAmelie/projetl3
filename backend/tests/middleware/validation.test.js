const validationMiddleware = require('../../src/middleware/validation');
const { body, param, query, validationResult } = require('express-validator');

// Mock express-validator
jest.mock('express-validator', () => ({
  body: jest.fn(),
  param: jest.fn(),
  query: jest.fn(),
  validationResult: jest.fn(),
  check: jest.fn(),
  oneOf: jest.fn()
}));

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { id: 1, role: 'customer' }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('User Validation', () => {
    it('should validate user registration data', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        dateOfBirth: '1990-01-15'
      };

      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      });

      await validationMiddleware.validateUserRegistration(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject invalid email format', async () => {
      req.body = {
        email: 'invalid-email',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const errors = [
        { msg: 'Please provide a valid email address', param: 'email' }
      ];

      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => errors
      });

      await validationMiddleware.validateUserRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: ['Please provide a valid email address']
      });
    });

    it('should reject weak passwords', async () => {
      req.body = {
        email: 'test@example.com',
        password: '123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const errors = [
        { msg: 'Password must be at least 8 characters long', param: 'password' }
      ];

      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => errors
      });

      await validationMiddleware.validateUserRegistration(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: ['Password must be at least 8 characters long']
      });
    });

    it('should validate password strength requirements', async () => {
      const weakPasswords = [
        'password',      // No numbers/special chars
        '12345678',      // Only numbers
        'PASSWORD',      // Only uppercase
        'pass',          // Too short
        'commonpassword123' // Common password
      ];

      for (const password of weakPasswords) {
        req.body = {
          email: 'test@example.com',
          password: password,
          firstName: 'John',
          lastName: 'Doe'
        };

        const isValid = validationMiddleware.isStrongPassword(password);
        expect(isValid).toBe(false);
      }
    });

    it('should accept strong passwords', async () => {
      const strongPasswords = [
        'MyStrongP@ss123',
        'ComplexPassw0rd!',
        'S3cur3P@ssw0rd',
        'Str0ng&Secure123'
      ];

      for (const password of strongPasswords) {
        const isValid = validationMiddleware.isStrongPassword(password);
        expect(isValid).toBe(true);
      }
    });

    it('should validate phone numbers', async () => {
      const validPhones = [
        '+1234567890',
        '+33123456789',
        '+229987654321',
        '+22890123456'
      ];

      const invalidPhones = [
        '1234567890',    // Missing country code
        '+123',          // Too short
        'abc123456',     // Contains letters
        '+1234567890123456' // Too long
      ];

      for (const phone of validPhones) {
        expect(validationMiddleware.isValidPhoneNumber(phone)).toBe(true);
      }

      for (const phone of invalidPhones) {
        expect(validationMiddleware.isValidPhoneNumber(phone)).toBe(false);
      }
    });
  });

  describe('Product Validation', () => {
    it('should validate product creation data', async () => {
      req.body = {
        name: 'Test Product',
        description: 'A great product for testing',
        price: 29.99,
        category: 'electronics',
        stock: 100,
        sku: 'TEST-001',
        weight: 0.5,
        dimensions: {
          length: 10,
          width: 5,
          height: 3
        },
        culturalSignificance: 'Traditional craft',
        origin: 'Benin'
      };

      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      });

      await validationMiddleware.validateProductCreation(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject negative prices', async () => {
      req.body = {
        name: 'Test Product',
        price: -10,
        stock: 5
      };

      const errors = [
        { msg: 'Price must be greater than 0', param: 'price' }
      ];

      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => errors
      });

      await validationMiddleware.validateProductCreation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should validate product name length', async () => {
      req.body = {
        name: 'ab',  // Too short
        price: 10,
        stock: 5
      };

      const errors = [
        { msg: 'Product name must be between 3 and 100 characters', param: 'name' }
      ];

      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => errors
      });

      await validationMiddleware.validateProductCreation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should validate SKU format', async () => {
      const validSKUs = [
        'PROD-001',
        'ABC123',
        'TEST_PRODUCT_001',
        'CLOTH-RED-M'
      ];

      const invalidSKUs = [
        'ab',           // Too short
        'invalid sku',  // Contains spaces
        'PROD@001',     // Invalid characters
        'a'.repeat(51)  // Too long
      ];

      for (const sku of validSKUs) {
        expect(validationMiddleware.isValidSKU(sku)).toBe(true);
      }

      for (const sku of invalidSKUs) {
        expect(validationMiddleware.isValidSKU(sku)).toBe(false);
      }
    });

    it('should validate product dimensions', async () => {
      req.body = {
        name: 'Test Product',
        price: 10,
        dimensions: {
          length: -5,  // Invalid negative value
          width: 0,    // Invalid zero value
          height: 'abc' // Invalid non-numeric value
        }
      };

      const isValid = validationMiddleware.validateDimensions(req.body.dimensions);
      expect(isValid).toBe(false);
    });
  });

  describe('Order Validation', () => {
    it('should validate order creation', async () => {
      req.body = {
        items: [
          {
            productId: 1,
            quantity: 2,
            price: 29.99
          },
          {
            productId: 2,
            quantity: 1,
            price: 15.50
          }
        ],
        shippingAddress: {
          street: '123 Main St',
          city: 'Cotonou',
          country: 'Benin',
          postalCode: '01BP234'
        },
        paymentMethod: 'tmoney'
      };

      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      });

      await validationMiddleware.validateOrderCreation(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject orders with invalid quantities', async () => {
      req.body = {
        items: [
          {
            productId: 1,
            quantity: 0,  // Invalid quantity
            price: 29.99
          }
        ],
        shippingAddress: {
          street: '123 Main St',
          city: 'Cotonou',
          country: 'Benin'
        }
      };

      const errors = [
        { msg: 'Quantity must be at least 1', param: 'items[0].quantity' }
      ];

      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => errors
      });

      await validationMiddleware.validateOrderCreation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should validate shipping addresses', async () => {
      const validAddress = {
        street: '123 Main Street',
        city: 'Cotonou',
        state: 'Littoral',
        country: 'Benin',
        postalCode: '01BP234'
      };

      const invalidAddresses = [
        { street: '', city: 'Cotonou', country: 'Benin' }, // Missing street
        { street: '123 Main St', city: '', country: 'Benin' }, // Missing city
        { street: '123 Main St', city: 'Cotonou', country: '' } // Missing country
      ];

      expect(validationMiddleware.isValidAddress(validAddress)).toBe(true);

      for (const address of invalidAddresses) {
        expect(validationMiddleware.isValidAddress(address)).toBe(false);
      }
    });
  });

  describe('Store Validation', () => {
    it('should validate store creation', async () => {
      req.body = {
        name: 'African Crafts Store',
        description: 'Authentic African crafts and textiles',
        category: 'fashion',
        address: {
          street: '123 Commerce Ave',
          city: 'Porto-Novo',
          country: 'Benin'
        },
        phone: '+22990123456',
        email: 'store@example.com'
      };

      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      });

      await validationMiddleware.validateStoreCreation(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should validate store business hours', async () => {
      const validHours = {
        monday: { open: '09:00', close: '18:00', closed: false },
        tuesday: { open: '09:00', close: '18:00', closed: false },
        wednesday: { open: '09:00', close: '18:00', closed: false },
        thursday: { open: '09:00', close: '18:00', closed: false },
        friday: { open: '09:00', close: '18:00', closed: false },
        saturday: { open: '10:00', close: '16:00', closed: false },
        sunday: { closed: true }
      };

      const invalidHours = {
        monday: { open: '25:00', close: '18:00', closed: false }, // Invalid hour
        tuesday: { open: '09:00', close: '08:00', closed: false } // Close before open
      };

      expect(validationMiddleware.validateBusinessHours(validHours)).toBe(true);
      expect(validationMiddleware.validateBusinessHours(invalidHours)).toBe(false);
    });
  });

  describe('Search and Filter Validation', () => {
    it('should validate search parameters', async () => {
      req.query = {
        q: 'african textile',
        category: 'fashion',
        minPrice: '10',
        maxPrice: '100',
        page: '1',
        limit: '20',
        sortBy: 'price',
        sortOrder: 'asc'
      };

      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      });

      await validationMiddleware.validateSearchQuery(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should validate pagination parameters', async () => {
      req.query = {
        page: '-1',  // Invalid negative page
        limit: '1000' // Exceeds maximum limit
      };

      const errors = [
        { msg: 'Page must be a positive integer', param: 'page' },
        { msg: 'Limit cannot exceed 100', param: 'limit' }
      ];

      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => errors
      });

      await validationMiddleware.validateSearchQuery(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should validate sort parameters', async () => {
      const validSortFields = ['name', 'price', 'rating', 'createdAt', 'popularity'];
      const validSortOrders = ['asc', 'desc'];

      for (const field of validSortFields) {
        expect(validationMiddleware.isValidSortField(field)).toBe(true);
      }

      for (const order of validSortOrders) {
        expect(validationMiddleware.isValidSortOrder(order)).toBe(true);
      }

      expect(validationMiddleware.isValidSortField('invalidField')).toBe(false);
      expect(validationMiddleware.isValidSortOrder('random')).toBe(false);
    });
  });

  describe('Custom Validators', () => {
    it('should validate African postal codes', async () => {
      const validCodes = [
        '01BP234',     // Benin
        '04BP567',     // Togo
        'ABCD1234',    // Ghana format
        '12345'        // Generic 5-digit
      ];

      const invalidCodes = [
        '',            // Empty
        'abc',         // Too short
        '123456789012' // Too long
      ];

      for (const code of validCodes) {
        expect(validationMiddleware.isValidAfricanPostalCode(code)).toBe(true);
      }

      for (const code of invalidCodes) {
        expect(validationMiddleware.isValidAfricanPostalCode(code)).toBe(false);
      }
    });

    it('should validate cultural significance descriptions', async () => {
      const validDescriptions = [
        'Traditional Yoruba textile pattern',
        'Ancient Benin bronze casting technique',
        'Contemporary interpretation of Kente cloth'
      ];

      const invalidDescriptions = [
        '',              // Empty
        'abc',           // Too short
        'a'.repeat(1001) // Too long
      ];

      for (const desc of validDescriptions) {
        expect(validationMiddleware.isValidCulturalDescription(desc)).toBe(true);
      }

      for (const desc of invalidDescriptions) {
        expect(validationMiddleware.isValidCulturalDescription(desc)).toBe(false);
      }
    });

    it('should validate price ranges', async () => {
      const validRanges = [
        { min: 10, max: 100 },
        { min: 0, max: 50 },
        { min: 25, max: 25 } // Equal min/max
      ];

      const invalidRanges = [
        { min: 100, max: 50 }, // Min greater than max
        { min: -10, max: 100 }, // Negative min
        { min: 10, max: -50 }   // Negative max
      ];

      for (const range of validRanges) {
        expect(validationMiddleware.isValidPriceRange(range.min, range.max)).toBe(true);
      }

      for (const range of invalidRanges) {
        expect(validationMiddleware.isValidPriceRange(range.min, range.max)).toBe(false);
      }
    });
  });

  describe('Sanitization', () => {
    it('should sanitize user input', async () => {
      req.body = {
        name: '  John Doe  ',
        description: '<script>alert("xss")</script>Valid description',
        email: '  TEST@EXAMPLE.COM  '
      };

      const sanitized = validationMiddleware.sanitizeInput(req.body);

      expect(sanitized.name).toBe('John Doe');
      expect(sanitized.description).toBe('Valid description');
      expect(sanitized.email).toBe('test@example.com');
    });

    it('should remove dangerous HTML tags', async () => {
      const dangerousInput = {
        content: '<script>alert("hack")</script><p>Safe content</p><iframe src="evil.com"></iframe>'
      };

      const sanitized = validationMiddleware.sanitizeHTML(dangerousInput.content);
      
      expect(sanitized).toBe('<p>Safe content</p>');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('<iframe>');
    });

    it('should preserve safe formatting tags', async () => {
      const input = '<p>This is <strong>bold</strong> and <em>italic</em> text.</p>';
      
      const sanitized = validationMiddleware.sanitizeHTML(input);
      
      expect(sanitized).toBe(input);
    });
  });

  describe('Rate Limiting Validation', () => {
    it('should validate rate limiting headers', async () => {
      req.headers = {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        'user-agent': 'Mozilla/5.0...'
      };

      const clientIp = validationMiddleware.getClientIP(req);
      expect(clientIp).toBe('192.168.1.1');
    });

    it('should detect suspicious patterns', async () => {
      const suspiciousInputs = [
        'SELECT * FROM users',     // SQL injection attempt
        '../../../etc/passwd',     // Path traversal
        'javascript:alert(1)',     // JavaScript injection
        'data:text/html,<script>'  // Data URL
      ];

      for (const input of suspiciousInputs) {
        expect(validationMiddleware.isSuspiciousInput(input)).toBe(true);
      }
    });
  });

  describe('File Upload Validation', () => {
    it('should validate image file types', async () => {
      const validFiles = [
        { mimetype: 'image/jpeg', size: 1024000 },
        { mimetype: 'image/png', size: 512000 },
        { mimetype: 'image/gif', size: 256000 }
      ];

      const invalidFiles = [
        { mimetype: 'text/plain', size: 1000 },
        { mimetype: 'application/javascript', size: 500 },
        { mimetype: 'image/jpeg', size: 10000000 } // Too large
      ];

      for (const file of validFiles) {
        expect(validationMiddleware.isValidImageFile(file)).toBe(true);
      }

      for (const file of invalidFiles) {
        expect(validationMiddleware.isValidImageFile(file)).toBe(false);
      }
    });

    it('should validate file names', async () => {
      const validNames = [
        'document.pdf',
        'image_001.jpg',
        'my-file.png'
      ];

      const invalidNames = [
        '../../../etc/passwd',
        'file<>name.txt',
        'script.js.exe',
        'con.txt' // Windows reserved name
      ];

      for (const name of validNames) {
        expect(validationMiddleware.isValidFileName(name)).toBe(true);
      }

      for (const name of invalidNames) {
        expect(validationMiddleware.isValidFileName(name)).toBe(false);
      }
    });
  });

  describe('Geo-location Validation', () => {
    it('should validate coordinates', async () => {
      const validCoordinates = [
        { lat: 6.3654, lng: 2.4183 },    // Cotonou, Benin
        { lat: -1.2921, lng: 36.8219 },  // Nairobi, Kenya
        { lat: 5.6037, lng: -0.1870 }    // Accra, Ghana
      ];

      const invalidCoordinates = [
        { lat: 91, lng: 2.4183 },     // Latitude out of range
        { lat: 6.3654, lng: 181 },    // Longitude out of range
        { lat: 'invalid', lng: 2.4 },  // Non-numeric latitude
        { lat: 6.3, lng: 'invalid' }   // Non-numeric longitude
      ];

      for (const coords of validCoordinates) {
        expect(validationMiddleware.isValidCoordinates(coords.lat, coords.lng)).toBe(true);
      }

      for (const coords of invalidCoordinates) {
        expect(validationMiddleware.isValidCoordinates(coords.lat, coords.lng)).toBe(false);
      }
    });

    it('should validate delivery radius', async () => {
      const validRadii = [1, 5, 10, 25, 50];
      const invalidRadii = [0, -5, 101, 'abc'];

      for (const radius of validRadii) {
        expect(validationMiddleware.isValidDeliveryRadius(radius)).toBe(true);
      }

      for (const radius of invalidRadii) {
        expect(validationMiddleware.isValidDeliveryRadius(radius)).toBe(false);
      }
    });
  });
});