const db = require('../config/database');

/**
 * Modèle Product - Gestion des produits avec spécificités africaines
 */
class Product {
  /**
   * Créer un nouveau produit
   */
  static async create(productData) {
    const {
      name,
      description,
      short_description,
      sku,
      barcode,
      store_id,
      category_id,
      price,
      compare_at_price,
      cost_price,
      currency = 'FCFA',
      fabric_type,
      fabric_origin,
      cultural_significance = {},
      care_instructions,
      dimensions = {},
      weight,
      color_options = [],
      size_options = [],
      style_tags = [],
      occasion_tags = [],
      gender_target = 'unisex',
      age_group = 'adult',
      season = 'all',
      material_composition = {},
      sustainability_info = {},
      images = [],
      videos = [],
      inventory_tracking = true,
      stock_quantity = 0,
      low_stock_threshold = 5,
      seo_title,
      seo_description,
      seo_keywords = []
    } = productData;

    // Générer un slug unique
    const baseSlug = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
    
    let slug = baseSlug;
    let counter = 1;
    
    while (await this.findBySlug(slug, store_id)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const [product] = await db('products')
      .insert({
        name,
        slug,
        description,
        short_description,
        sku,
        barcode,
        store_id,
        category_id,
        price,
        compare_at_price,
        cost_price,
        currency,
        fabric_type,
        fabric_origin,
        cultural_significance: JSON.stringify(cultural_significance),
        care_instructions,
        dimensions: JSON.stringify(dimensions),
        weight,
        color_options: JSON.stringify(color_options),
        size_options: JSON.stringify(size_options),
        style_tags: JSON.stringify(style_tags),
        occasion_tags: JSON.stringify(occasion_tags),
        gender_target,
        age_group,
        season,
        material_composition: JSON.stringify(material_composition),
        sustainability_info: JSON.stringify(sustainability_info),
        images: JSON.stringify(images),
        videos: JSON.stringify(videos),
        inventory_tracking,
        stock_quantity,
        low_stock_threshold,
        seo_title: seo_title || name,
        seo_description: seo_description || short_description,
        seo_keywords: JSON.stringify(seo_keywords),
        status: 'draft'
      })
      .returning('*');

    return this.formatProduct(product);
  }

  /**
   * Trouver un produit par ID
   */
  static async findById(id) {
    const product = await db('products')
      .select('products.*', 'stores.name as store_name', 'stores.slug as store_slug', 'categories.name as category_name')
      .leftJoin('stores', 'products.store_id', 'stores.id')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .where('products.id', id)
      .whereNull('products.deleted_at')
      .first();

    return product ? this.formatProduct(product) : null;
  }

  /**
   * Trouver un produit par slug
   */
  static async findBySlug(slug, storeId = null) {
    let query = db('products')
      .select('products.*', 'stores.name as store_name', 'stores.slug as store_slug', 'categories.name as category_name')
      .leftJoin('stores', 'products.store_id', 'stores.id')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .where('products.slug', slug)
      .whereNull('products.deleted_at');

    if (storeId) {
      query = query.where('products.store_id', storeId);
    }

    const product = await query.first();
    return product ? this.formatProduct(product) : null;
  }

  /**
   * Obtenir tous les produits avec filtres avancés
   */
  static async getAll(options = {}) {
    const {
      page = 1,
      limit = 12,
      store_id = null,
      category_id = null,
      status = 'active',
      fabric_type = null,
      fabric_origin = null,
      gender_target = null,
      age_group = null,
      season = null,
      price_min = null,
      price_max = null,
      in_stock = null,
      search = null,
      sort = 'created_at',
      order = 'desc'
    } = options;

    let query = db('products')
      .select('products.*', 'stores.name as store_name', 'stores.slug as store_slug', 'categories.name as category_name')
      .leftJoin('stores', 'products.store_id', 'stores.id')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .whereNull('products.deleted_at')
      .where('stores.status', 'active');

    // Filtres
    if (store_id) query = query.where('products.store_id', store_id);
    if (category_id) query = query.where('products.category_id', category_id);
    if (status) query = query.where('products.status', status);
    if (fabric_type) query = query.where('products.fabric_type', fabric_type);
    if (fabric_origin) query = query.where('products.fabric_origin', fabric_origin);
    if (gender_target) query = query.where('products.gender_target', gender_target);
    if (age_group) query = query.where('products.age_group', age_group);
    if (season) query = query.where('products.season', season);
    if (price_min) query = query.where('products.price', '>=', price_min);
    if (price_max) query = query.where('products.price', '<=', price_max);
    if (in_stock === true) query = query.where('products.stock_quantity', '>', 0);
    if (in_stock === false) query = query.where('products.stock_quantity', '<=', 0);
    
    if (search) {
      query = query.where(function() {
        this.where('products.name', 'ilike', `%${search}%`)
          .orWhere('products.description', 'ilike', `%${search}%`)
          .orWhere('products.fabric_type', 'ilike', `%${search}%`)
          .orWhere('products.fabric_origin', 'ilike', `%${search}%`);
      });
    }

    // Tri
    const validSorts = ['created_at', 'name', 'price', 'stock_quantity', 'total_sales'];
    const sortField = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = ['asc', 'desc'].includes(order) ? order : 'desc';
    
    query = query.orderBy(`products.${sortField}`, sortOrder);

    // Pagination
    const offset = (page - 1) * limit;
    const products = await query.limit(limit).offset(offset);

    // Compter le total
    const totalQuery = db('products')
      .leftJoin('stores', 'products.store_id', 'stores.id')
      .whereNull('products.deleted_at')
      .where('stores.status', 'active');

    // Appliquer les mêmes filtres pour le count
    if (store_id) totalQuery.where('products.store_id', store_id);
    if (category_id) totalQuery.where('products.category_id', category_id);
    if (status) totalQuery.where('products.status', status);
    if (fabric_type) totalQuery.where('products.fabric_type', fabric_type);
    if (fabric_origin) totalQuery.where('products.fabric_origin', fabric_origin);
    if (gender_target) totalQuery.where('products.gender_target', gender_target);
    if (age_group) totalQuery.where('products.age_group', age_group);
    if (season) totalQuery.where('products.season', season);
    if (price_min) totalQuery.where('products.price', '>=', price_min);
    if (price_max) totalQuery.where('products.price', '<=', price_max);
    if (in_stock === true) totalQuery.where('products.stock_quantity', '>', 0);
    if (in_stock === false) totalQuery.where('products.stock_quantity', '<=', 0);
    
    if (search) {
      totalQuery.where(function() {
        this.where('products.name', 'ilike', `%${search}%`)
          .orWhere('products.description', 'ilike', `%${search}%`)
          .orWhere('products.fabric_type', 'ilike', `%${search}%`)
          .orWhere('products.fabric_origin', 'ilike', `%${search}%`);
      });
    }
    
    const [{ count }] = await totalQuery.count('products.id as count');
    const total = parseInt(count);

    return {
      products: products.map(product => this.formatProduct(product)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Obtenir les produits similaires
   */
  static async getSimilar(productId, limit = 6) {
    const product = await this.findById(productId);
    if (!product) return [];

    const similar = await db('products')
      .select('products.*', 'stores.name as store_name', 'categories.name as category_name')
      .leftJoin('stores', 'products.store_id', 'stores.id')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .where('products.category_id', product.category_id)
      .where('products.id', '!=', productId)
      .where('products.status', 'active')
      .whereNull('products.deleted_at')
      .where('stores.status', 'active')
      .orderByRaw('RANDOM()')
      .limit(limit);

    return similar.map(p => this.formatProduct(p));
  }

  /**
   * Mettre à jour un produit
   */
  static async update(id, updateData) {
    const allowedFields = [
      'name', 'description', 'short_description', 'sku', 'barcode', 'category_id',
      'price', 'compare_at_price', 'cost_price', 'fabric_type', 'fabric_origin',
      'cultural_significance', 'care_instructions', 'dimensions', 'weight',
      'color_options', 'size_options', 'style_tags', 'occasion_tags',
      'gender_target', 'age_group', 'season', 'material_composition',
      'sustainability_info', 'images', 'videos', 'seo_title', 'seo_description',
      'seo_keywords', 'status'
    ];

    const filteredData = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (typeof updateData[field] === 'object') {
          filteredData[field] = JSON.stringify(updateData[field]);
        } else {
          filteredData[field] = updateData[field];
        }
      }
    }

    // Générer un nouveau slug si le nom change
    if (updateData.name) {
      const currentProduct = await this.findById(id);
      const baseSlug = updateData.name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim();
      
      let slug = baseSlug;
      let counter = 1;
      
      while (true) {
        const existing = await db('products')
          .where({ slug })
          .where('store_id', currentProduct.store_id)
          .where('id', '!=', id)
          .first();
        
        if (!existing) break;
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      
      filteredData.slug = slug;
    }

    filteredData.updated_at = db.fn.now();

    const [product] = await db('products')
      .where({ id })
      .whereNull('deleted_at')
      .update(filteredData)
      .returning('*');

    return product ? this.formatProduct(product) : null;
  }

  /**
   * Gestion du stock
   */
  static async updateStock(id, quantity, operation = 'set') {
    const product = await this.findById(id);
    if (!product) return null;

    let newQuantity;
    switch (operation) {
      case 'add':
        newQuantity = product.stock_quantity + quantity;
        break;
      case 'subtract':
        newQuantity = Math.max(0, product.stock_quantity - quantity);
        break;
      case 'set':
      default:
        newQuantity = quantity;
    }

    const [updatedProduct] = await db('products')
      .where({ id })
      .update({
        stock_quantity: newQuantity,
        updated_at: db.fn.now()
      })
      .returning('*');

    return this.formatProduct(updatedProduct);
  }

  /**
   * Obtenir les produits en rupture de stock
   */
  static async getLowStock(storeId = null) {
    let query = db('products')
      .select('products.*', 'stores.name as store_name')
      .leftJoin('stores', 'products.store_id', 'stores.id')
      .whereRaw('products.stock_quantity <= products.low_stock_threshold')
      .where('products.inventory_tracking', true)
      .where('products.status', 'active')
      .whereNull('products.deleted_at');

    if (storeId) {
      query = query.where('products.store_id', storeId);
    }

    const products = await query.orderBy('products.stock_quantity', 'asc');
    return products.map(product => this.formatProduct(product));
  }

  /**
   * Obtenir les avis d'un produit
   */
  static async getReviews(productId, options = {}) {
    const { page = 1, limit = 10 } = options;

    const offset = (page - 1) * limit;
    const reviews = await db('reviews')
      .select('reviews.*', 'users.first_name', 'users.last_name', 'users.avatar_url')
      .leftJoin('users', 'reviews.user_id', 'users.id')
      .where('reviews.product_id', productId)
      .whereNull('reviews.deleted_at')
      .orderBy('reviews.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return reviews;
  }

  /**
   * Calculer la note moyenne d'un produit
   */
  static async calculateRating(productId) {
    const [result] = await db('reviews')
      .select(
        db.raw('COUNT(*) as total_reviews'),
        db.raw('AVG(rating) as average_rating'),
        db.raw('COUNT(*) FILTER (WHERE rating = 1) as rating_1'),
        db.raw('COUNT(*) FILTER (WHERE rating = 2) as rating_2'),
        db.raw('COUNT(*) FILTER (WHERE rating = 3) as rating_3'),
        db.raw('COUNT(*) FILTER (WHERE rating = 4) as rating_4'),
        db.raw('COUNT(*) FILTER (WHERE rating = 5) as rating_5')
      )
      .where({ product_id: productId })
      .whereNull('deleted_at');

    return {
      total_reviews: parseInt(result.total_reviews) || 0,
      average_rating: parseFloat(result.average_rating) || 0,
      rating_distribution: {
        1: parseInt(result.rating_1) || 0,
        2: parseInt(result.rating_2) || 0,
        3: parseInt(result.rating_3) || 0,
        4: parseInt(result.rating_4) || 0,
        5: parseInt(result.rating_5) || 0
      }
    };
  }

  /**
   * Supprimer un produit (soft delete)
   */
  static async delete(id) {
    await db('products')
      .where({ id })
      .update({
        deleted_at: db.fn.now(),
        status: 'archived'
      });

    return true;
  }

  /**
   * Formater les données de produit
   */
  static formatProduct(product) {
    if (!product) return null;

    const formatted = { ...product };

    // Parser les champs JSON
    const jsonFields = [
      'cultural_significance', 'dimensions', 'color_options', 'size_options',
      'style_tags', 'occasion_tags', 'material_composition', 'sustainability_info',
      'images', 'videos', 'seo_keywords'
    ];

    jsonFields.forEach(field => {
      try {
        if (formatted[field] && typeof formatted[field] === 'string') {
          formatted[field] = JSON.parse(formatted[field]);
        }
      } catch (error) {
        console.error(`Erreur lors du parsing de ${field}:`, error);
        formatted[field] = [];
      }
    });

    return formatted;
  }

  /**
   * Recherche de produits par tags culturels
   */
  static async findByCulturalTags(tags, limit = 12) {
    const products = await db('products')
      .select('products.*', 'stores.name as store_name', 'categories.name as category_name')
      .leftJoin('stores', 'products.store_id', 'stores.id')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .where('products.status', 'active')
      .whereNull('products.deleted_at')
      .where('stores.status', 'active')
      .where(function() {
        tags.forEach(tag => {
          this.orWhereRaw("products.cultural_significance::text ILIKE ?", [`%${tag}%`]);
        });
      })
      .limit(limit);

    return products.map(product => this.formatProduct(product));
  }

  /**
   * Obtenir les statistiques des produits
   */
  static async getStats(storeId = null) {
    let query = db('products');
    
    if (storeId) {
      query = query.where({ store_id: storeId });
    }
    
    const [stats] = await query
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('COUNT(*) FILTER (WHERE status = \'active\') as active'),
        db.raw('COUNT(*) FILTER (WHERE status = \'draft\') as draft'),
        db.raw('COUNT(*) FILTER (WHERE stock_quantity <= low_stock_threshold AND inventory_tracking = true) as low_stock'),
        db.raw('COUNT(*) FILTER (WHERE stock_quantity = 0 AND inventory_tracking = true) as out_of_stock'),
        db.raw('AVG(price) as average_price')
      )
      .whereNull('deleted_at');

    return {
      total: parseInt(stats.total) || 0,
      active: parseInt(stats.active) || 0,
      draft: parseInt(stats.draft) || 0,
      low_stock: parseInt(stats.low_stock) || 0,
      out_of_stock: parseInt(stats.out_of_stock) || 0,
      average_price: parseFloat(stats.average_price) || 0
    };
  }
}

module.exports = Product;
