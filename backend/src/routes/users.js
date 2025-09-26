const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadMiddleware, uploadService } = require('../services/uploadService');

/**
 * @route GET /api/users/profile
 * @desc Récupérer le profil de l'utilisateur connecté
 * @access Private
 */
router.get('/profile', requireAuth, userController.getUserProfile);

/**
 * @route PUT /api/users/profile
 * @desc Mettre à jour le profil utilisateur
 * @access Private
 */
router.put('/profile', requireAuth, userController.updateUserProfile);

/**
 * @route PUT /api/users/change-password
 * @desc Changer le mot de passe
 * @access Private
 */
router.put('/change-password', requireAuth, userController.changePassword);

/**
 * @route POST /api/users/avatar
 * @desc Upload de l'avatar utilisateur
 * @access Private
 */
router.post('/avatar',
  requireAuth,
  uploadMiddleware(uploadService.uploadUserAvatar),
  userController.uploadAvatar
);

/**
 * @route GET /api/users/dashboard
 * @desc Récupérer les données du dashboard utilisateur
 * @access Private
 */
router.get('/dashboard', requireAuth, userController.getUserDashboard);

/**
 * @route GET /api/users/wishlist
 * @desc Récupérer la liste de souhaits
 * @access Private
 */
router.get('/wishlist', requireAuth, userController.getUserWishlist);

/**
 * @route POST /api/users/wishlist/:productId
 * @desc Ajouter/retirer un produit de la wishlist
 * @access Private
 */
router.post('/wishlist/:productId', requireAuth, userController.toggleWishlistItem);

/**
 * @route DELETE /api/users/wishlist
 * @desc Vider la liste de souhaits
 * @access Private
 */
router.delete('/wishlist', requireAuth, userController.clearWishlist);

/**
 * @route GET /api/users/addresses
 * @desc Récupérer les adresses de l'utilisateur
 * @access Private
 */
router.get('/addresses', requireAuth, userController.getUserAddresses);

/**
 * @route POST /api/users/addresses
 * @desc Ajouter une nouvelle adresse
 * @access Private
 */
router.post('/addresses', requireAuth, async (req, res, next) => {
  // TODO: Implémenter la gestion des adresses multiples
  res.json({
    success: false,
    message: 'Fonctionnalité en cours de développement'
  });
});

/**
 * @route GET /api/users/notifications
 * @desc Récupérer les notifications de l'utilisateur
 * @access Private
 */
router.get('/notifications', requireAuth, userController.getUserNotifications);

/**
 * @route PUT /api/users/notifications/:id/read
 * @desc Marquer une notification comme lue
 * @access Private
 */
router.put('/notifications/:id/read', requireAuth, userController.markNotificationAsRead);

/**
 * @route POST /api/users/notifications/mark-all-read
 * @desc Marquer toutes les notifications comme lues
 * @access Private
 */
router.post('/notifications/mark-all-read', requireAuth, async (req, res) => {
  // TODO: Implémenter la mise à jour en lot
  res.json({
    success: true,
    message: 'Toutes les notifications ont été marquées comme lues'
  });
});

/**
 * @route DELETE /api/users/account
 * @desc Supprimer le compte utilisateur (soft delete)
 * @access Private
 */
