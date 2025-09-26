const db = require('../config/database');
const { cache, CACHE_KEYS } = require('../config/redis');
const { asyncHandler, commonErrors } = require('../middleware/errorHandler');
const { uploadService } = require('../services/uploadService');

/**
 * Récupérer toutes les boutiques avec filtres et pagination
 * GET /api/stores
 */
const getAllStores = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    country,
    city,
    search,
    status = 'active',
    verified,
    featured,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = req.query;

  // Vérifier le cache
  const cacheKey = `${CACHE_KEYS.STORES}:list:${JSON.stringify(req.query)}`;
  const cachedStores = await cache.get(cacheKey);
  
  if (cachedStores) {
    return res.json({
      success: true,
      data: cachedStores.data,
      pagination: cachedStores.pagination
    });
  }

  // Construire la requête de base
  let query = db('stores')
    .select([
      'stores.id',
      'stores.name',
      'stores.slug',
      'stores.short_description',
      'stores.logo_url',
      'stores.banner_url',
      'stores.theme_color',
      'stores.country',
      'stores.region',
      'stores.city',
      'stores.status',
      'stores.is_verified',
      'stores.featured',
      'stores.average_rating',
      'stores.total_reviews',
      'stores.total_products',
      'stores.total_orders',
      'stores.followers_count',
      'stores.created_at',
      'users.first_name as owner_first_name',
      'users.last_name as owner_last_name'
    ])
    .leftJoin('users', 'stores.owner_id', 'users.id')
    .where('stores.status', status)
    .whereNull('stores.deleted_at');

  // Appliquer les filtres
  if (country) {
    query = query.where('stores.country', country);
  }

  if (city) {
    query = query.whereILike('stores.city', `%${city}%`);
  }

  if (search) {
    query = query.where(function() {
      this.whereILike('stores.name', `%${search}%`)
        .orWhereILike('stores.description', `%${search}%`)
        .orWhereILike('stores.city', `%${search}%`);
    });
  }

  if (verified === 'true') {
    query = query.where('stores.is_verified', true);
  } else if (verified === 'false') {
    query = query.where('stores.is_verified', false);
  }

  if (featured === 'true') {
    query = query.where('stores.featured', true);
  }

  // Tri
  const validSortFields = ['name', 'created_at', 'average_rating', 'total_products', 'total_orders'];
  const sortField = validSortFields.includes(sortBy) ? `stores.${sortBy}` : 'stores.created_at';
  const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';
  
  query = query.orderBy(sortField, order);

  // Si tri par featured, les mettre en premier
  if (featured !== 'false') {
    query = query.orderBy('stores.featured', 'desc');
  }

  // Pagination
  const result = await db.helpers.paginate(query, page, limit);

  // Formater les résultats
  const stores = result.data.map(store => ({
    id: store.id,
    name: store.name,
    slug: store.slug,
    shortDescription: store.short_description,
    logoUrl: store.logo_url,
    bannerUrl: store.banner_url,
    themeColor: store.theme_color,
    location: {
      country: store.country,
      region: store.region,
      city: store.city
    },
    status: store.status,
    isVerified: store.is_verified,
    featured: store.featured,
    rating: {
      average: store.average_rating ? parseFloat(store.average_rating) : 0,
      count: store.total_reviews || 0
    },
    stats: {
      products: store.total_products || 0,
      orders: store.total_orders || 0,
      followers: store.followers_count || 0
    },
    owner: {
      firstName: store.owner_first_name,
      lastName: store.owner_last_name
    },
    createdAt: store.created_at
  }));

  const responseData = {
    data: stores,
    pagination: result.pagination
  };

  // Mettre en cache
  await cache.set(cacheKey, responseData, 900); // 15 minutes

  res.json({
    success: true,
    ...responseData
  });
});

/**
 * Récupérer une boutique par ID ou slug
 * GET /api/stores/:id
 */
