const db = require('../config/database');

/**
 * Modèle Category - Gestion des catégories hiérarchiques
 */
class Category {
  /**
   * Créer une nouvelle catégorie
   */
  static async create(categoryData) {
    const {
      name,
      description,
      parent_id = null,
      icon,
      image_url,
      color = '#8B2E2E',
      sort_order = 0,
      seo_title,
      seo_description,
      seo_keywords = [],
      is_featured = false
    } = categoryData;

    // Générer un slug unique
    const baseSlug = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
    
    let slug = baseSlug;
    let counter = 1;
    
    while (await this.findBySlug(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Déterminer le niveau dans la hiérarchie
    let level = 0;
    if (parent_id) {
      const parent = await this.findById(parent_id);
      if (parent) {
        level = parent.level + 1;
      }
    }

    const [category] = await db('categories')
      .insert({
        name,
        slug,
        description,
        parent_id,
        level,
        icon,
        image_url,
        color,
        sort_order,
        seo_title: seo_title || name,
        seo_description: seo_description || description,
        seo_keywords: JSON.stringify(seo_keywords),
        is_featured,
        is_active: true
      })
      .returning('*');

    return this.formatCategory(category);
  }

  /**
   * Trouver une catégorie par ID
   */
  static async findById(id) {
    const category = await db('categories')
      .select('*')
      .where({ id })
      .whereNull('deleted_at')
      .first();

    return category ? this.formatCategory(category) : null;
  }

  /**
   * Trouver une catégorie par slug
   */
  static async findBySlug(slug) {
    const category = await db('categories')
      .select('*')
      .where({ slug })
      .whereNull('deleted_at')
      .first();

    return category ? this.formatCategory(category) : null;
  }

  /**
   * Obtenir toutes les catégories avec hiérarchie
   */
  static async getAll(options = {}) {
    const {
      parent_id = null,
      is_active = true,
      is_featured = null,
      level = null,
      with_children = false
    } = options;

    let query = db('categories')
      .select('*')
      .whereNull('deleted_at');

    // Filtres
    if (parent_id === null) {
      query = query.whereNull('parent_id');
    } else if (parent_id !== undefined) {
      query = query.where('parent_id', parent_id);
    }

    if (is_active !== null) query = query.where('is_active', is_active);
    if (is_featured !== null) query = query.where('is_featured', is_featured);
    if (level !== null) query = query.where('level', level);

    const categories = await query
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc');

    let formattedCategories = categories.map(category => this.formatCategory(category));

    // Si demandé, inclure les enfants
    if (with_children) {
      for (let category of formattedCategories) {
        category.children = await this.getChildren(category.id);
      }
    }

    return formattedCategories;
  }

  /**
   * Obtenir les catégories racines (niveau 0)
   */
  static async getRootCategories() {
    return await this.getAll({ parent_id: null, level: 0 });
  }

  /**
   * Obtenir les catégories enfants d'une catégorie
   */
  static async getChildren(parentId) {
    const children = await db('categories')
      .select('*')
      .where({ parent_id: parentId })
      .where('is_active', true)
      .whereNull('deleted_at')
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc');

    return children.map(category => this.formatCategory(category));
  }

  /**
   * Obtenir toute la descendance d'une catégorie
   */
  static async getDescendants(categoryId) {
    const descendants = await db.raw(`
      WITH RECURSIVE category_tree AS (
        SELECT * FROM categories WHERE parent_id = ? AND deleted_at IS NULL
        UNION ALL
        SELECT c.* FROM categories c
        INNER JOIN category_tree ct ON c.parent_id = ct.id
        WHERE c.deleted_at IS NULL
      )
      SELECT * FROM category_tree ORDER BY level, sort_order, name
    `, [categoryId]);

    return descendants.rows.map(category => this.formatCategory(category));
  }

  /**
   * Obtenir le chemin complet d'une catégorie (breadcrumb)
   */
  static async getPath(categoryId) {
    const path = await db.raw(`
      WITH RECURSIVE category_path AS (
        SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL
        UNION ALL
        SELECT c.* FROM categories c
        INNER JOIN category_path cp ON c.id = cp.parent_id
        WHERE c.deleted_at IS NULL
      )
      SELECT * FROM category_path ORDER BY level
    `, [categoryId]);

    return path.rows.map(category => this.formatCategory(category));
  }

  /**
   * Obtenir l'arbre complet des catégories
   */
  static async getTree() {
    const rootCategories = await this.getRootCategories();
    
    for (let category of rootCategories) {
      category.children = await this.buildCategoryTree(category.id);
    }
    
    return rootCategories;
  }

  /**
   * Construire récursivement l'arbre des catégories
   */
  static async buildCategoryTree(parentId) {
    const children = await this.getChildren(parentId);
    
    for (let child of children) {
      child.children = await this.buildCategoryTree(child.id);
    }
    
    return children;
  }

  /**
   * Mettre à jour une catégorie
   */
  static async update(id, updateData) {
    const allowedFields = [
      'name', 'description', 'parent_id', 'icon', 'image_url', 'color',
      'sort_order', 'seo_title', 'seo_description', 'seo_keywords',
      'is_featured', 'is_active'
    ];

    const filteredData = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'seo_keywords' && typeof updateData[field] === 'object') {
          filteredData[field] = JSON.stringify(updateData[field]);
        } else {
          filteredData[field] = updateData[field];
        }
      }
    }

