const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { requireAuth, requireRole } = require('../middleware/auth');

/**
 * @route POST /api/orders
 * @desc Créer une nouvelle commande
 * @access Private
 */
router.post('/', requireAuth, orderController.createOrder);

/**
 * @route GET /api/orders
 * @desc Récupérer les commandes de l'utilisateur connecté
 * @access Private
 */
router.get('/', requireAuth, orderController.getUserOrders);

/**
 * @route GET /api/orders/:id
 * @desc Récupérer une commande spécifique
 * @access Private (Owner/Store Owner/Admin)
 */
router.get('/:id', requireAuth, orderController.getOrderById);

/**
 * @route POST /api/orders/:id/cancel
 * @desc Annuler une commande
 * @access Private (Owner/Store Owner/Admin)
 */
router.post('/:id/cancel', requireAuth, orderController.cancelOrder);

/**
 * @route PUT /api/orders/:id/status
 * @desc Mettre à jour le statut d'une commande (vendeur/admin)
 * @access Private (Vendor+)
 */
router.put('/:id/status',
  requireAuth,
  requireRole(['vendor', 'manager', 'admin', 'super_admin']),
  orderController.updateOrderStatus
);

/**
 * @route GET /api/orders/:id/tracking
 * @desc Récupérer les informations de suivi d'une commande
 * @access Private (Owner/Store Owner/Admin)
 */
