const authMiddleware = require('../../src/middleware/auth');
const jwt = require('jsonwebtoken');
const User = require('../../src/models/User');

// Mock des dépendances
jest.mock('jsonwebtoken');
jest.mock('../../src/models/User');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate user with valid token', async () => {
      const mockUser = {
        id: 1,
        email: 'test@test.com',
        role: 'customer',
        status: 'active'
      };

      const mockToken = 'valid.jwt.token';
      const mockDecoded = {
        userId: 1,
        email: 'test@test.com',
        role: 'customer'
      };

      req.headers.authorization = `Bearer ${mockToken}`;

      jwt.verify.mockReturnValue(mockDecoded);
      User.findById = jest.fn().mockResolvedValue(mockUser);

      await authMiddleware.authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, process.env.JWT_SECRET);
      expect(User.findById).toHaveBeenCalledWith(1);
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access token required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token format', async () => {
      req.headers.authorization = 'InvalidFormat token';

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token format'
      });
    });

    it('should reject request with expired token', async () => {
      req.headers.authorization = 'Bearer expired.token';

      jwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token expired'
      });
    });

    it('should reject request with malformed token', async () => {
      req.headers.authorization = 'Bearer malformed.token';

      jwt.verify.mockImplementation(() => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
    });

    it('should reject request if user not found', async () => {
      const mockToken = 'valid.jwt.token';
      const mockDecoded = { userId: 999 };

      req.headers.authorization = `Bearer ${mockToken}`;

      jwt.verify.mockReturnValue(mockDecoded);
      User.findById = jest.fn().mockResolvedValue(null);

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });

    it('should reject request if user is suspended', async () => {
      const mockUser = {
        id: 1,
        email: 'suspended@test.com',
        role: 'customer',
        status: 'suspended'
      };

      const mockToken = 'valid.jwt.token';
      const mockDecoded = { userId: 1 };

      req.headers.authorization = `Bearer ${mockToken}`;

      jwt.verify.mockReturnValue(mockDecoded);
      User.findById = jest.fn().mockResolvedValue(mockUser);

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Account suspended'
      });
    });

    it('should handle database errors', async () => {
      const mockToken = 'valid.jwt.token';
      const mockDecoded = { userId: 1 };

      req.headers.authorization = `Bearer ${mockToken}`;

      jwt.verify.mockReturnValue(mockDecoded);
      User.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication error'
      });
    });
  });

  describe('requireRole', () => {
    it('should allow access for correct role', async () => {
      req.user = {
        id: 1,
        role: 'admin'
      };

      const middleware = authMiddleware.requireRole('admin');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow access for multiple valid roles', async () => {
      req.user = {
        id: 1,
        role: 'vendor'
      };

      const middleware = authMiddleware.requireRole(['admin', 'vendor']);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access for incorrect role', async () => {
      req.user = {
        id: 1,
        role: 'customer'
      };

      const middleware = authMiddleware.requireRole('admin');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access if user not set', async () => {
      req.user = null;

      const middleware = authMiddleware.requireRole('admin');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
    });
  });

  describe('requireOwnership', () => {
    it('should allow access for resource owner', async () => {
      req.user = { id: 1, role: 'vendor' };
      req.params = { id: '123' };

      // Mock resource that belongs to user
      const mockResource = { ownerId: 1 };
      const checkOwnership = jest.fn().mockResolvedValue(mockResource);

      const middleware = authMiddleware.requireOwnership(checkOwnership);
      await middleware(req, res, next);

      expect(checkOwnership).toHaveBeenCalledWith('123');
      expect(next).toHaveBeenCalled();
    });

    it('should allow access for admin even if not owner', async () => {
      req.user = { id: 2, role: 'admin' };
      req.params = { id: '123' };

      const mockResource = { ownerId: 1 };
      const checkOwnership = jest.fn().mockResolvedValue(mockResource);

      const middleware = authMiddleware.requireOwnership(checkOwnership);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access for non-owner non-admin', async () => {
      req.user = { id: 2, role: 'customer' };
      req.params = { id: '123' };

      const mockResource = { ownerId: 1 };
      const checkOwnership = jest.fn().mockResolvedValue(mockResource);

      const middleware = authMiddleware.requireOwnership(checkOwnership);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied'
      });
    });

    it('should handle non-existent resource', async () => {
      req.user = { id: 1, role: 'vendor' };
      req.params = { id: '999' };

      const checkOwnership = jest.fn().mockResolvedValue(null);

      const middleware = authMiddleware.requireOwnership(checkOwnership);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Resource not found'
      });
    });
  });

  describe('optionalAuth', () => {
    it('should set user if valid token provided', async () => {
      const mockUser = {
        id: 1,
        email: 'test@test.com',
        role: 'customer'
      };

      const mockToken = 'valid.jwt.token';
      const mockDecoded = { userId: 1 };

      req.headers.authorization = `Bearer ${mockToken}`;

      jwt.verify.mockReturnValue(mockDecoded);
      User.findById = jest.fn().mockResolvedValue(mockUser);

      await authMiddleware.optionalAuth(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    it('should continue without user if no token provided', async () => {
      await authMiddleware.optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should continue without user if invalid token provided', async () => {
      req.headers.authorization = 'Bearer invalid.token';

      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authMiddleware.optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('requireVerification', () => {
    it('should allow access for verified user', async () => {
      req.user = {
        id: 1,
        role: 'vendor',
        isVerified: true
      };

      await authMiddleware.requireVerification(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access for unverified user', async () => {
      req.user = {
        id: 1,
        role: 'vendor',
        isVerified: false
      };

      await authMiddleware.requireVerification(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Account verification required'
      });
    });

    it('should allow access for admin regardless of verification', async () => {
      req.user = {
        id: 1,
        role: 'admin',
        isVerified: false
      };

      await authMiddleware.requireVerification(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('checkSubscription', () => {
    it('should allow access for active subscription', async () => {
      req.user = {
        id: 1,
        role: 'vendor',
        subscription: {
          status: 'active',
          expiresAt: new Date(Date.now() + 86400000) // Tomorrow
        }
      };

      await authMiddleware.checkSubscription(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access for expired subscription', async () => {
      req.user = {
        id: 1,
        role: 'vendor',
        subscription: {
          status: 'expired',
          expiresAt: new Date(Date.now() - 86400000) // Yesterday
        }
      };

      await authMiddleware.checkSubscription(req, res, next);

      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Subscription expired'
      });
    });

    it('should allow access for users without subscription requirement', async () => {
      req.user = {
        id: 1,
        role: 'customer'
      };

      await authMiddleware.checkSubscription(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('API key authentication', () => {
    it('should authenticate with valid API key', async () => {
      req.headers['x-api-key'] = 'valid-api-key';

      // Mock API key validation
      authMiddleware.validateApiKey = jest.fn().mockResolvedValue({
        id: 'api-user',
        permissions: ['read', 'write']
      });

      await authMiddleware.authenticateApiKey(req, res, next);

      expect(req.apiUser).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid API key', async () => {
      req.headers['x-api-key'] = 'invalid-api-key';

      authMiddleware.validateApiKey = jest.fn().mockResolvedValue(null);

      await authMiddleware.authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid API key'
      });
    });

    it('should handle missing API key', async () => {
      await authMiddleware.authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'API key required'
      });
    });
  });

  describe('permission checking', () => {
    it('should allow access with required permission', async () => {
      req.user = {
        id: 1,
        role: 'vendor',
        permissions: ['read:products', 'write:products']
      };

      const middleware = authMiddleware.requirePermission('read:products');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access without required permission', async () => {
      req.user = {
        id: 1,
        role: 'customer',
        permissions: ['read:profile']
      };

      const middleware = authMiddleware.requirePermission('write:products');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Permission denied'
      });
    });
  });

  describe('rate limiting by user', () => {
    it('should track requests by authenticated user', async () => {
      req.user = { id: 1 };

      // Mock rate limiter
      const rateLimiter = {
        consume: jest.fn().mockResolvedValue({ remainingHits: 99 })
      };

      authMiddleware.userRateLimiter = rateLimiter;

      await authMiddleware.rateLimitByUser(req, res, next);

      expect(rateLimiter.consume).toHaveBeenCalledWith(1);
      expect(next).toHaveBeenCalled();
    });

    it('should apply rate limit for excessive requests', async () => {
      req.user = { id: 1 };

      const rateLimiter = {
        consume: jest.fn().mockRejectedValue({
          msBeforeNext: 60000,
          remainingHits: 0
        })
      };

      authMiddleware.userRateLimiter = rateLimiter;

      await authMiddleware.rateLimitByUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Too many requests'
      });
    });
  });
});