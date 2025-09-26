const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { cacheMiddleware } = require('../config/redis');

/**
 * @route GET /api/categories
 * @desc Récupérer toutes les catégories
 * @access Public
 */
router.get('/', 
  cacheMiddleware(1800, (req) => `categories:list:${JSON.stringify(req.query)}`),
  categoryController.getAllCategories
);

/**
 * @route GET /api/categories/tree
 * @desc Récupérer l'arbre hiérarchique des catégories
 * @access Public
 */
router.get('/tree',
  cacheMiddleware(3600, () => 'categories:tree'),
  async (req, res, next) => {
    req.query.tree = 'true';
    req.query.active = 'true';
    next();
  },
  categoryController.getAllCategories
);

/**
 * @route GET /api/categories/menu
 * @desc Récupérer les catégories pour le menu de navigation
 * @access Public
 */
router.get('/menu',
  cacheMiddleware(3600, () => 'categories:menu'),
  async (req, res, next) => {
    req.query.tree = 'true';
    req.query.active = 'true';
    req.query.level = '0'; // Seulement les catégories de premier niveau
    next();
  },
  categoryController.getAllCategories
);

/**
 * @route GET /api/categories/featured
 * @desc Récupérer les catégories en vedette
 * @access Public
 */
router.get('/featured',
  cacheMiddleware(1800, () => 'categories:featured'),
  async (req, res, next) => {
    req.query.featured = 'true';
    req.query.active = 'true';
    req.query.includeProducts = 'true';
    req.query.limit = '8';
    next();
  },
  categoryController.getAllCategories
);

/**
 * @route GET /api/categories/popular
 * @desc Récupérer les catégories populaires (par nombre de produits)
 * @access Public
 */
