const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Modèle Store - Gestion des boutiques
 */
class Store {
  /**
   * Créer une nouvelle boutique
   */
  static async create(storeData) {
    const {
      name,
      description,
      short_description,
      owner_id,
      email,
      phone,
      whatsapp,
      website,
      social_links = {},
      country = 'TG',
      region,
      city,
      address,
      postal_code,
      latitude,
      longitude,
      business_type = 'fashion',
      specialties = [],
      brand_story,
      operating_hours = {},
      delivery_zones = [],
      delivery_fee = 0,
      min_order_amount = 0,
      return_policy,
      theme_color = '#8B2E2E',
      brand_colors = {}
    } = storeData;

    // Générer un slug unique
    const baseSlug = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
    
    let slug = baseSlug;
    let counter = 1;
    
    // Vérifier l'unicité du slug
    while (await this.findBySlug(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const [store] = await db('stores')
      .insert({
        name,
        slug,
        description,
        short_description,
        owner_id,
        email,
        phone,
        whatsapp,
        website,
        social_links: JSON.stringify(social_links),
        country,
        region,
        city,
        address,
        postal_code,
        latitude,
        longitude,
        business_type,
        specialties: JSON.stringify(specialties),
        brand_story,
        operating_hours: JSON.stringify(operating_hours),
        delivery_zones: JSON.stringify(delivery_zones),
        delivery_fee,
        min_order_amount,
        return_policy,
        theme_color,
        brand_colors: JSON.stringify(brand_colors),
        status: 'pending',
        is_verified: false
      })
      .returning('*');

    return this.formatStore(store);
  }

  /**
   * Trouver une boutique par ID
   */
  static async findById(id) {
    const store = await db('stores')
      .select('stores.*', 'users.first_name', 'users.last_name', 'users.email as owner_email')
      .leftJoin('users', 'stores.owner_id', 'users.id')
      .where('stores.id', id)
      .whereNull('stores.deleted_at')
      .first();

    return store ? this.formatStore(store) : null;
  }

  /**
   * Trouver une boutique par slug
   */
  static async findBySlug(slug) {
    const store = await db('stores')
      .select('*')
      .where({ slug })
      .whereNull('deleted_at')
      .first();

    return store ? this.formatStore(store) : null;
  }

  /**
   * Obtenir toutes les boutiques avec filtres
   */
  static async getAll(options = {}) {
    const {
      page = 1,
      limit = 12,
      status = null,
      country = null,
      city = null,
      business_type = null,
      is_verified = null,
      search = null,
      sort = 'created_at',
      order = 'desc'
    } = options;

    let query = db('stores')
      .select('stores.*', 'users.first_name', 'users.last_name')
      .leftJoin('users', 'stores.owner_id', 'users.id')
      .whereNull('stores.deleted_at');

    // Filtres
    if (status) query = query.where('stores.status', status);
    if (country) query = query.where('stores.country', country);
    if (city) query = query.where('stores.city', 'ilike', `%${city}%`);
    if (business_type) query = query.where('stores.business_type', business_type);
    if (is_verified !== null) query = query.where('stores.is_verified', is_verified);
    
    if (search) {
      query = query.where(function() {
        this.where('stores.name', 'ilike', `%${search}%`)
          .orWhere('stores.description', 'ilike', `%${search}%`)
          .orWhere('stores.short_description', 'ilike', `%${search}%`);
      });
    }

    // Tri
    const validSorts = ['created_at', 'name', 'rating', 'total_sales'];
    const sortField = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = ['asc', 'desc'].includes(order) ? order : 'desc';
    
    query = query.orderBy(`stores.${sortField}`, sortOrder);

    // Pagination
    const offset = (page - 1) * limit;
    const stores = await query.limit(limit).offset(offset);

    // Compter le total
    const totalQuery = db('stores').whereNull('deleted_at');
    if (status) totalQuery.where('status', status);
    if (country) totalQuery.where('country', country);
    if (city) totalQuery.where('city', 'ilike', `%${city}%`);
    if (business_type) totalQuery.where('business_type', business_type);
    if (is_verified !== null) totalQuery.where('is_verified', is_verified);
    if (search) {
      totalQuery.where(function() {
        this.where('name', 'ilike', `%${search}%`)
          .orWhere('description', 'ilike', `%${search}%`)
          .orWhere('short_description', 'ilike', `%${search}%`);
      });
    }
    
    const [{ count }] = await totalQuery.count('* as count');
    const total = parseInt(count);

    return {
      stores: stores.map(store => this.formatStore(store)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Obtenir les boutiques d'un propriétaire
   */
  static async getByOwner(ownerId) {
    const stores = await db('stores')
      .select('*')
      .where({ owner_id: ownerId })
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc');

    return stores.map(store => this.formatStore(store));
  }

  /**
   * Mettre à jour une boutique
   */
  static async update(id, updateData) {
    const allowedFields = [
      'name', 'description', 'short_description', 'logo_url', 'banner_url',
      'email', 'phone', 'whatsapp', 'website', 'social_links', 'region', 'city',
      'address', 'postal_code', 'latitude', 'longitude', 'specialties',
      'brand_story', 'operating_hours', 'delivery_zones', 'delivery_fee',
      'min_order_amount', 'return_policy', 'theme_color', 'brand_colors'
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
      const baseSlug = updateData.name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim();
      
      let slug = baseSlug;
      let counter = 1;
      
      while (true) {
        const existing = await db('stores')
          .where({ slug })
          .where('id', '!=', id)
          .first();
        
        if (!existing) break;
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      
      filteredData.slug = slug;
    }

    filteredData.updated_at = db.fn.now();

    const [store] = await db('stores')
      .where({ id })
      .whereNull('deleted_at')
      .update(filteredData)
      .returning('*');

    return store ? this.formatStore(store) : null;
  }

  /**
   * Obtenir les produits d'une boutique
   */
  static async getProducts(storeId, options = {}) {
    const { page = 1, limit = 12, status = 'active', category_id = null } = options;

    let query = db('products')
      .select('products.*', 'categories.name as category_name')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .where('products.store_id', storeId)
      .where('products.status', status)
      .whereNull('products.deleted_at');

    if (category_id) {
      query = query.where('products.category_id', category_id);
    }

    const offset = (page - 1) * limit;
    const products = await query
      .orderBy('products.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return products;
  }

  /**
   * Obtenir les statistiques d'une boutique
   */
  static async getStats(storeId) {
    const [productStats] = await db('products')
      .select(
        db.raw('COUNT(*) as total_products'),
        db.raw('COUNT(*) FILTER (WHERE status = \'active\') as active_products'),
        db.raw('COUNT(*) FILTER (WHERE status = \'draft\') as draft_products')
      )
      .where({ store_id: storeId })
      .whereNull('deleted_at');

    const [orderStats] = await db('orders')
      .join('order_items', 'orders.id', 'order_items.order_id')
      .join('products', 'order_items.product_id', 'products.id')
      .select(
        db.raw('COUNT(DISTINCT orders.id) as total_orders'),
        db.raw('SUM(order_items.quantity) as total_items_sold'),
        db.raw('SUM(order_items.price * order_items.quantity) as total_revenue')
      )
      .where('products.store_id', storeId)
      .whereNull('orders.deleted_at');

    const [reviewStats] = await db('reviews')
      .join('products', 'reviews.product_id', 'products.id')
      .select(
        db.raw('COUNT(*) as total_reviews'),
        db.raw('AVG(reviews.rating) as average_rating')
      )
      .where('products.store_id', storeId);

    return {
      products: {
        total: parseInt(productStats.total_products) || 0,
        active: parseInt(productStats.active_products) || 0,
        draft: parseInt(productStats.draft_products) || 0
      },
      orders: {
        total: parseInt(orderStats.total_orders) || 0,
        items_sold: parseInt(orderStats.total_items_sold) || 0,
        revenue: parseFloat(orderStats.total_revenue) || 0
      },
      reviews: {
        total: parseInt(reviewStats.total_reviews) || 0,
        average_rating: parseFloat(reviewStats.average_rating) || 0
      }
    };
  }

  /**
   * Vérifier une boutique
   */
  static async verify(id) {
    const [store] = await db('stores')
      .where({ id })
      .update({
        is_verified: true,
        verified_at: db.fn.now(),
        status: 'active',
        updated_at: db.fn.now()
      })
      .returning('*');

    return store ? this.formatStore(store) : null;
  }

  /**
   * Suspendre une boutique
   */
  static async suspend(id, reason = null) {
    const [store] = await db('stores')
      .where({ id })
      .update({
        status: 'suspended',
        suspension_reason: reason,
        suspended_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');

    return store ? this.formatStore(store) : null;
  }

  /**
   * Supprimer une boutique (soft delete)
   */
  static async delete(id) {
    await db('stores')
      .where({ id })
      .update({
        deleted_at: db.fn.now(),
        status: 'closed'
      });

    return true;
  }

  /**
   * Formater les données de boutique
   */
  static formatStore(store) {
    if (!store) return null;

    const formatted = { ...store };

    // Parser les champs JSON
    try {
      if (formatted.social_links && typeof formatted.social_links === 'string') {
        formatted.social_links = JSON.parse(formatted.social_links);
      }
      if (formatted.specialties && typeof formatted.specialties === 'string') {
        formatted.specialties = JSON.parse(formatted.specialties);
      }
      if (formatted.operating_hours && typeof formatted.operating_hours === 'string') {
        formatted.operating_hours = JSON.parse(formatted.operating_hours);
      }
      if (formatted.delivery_zones && typeof formatted.delivery_zones === 'string') {
        formatted.delivery_zones = JSON.parse(formatted.delivery_zones);
      }
      if (formatted.brand_colors && typeof formatted.brand_colors === 'string') {
        formatted.brand_colors = JSON.parse(formatted.brand_colors);
      }
    } catch (error) {
      console.error('Erreur lors du parsing JSON:', error);
    }

    return formatted;
  }

  /**
   * Recherche de boutiques par proximité géographique
   */
  static async findNearby(latitude, longitude, radiusKm = 50, limit = 10) {
    const stores = await db('stores')
      .select('*')
      .select(db.raw(`
        (6371 * acos(
          cos(radians(?)) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians(?)) + 
          sin(radians(?)) * sin(radians(latitude))
        )) AS distance
      `, [latitude, longitude, latitude]))
      .whereNotNull('latitude')
      .whereNotNull('longitude')
      .where('status', 'active')
      .whereNull('deleted_at')
      .havingRaw('distance < ?', [radiusKm])
      .orderBy('distance')
      .limit(limit);

    return stores.map(store => this.formatStore(store));
  }
}

module.exports = Store;
