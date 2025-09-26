const rateLimiter = require('../../src/middleware/rateLimiter');

// Mock Redis pour les tests
const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
  exists: jest.fn()
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient)
}));

describe('Rate Limiter Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'Jest Test',
        'x-forwarded-for': ''
      },
      user: null,
      method: 'GET',
      path: '/api/test'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };

    next = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.incr.mockResolvedValue(1);
    mockRedisClient.expire.mockResolvedValue(1);
  });

  describe('Basic Rate Limiting', () => {
    it('should allow request within rate limit', async () => {
      mockRedisClient.get.mockResolvedValue('5'); // 5 requests made

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // max 100 requests
        message: 'Too many requests'
      });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': 100,
        'X-RateLimit-Remaining': 95,
        'X-RateLimit-Reset': expect.any(Number)
      });
    });

    it('should block request when rate limit exceeded', async () => {
      mockRedisClient.get.mockResolvedValue('101'); // 101 requests made

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: 'Too many requests from this IP'
      });

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Too many requests from this IP',
        retryAfter: expect.any(Number)
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should increment request count', async () => {
      mockRedisClient.get.mockResolvedValue('1');
      mockRedisClient.incr.mockResolvedValue(2);

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 100
      });

      await middleware(req, res, next);

      const expectedKey = `rate_limit:${req.ip}:${req.path}`;
      expect(mockRedisClient.incr).toHaveBeenCalledWith(expectedKey);
      expect(mockRedisClient.expire).toHaveBeenCalledWith(expectedKey, 900); // 15 minutes in seconds
    });
  });

  describe('IP-based Rate Limiting', () => {
    it('should use client IP from request', async () => {
      req.ip = '192.168.1.100';
      mockRedisClient.get.mockResolvedValue('10');

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 60000,
        max: 50
      });

      await middleware(req, res, next);

      const expectedKey = `rate_limit:192.168.1.100:${req.path}`;
      expect(mockRedisClient.get).toHaveBeenCalledWith(expectedKey);
    });

    it('should use X-Forwarded-For header when available', async () => {
      req.headers['x-forwarded-for'] = '203.0.113.1, 198.51.100.2';
      mockRedisClient.get.mockResolvedValue('5');

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 60000,
        max: 50,
        trustProxy: true
      });

      await middleware(req, res, next);

      const expectedKey = `rate_limit:203.0.113.1:${req.path}`;
      expect(mockRedisClient.get).toHaveBeenCalledWith(expectedKey);
    });

    it('should handle multiple proxies in X-Forwarded-For', async () => {
      req.headers['x-forwarded-for'] = '203.0.113.1, 198.51.100.2, 192.168.1.1';
      mockRedisClient.get.mockResolvedValue('3');

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 60000,
        max: 50,
        trustProxy: true
      });

      await middleware(req, res, next);

      const expectedKey = `rate_limit:203.0.113.1:${req.path}`;
      expect(mockRedisClient.get).toHaveBeenCalledWith(expectedKey);
    });
  });

  describe('User-based Rate Limiting', () => {
    it('should use user ID for authenticated requests', async () => {
      req.user = { id: 123, role: 'customer' };
      mockRedisClient.get.mockResolvedValue('8');

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 60000,
        max: 50,
        keyGenerator: (req) => req.user ? `user:${req.user.id}` : `ip:${req.ip}`
      });

      await middleware(req, res, next);

      const expectedKey = `rate_limit:user:123:${req.path}`;
      expect(mockRedisClient.get).toHaveBeenCalledWith(expectedKey);
    });

    it('should apply different limits based on user role', async () => {
      req.user = { id: 456, role: 'premium' };
      mockRedisClient.get.mockResolvedValue('150');

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 60000,
        max: (req) => {
          if (req.user && req.user.role === 'premium') return 200;
          if (req.user && req.user.role === 'vendor') return 500;
          return 100;
        }
      });

      await middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': 200,
        'X-RateLimit-Remaining': 50,
        'X-RateLimit-Reset': expect.any(Number)
      });
    });

    it('should apply admin bypass', async () => {
      req.user = { id: 789, role: 'admin' };
      mockRedisClient.get.mockResolvedValue('1000');

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 60000,
        max: 100,
        skip: (req) => req.user && req.user.role === 'admin'
      });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });
  });

  describe('Endpoint-specific Rate Limiting', () => {
    it('should apply strict limits to auth endpoints', async () => {
      req.path = '/api/auth/login';
      mockRedisClient.get.mockResolvedValue('6');

      const middleware = rateLimiter.authRateLimit;

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Too many authentication attempts'
      });
    });

    it('should allow password reset with separate limit', async () => {
      req.path = '/api/auth/reset-password';
      mockRedisClient.get.mockResolvedValue('3');

      const middleware = rateLimiter.passwordResetLimit;

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should apply strict limits to file uploads', async () => {
      req.path = '/api/upload';
      req.method = 'POST';
      mockRedisClient.get.mockResolvedValue('11');

      const middleware = rateLimiter.uploadRateLimit;

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Too many upload attempts'
      });
    });
  });

  describe('API Rate Limiting', () => {
    it('should apply higher limits for API endpoints', async () => {
      req.path = '/api/v1/products';
      req.headers['x-api-key'] = 'valid-api-key';
      mockRedisClient.get.mockResolvedValue('500');

      const middleware = rateLimiter.apiRateLimit;

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': 1000,
        'X-RateLimit-Remaining': 500,
        'X-RateLimit-Reset': expect.any(Number)
      });
    });

    it('should block API requests exceeding limit', async () => {
      req.path = '/api/v1/products';
      req.headers['x-api-key'] = 'valid-api-key';
      mockRedisClient.get.mockResolvedValue('1001');

      const middleware = rateLimiter.apiRateLimit;

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'API rate limit exceeded'
      });
    });
  });

  describe('Redis Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 60000,
        max: 100
      });

      await middleware(req, res, next);

      // Should allow request to proceed when Redis is down
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('should handle Redis timeout errors', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Request timeout'));

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 60000,
        max: 100,
        skipOnError: true
      });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should fail closed when skipOnError is false', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 60000,
        max: 100,
        skipOnError: false
      });

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Rate limiting service unavailable'
      });
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include standard rate limit headers', async () => {
      mockRedisClient.get.mockResolvedValue('25');

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 60000,
        max: 100
      });

      await middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': 100,
        'X-RateLimit-Remaining': 75,
        'X-RateLimit-Reset': expect.any(Number)
      });
    });

    it('should include Retry-After header when limit exceeded', async () => {
      mockRedisClient.get.mockResolvedValue('101');

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 60000,
        max: 100
      });

      await middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith({
        'Retry-After': 60,
        'X-RateLimit-Limit': 100,
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': expect.any(Number)
      });
    });
  });

  describe('Custom Key Generators', () => {
    it('should use custom key generator function', async () => {
      req.headers['x-client-id'] = 'mobile-app-v1.0';
      mockRedisClient.get.mockResolvedValue('15');

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 60000,
        max: 100,
        keyGenerator: (req) => {
          if (req.headers['x-client-id']) {
            return `client:${req.headers['x-client-id']}`;
          }
          return `ip:${req.ip}`;
        }
      });

      await middleware(req, res, next);

      const expectedKey = `rate_limit:client:mobile-app-v1.0:${req.path}`;
      expect(mockRedisClient.get).toHaveBeenCalledWith(expectedKey);
    });

    it('should handle async key generators', async () => {
      req.user = { id: 123 };
      mockRedisClient.get.mockResolvedValue('8');

      const middleware = rateLimiter.createRateLimiter({
        windowMs: 60000,
        max: 100,
        keyGenerator: async (req) => {
          if (req.user) {
            // Simulate async operation (e.g., fetching user subscription level)
            await new Promise(resolve => setTimeout(resolve, 10));
            return `user:${req.user.id}:premium`;
          }
          return `ip:${req.ip}`;
        }
      });

      await middleware(req, res, next);

      const expectedKey = `rate_limit:user:123:premium:${req.path}`;
      expect(mockRedisClient.get).toHaveBeenCalledWith(expectedKey);
    });
  });

  describe('Sliding Window Rate Limiting', () => {
    it('should implement sliding window algorithm', async () => {
      const now = Date.now();
      const windowStart = now - 60000; // 1 minute ago

      // Mock Redis to return timestamps of previous requests
      mockRedisClient.get.mockResolvedValue(JSON.stringify([
        now - 30000, // 30 seconds ago
        now - 45000, // 45 seconds ago
        now - 50000  // 50 seconds ago
      ]));

      const middleware = rateLimiter.createSlidingWindowRateLimiter({
        windowMs: 60000,
        max: 10
      });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': 10,
        'X-RateLimit-Remaining': 6, // 10 - 3 previous - 1 current
        'X-RateLimit-Reset': expect.any(Number)
      });
    });

    it('should clean up old timestamps', async () => {
      const now = Date.now();

      // Mock Redis with some old timestamps that should be cleaned
      mockRedisClient.get.mockResolvedValue(JSON.stringify([
        now - 120000, // 2 minutes ago (should be cleaned)
        now - 90000,  // 1.5 minutes ago (should be cleaned)
        now - 30000   // 30 seconds ago (should be kept)
      ]));

      const middleware = rateLimiter.createSlidingWindowRateLimiter({
        windowMs: 60000,
        max: 10
      });

      await middleware(req, res, next);

      // Should save only the valid timestamp plus the new one
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(String(now - 30000)), // Old valid timestamp
        'EX',
        60
      );
    });
  });

  describe('Burst Protection', () => {
    it('should implement burst protection', async () => {
      // Simulate rapid consecutive requests
      const timestamps = [];
      for (let i = 0; i < 20; i++) {
        timestamps.push(Date.now() - (i * 100)); // 20 requests in 2 seconds
      }

      mockRedisClient.get.mockResolvedValue(JSON.stringify(timestamps));

      const middleware = rateLimiter.createBurstProtection({
        windowMs: 10000,  // 10 second window
        max: 100,         // 100 requests per window
        burstWindow: 1000, // 1 second burst window
        burstMax: 10      // Max 10 requests per second
      });

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Request burst limit exceeded'
      });
    });
  });

  describe('Progressive Rate Limiting', () => {
    it('should apply progressive penalties for repeated violations', async () => {
      req.ip = '192.168.1.100';
      
      // Mock violation count
      mockRedisClient.get
        .mockResolvedValueOnce('105') // Current requests
        .mockResolvedValueOnce('3');  // Violation count

      const middleware = rateLimiter.createProgressiveRateLimiter({
        windowMs: 60000,
        max: 100,
        penaltyMultiplier: 2
      });

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      
      // Should set longer penalty window due to repeated violations
      const penaltyKey = `penalty:${req.ip}`;
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        penaltyKey,
        '4', // Increment violation count
        'EX',
        expect.any(Number) // Extended penalty duration
      );
    });
  });
});