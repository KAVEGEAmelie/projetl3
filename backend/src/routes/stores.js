const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { requireAuth, requireRole, requireStoreAccess } = require('../middleware/auth');
const { uploadMiddleware, uploadService } = require('../services/uploadService');
const { cacheMiddleware } = require('../config/redis');

/**
 * @route GET /api/stores
 * @desc Récupérer toutes les boutiques avec filtres et pagination
 * @access Public
 */
router.get('/', 
  cacheMiddleware(900, (req) => `stores:list:${JSON.stringify(req.query)}`),
  storeController.getAllStores
);

/**
 * @route GET /api/stores/featured
 * @desc Récupérer les boutiques en vedette
 * @access Public
 */
router.get('/featured',
  cacheMiddleware(1800, () => 'stores:featured'),
  async (req, res, next) => {
    req.query.featured = 'true';
    req.query.verified = 'true';
    req.query.limit = req.query.limit || '8';
    req.query.sortBy = 'average_rating';
    req.query.sortOrder = 'desc';
    next();
  },
  storeController.getAllStores
);

/**
 * @route GET /api/stores/search
 * @desc Rechercher des boutiques
 * @access Public
 */
router.get('/search', async (req, res, next) => {
  const { q } = req.query;
  if (q) {
    req.query.search = q;
  }
  next();
}, storeController.getAllStores);

/**
 * @route GET /api/stores/by-location/:country
 * @desc Récupérer les boutiques par pays
 * @access Public
 */
router.get('/by-location/:country',
  cacheMiddleware(1800, (req) => `stores:country:${req.params.country}`),
  async (req, res, next) => {
    req.query.country = req.params.country.toUpperCase();
    req.query.status = 'active';
    req.query.verified = 'true';
    next();
  },
  storeController.getAllStores
);

/**
 * @route POST /api/stores
 * @desc Créer une nouvelle boutique
 * @access Private (Customer+, devient Vendor)
 */
router.post('/',
  requireAuth,
  requireRole(['customer', 'vendor', 'admin', 'super_admin']),
  storeController.createStore
);

/**
 * @route GET /api/stores/:id
 * @desc Récupérer une boutique par ID ou slug
 * @access Public
 */
router.get('/:id',
  cacheMiddleware(1800, (req) => `store:${req.params.id}`),
  storeController.getStoreById
);

/**
 * @route PUT /api/stores/:id
 * @desc Mettre à jour une boutique
 * @access Private (Owner/Admin)
 */
router.put('/:id',
  requireAuth,
  requireStoreAccess,
  storeController.updateStore
);

/**
 * @route DELETE /api/stores/:id
 * @desc Supprimer une boutique (soft delete)
 * @access Private (Owner/Admin)
 */