const getStoreById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Vérifier le cache
  const cacheKey = `${CACHE_KEYS.STORES}:${id}`;
  const cachedStore = await cache.get(cacheKey);
  
  if (cachedStore) {
    return res.json({
      success: true,
      data: cachedStore
    });
  }

  // Déterminer si c'est un UUID ou un slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const whereClause = isUuid ? { 'stores.id': id } : { 'stores.slug': id };

  const store = await db('stores')
    .select([
      'stores.*',
      'users.first_name as owner_first_name',
      'users.last_name as owner_last_name',
      'users.email as owner_email',
      'users.phone as owner_phone',
      'users.avatar_url as owner_avatar'
    ])
    .leftJoin('users', 'stores.owner_id', 'users.id')
    .where(whereClause)
    .whereNull('stores.deleted_at')
    .first();

  if (!store) {
    throw commonErrors.notFound('Boutique');
  }

  // Récupérer quelques produits en vedette de la boutique
  const featuredProducts = await db('products')
    .select([
      'id', 'name', 'slug', 'price', 'primary_image', 
      'average_rating', 'reviews_count'
    ])
    .where('store_id', store.id)
    .where('status', 'active')
    .where('featured', true)
    .whereNull('deleted_at')
    .orderBy('created_at', 'desc')
    .limit(6);

  // Statistiques de la boutique
  const stats = await db('products')
    .where('store_id', store.id)
    .where('status', 'active')
    .whereNull('deleted_at')
    .select([
      db.raw('COUNT(*) as total_products'),
      db.raw('AVG(average_rating) as avg_product_rating'),
      db.raw('SUM(sales_count) as total_sales')
    ])
    .first();

  // Formater la réponse
  const formattedStore = {
    id: store.id,
    name: store.name,
    slug: store.slug,
    description: store.description,
    shortDescription: store.short_description,
    
    // Images et branding
    logoUrl: store.logo_url,
    bannerUrl: store.banner_url,
    themeColor: store.theme_color,
    brandColors: store.brand_colors,
    
    // Contact
    email: store.email,
    phone: store.phone,
    whatsapp: store.whatsapp,
    website: store.website,
    socialLinks: store.social_links,
    
    // Localisation
    location: {
      country: store.country,
      region: store.region,
      city: store.city,
      address: store.address,
      postalCode: store.postal_code,
      coordinates: store.latitude && store.longitude ? {
        lat: parseFloat(store.latitude),
        lng: parseFloat(store.longitude)
      } : null
    },
    
    // Informations business
    businessInfo: {
      registrationNumber: store.business_registration_number,
      taxNumber: store.tax_number,
      businessType: store.business_type
    },
    
    // Statut et paramètres
    status: store.status,
    isVerified: store.is_verified,
    featured: store.featured,
    commissionRate: store.commission_rate ? parseFloat(store.commission_rate) : 10,
    
    // Politiques
    returnPolicy: store.return_policy,
    shippingPolicy: store.shipping_policy,
    privacyPolicy: store.privacy_policy,
    termsConditions: store.terms_conditions,
    
    // Langues et devises
    languages: {
      default: store.default_language,
      supported: store.supported_languages || ['fr']
    },
    currencies: {
      default: store.default_currency,
      accepted: store.accepted_currencies || ['FCFA']
    },
    
    // Méthodes de paiement
    paymentMethods: store.payment_methods || [],
    
    // Statistiques
    stats: {
      totalProducts: parseInt(stats.total_products) || 0,
      totalOrders: store.total_orders || 0,
      totalRevenue: store.total_revenue ? parseFloat(store.total_revenue) : 0,
      totalSales: parseInt(stats.total_sales) || 0,
      followersCount: store.followers_count || 0
    },
    
    // Évaluations
    rating: {
      average: store.average_rating ? parseFloat(store.average_rating) : 0,
      count: store.total_reviews || 0,
      productAverage: stats.avg_product_rating ? parseFloat(stats.avg_product_rating) : 0
    },
    
    // SEO
    seo: {
      metaTitle: store.meta_title,
      metaDescription: store.meta_description,
      metaKeywords: store.meta_keywords
    },
    
    // Horaires d'ouverture
    openingHours: store.opening_hours,
    timezone: store.timezone,
    
    // Propriétaire
    owner: {
      firstName: store.owner_first_name,
      lastName: store.owner_last_name,
      email: store.owner_email,
      phone: store.owner_phone,
      avatar: store.owner_avatar
    },
    
    // Produits en vedette
    featuredProducts: featuredProducts.map(product => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: parseFloat(product.price),
      primaryImage: product.primary_image,
      rating: {
        average: product.average_rating ? parseFloat(product.average_rating) : 0,
        count: product.reviews_count || 0
      }
    })),
    
    // Traductions
    translations: store.translations,
    
    // Dates
    createdAt: store.created_at,
    updatedAt: store.updated_at
  };

  // Mettre en cache
  await cache.set(cacheKey, formattedStore, 1800); // 30 minutes

  res.json({
    success: true,
    data: formattedStore
  });
});

