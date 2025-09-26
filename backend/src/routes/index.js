const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const userRoutes = require('./users');
const storeRoutes = require('./stores');
const categoryRoutes = require('./categories');
const productRoutes = require('./products');
const orderRoutes = require('./orders');
const paymentRoutes = require('./payments');
const analyticsRoutes = require('./analytics');

// Import middleware
const authMiddleware = require('../middleware/auth');

// API version and info
router.get('/', (req, res) => {
  res.json({
    message: 'Bienvenue sur l\'API AfrikMode 🌍',
    version: process.env.API_VERSION || 'v1',
    documentation: `/api/docs`,
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      stores: '/api/stores',
      categories: '/api/categories',
      products: '/api/products',
      orders: '/api/orders',
      payments: '/api/payments',
      analytics: '/api/analytics'
    },
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

// Public routes (no authentication required)
router.use('/auth', authRoutes);
router.use('/stores', storeRoutes); // Some store routes are public
router.use('/categories', categoryRoutes); // Category browsing is public
router.use('/products', productRoutes); // Product browsing is public

// Protected routes (authentication required)
router.use('/users', authMiddleware.requireAuth, userRoutes);
router.use('/orders', authMiddleware.requireAuth, orderRoutes);
router.use('/payments', authMiddleware.requireAuth, paymentRoutes);
router.use('/analytics', authMiddleware.requireAuth, analyticsRoutes);

// Health check endpoint with detailed info
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const db = require('../config/database');
    await db.raw('SELECT 1');
    
    // Check Redis connection (if configured)
    let redisStatus = 'not_configured';
    if (process.env.REDIS_HOST) {
      try {
        const redis = require('../config/redis');
        await redis.ping();
        redisStatus = 'connected';
      } catch (error) {
        redisStatus = 'error';
      }
    }
    
    res.status(200).json({
      status: 'healthy',
      message: 'AfrikMode API fonctionne correctement',
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || 'v1',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: 'connected',
        redis: redisStatus
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      node_version: process.version
    });
    
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      message: 'Problème de santé de l\'API',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API Documentation (simple endpoint, can be enhanced with Swagger later)
router.get('/docs', (req, res) => {
  res.json({
    title: 'AfrikMode API Documentation',
    version: process.env.API_VERSION || 'v1',
    description: 'API REST pour la plateforme e-commerce AfrikMode - Mode africaine',
    base_url: `${req.protocol}://${req.get('host')}/api`,
    authentication: {
      type: 'JWT Bearer Token',
      header: 'Authorization: Bearer <token>',
      login_endpoint: '/api/auth/login'
    },
    endpoints: {
      auth: {
        login: 'POST /auth/login',
        register: 'POST /auth/register',
        logout: 'POST /auth/logout',
        refresh: 'POST /auth/refresh',
        verify_email: 'POST /auth/verify-email',
        forgot_password: 'POST /auth/forgot-password',
        reset_password: 'POST /auth/reset-password'
      },
      users: {
        profile: 'GET /users/profile',
        update_profile: 'PUT /users/profile',
        change_password: 'PUT /users/change-password',
        addresses: 'GET/POST /users/addresses',
        wishlist: 'GET /users/wishlist',
        orders: 'GET /users/orders'
      },
      stores: {
        list: 'GET /stores',
        details: 'GET /stores/:id',
        create: 'POST /stores (vendor+)',
        update: 'PUT /stores/:id (owner)',
        products: 'GET /stores/:id/products',
        orders: 'GET /stores/:id/orders (owner)',
        analytics: 'GET /stores/:id/analytics (owner)'
      },
      categories: {
        list: 'GET /categories',
        details: 'GET /categories/:id',
        create: 'POST /categories (admin)',
        update: 'PUT /categories/:id (admin)',
        products: 'GET /categories/:id/products'
      },
      products: {
        list: 'GET /products',
        search: 'GET /products/search?q=term',
        details: 'GET /products/:id',
        create: 'POST /products (vendor+)',
        update: 'PUT /products/:id (owner)',
        reviews: 'GET/POST /products/:id/reviews',
        variants: 'GET /products/:id/variants'
      },
      orders: {
        list: 'GET /orders',
        create: 'POST /orders',
        details: 'GET /orders/:id',
        update: 'PUT /orders/:id (vendor+)',
        cancel: 'POST /orders/:id/cancel',
        tracking: 'GET /orders/:id/tracking'
      },
      payments: {
        methods: 'GET /payments/methods',
        process: 'POST /payments/process',
        webhook: 'POST /payments/webhook/:provider',
        refund: 'POST /payments/:id/refund (admin)'
      },
      analytics: {
        dashboard: 'GET /analytics/dashboard',
        sales: 'GET /analytics/sales',
        products: 'GET /analytics/products',
        customers: 'GET /analytics/customers'
      }
    },
    response_format: {
      success: {
        success: true,
        data: 'response_data',
        message: 'success_message',
        pagination: 'pagination_info (if applicable)'
      },
      error: {
        success: false,
        error: 'error_message',
        code: 'error_code',
        details: 'detailed_error_info'
      }
    },
    status_codes: {
      200: 'Success',
      201: 'Created',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      422: 'Validation Error',
      429: 'Too Many Requests',
      500: 'Internal Server Error'
    }
  });
});

// Catch all route for API
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint API ${req.originalUrl} introuvable`,
    available_endpoints: '/api/docs',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;