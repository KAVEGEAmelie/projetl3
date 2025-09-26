const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { cacheMiddleware } = require('../config/redis');

/**
 * @route GET /api/analytics/dashboard
 * @desc Dashboard analytics global
 * @access Private (Admin)
 */
router.get('/dashboard',
  requireAuth,
  requireRole(['admin', 'super_admin', 'manager']),
  cacheMiddleware(1800, (req) => `analytics:dashboard:${req.query.period || '30d'}`),
  analyticsController.getGlobalDashboard
);

/**
 * @route GET /api/analytics/sales
 * @desc Analytics de ventes
 * @access Private (Admin/Vendor)
 */
router.get('/sales',
  requireAuth,
  requireRole(['vendor', 'manager', 'admin', 'super_admin']),
  cacheMiddleware(900, (req) => `analytics:sales:${JSON.stringify(req.query)}`),
  analyticsController.getSalesAnalytics
);

/**
 * @route GET /api/analytics/products
 * @desc Analytics des produits
 * @access Private (Admin/Vendor)
 */
router.get('/products',
  requireAuth,
  requireRole(['vendor', 'manager', 'admin', 'super_admin']),
  cacheMiddleware(1800, (req) => `analytics:products:${JSON.stringify(req.query)}`),
  analyticsController.getProductAnalytics
);

/**
 * @route GET /api/analytics/customers
 * @desc Analytics des clients
 * @access Private (Admin/Vendor)
 */
router.get('/customers',
  requireAuth,
  requireRole(['vendor', 'manager', 'admin', 'super_admin']),
  cacheMiddleware(1800, (req) => `analytics:customers:${JSON.stringify(req.query)}`),
  analyticsController.getCustomerAnalytics
);

/**
 * @route GET /api/analytics/export
 * @desc Exporter les données analytics
 * @access Private (Admin)
 */
router.get('/export',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  analyticsController.exportAnalytics
);

/**
 * @route GET /api/analytics/real-time
 * @desc Analytics en temps réel
 * @access Private (Admin)
 */