router.delete('/:id',
  requireAuth,
  requireStoreAccess,
  async (req, res, next) => {
    const db = require('../config/database');
    const { cache, CACHE_KEYS } = require('../config/redis');
    const { commonErrors } = require('../middleware/errorHandler');
    
    try {
      const storeId = req.params.id;
      
      // Vérifier qu'il n'y a pas de commandes en cours
      const pendingOrders = await db('orders')
        .where({ store_id: storeId })
        .whereIn('status', ['pending', 'paid', 'confirmed', 'processing', 'shipped'])
        .count('id as count')
        .first();

      if (parseInt(pendingOrders.count) > 0) {
        throw commonErrors.conflict(
          'Impossible de supprimer la boutique. Des commandes sont en cours de traitement.'
        );
      }

      // Soft delete de la boutique
      await db('stores')
        .where({ id: storeId })
        .update({
          deleted_at: db.fn.now(),
          deleted_by: req.user.id
        });

      // Soft delete de tous les produits de la boutique
      await db('products')
        .where({ store_id: storeId })
        .update({
          deleted_at: db.fn.now(),
          deleted_by: req.user.id
        });

      // Invalider les caches
      await cache.delPattern(`${CACHE_KEYS.STORES}*`);
      await cache.delPattern(`${CACHE_KEYS.PRODUCTS}*`);

      res.json({
        success: true,
        message: 'Boutique supprimée avec succès'
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/stores/:id/products
 * @desc Récupérer les produits d'une boutique
 * @access Public
 */
router.get('/:id/products',
  cacheMiddleware(600, (req) => `store:${req.params.id}:products:${JSON.stringify(req.query)}`),
  storeController.getStoreProducts
);

/**
 * @route POST /api/stores/:id/images
 * @desc Upload des images de boutique (logo, bannière)
 * @access Private (Owner/Admin)
 */
router.post('/:id/images',
  requireAuth,
  requireStoreAccess,
  uploadMiddleware(uploadService.uploadStoreImages),
  storeController.uploadStoreImages
);

/**
 * @route POST /api/stores/:id/follow
 * @desc Suivre/Ne plus suivre une boutique
 * @access Private
 */
router.post('/:id/follow',
  requireAuth,
  async (req, res, next) => {
    const db = require('../config/database');
    const { sets, CACHE_KEYS } = require('../config/redis');
    const { commonErrors } = require('../middleware/errorHandler');
    
    try {
      const storeId = req.params.id;
      const userId = req.user.id;
      
      // Vérifier que la boutique existe
      const store = await db('stores')
        .where({ id: storeId })
        .whereNull('deleted_at')
        .first();

      if (!store) {
        throw commonErrors.notFound('Boutique');
      }

      // Vérifier si l'utilisateur suit déjà cette boutique
      const followKey = `user:${userId}:following`;
      const isFollowing = await sets.isMember(followKey, storeId);
      
      if (isFollowing) {
        // Ne plus suivre
        await sets.remove(followKey, storeId);
        await db('stores')
          .where({ id: storeId })
          .decrement('followers_count', 1);
        
        res.json({
          success: true,
          message: 'Vous ne suivez plus cette boutique',
          following: false
        });
      } else {
        // Suivre
        await sets.add(followKey, storeId);
        await db('stores')
          .where({ id: storeId })
          .increment('followers_count', 1);
        
        res.json({
          success: true,
          message: 'Vous suivez maintenant cette boutique',
          following: true
        });
      }

      // Invalider le cache de la boutique
      await cache.del(`${CACHE_KEYS.STORES}:${storeId}`);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/stores/:id/analytics
 * @desc Récupérer les analytics d'une boutique
 * @access Private (Owner/Admin)
 */
router.get('/:id/analytics',
  requireAuth,
  requireStoreAccess,
  async (req, res, next) => {
    const db = require('../config/database');
    const { commonErrors } = require('../middleware/errorHandler');
    
    try {
      const storeId = req.params.id;
      const { period = '30d' } = req.query;
      
      // Calculer la période
      let dateFilter = db.raw('1=1'); // Pas de filtre par défaut
      if (period === '7d') {
        dateFilter = db.raw("created_at >= NOW() - INTERVAL '7 days'");
      } else if (period === '30d') {
        dateFilter = db.raw("created_at >= NOW() - INTERVAL '30 days'");
      } else if (period === '90d') {
        dateFilter = db.raw("created_at >= NOW() - INTERVAL '90 days'");
      }
      
      // Statistiques des commandes
      const orderStats = await db('orders')
        .where({ store_id: storeId })
        .where(dateFilter)
        .select([
          db.raw('COUNT(*) as total_orders'),
          db.raw('SUM(CASE WHEN status = \'delivered\' THEN total_amount ELSE 0 END) as revenue'),
          db.raw('AVG(total_amount) as average_order_value'),
          db.raw('COUNT(CASE WHEN status = \'delivered\' THEN 1 END) as completed_orders'),
          db.raw('COUNT(CASE WHEN status = \'cancelled\' THEN 1 END) as cancelled_orders')
        ])
        .first();

      // Top produits
      const topProducts = await db('order_items')
        .join('products', 'order_items.product_id', 'products.id')
        .join('orders', 'order_items.order_id', 'orders.id')
        .where('order_items.store_id', storeId)
        .where('orders.status', 'delivered')
        .where(dateFilter)
        .groupBy('products.id', 'products.name', 'products.slug', 'products.primary_image')
        .select([
          'products.id',
          'products.name',
          'products.slug',
          'products.primary_image',
          db.raw('SUM(order_items.quantity) as total_sold'),
          db.raw('SUM(order_items.total_price) as total_revenue')
        ])
        .orderBy('total_sold', 'desc')
        .limit(5);

      // Évolution des ventes (par jour pour les 30 derniers jours)
      const salesEvolution = await db('orders')
        .where({ store_id: storeId })
        .where('status', 'delivered')
        .where(db.raw("created_at >= NOW() - INTERVAL '30 days'"))
        .select([
          db.raw('DATE(created_at) as date'),
          db.raw('COUNT(*) as orders_count'),
          db.raw('SUM(total_amount) as daily_revenue')
        ])
        .groupBy(db.raw('DATE(created_at)'))
        .orderBy('date', 'desc')
        .limit(30);

      res.json({
        success: true,
        data: {
          period,
          summary: {
            totalOrders: parseInt(orderStats.total_orders) || 0,
            revenue: parseFloat(orderStats.revenue) || 0,
            averageOrderValue: parseFloat(orderStats.average_order_value) || 0,
            completedOrders: parseInt(orderStats.completed_orders) || 0,
            cancelledOrders: parseInt(orderStats.cancelled_orders) || 0,
            conversionRate: orderStats.total_orders > 0 
              ? ((orderStats.completed_orders / orderStats.total_orders) * 100).toFixed(2)
              : 0
          },
          topProducts: topProducts.map(product => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            image: product.primary_image,
            totalSold: parseInt(product.total_sold),
            totalRevenue: parseFloat(product.total_revenue)
          })),
          salesEvolution: salesEvolution.map(day => ({
            date: day.date,
            orders: parseInt(day.orders_count),
            revenue: parseFloat(day.daily_revenue)
          })).reverse() // Ordre chronologique
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/stores/:id/orders
 * @desc Récupérer les commandes d'une boutique
 * @access Private (Owner/Admin)
 */
router.get('/:id/orders',
  requireAuth,
  requireStoreAccess,
  async (req, res, next) => {
    const db = require('../config/database');
    const {
      page = 1,
      limit = 20,
      status,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;
    
    try {
      const storeId = req.params.id;
      
      let query = db('orders')
        .select([
          'orders.id',
          'orders.order_number',
          'orders.status',
          'orders.payment_status',
          'orders.total_amount',
          'orders.currency',
          'orders.customer_name',
          'orders.customer_email',
          'orders.customer_phone',
          'orders.created_at',
          'orders.updated_at'
        ])
        .where('orders.store_id', storeId);

      // Filtre par statut
      if (status) {
        query = query.where('orders.status', status);
      }

      // Tri
      const validSortFields = ['created_at', 'total_amount', 'status'];
      const sortField = validSortFields.includes(sortBy) ? `orders.${sortBy}` : 'orders.created_at';
      const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';
      
      query = query.orderBy(sortField, order);

      // Pagination
      const result = await db.helpers.paginate(query, page, limit);

      res.json({
        success: true,
        data: result.data.map(order => ({
          id: order.id,
          orderNumber: order.order_number,
          status: order.status,
          paymentStatus: order.payment_status,
          totalAmount: parseFloat(order.total_amount),
          currency: order.currency,
          customer: {
            name: order.customer_name,
            email: order.customer_email,
            phone: order.customer_phone
          },
          createdAt: order.created_at,
          updatedAt: order.updated_at
        })),
        pagination: result.pagination
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/stores/stats/global
 * @desc Statistiques globales des boutiques (admin seulement)
 * @access Private (Admin)
 */
router.get('/stats/global',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  cacheMiddleware(3600, () => 'stores:global:stats'),
  async (req, res, next) => {
    const db = require('../config/database');
    
    try {
      // Statistiques générales
      const generalStats = await db('stores')
        .select([
          db.raw('COUNT(*) as total_stores'),
          db.raw('COUNT(CASE WHEN status = \'active\' THEN 1 END) as active_stores'),
          db.raw('COUNT(CASE WHEN status = \'pending\' THEN 1 END) as pending_stores'),
          db.raw('COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_stores'),
          db.raw('COUNT(CASE WHEN featured = true THEN 1 END) as featured_stores')
        ])
        .whereNull('deleted_at')
        .first();

      // Répartition par pays
      const countryStats = await db('stores')
        .select('country')
        .count('* as count')
        .whereNull('deleted_at')
        .groupBy('country')
        .orderBy('count', 'desc');

      // Top boutiques par revenus
      const topStoresByRevenue = await db('stores')
        .select(['id', 'name', 'slug', 'total_revenue', 'total_orders'])
        .whereNull('deleted_at')
        .where('status', 'active')
        .orderBy('total_revenue', 'desc')
        .limit(10);

      res.json({
        success: true,
        data: {
          general: {
            totalStores: parseInt(generalStats.total_stores),
            activeStores: parseInt(generalStats.active_stores),
            pendingStores: parseInt(generalStats.pending_stores),
            verifiedStores: parseInt(generalStats.verified_stores),
            featuredStores: parseInt(generalStats.featured_stores)
          },
          byCountry: countryStats.map(stat => ({
            country: stat.country,
            count: parseInt(stat.count)
          })),
          topByRevenue: topStoresByRevenue.map(store => ({
            id: store.id,
            name: store.name,
            slug: store.slug,
            totalRevenue: parseFloat(store.total_revenue) || 0,
            totalOrders: store.total_orders || 0
          }))
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;