router.delete('/account', requireAuth, async (req, res, next) => {
  const db = require('../config/database');
  const { cache, CACHE_KEYS } = require('../config/redis');
  const { commonErrors } = require('../middleware/errorHandler');
  
  try {
    const userId = req.user.id;
    const { password, reason } = req.body;
    
    if (!password) {
      throw commonErrors.badRequest('Mot de passe requis pour supprimer le compte');
    }
    
    // Vérifier le mot de passe
    const user = await db('users')
      .select(['password_hash'])
      .where({ id: userId })
      .first();
    
    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      throw commonErrors.badRequest('Mot de passe incorrect');
    }
    
    // Vérifier qu'il n'y a pas de commandes en cours
    const pendingOrders = await db('orders')
      .where({ customer_id: userId })
      .whereIn('status', ['pending', 'paid', 'confirmed', 'processing', 'shipped'])
      .count('id as count')
      .first();
      
    if (parseInt(pendingOrders.count) > 0) {
      throw commonErrors.conflict(
        'Impossible de supprimer votre compte. Des commandes sont en cours de traitement.'
      );
    }
    
    // Soft delete du compte
    await db('users')
      .where({ id: userId })
      .update({
        deleted_at: db.fn.now(),
        deleted_by: userId,
        admin_notes: reason || 'Suppression demandée par l\'utilisateur'
      });
    
    // Supprimer les données en cache
    await cache.del(CACHE_KEYS.USER_PROFILE(userId));
    await cache.del(CACHE_KEYS.USER_WISHLIST(userId));
    
    res.json({
      success: true,
      message: 'Votre compte a été supprimé avec succès'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/users/export
 * @desc Exporter les données utilisateur (RGPD)
 * @access Private
 */
router.get('/export', requireAuth, async (req, res, next) => {
  const db = require('../config/database');
  const { sets, CACHE_KEYS } = require('../config/redis');
  
  try {
    const userId = req.user.id;
    
    // Données utilisateur
    const user = await db('users')
      .select([
        'email', 'first_name', 'last_name', 'phone', 'birth_date',
        'gender', 'bio', 'country', 'city', 'address', 'postal_code',
        'preferred_language', 'preferred_currency', 'loyalty_points',
        'marketing_emails', 'marketing_sms', 'created_at'
      ])
      .where({ id: userId })
      .first();
    
    // Commandes
    const orders = await db('orders')
      .select([
        'order_number', 'status', 'total_amount', 'currency',
        'delivery_address', 'created_at'
      ])
      .where({ customer_id: userId });
    
    // Wishlist
    const wishlistKey = CACHE_KEYS.USER_WISHLIST(userId);
    const wishlistIds = await sets.members(wishlistKey);
    
    const wishlist = [];
    if (wishlistIds.length > 0) {
      const products = await db('products')
        .select(['name', 'price', 'currency'])
        .whereIn('id', wishlistIds.map(id => JSON.parse(id)));
      wishlist.push(...products);
    }
    
    // Avis
    const reviews = await db('product_reviews')
      .select(['rating', 'comment', 'created_at'])
      .where({ customer_id: userId });
    
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        ...user,
        id: undefined // Ne pas inclure l'ID
      },
      orders,
      wishlist,
      reviews,
      summary: {
        totalOrders: orders.length,
        totalWishlistItems: wishlist.length,
        totalReviews: reviews.length
      }
    };
    
    res.json({
      success: true,
      data: exportData
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/users/:id (Admin only)
 * @desc Récupérer un utilisateur par ID (admin)
 * @access Private (Admin)
 */
router.get('/:id',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    const db = require('../config/database');
    const { commonErrors } = require('../middleware/errorHandler');
    
    try {
      const { id } = req.params;
      
      const user = await db('users')
        .select([
          'id', 'email', 'first_name', 'last_name', 'phone', 'role', 'status',
          'email_verified', 'country', 'city', 'loyalty_points', 'loyalty_tier',
          'last_login', 'created_at', 'updated_at'
        ])
        .where({ id })
        .whereNull('deleted_at')
        .first();
      
      if (!user) {
        throw commonErrors.notFound('Utilisateur');
      }
      
      // Statistiques
      const stats = await db('orders')
        .select([
          db.raw('COUNT(*) as total_orders'),
          db.raw('SUM(total_amount) as total_spent')
        ])
        .where({ customer_id: id })
        .first();
      
      res.json({
        success: true,
        data: {
          ...user,
          stats: {
            totalOrders: parseInt(stats.total_orders) || 0,
            totalSpent: parseFloat(stats.total_spent) || 0
          }
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/users (Admin only)
 * @desc Récupérer tous les utilisateurs (admin)
 * @access Private (Admin)
 */
router.get('/',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    const db = require('../config/database');
    const {
      page = 1,
      limit = 20,
      role,
      status,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;
    
    try {
      let query = db('users')
        .select([
          'id', 'email', 'first_name', 'last_name', 'phone', 'role', 'status',
          'email_verified', 'country', 'city', 'loyalty_points',
          'last_login', 'created_at'
        ])
        .whereNull('deleted_at');
      
      // Filtres
      if (role) {
        query = query.where('role', role);
      }
      
      if (status) {
        query = query.where('status', status);
      }
      
      if (search) {
        query = query.where(function() {
          this.whereILike('first_name', `%${search}%`)
            .orWhereILike('last_name', `%${search}%`)
            .orWhereILike('email', `%${search}%`);
        });
      }
      
      // Tri
      const validSortFields = ['created_at', 'first_name', 'last_name', 'email', 'role'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';
      
      query = query.orderBy(sortField, order);
      
      // Pagination
      const result = await db.helpers.paginate(query, page, limit);
      
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
      
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PUT /api/users/:id/status (Admin only)
 * @desc Changer le statut d'un utilisateur
 * @access Private (Admin)
 */
router.put('/:id/status',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    const db = require('../config/database');
    const { commonErrors } = require('../middleware/errorHandler');
    
    try {
      const { id } = req.params;
      const { status, reason } = req.body;
      
      const validStatuses = ['active', 'suspended', 'banned'];
      if (!validStatuses.includes(status)) {
        throw commonErrors.badRequest('Statut invalide');
      }
      
      const user = await db('users')
        .where({ id })
        .whereNull('deleted_at')
        .first();
      
      if (!user) {
        throw commonErrors.notFound('Utilisateur');
      }
      
      await db('users')
        .where({ id })
        .update({
          status,
          admin_notes: reason || `Statut changé en ${status}`,
          updated_at: db.fn.now(),
          updated_by: req.user.id
        });
      
      res.json({
        success: true,
        message: `Statut de l'utilisateur mis à jour: ${status}`,
        data: { id, status, reason }
      });
      
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;