router.get('/real-time',
  requireAuth,
  requireRole(['admin', 'super_admin', 'manager']),
  async (req, res, next) => {
    const db = require('../config/database');
    
    try {
      // Commandes du jour
      const todayOrders = await db('orders')
        .select([
          db.raw('COUNT(*) as total'),
          db.raw('SUM(total_amount) as revenue'),
          db.raw('COUNT(CASE WHEN status = \'pending\' THEN 1 END) as pending'),
          db.raw('COUNT(CASE WHEN status = \'delivered\' THEN 1 END) as delivered')
        ])
        .whereRaw('DATE(created_at) = CURRENT_DATE')
        .first();

      // Nouveaux utilisateurs du jour
      const todayUsers = await db('users')
        .count('* as count')
        .whereRaw('DATE(created_at) = CURRENT_DATE')
        .first();

      // Paiements en cours
      const pendingPayments = await db('payments')
        .count('* as count')
        .where('status', 'pending')
        .first();

      // Dernières activités
      const recentOrders = await db('orders')
        .select([
          'id', 'order_number', 'customer_name', 'total_amount', 
          'status', 'created_at'
        ])
        .orderBy('created_at', 'desc')
        .limit(10);

      const recentUsers = await db('users')
        .select([
          'id', 'first_name', 'last_name', 'email', 'role', 'created_at'
        ])
        .orderBy('created_at', 'desc')
        .limit(10);

      res.json({
        success: true,
        data: {
          today: {
            orders: {
              total: parseInt(todayOrders.total) || 0,
              revenue: parseFloat(todayOrders.revenue) || 0,
              pending: parseInt(todayOrders.pending) || 0,
              delivered: parseInt(todayOrders.delivered) || 0
            },
            newUsers: parseInt(todayUsers.count) || 0,
            pendingPayments: parseInt(pendingPayments.count) || 0
          },
          recent: {
            orders: recentOrders.map(order => ({
              id: order.id,
              orderNumber: order.order_number,
              customerName: order.customer_name,
              amount: parseFloat(order.total_amount),
              status: order.status,
              createdAt: order.created_at
            })),
            users: recentUsers.map(user => ({
              id: user.id,
              name: `${user.first_name} ${user.last_name}`,
              email: user.email,
              role: user.role,
              createdAt: user.created_at
            }))
          },
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/analytics/trends
 * @desc Tendances et insights
 * @access Private (Admin)
 */
router.get('/trends',
  requireAuth,
  requireRole(['admin', 'super_admin', 'manager']),
  cacheMiddleware(3600, () => 'analytics:trends'),
  async (req, res, next) => {
    const db = require('../config/database');
    
    try {
      // Croissance mensuelle
      const monthlyGrowth = await db('orders')
        .select([
          db.raw("DATE_TRUNC('month', created_at) as month"),
          db.raw('COUNT(*) as orders'),
          db.raw('SUM(total_amount) as revenue')
        ])
        .where(db.raw("created_at >= NOW() - INTERVAL '12 months'"))
        .where('status', 'delivered')
        .groupBy(db.raw("DATE_TRUNC('month', created_at)"))
        .orderBy('month');

      // Produits tendance (forte croissance récente)
      const trendingProducts = await db('order_items')
        .join('orders', 'order_items.order_id', 'orders.id')
        .join('products', 'order_items.product_id', 'products.id')
        .where('orders.status', 'delivered')
        .where(db.raw("orders.created_at >= NOW() - INTERVAL '7 days'"))
        .select([
          'products.id',
          'products.name',
          'products.primary_image',
          db.raw('SUM(order_items.quantity) as recent_sales'),
          db.raw('SUM(order_items.total_price) as recent_revenue')
        ])
        .groupBy('products.id', 'products.name', 'products.primary_image')
        .having(db.raw('SUM(order_items.quantity)'), '>', 5)
        .orderBy('recent_sales', 'desc')
        .limit(10);

      // Catégories en croissance
      const growingCategories = await db('order_items')
        .join('orders', 'order_items.order_id', 'orders.id')
        .join('products', 'order_items.product_id', 'products.id')
        .join('categories', 'products.category_id', 'categories.id')
        .where('orders.status', 'delivered')
        .where(db.raw("orders.created_at >= NOW() - INTERVAL '30 days'"))
        .select([
          'categories.name',
          db.raw('SUM(order_items.quantity) as total_sold'),
          db.raw('COUNT(DISTINCT order_items.product_id) as products_sold'),
          db.raw('SUM(order_items.total_price) as revenue')
        ])
        .groupBy('categories.id', 'categories.name')
        .orderBy('revenue', 'desc')
        .limit(8);

      // Heures de pointe
      const peakHours = await db('orders')
        .select([
          db.raw('EXTRACT(hour FROM created_at) as hour'),
          db.raw('COUNT(*) as orders')
        ])
        .where(db.raw("created_at >= NOW() - INTERVAL '30 days'"))
        .groupBy(db.raw('EXTRACT(hour FROM created_at)'))
        .orderBy('hour');

      res.json({
        success: true,
        data: {
          monthlyGrowth: monthlyGrowth.map(month => ({
            month: month.month,
            orders: parseInt(month.orders),
            revenue: parseFloat(month.revenue)
          })),
          trendingProducts: trendingProducts.map(product => ({
            id: product.id,
            name: product.name,
            image: product.primary_image,
            recentSales: parseInt(product.recent_sales),
            recentRevenue: parseFloat(product.recent_revenue)
          })),
          growingCategories: growingCategories.map(category => ({
            name: category.name,
            totalSold: parseInt(category.total_sold),
            productsSold: parseInt(category.products_sold),
            revenue: parseFloat(category.revenue)
          })),
          peakHours: peakHours.map(hour => ({
            hour: parseInt(hour.hour),
            orders: parseInt(hour.orders)
          }))
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/analytics/geographic
 * @desc Analytics géographiques
 * @access Private (Admin)
 */
router.get('/geographic',
  requireAuth,
  requireRole(['admin', 'super_admin', 'manager']),
  cacheMiddleware(3600, (req) => `analytics:geographic:${req.query.period || '30d'}`),
  async (req, res, next) => {
    const { period = '30d' } = req.query;
    const db = require('../config/database');
    
    try {
      let dateFilter = db.raw('1=1');
      switch (period) {
        case '7d':
          dateFilter = db.raw("orders.created_at >= NOW() - INTERVAL '7 days'");
          break;
        case '30d':
          dateFilter = db.raw("orders.created_at >= NOW() - INTERVAL '30 days'");
          break;
        case '90d':
          dateFilter = db.raw("orders.created_at >= NOW() - INTERVAL '90 days'");
          break;
      }

      // Ventes par pays
      const salesByCountry = await db('orders')
        .join('users', 'orders.customer_id', 'users.id')
        .where('orders.status', 'delivered')
        .where(dateFilter)
        .select([
          'users.country',
          db.raw('COUNT(*) as orders'),
          db.raw('SUM(orders.total_amount) as revenue'),
          db.raw('COUNT(DISTINCT orders.customer_id) as customers')
        ])
        .groupBy('users.country')
        .orderBy('revenue', 'desc');

      // Ventes par ville (top 10)
      const salesByCity = await db('orders')
        .join('users', 'orders.customer_id', 'users.id')
        .where('orders.status', 'delivered')
        .where(dateFilter)
        .select([
          'users.city',
          'users.country',
          db.raw('COUNT(*) as orders'),
          db.raw('SUM(orders.total_amount) as revenue')
        ])
        .groupBy('users.city', 'users.country')
        .orderBy('revenue', 'desc')
        .limit(10);

      // Boutiques par région
      const storesByRegion = await db('stores')
        .select([
          'country',
          'region',
          db.raw('COUNT(*) as stores'),
          db.raw('SUM(total_orders) as total_orders'),
          db.raw('SUM(total_revenue) as total_revenue')
        ])
        .where('status', 'active')
        .whereNull('deleted_at')
        .groupBy('country', 'region')
        .orderBy('total_revenue', 'desc');

      res.json({
        success: true,
        data: {
          period,
          salesByCountry: salesByCountry.map(country => ({
            country: country.country,
            orders: parseInt(country.orders),
            revenue: parseFloat(country.revenue),
            customers: parseInt(country.customers)
          })),
          salesByCity: salesByCity.map(city => ({
            city: city.city,
            country: city.country,
            orders: parseInt(city.orders),
            revenue: parseFloat(city.revenue)
          })),
          storesByRegion: storesByRegion.map(region => ({
            country: region.country,
            region: region.region,
            stores: parseInt(region.stores),
            totalOrders: parseInt(region.total_orders) || 0,
            totalRevenue: parseFloat(region.total_revenue) || 0
          }))
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/analytics/financial
 * @desc Analytics financières détaillées
 * @access Private (Admin)
 */
router.get('/financial',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  cacheMiddleware(900, (req) => `analytics:financial:${req.query.period || '30d'}`),
  async (req, res, next) => {
    const { period = '30d' } = req.query;
    const db = require('../config/database');
    
    try {
      let dateFilter = db.raw('1=1');
      switch (period) {
        case '7d':
          dateFilter = db.raw("created_at >= NOW() - INTERVAL '7 days'");
          break;
        case '30d':
          dateFilter = db.raw("created_at >= NOW() - INTERVAL '30 days'");
          break;
        case '90d':
          dateFilter = db.raw("created_at >= NOW() - INTERVAL '90 days'");
          break;
      }

      // Revenus et commissions
      const revenueBreakdown = await db('orders')
        .join('stores', 'orders.store_id', 'stores.id')
        .where('orders.status', 'delivered')
        .where(dateFilter)
        .select([
          db.raw('SUM(orders.total_amount) as gross_revenue'),
          db.raw('SUM(orders.total_amount * stores.commission_rate / 100) as total_commission'),
          db.raw('SUM(orders.total_amount * (1 - stores.commission_rate / 100)) as store_payout'),
          db.raw('COUNT(*) as completed_orders')
        ])
        .first();

      // Commissions par boutique
      const commissionByStore = await db('orders')
        .join('stores', 'orders.store_id', 'stores.id')
        .where('orders.status', 'delivered')
        .where(dateFilter)
        .select([
          'stores.id',
          'stores.name',
          'stores.commission_rate',
          db.raw('COUNT(*) as orders'),
          db.raw('SUM(orders.total_amount) as revenue'),
          db.raw('SUM(orders.total_amount * stores.commission_rate / 100) as commission'),
          db.raw('SUM(orders.total_amount * (1 - stores.commission_rate / 100)) as payout')
        ])
        .groupBy('stores.id', 'stores.name', 'stores.commission_rate')
        .orderBy('revenue', 'desc')
        .limit(20);

      // Analyse des frais de paiement
      const paymentFees = await db('payments')
        .where('status', 'completed')
        .where(dateFilter)
        .select([
          'payment_method',
          db.raw('COUNT(*) as transactions'),
          db.raw('SUM(amount) as volume'),
          db.raw('SUM(fee_amount) as total_fees'),
          db.raw('AVG(fee_amount) as avg_fee')
        ])
        .groupBy('payment_method')
        .orderBy('volume', 'desc');

      res.json({
        success: true,
        data: {
          period,
          overview: {
            grossRevenue: parseFloat(revenueBreakdown.gross_revenue) || 0,
            totalCommission: parseFloat(revenueBreakdown.total_commission) || 0,
            storePayout: parseFloat(revenueBreakdown.store_payout) || 0,
            completedOrders: parseInt(revenueBreakdown.completed_orders) || 0,
            avgCommissionRate: revenueBreakdown.gross_revenue > 0 
              ? ((revenueBreakdown.total_commission / revenueBreakdown.gross_revenue) * 100).toFixed(2)
              : 0
          },
          storeCommissions: commissionByStore.map(store => ({
            id: store.id,
            name: store.name,
            commissionRate: parseFloat(store.commission_rate),
            orders: parseInt(store.orders),
            revenue: parseFloat(store.revenue),
            commission: parseFloat(store.commission),
            payout: parseFloat(store.payout)
          })),
          paymentFees: paymentFees.map(fee => ({
            method: fee.payment_method,
            transactions: parseInt(fee.transactions),
            volume: parseFloat(fee.volume),
            totalFees: parseFloat(fee.total_fees) || 0,
            avgFee: parseFloat(fee.avg_fee) || 0,
            feeRate: fee.volume > 0 
              ? ((fee.total_fees / fee.volume) * 100).toFixed(2)
              : 0
          }))
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;