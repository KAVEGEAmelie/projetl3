const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { requireAuth, requireRole, optionalAuth } = require('../middleware/auth');
const { cacheMiddleware } = require('../config/redis');

/**
 * @route GET /api/products
 * @desc Récupérer tous les produits avec filtres et pagination
 * @access Public
 */
router.get('/', 
  cacheMiddleware(600, (req) => `products:list:${JSON.stringify(req.query)}`),
  productController.getAllProducts
);

/**
 * @route GET /api/products/search
 * @desc Rechercher des produits
 * @access Public
 */
router.get('/search', productController.searchProducts);

/**
 * @route GET /api/products/featured
 * @desc Récupérer les produits en vedette
 * @access Public
 */
router.get('/featured', 
  cacheMiddleware(1800, () => 'products:featured'),
  async (req, res, next) => {
    req.query.featured = 'true';
    req.query.limit = req.query.limit || '12';
    next();
  },
  productController.getAllProducts
);

/**
 * @route GET /api/products/trending
 * @desc Récupérer les produits tendances
 * @access Public
 */
router.get('/trending',
  cacheMiddleware(3600, () => 'products:trending'),
  async (req, res, next) => {
    req.query.sortBy = 'sales_count';
    req.query.sortOrder = 'desc';
    req.query.limit = req.query.limit || '12';
    next();
  },
  productController.getAllProducts
);

/**
 * @route GET /api/products/new
 * @desc Récupérer les nouveaux produits
 * @access Public
 */
router.get('/new',
  cacheMiddleware(900, () => 'products:new'),
  async (req, res, next) => {
    req.query.sortBy = 'created_at';
    req.query.sortOrder = 'desc';
    req.query.limit = req.query.limit || '12';
    next();
  },
  productController.getAllProducts
);

/**
 * @route POST /api/products
 * @desc Créer un nouveau produit
 * @access Private (Vendor+)
 */
router.post('/', 
  requireAuth,
  requireRole(['vendor', 'manager', 'admin', 'super_admin']),
  productController.createProduct
);

/**
 * @route GET /api/products/:id
 * @desc Récupérer un produit par ID ou slug
 * @access Public
 */
router.get('/:id',
  optionalAuth,
  cacheMiddleware(1800, (req) => `product:${req.params.id}:${req.user?.id || 'guest'}`),
  productController.getProductById
);

/**
 * @route PUT /api/products/:id
 * @desc Mettre à jour un produit
 * @access Private (Owner/Admin)
 */
