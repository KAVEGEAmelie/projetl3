const errorHandler = require('../../src/middleware/errorHandler');

describe('Error Handler Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      url: '/test',
      headers: {
        'user-agent': 'Jest Test'
      },
      user: null
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      headersSent: false
    };

    next = jest.fn();

    // Mock console methods
    console.error = jest.fn();
    console.log = jest.fn();

    jest.clearAllMocks();
  });

  describe('Validation Errors', () => {
    it('should handle validation errors properly', () => {
      const error = {
        name: 'ValidationError',
        details: [
          { message: 'Email is required', path: ['email'] },
          { message: 'Password must be at least 6 characters', path: ['password'] }
        ]
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: [
          'Email is required',
          'Password must be at least 6 characters'
        ]
      });
    });

    it('should handle single validation error', () => {
      const error = {
        name: 'ValidationError',
        message: 'Invalid email format'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: ['Invalid email format']
      });
    });
  });

  describe('Database Errors', () => {
    it('should handle unique constraint violations', () => {
      const error = {
        name: 'ConstraintViolationError',
        code: '23505',
        constraint: 'users_email_unique',
        message: 'duplicate key value violates unique constraint'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email already exists'
      });
    });

    it('should handle foreign key constraint violations', () => {
      const error = {
        name: 'ConstraintViolationError',
        code: '23503',
        constraint: 'orders_user_id_foreign',
        message: 'violates foreign key constraint'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid reference'
      });
    });

    it('should handle not null constraint violations', () => {
      const error = {
        name: 'ConstraintViolationError',
        code: '23502',
        column: 'name',
        message: 'null value in column "name" violates not-null constraint'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Field "name" is required'
      });
    });

    it('should handle connection timeout errors', () => {
      const error = {
        name: 'TimeoutError',
        message: 'Knex: Timeout acquiring a connection'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database connection timeout'
      });
    });

    it('should handle database connection errors', () => {
      const error = {
        name: 'DatabaseError',
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database unavailable'
      });
    });
  });

  describe('HTTP Errors', () => {
    it('should handle 404 errors', () => {
      const error = {
        status: 404,
        message: 'Product not found'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Product not found'
      });
    });

    it('should handle 401 unauthorized errors', () => {
      const error = {
        status: 401,
        message: 'Token expired'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token expired'
      });
    });

    it('should handle 403 forbidden errors', () => {
      const error = {
        status: 403,
        message: 'Insufficient permissions'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions'
      });
    });
  });

  describe('Payment Errors', () => {
    it('should handle payment processing errors', () => {
      const error = {
        name: 'PaymentError',
        code: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient funds in account'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Payment failed: Insufficient funds in account'
      });
    });

    it('should handle payment gateway timeout', () => {
      const error = {
        name: 'PaymentError',
        code: 'GATEWAY_TIMEOUT',
        message: 'Payment gateway timeout'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(504);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Payment processing timeout'
      });
    });

    it('should handle invalid payment method', () => {
      const error = {
        name: 'PaymentError',
        code: 'INVALID_METHOD',
        message: 'Payment method not supported'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Payment failed: Payment method not supported'
      });
    });
  });

  describe('File Upload Errors', () => {
    it('should handle file too large errors', () => {
      const error = {
        name: 'MulterError',
        code: 'LIMIT_FILE_SIZE',
        message: 'File too large'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'File size exceeds limit'
      });
    });

    it('should handle too many files error', () => {
      const error = {
        name: 'MulterError',
        code: 'LIMIT_FILE_COUNT',
        message: 'Too many files'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Too many files uploaded'
      });
    });

    it('should handle unsupported file type', () => {
      const error = {
        name: 'MulterError',
        code: 'INVALID_FILE_TYPE',
        message: 'Unsupported file type'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unsupported file type'
      });
    });
  });

  describe('JWT Errors', () => {
    it('should handle JWT malformed errors', () => {
      const error = {
        name: 'JsonWebTokenError',
        message: 'jwt malformed'
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
    });

    it('should handle JWT expired errors', () => {
      const error = {
        name: 'TokenExpiredError',
        message: 'jwt expired',
        expiredAt: new Date()
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token expired'
      });
    });

    it('should handle JWT not before errors', () => {
      const error = {
        name: 'NotBeforeError',
        message: 'jwt not active',
        date: new Date()
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token not yet valid'
      });
    });
  });

  describe('Rate Limiting Errors', () => {
    it('should handle rate limit exceeded', () => {
      const error = {
        name: 'TooManyRequestsError',
        message: 'Rate limit exceeded',
        retryAfter: 3600
      };

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Too many requests, try again later',
        retryAfter: 3600
      });
    });
  });

  describe('Generic Errors', () => {
    it('should handle generic errors in production', () => {
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Internal server error');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });

      expect(console.error).toHaveBeenCalled();
    });

    it('should include stack trace in development', () => {
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Development error');
      error.stack = 'Error: Development error\n    at test';

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Development error',
        stack: error.stack
      });
    });

    it('should handle errors with custom status codes', () => {
      const error = new Error('Custom error');
      error.statusCode = 418;

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(418);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Custom error'
      });
    });
  });

  describe('Request Context Logging', () => {
    it('should log request context with error', () => {
      req.user = { id: 1, email: 'test@test.com' };
      req.method = 'POST';
      req.url = '/api/products';

      const error = new Error('Test error');

      errorHandler(error, req, res, next);

      expect(console.error).toHaveBeenCalledWith('Error occurred:', {
        error: error.message,
        method: 'POST',
        url: '/api/products',
        userId: 1,
        userAgent: 'Jest Test',
        timestamp: expect.any(String)
      });
    });

    it('should log without user context for unauthenticated requests', () => {
      const error = new Error('Unauthenticated error');

      errorHandler(error, req, res, next);

      expect(console.error).toHaveBeenCalledWith('Error occurred:', {
        error: error.message,
        method: 'GET',
        url: '/test',
        userId: null,
        userAgent: 'Jest Test',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Response Already Sent', () => {
    it('should not send response if headers already sent', () => {
      res.headersSent = true;
      
      const error = new Error('Test error');

      errorHandler(error, req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Error Sanitization', () => {
    it('should sanitize database connection strings from error messages', () => {
      const error = new Error('Connection failed: postgres://user:password@localhost:5432/db');

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Connection failed: [DATABASE_URL_REDACTED]'
      });
    });

    it('should sanitize API keys from error messages', () => {
      const error = new Error('API request failed with key: sk-1234567890abcdef');

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'API request failed with key: [API_KEY_REDACTED]'
      });
    });

    it('should sanitize file paths in production', () => {
      process.env.NODE_ENV = 'production';
      
      const error = new Error('File not found: /home/user/secrets/config.json');

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'File not found: [PATH_REDACTED]'
      });
    });
  });

  describe('Error Notification', () => {
    it('should trigger error notification for critical errors', async () => {
      const mockNotificationService = {
        notifyError: jest.fn().mockResolvedValue(true)
      };

      // Mock the notification service
      errorHandler.setNotificationService(mockNotificationService);

      const error = new Error('Critical database failure');
      error.critical = true;

      await errorHandler(error, req, res, next);

      expect(mockNotificationService.notifyError).toHaveBeenCalledWith({
        error: error.message,
        context: expect.objectContaining({
          method: 'GET',
          url: '/test',
          userId: null
        })
      });
    });

    it('should handle notification service failures gracefully', async () => {
      const mockNotificationService = {
        notifyError: jest.fn().mockRejectedValue(new Error('Notification failed'))
      };

      errorHandler.setNotificationService(mockNotificationService);

      const error = new Error('Test error');
      error.critical = true;

      await errorHandler(error, req, res, next);

      // Should still handle the original error even if notification fails
      expect(res.status).toHaveBeenCalledWith(500);
      expect(console.error).toHaveBeenCalledTimes(2); // Original error + notification error
    });
  });
});