/**
 * Créer une nouvelle boutique
 * POST /api/stores
 */
const createStore = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    shortDescription,
    email,
    phone,
    whatsapp,
    website,
    country = 'TG',
    region,
    city,
    address,
    postalCode,
    businessType = 'individual',
    returnPolicy,
    shippingPolicy,
    defaultLanguage = 'fr',
    defaultCurrency = 'FCFA'
  } = req.body;

  // Validation des champs requis
  if (!name || !description || !city || !address) {
    throw commonErrors.validation({
      name: !name ? 'Nom de boutique requis' : null,
      description: !description ? 'Description requise' : null,
      city: !city ? 'Ville requise' : null,
      address: !address ? 'Adresse requise' : null
    });
  }

  // Vérifier que l'utilisateur n'a pas déjà une boutique (sauf admin)
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    const existingStore = await db('stores')
      .where({ owner_id: req.user.id })
      .whereNull('deleted_at')
      .first();

    if (existingStore) {
      throw commonErrors.conflict('Vous avez déjà une boutique enregistrée');
    }
  }

  // Générer un slug unique
  let slug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const existingSlug = await db('stores')
    .where({ slug })
    .whereNull('deleted_at')
    .first();

  if (existingSlug) {
    slug = `${slug}-${Date.now()}`;
  }

  try {
    // Créer la boutique
    const [store] = await db('stores')
      .insert({
        name,
        slug,
        description,
        short_description: shortDescription,
        owner_id: req.user.id,
        email: email || req.user.email,
        phone: phone || req.user.phone,
        whatsapp,
        website,
        country,
        region,
        city,
        address,
        postal_code: postalCode,
        business_type: businessType,
        status: 'pending', // Nécessite validation
        is_verified: false,
        return_policy: returnPolicy,
        shipping_policy: shippingPolicy,
        default_language: defaultLanguage,
        supported_languages: JSON.stringify([defaultLanguage]),
        default_currency: defaultCurrency,
        accepted_currencies: JSON.stringify([defaultCurrency]),
        payment_methods: JSON.stringify(['cash_on_delivery']),
        theme_color: '#8B2E2E',
        created_by: req.user.id,
        tenant_id: req.user.tenantId
      })
      .returning('*');

    // Mettre à jour le rôle de l'utilisateur s'il était client
    if (req.user.role === 'customer') {
      await db('users')
        .where({ id: req.user.id })
        .update({ role: 'vendor' });
    }

    // Invalider les caches
    await cache.delPattern(`${CACHE_KEYS.STORES}*`);

    res.status(201).json({
      success: true,
      message: 'Boutique créée avec succès. Elle sera activée après validation.',
      data: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        status: store.status,
        isVerified: store.is_verified,
        createdAt: store.created_at
      }
    });

  } catch (error) {
    console.error('Erreur création boutique:', error);
    throw error;
  }
});

/**
 * Mettre à jour une boutique
 * PUT /api/stores/:id
 */
const updateStore = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  // Vérifier que la boutique existe
  const store = await db('stores')
    .where({ id })
    .whereNull('deleted_at')
    .first();

  if (!store) {
    throw commonErrors.notFound('Boutique');
  }

  // Vérifier les permissions
  if (!['admin', 'super_admin'].includes(req.user.role) && store.owner_id !== req.user.id) {
    throw commonErrors.forbidden('Vous ne pouvez modifier que votre propre boutique');
  }

  // Supprimer les champs non modifiables
  delete updateData.id;
  delete updateData.slug;
  delete updateData.owner_id;
  delete updateData.created_at;
  delete updateData.total_orders;
  delete updateData.total_revenue;

  // Seuls les admins peuvent modifier certains champs
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    delete updateData.status;
    delete updateData.is_verified;
    delete updateData.featured;
    delete updateData.commission_rate;
  }

  // Ajouter les métadonnées de mise à jour
  updateData.updated_at = db.fn.now();
  updateData.updated_by = req.user.id;

  try {
    // Mettre à jour la boutique
    const [updatedStore] = await db('stores')
      .where({ id })
      .update(updateData)
      .returning('*');

    // Invalider les caches
    await cache.delPattern(`${CACHE_KEYS.STORES}*`);
    await cache.del(`${CACHE_KEYS.STORES}:${id}`);

    res.json({
      success: true,
      message: 'Boutique mise à jour avec succès',
      data: updatedStore
    });

  } catch (error) {
    console.error('Erreur mise à jour boutique:', error);
    throw error;
  }
});