router.get('/:id/tracking', requireAuth, async (req, res, next) => {
  const db = require('../config/database');
  const { commonErrors } = require('../middleware/errorHandler');
  
  try {
    const { id } = req.params;
    
    const order = await db('orders')
      .select([
        'id', 'order_number', 'customer_id', 'store_id', 'status',
        'tracking_number', 'tracking_url', 'carrier',
        'estimated_delivery_date', 'actual_delivery_date',
        'delivery_address', 'created_at', 'updated_at'
      ])
      .where({ id })
      .first();

    if (!order) {
      throw commonErrors.notFound('Commande');
    }

    // Vérifier les permissions
    const isOwner = order.customer_id === req.user.id;
    const isStoreOwner = req.user.role === 'vendor' && await db('stores')
      .where({ id: order.store_id, owner_id: req.user.id })
      .first();
    const isAdmin = ['admin', 'super_admin', 'manager'].includes(req.user.role);

    if (!isOwner && !isStoreOwner && !isAdmin) {
      throw commonErrors.forbidden('Accès non autorisé');
    }

    // Historique de statut (simulé - pourrait être une vraie table)
    const statusHistory = [
      { status: 'pending', date: order.created_at, description: 'Commande créée' },
      { status: 'confirmed', date: order.created_at, description: 'Commande confirmée' }
    ];

    if (['processing', 'shipped', 'delivered'].includes(order.status)) {
      statusHistory.push({ 
        status: 'processing', 
        date: order.updated_at, 
        description: 'Commande en préparation' 
      });
    }

    if (['shipped', 'delivered'].includes(order.status)) {
      statusHistory.push({ 
        status: 'shipped', 
        date: order.updated_at, 
        description: 'Commande expédiée' 
      });
    }

    if (order.status === 'delivered') {
      statusHistory.push({ 
        status: 'delivered', 
        date: order.actual_delivery_date || order.updated_at, 
        description: 'Commande livrée' 
      });
    }

    res.json({
      success: true,
      data: {
        orderNumber: order.order_number,
        currentStatus: order.status,
        trackingNumber: order.tracking_number,
        trackingUrl: order.tracking_url,
        carrier: order.carrier,
        estimatedDeliveryDate: order.estimated_delivery_date,
        actualDeliveryDate: order.actual_delivery_date,
        deliveryAddress: order.delivery_address,
        statusHistory: statusHistory.sort((a, b) => new Date(a.date) - new Date(b.date))
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/orders/:id/review
 * @desc Laisser un avis sur une commande livrée
 * @access Private (Customer only)
 */
router.post('/:id/review', requireAuth, async (req, res, next) => {
  const db = require('../config/database');
  const { commonErrors } = require('../middleware/errorHandler');
  
  try {
    const { id } = req.params;
    const { rating, comment, items } = req.body; // items = array of {productId, rating, comment}

    if (!rating || rating < 1 || rating > 5) {
      throw commonErrors.badRequest('Note globale requise (1-5 étoiles)');
    }

    const order = await db('orders')
      .select(['id', 'customer_id', 'store_id', 'status'])
      .where({ id })
      .first();

    if (!order) {
      throw commonErrors.notFound('Commande');
    }

    // Vérifier que c'est le propriétaire de la commande
    if (order.customer_id !== req.user.id) {
      throw commonErrors.forbidden('Vous ne pouvez évaluer que vos propres commandes');
    }

    // Vérifier que la commande est livrée
    if (order.status !== 'delivered') {
      throw commonErrors.badRequest('Vous ne pouvez évaluer qu\'une commande livrée');
    }

    // Vérifier si un avis a déjà été laissé
    const existingReview = await db('order_reviews')
      .where({ order_id: id })
      .first();

    if (existingReview) {
      throw commonErrors.conflict('Un avis a déjà été laissé pour cette commande');
    }

    const trx = await db.transaction();

    try {
      // Créer l'avis global sur la commande
      await trx('order_reviews').insert({
        order_id: id,
        customer_id: req.user.id,
        store_id: order.store_id,
        rating: rating,
        comment: comment,
        created_at: trx.fn.now()
      });

      // Créer les avis sur les produits individuels
      if (items && items.length > 0) {
        const productReviews = items
          .filter(item => item.rating && item.rating >= 1 && item.rating <= 5)
          .map(item => ({
            product_id: item.productId,
            customer_id: req.user.id,
            order_id: id,
            rating: item.rating,
            comment: item.comment || '',
            status: 'published',
            created_at: trx.fn.now()
          }));

        if (productReviews.length > 0) {
          await trx('product_reviews').insert(productReviews);

          // Mettre à jour les statistiques des produits
          for (const review of productReviews) {
            const productStats = await trx('product_reviews')
              .where({ product_id: review.product_id, status: 'published' })
              .select([
                trx.raw('AVG(rating) as avg_rating'),
                trx.raw('COUNT(*) as review_count')
              ])
              .first();

            await trx('products')
              .where({ id: review.product_id })
              .update({
                average_rating: parseFloat(productStats.avg_rating).toFixed(1),
                reviews_count: parseInt(productStats.review_count)
              });
          }
        }
      }

      // Mettre à jour les statistiques de la boutique
      const storeStats = await trx('order_reviews')
        .where({ store_id: order.store_id })
        .select([
          trx.raw('AVG(rating) as avg_rating'),
          trx.raw('COUNT(*) as review_count')
        ])
        .first();

      await trx('stores')
        .where({ id: order.store_id })
        .update({
          average_rating: parseFloat(storeStats.avg_rating).toFixed(1),
          total_reviews: parseInt(storeStats.review_count)
        });

      await trx.commit();

      res.status(201).json({
        success: true,
        message: 'Avis enregistré avec succès. Merci pour votre retour !'
      });

    } catch (error) {
      await trx.rollback();
      throw error;
    }

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/orders/stats/summary
 * @desc Statistiques des commandes (admin/manager)
 * @access Private (Admin)
 */
router.get('/stats/summary',
  requireAuth,
  requireRole(['admin', 'super_admin', 'manager']),
  async (req, res, next) => {
    const db = require('../config/database');
    const { period = '30d' } = req.query;
    
    try {
      // Calculer la période
      let dateFilter = db.raw('1=1');
      if (period === '7d') {
        dateFilter = db.raw("created_at >= NOW() - INTERVAL '7 days'");
      } else if (period === '30d') {
        dateFilter = db.raw("created_at >= NOW() - INTERVAL '30 days'");
      } else if (period === '90d') {
        dateFilter = db.raw("created_at >= NOW() - INTERVAL '90 days'");
      }

      // Statistiques générales
      const generalStats = await db('orders')
        .where(dateFilter)
        .select([
          db.raw('COUNT(*) as total_orders'),
          db.raw('SUM(total_amount) as total_revenue'),
          db.raw('AVG(total_amount) as average_order_value'),
          db.raw('COUNT(CASE WHEN status = \'delivered\' THEN 1 END) as completed_orders'),
          db.raw('COUNT(CASE WHEN status = \'cancelled\' THEN 1 END) as cancelled_orders'),
          db.raw('COUNT(CASE WHEN payment_status = \'paid\' THEN 1 END) as paid_orders')
        ])
        .first();

      // Répartition par statut
      const statusStats = await db('orders')
        .where(dateFilter)
        .select('status')
        .count('* as count')
        .groupBy('status');

      // Répartition par méthode de paiement
      const paymentStats = await db('orders')
        .where(dateFilter)
        .select('payment_method')
        .count('* as count')
        .groupBy('payment_method');

      // Top boutiques
      const topStores = await db('orders')
        .join('stores', 'orders.store_id', 'stores.id')
        .where(dateFilter)
        .where('orders.status', 'delivered')
        .select([
          'stores.id',
          'stores.name',
          'stores.slug'
        ])
        .sum('orders.total_amount as revenue')
        .count('orders.id as order_count')
        .groupBy('stores.id', 'stores.name', 'stores.slug')
        .orderBy('revenue', 'desc')
        .limit(5);

      res.json({
        success: true,
        data: {
          period,
          summary: {
            totalOrders: parseInt(generalStats.total_orders) || 0,
            totalRevenue: parseFloat(generalStats.total_revenue) || 0,
            averageOrderValue: parseFloat(generalStats.average_order_value) || 0,
            completedOrders: parseInt(generalStats.completed_orders) || 0,
            cancelledOrders: parseInt(generalStats.cancelled_orders) || 0,
            paidOrders: parseInt(generalStats.paid_orders) || 0,
            conversionRate: generalStats.total_orders > 0 
              ? ((generalStats.completed_orders / generalStats.total_orders) * 100).toFixed(2)
              : 0
          },
          byStatus: statusStats.map(stat => ({
            status: stat.status,
            count: parseInt(stat.count)
          })),
          byPaymentMethod: paymentStats.map(stat => ({
            method: stat.payment_method,
            count: parseInt(stat.count)
          })),
          topStores: topStores.map(store => ({
            id: store.id,
            name: store.name,
            slug: store.slug,
            revenue: parseFloat(store.revenue),
            orderCount: parseInt(store.order_count)
          }))
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/orders/bulk-update
 * @desc Mise à jour en lot des commandes (admin)
 * @access Private (Admin)
 */
router.post('/bulk-update',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    const db = require('../config/database');
    const { orderIds, status, notes } = req.body;
    
    try {
      if (!orderIds || orderIds.length === 0) {
        throw commonErrors.badRequest('Liste des commandes requise');
      }

      if (!status) {
        throw commonErrors.badRequest('Statut requis');
      }

      const validStatuses = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw commonErrors.badRequest('Statut invalide');
      }

      const updateData = {
        status,
        updated_at: db.fn.now(),
        updated_by: req.user.id
      };

      if (notes) {
        updateData.admin_notes = notes;
      }

      // Mettre à jour les commandes
      const updatedCount = await db('orders')
        .whereIn('id', orderIds)
        .update(updateData);

      // Mettre à jour les articles
      await db('order_items')
        .whereIn('order_id', orderIds)
        .update({ status });

      res.json({
        success: true,
        message: `${updatedCount} commande(s) mise(s) à jour avec le statut: ${status}`,
        data: {
          updatedCount,
          status
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;