router.get('/popular',
  cacheMiddleware(3600, () => 'categories:popular'),
  async (req, res, next) => {
    const db = require('../config/database');
    
    try {
      const popularCategories = await db('categories')
        .select([
          'categories.id',
          'categories.name',
          'categories.slug',
          'categories.description',
          'categories.image_url',
          'categories.products_count'
        ])
        .where('categories.is_active', true)
        .where('categories.products_count', '>', 0)
        .whereNull('categories.deleted_at')
        .orderBy('categories.products_count', 'desc')
        .orderBy('categories.views_count', 'desc')
        .limit(12);

      res.json({
        success: true,
        data: popularCategories.map(cat => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          imageUrl: cat.image_url,
          productsCount: cat.products_count || 0
        }))
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/categories
 * @desc Créer une nouvelle catégorie
 * @access Private (Admin)
 */
router.post('/',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  categoryController.createCategory
);

/**
 * @route GET /api/categories/:id
 * @desc Récupérer une catégorie par ID ou slug
 * @access Public
 */
router.get('/:id',
  cacheMiddleware(1800, (req) => `category:${req.params.id}`),
  categoryController.getCategoryById
);

/**
 * @route PUT /api/categories/:id
 * @desc Mettre à jour une catégorie
 * @access Private (Admin)
 */
router.put('/:id',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  categoryController.updateCategory
);

/**
 * @route DELETE /api/categories/:id
 * @desc Supprimer une catégorie
 * @access Private (Admin)
 */
router.delete('/:id',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  categoryController.deleteCategory
);

/**
 * @route GET /api/categories/:id/products
 * @desc Récupérer les produits d'une catégorie
 * @access Public
 */
router.get('/:id/products',
  cacheMiddleware(600, (req) => `category:${req.params.id}:products:${JSON.stringify(req.query)}`),
  categoryController.getCategoryProducts
);

/**
 * @route GET /api/categories/:id/subcategories
 * @desc Récupérer les sous-catégories d'une catégorie
 * @access Public
 */
router.get('/:id/subcategories',
  cacheMiddleware(1800, (req) => `category:${req.params.id}:subcategories`),
  async (req, res, next) => {
    const db = require('../config/database');
    const { commonErrors } = require('../middleware/errorHandler');
    
    try {
      const { id } = req.params;

      // Vérifier que la catégorie parent existe
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
      const whereClause = isUuid ? { id } : { slug: id };

      const parentCategory = await db('categories')
        .select(['id', 'name', 'slug'])
        .where(whereClause)
        .whereNull('deleted_at')
        .first();

      if (!parentCategory) {
        throw commonErrors.notFound('Catégorie parent');
      }

      // Récupérer les sous-catégories
      const subcategories = await db('categories')
        .select([
          'id',
          'name',
          'slug', 
          'description',
          'image_url',
          'products_count',
          'sort_order'
        ])
        .where('parent_id', parentCategory.id)
        .where('is_active', true)
        .whereNull('deleted_at')
        .orderBy('sort_order')
        .orderBy('name');

      res.json({
        success: true,
        data: {
          parent: {
            id: parentCategory.id,
            name: parentCategory.name,
            slug: parentCategory.slug
          },
          subcategories: subcategories.map(cat => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            imageUrl: cat.image_url,
            productsCount: cat.products_count || 0,
            sortOrder: cat.sort_order
          }))
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/categories/:id/breadcrumb
 * @desc Récupérer le fil d'Ariane d'une catégorie
 * @access Public
 */
router.get('/:id/breadcrumb',
  cacheMiddleware(3600, (req) => `category:${req.params.id}:breadcrumb`),
  async (req, res, next) => {
    const db = require('../config/database');
    const { commonErrors } = require('../middleware/errorHandler');
    
    try {
      const { id } = req.params;

      // Récupérer la catégorie
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
      const whereClause = isUuid ? { id } : { slug: id };

      const category = await db('categories')
        .select(['id', 'name', 'slug', 'parent_id'])
        .where(whereClause)
        .whereNull('deleted_at')
        .first();

      if (!category) {
        throw commonErrors.notFound('Catégorie');
      }

      // Construire le breadcrumb
      const breadcrumb = [{
        id: category.id,
        name: category.name,
        slug: category.slug,
        current: true
      }];

      let currentCategory = category;
      
      // Remonter la hiérarchie
      while (currentCategory && currentCategory.parent_id) {
        const parent = await db('categories')
          .select(['id', 'name', 'slug', 'parent_id'])
          .where('id', currentCategory.parent_id)
          .whereNull('deleted_at')
          .first();
        
        if (parent) {
          breadcrumb.unshift({
            id: parent.id,
            name: parent.name,
            slug: parent.slug,
            current: false
          });
          currentCategory = parent;
        } else {
          break;
        }
      }

      // Ajouter l'accueil en premier
      breadcrumb.unshift({
        id: null,
        name: 'Accueil',
        slug: '',
        current: false
      });

      res.json({
        success: true,
        data: breadcrumb
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/categories/:id/reorder
 * @desc Réorganiser l'ordre des sous-catégories
 * @access Private (Admin)
 */
router.post('/:id/reorder',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    const db = require('../config/database');
    const { cache, CACHE_KEYS } = require('../config/redis');
    const { commonErrors } = require('../middleware/errorHandler');
    
    try {
      const { id } = req.params;
      const { subcategoryIds } = req.body; // Array d'IDs dans le nouvel ordre

      if (!subcategoryIds || !Array.isArray(subcategoryIds)) {
        throw commonErrors.badRequest('Liste des sous-catégories requise');
      }

      // Vérifier que la catégorie parent existe
      const parentCategory = await db('categories')
        .where({ id })
        .whereNull('deleted_at')
        .first();

      if (!parentCategory) {
        throw commonErrors.notFound('Catégorie parent');
      }

      // Vérifier que toutes les sous-catégories appartiennent au parent
      const subcategories = await db('categories')
        .select('id')
        .where('parent_id', id)
        .whereIn('id', subcategoryIds)
        .whereNull('deleted_at');

      if (subcategories.length !== subcategoryIds.length) {
        throw commonErrors.badRequest('Certaines sous-catégories ne sont pas valides');
      }

      // Mettre à jour l'ordre
      const trx = await db.transaction();
      
      try {
        for (let i = 0; i < subcategoryIds.length; i++) {
          await trx('categories')
            .where({ id: subcategoryIds[i] })
            .update({ 
              sort_order: i + 1,
              updated_at: trx.fn.now(),
              updated_by: req.user.id
            });
        }

        await trx.commit();

        // Invalider les caches
        await cache.delPattern(`${CACHE_KEYS.CATEGORIES}*`);

        res.json({
          success: true,
          message: 'Ordre des sous-catégories mis à jour avec succès'
        });

      } catch (error) {
        await trx.rollback();
        throw error;
      }

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/categories/stats/admin
 * @desc Statistiques des catégories pour l'administration
 * @access Private (Admin)
 */
router.get('/stats/admin',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  cacheMiddleware(3600, () => 'categories:admin:stats'),
  async (req, res, next) => {
    const db = require('../config/database');
    
    try {
      // Statistiques générales
      const generalStats = await db('categories')
        .select([
          db.raw('COUNT(*) as total_categories'),
          db.raw('COUNT(CASE WHEN is_active = true THEN 1 END) as active_categories'),
          db.raw('COUNT(CASE WHEN featured = true THEN 1 END) as featured_categories'),
          db.raw('COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as root_categories'),
          db.raw('AVG(products_count) as avg_products_per_category')
        ])
        .whereNull('deleted_at')
        .first();

      // Catégories par niveau
      const levelStats = await db('categories')
        .select('level')
        .count('* as count')
        .whereNull('deleted_at')
        .groupBy('level')
        .orderBy('level');

      // Top catégories par nombre de produits
      const topByProducts = await db('categories')
        .select(['id', 'name', 'slug', 'products_count'])
        .whereNull('deleted_at')
        .where('products_count', '>', 0)
        .orderBy('products_count', 'desc')
        .limit(10);

      // Top catégories par vues
      const topByViews = await db('categories')
        .select(['id', 'name', 'slug', 'views_count'])
        .whereNull('deleted_at')
        .where('views_count', '>', 0)
        .orderBy('views_count', 'desc')
        .limit(10);

      res.json({
        success: true,
        data: {
          general: {
            totalCategories: parseInt(generalStats.total_categories),
            activeCategories: parseInt(generalStats.active_categories),
            featuredCategories: parseInt(generalStats.featured_categories),
            rootCategories: parseInt(generalStats.root_categories),
            avgProductsPerCategory: parseFloat(generalStats.avg_products_per_category) || 0
          },
          byLevel: levelStats.map(stat => ({
            level: stat.level,
            count: parseInt(stat.count)
          })),
          topByProducts: topByProducts.map(cat => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            productsCount: cat.products_count
          })),
          topByViews: topByViews.map(cat => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            viewsCount: cat.views_count
          }))
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;