/**
 * Récupérer les produits d'une boutique
 * GET /api/stores/:id/products
 */
const getStoreProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    page = 1,
    limit = 20,
    category,
    status = 'active',
    featured,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = req.query;

  // Vérifier que la boutique existe
  const store = await db('stores')
    .where({ id })
    .whereNull('deleted_at')
    .first();

  if (!store) {
    throw commonErrors.notFound('Boutique');
  }

  // Construire la requête des produits
  let query = db('products')
    .select([
      'products.id',
      'products.name',
      'products.slug',
      'products.price',
      'products.compare_at_price',
      'products.primary_image',
      'products.stock_quantity',
      'products.featured',
      'products.average_rating',
      'products.reviews_count',
      'products.sales_count',
      'products.created_at',
      'categories.name as category_name',
      'categories.slug as category_slug'
    ])
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .where('products.store_id', id)
    .where('products.status', status)
    .whereNull('products.deleted_at');

  // Appliquer les filtres
  if (category) {
    query = query.where('categories.slug', category);
  }

  if (featured === 'true') {
    query = query.where('products.featured', true);
  }

  // Tri
  const validSortFields = ['name', 'price', 'created_at', 'average_rating', 'sales_count'];
  const sortField = validSortFields.includes(sortBy) ? `products.${sortBy}` : 'products.created_at';
  const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';
  
  query = query.orderBy(sortField, order);

  // Pagination
  const result = await db.helpers.paginate(query, page, limit);

  res.json({
    success: true,
    data: result.data.map(product => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: parseFloat(product.price),
      compareAtPrice: product.compare_at_price ? parseFloat(product.compare_at_price) : null,
      primaryImage: product.primary_image,
      stockQuantity: product.stock_quantity,
      featured: product.featured,
      rating: {
        average: product.average_rating ? parseFloat(product.average_rating) : 0,
        count: product.reviews_count || 0
      },
      salesCount: product.sales_count || 0,
      category: product.category_name ? {
        name: product.category_name,
        slug: product.category_slug
      } : null,
      createdAt: product.created_at
    })),
    pagination: result.pagination,
    store: {
      id: store.id,
      name: store.name,
      slug: store.slug
    }
  });
});

/**
 * Upload des images de boutique
 * POST /api/stores/:id/images
 */
const uploadStoreImages = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Vérifier que la boutique existe et appartient à l'utilisateur
  const store = await db('stores')
    .where({ id })
    .whereNull('deleted_at')
    .first();

  if (!store) {
    throw commonErrors.notFound('Boutique');
  }

  if (!['admin', 'super_admin'].includes(req.user.role) && store.owner_id !== req.user.id) {
    throw commonErrors.forbidden('Vous ne pouvez modifier que votre propre boutique');
  }

  if (!req.files || Object.keys(req.files).length === 0) {
    throw commonErrors.badRequest('Aucun fichier fourni');
  }

  try {
    // Traiter les images
    const processedImages = await uploadService.processStoreImages(req.files, id);
    
    // Mettre à jour la boutique avec les nouvelles URLs
    const updateData = {};
    if (processedImages.logo) {
      updateData.logo_url = processedImages.logo.url;
    }
    if (processedImages.banner) {
      updateData.banner_url = processedImages.banner.url;
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = db.fn.now();
      updateData.updated_by = req.user.id;

      await db('stores')
        .where({ id })
        .update(updateData);

      // Invalider le cache
      await cache.del(`${CACHE_KEYS.STORES}:${id}`);
    }

    res.json({
      success: true,
      message: 'Images uploadées avec succès',
      data: processedImages
    });

  } catch (error) {
    console.error('Erreur upload images boutique:', error);
    throw error;
  }
});

module.exports = {
  getAllStores,
  getStoreById,
  createStore,
  updateStore,
  getStoreProducts,
  uploadStoreImages
};