router.put('/:id',
  requireAuth,
  requireRole(['vendor', 'manager', 'admin', 'super_admin']),
  async (req, res, next) => {
    const db = require('../config/database');
    const { commonErrors } = require('../middleware/errorHandler');
    
    try {
      const product = await db('products')
        .select(['id', 'store_id'])
        .where({ id: req.params.id })
        .whereNull('deleted_at')
        .first();

      if (!product) {
        throw commonErrors.notFound('Produit');
      }

      // Vérifier les permissions
      if (!['admin', 'super_admin'].includes(req.user.role)) {
        const store = await db('stores')
          .where({ id: product.store_id })
          .first();
        
        if (!store || store.owner_id !== req.user.id) {
          throw commonErrors.forbidden('Vous ne pouvez modifier que vos propres produits');
        }
      }

      req.product = product;
      next();
    } catch (error) {
      next(error);
    }
  },
  async (req, res) => {
    const db = require('../config/database');
    const { cache, CACHE_KEYS } = require('../config/redis');
    
    try {
      const updateData = { ...req.body };
      
      // Supprimer les champs non modifiables
      delete updateData.id;
      delete updateData.slug;
      delete updateData.created_at;
      delete updateData.views_count;
      delete updateData.sales_count;
      delete updateData.total_revenue;
      
      // Ajouter les métadonnées de mise à jour
      updateData.updated_at = db.fn.now();
      updateData.updated_by = req.user.id;
      
      // Mettre à jour le produit
      const [updatedProduct] = await db('products')
        .where({ id: req.params.id })
        .update(updateData)
        .returning('*');

      // Invalider les caches
      await cache.delPattern(`${CACHE_KEYS.PRODUCTS}*`);
      await cache.delPattern(`product:${req.params.id}*`);

      res.json({
        success: true,
        message: 'Produit mis à jour avec succès',
        data: updatedProduct
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route DELETE /api/products/:id
 * @desc Supprimer un produit (soft delete)
 * @access Private (Owner/Admin)
 */
router.delete('/:id',
  requireAuth,
  requireRole(['vendor', 'manager', 'admin', 'super_admin']),
  async (req, res, next) => {
    const db = require('../config/database');
    const { commonErrors } = require('../middleware/errorHandler');
    const { cache, CACHE_KEYS } = require('../config/redis');
    
    try {
      const product = await db('products')
        .select(['id', 'store_id', 'name'])
        .where({ id: req.params.id })
        .whereNull('deleted_at')
        .first();

      if (!product) {
        throw commonErrors.notFound('Produit');
      }

      // Vérifier les permissions
      if (!['admin', 'super_admin'].includes(req.user.role)) {
        const store = await db('stores')
          .where({ id: product.store_id })
          .first();
        
        if (!store || store.owner_id !== req.user.id) {
          throw commonErrors.forbidden('Vous ne pouvez supprimer que vos propres produits');
        }
      }

      // Soft delete
      await db('products')
        .where({ id: req.params.id })
        .update({
          deleted_at: db.fn.now(),
          deleted_by: req.user.id
        });

      // Décrémenter le compteur de produits de la boutique
      await db('stores')
        .where({ id: product.store_id })
        .decrement('total_products', 1);

      // Invalider les caches
      await cache.delPattern(`${CACHE_KEYS.PRODUCTS}*`);
      await cache.delPattern(`product:${req.params.id}*`);

      res.json({
        success: true,
        message: `Produit "${product.name}" supprimé avec succès`
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/products/:id/images
 * @desc Ajouter des images à un produit
 * @access Private (Owner/Admin)
 */
router.post('/:id/images',
  requireAuth,
  requireRole(['vendor', 'manager', 'admin', 'super_admin']),
  // Middleware upload sera implémenté plus tard
  async (req, res) => {
    // TODO: Implémenter l'upload d'images
    res.json({
      success: true,
      message: 'Upload d\'images à implémenter'
    });
  }
);

/**
 * @route GET /api/products/:id/reviews
 * @desc Récupérer les avis d'un produit
 * @access Public
 */
router.get('/:id/reviews',
  cacheMiddleware(600, (req) => `product:${req.params.id}:reviews`),
  async (req, res, next) => {
    const db = require('../config/database');
    const { commonErrors } = require('../middleware/errorHandler');
    
    try {
      const { page = 1, limit = 10 } = req.query;
      
      // Vérifier que le produit existe
      const product = await db('products')
        .where({ id: req.params.id })
        .whereNull('deleted_at')
        .first();

      if (!product) {
        throw commonErrors.notFound('Produit');
      }

      // TODO: Récupérer les avis (table à créer)
      res.json({
        success: true,
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          pages: 0
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/products/:id/reviews
 * @desc Ajouter un avis sur un produit
 * @access Private
 */
router.post('/:id/reviews',
  requireAuth,
  async (req, res) => {
    // TODO: Implémenter le système d'avis
    res.json({
      success: true,
      message: 'Système d\'avis à implémenter'
    });
  }
);

/**
 * @route POST /api/products/:id/wishlist
 * @desc Ajouter/retirer un produit de la wishlist
 * @access Private
 */
router.post('/:id/wishlist',
  requireAuth,
  async (req, res, next) => {
    const db = require('../config/database');
    const { sets, CACHE_KEYS } = require('../config/redis');
    const { commonErrors } = require('../middleware/errorHandler');
    
    try {
      const productId = req.params.id;
      const userId = req.user.id;
      
      // Vérifier que le produit existe
      const product = await db('products')
        .where({ id: productId })
        .whereNull('deleted_at')
        .first();

      if (!product) {
        throw commonErrors.notFound('Produit');
      }

      const wishlistKey = CACHE_KEYS.USER_WISHLIST(userId);
      const isInWishlist = await sets.isMember(wishlistKey, productId);
      
      if (isInWishlist) {
        // Retirer de la wishlist
        await sets.remove(wishlistKey, productId);
        await db('products')
          .where({ id: productId })
          .decrement('wishlist_count', 1);
        
        res.json({
          success: true,
          message: 'Produit retiré de la liste de souhaits',
          inWishlist: false
        });
      } else {
        // Ajouter à la wishlist
        await sets.add(wishlistKey, productId);
        await db('products')
          .where({ id: productId })
          .increment('wishlist_count', 1);
        
        res.json({
          success: true,
          message: 'Produit ajouté à la liste de souhaits',
          inWishlist: true
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;