    // Générer un nouveau slug si le nom change
    if (updateData.name) {
      const baseSlug = updateData.name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim();
      
      let slug = baseSlug;
      let counter = 1;
      
      while (true) {
        const existing = await db('categories')
          .where({ slug })
          .where('id', '!=', id)
          .whereNull('deleted_at')
          .first();
        
        if (!existing) break;
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      
      filteredData.slug = slug;
    }

    // Recalculer le niveau si le parent change
    if (updateData.parent_id !== undefined) {
      if (updateData.parent_id === null) {
        filteredData.level = 0;
      } else {
        const parent = await this.findById(updateData.parent_id);
        filteredData.level = parent ? parent.level + 1 : 0;
      }
    }

    filteredData.updated_at = db.fn.now();

    const [category] = await db('categories')
      .where({ id })
      .whereNull('deleted_at')
      .update(filteredData)
      .returning('*');

    // Mettre à jour les niveaux des enfants si nécessaire
    if (filteredData.level !== undefined) {
      await this.updateChildrenLevels(id);
    }

    return category ? this.formatCategory(category) : null;
  }

  /**
   * Mettre à jour récursivement les niveaux des catégories enfants
   */
  static async updateChildrenLevels(parentId) {
    const parent = await this.findById(parentId);
    if (!parent) return;

    const children = await db('categories')
      .where({ parent_id: parentId })
      .whereNull('deleted_at');

    for (let child of children) {
      await db('categories')
        .where({ id: child.id })
        .update({
          level: parent.level + 1,
          updated_at: db.fn.now()
        });

      // Récursion pour les petits-enfants
      await this.updateChildrenLevels(child.id);
    }
  }

  /**
   * Obtenir les produits d'une catégorie
   */
  static async getProducts(categoryId, options = {}) {
    const { 
      page = 1, 
      limit = 12, 
      include_descendants = false,
      status = 'active' 
    } = options;

    let productQuery = db('products')
      .select('products.*', 'stores.name as store_name', 'stores.slug as store_slug')
      .leftJoin('stores', 'products.store_id', 'stores.id')
      .where('products.status', status)
      .whereNull('products.deleted_at')
      .where('stores.status', 'active');

    if (include_descendants) {
      // Inclure les produits de toutes les catégories descendantes
      const descendants = await this.getDescendants(categoryId);
      const categoryIds = [categoryId, ...descendants.map(d => d.id)];
      productQuery = productQuery.whereIn('products.category_id', categoryIds);
    } else {
      productQuery = productQuery.where('products.category_id', categoryId);
    }

    const offset = (page - 1) * limit;
    const products = await productQuery
      .orderBy('products.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return products;
  }

  /**
   * Obtenir les catégories populaires
   */
  static async getPopular(limit = 8) {
    const categories = await db('categories')
      .select('categories.*')
      .select(db.raw('COUNT(products.id) as product_count'))
      .leftJoin('products', function() {
        this.on('categories.id', 'products.category_id')
          .andOn(db.raw('products.deleted_at IS NULL'))
          .andOn('products.status', db.raw('?', ['active']));
      })
      .where('categories.is_active', true)
      .whereNull('categories.deleted_at')
      .groupBy('categories.id')
      .orderBy('product_count', 'desc')
      .orderBy('categories.is_featured', 'desc')
      .limit(limit);

    return categories.map(category => this.formatCategory(category));
  }

  /**
   * Rechercher des catégories
   */
  static async search(query, limit = 10) {
    const categories = await db('categories')
      .select('*')
      .where('is_active', true)
      .whereNull('deleted_at')
      .where(function() {
        this.where('name', 'ilike', `%${query}%`)
          .orWhere('description', 'ilike', `%${query}%`);
      })
      .orderBy('name', 'asc')
      .limit(limit);

    return categories.map(category => this.formatCategory(category));
  }

  /**
   * Supprimer une catégorie (soft delete)
   */
  static async delete(id) {
    // Vérifier s'il y a des produits associés
    const productCount = await db('products')
      .where({ category_id: id })
      .whereNull('deleted_at')
      .count('* as count')
      .first();

    if (parseInt(productCount.count) > 0) {
      throw new Error('Impossible de supprimer une catégorie qui contient des produits');
    }

    // Vérifier s'il y a des catégories enfants
    const childCount = await db('categories')
      .where({ parent_id: id })
      .whereNull('deleted_at')
      .count('* as count')
      .first();

    if (parseInt(childCount.count) > 0) {
      throw new Error('Impossible de supprimer une catégorie qui contient des sous-catégories');
    }

    await db('categories')
      .where({ id })
      .update({
        deleted_at: db.fn.now(),
        is_active: false
      });

    return true;
  }

  /**
   * Réorganiser l'ordre des catégories
   */
  static async reorder(categoryIds) {
    for (let i = 0; i < categoryIds.length; i++) {
      await db('categories')
        .where({ id: categoryIds[i] })
        .update({
          sort_order: i + 1,
          updated_at: db.fn.now()
        });
    }

    return true;
  }

  /**
   * Obtenir les statistiques des catégories
   */
  static async getStats() {
    const [stats] = await db('categories')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('COUNT(*) FILTER (WHERE is_active = true) as active'),
        db.raw('COUNT(*) FILTER (WHERE is_featured = true) as featured'),
        db.raw('COUNT(*) FILTER (WHERE level = 0) as root_categories'),
        db.raw('MAX(level) as max_depth')
      )
      .whereNull('deleted_at');

    return {
      total: parseInt(stats.total) || 0,
      active: parseInt(stats.active) || 0,
      featured: parseInt(stats.featured) || 0,
      root_categories: parseInt(stats.root_categories) || 0,
      max_depth: parseInt(stats.max_depth) || 0
    };
  }

  /**
   * Formater les données de catégorie
   */
  static formatCategory(category) {
    if (!category) return null;

    const formatted = { ...category };

    // Parser les mots-clés SEO
    try {
      if (formatted.seo_keywords && typeof formatted.seo_keywords === 'string') {
        formatted.seo_keywords = JSON.parse(formatted.seo_keywords);
      }
    } catch (error) {
      console.error('Erreur lors du parsing des mots-clés SEO:', error);
      formatted.seo_keywords = [];
    }

    // Ajouter des propriétés calculées
    formatted.has_children = false; // Sera mis à jour si nécessaire
    formatted.product_count = parseInt(formatted.product_count) || 0;

    return formatted;
  }
}

module.exports = Category;
