const db = require('../config/database');
const { cache, CACHE_KEYS } = require('../config/redis');
const { asyncHandler, commonErrors } = require('../middleware/errorHandler');
const uploadService = require('../services/uploadService');

/**
 * Récupérer tous les produits avec filtres et pagination
 * GET /api/products
 */
const getAllProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    category,
    store,
    search,
    minPrice,
    maxPrice,
    fabric,
    size,
    color,
    sortBy = 'created_at',
    sortOrder = 'desc',
    featured,
    status = 'active'
  } = req.query;

  // Construire la requête de base
  let query = db('products')
    .select([
      'products.id',
      'products.name',
      'products.slug',
      'products.short_description',
      'products.price',
      'products.compare_at_price',
      'products.currency',
      'products.primary_image',
      'products.images',
      'products.fabric_type',
      'products.colors_available',
      'products.sizes_available',
      'products.stock_quantity',
      'products.featured',
      'products.average_rating',
      'products.reviews_count',
      'products.sales_count',
      'products.created_at',
      'stores.name as store_name',
      'stores.slug as store_slug',
      'stores.logo_url as store_logo',
      'categories.name as category_name',
      'categories.slug as category_slug'
    ])
    .leftJoin('stores', 'products.store_id', 'stores.id')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .where('products.status', status)
    .whereNull('products.deleted_at')
    .whereNull('stores.deleted_at');

  // Appliquer les filtres
  if (category) {
    query = query.where('categories.slug', category);
  }

  if (store) {
    query = query.where('stores.slug', store);
  }

  if (search) {
    query = query.where(function() {
      this.whereILike('products.name', `%${search}%`)
        .orWhereILike('products.description', `%${search}%`)
        .orWhereILike('products.fabric_type', `%${search}%`);
    });
  }

  if (minPrice) {
    query = query.where('products.price', '>=', minPrice);
  }

  if (maxPrice) {
    query = query.where('products.price', '<=', maxPrice);
  }

  if (fabric) {
    query = query.whereILike('products.fabric_type', `%${fabric}%`);
  }

  if (size) {
    query = query.whereRaw('products.sizes_available::text ILIKE ?', [`%${size}%`]);
  }

  if (color) {
    query = query.whereRaw('products.colors_available::text ILIKE ?', [`%${color}%`]);
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

  // Formater les résultats
  const products = result.data.map(product => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.short_description,
    price: parseFloat(product.price),
    compareAtPrice: product.compare_at_price ? parseFloat(product.compare_at_price) : null,
    currency: product.currency,
    primaryImage: product.primary_image,
    images: product.images || [],
    fabricType: product.fabric_type,
    colorsAvailable: product.colors_available || [],
    sizesAvailable: product.sizes_available || [],
    stockQuantity: product.stock_quantity,
    featured: product.featured,
    averageRating: product.average_rating ? parseFloat(product.average_rating) : 0,
    reviewsCount: product.reviews_count || 0,
    salesCount: product.sales_count || 0,
    createdAt: product.created_at,
    store: {
      name: product.store_name,
      slug: product.store_slug,
      logo: product.store_logo
    },
    category: {
      name: product.category_name,
      slug: product.category_slug
    }
  }));

  res.json({
    success: true,
    data: products,
    pagination: result.pagination
  });
});

/**
 * Récupérer un produit par ID ou slug
 * GET /api/products/:id
 */
const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Vérifier le cache d'abord
  const cacheKey = `${CACHE_KEYS.PRODUCTS}:${id}`;
  const cachedProduct = await cache.get(cacheKey);
  
  if (cachedProduct) {
    return res.json({
      success: true,
      data: cachedProduct
    });
  }

  // Construire la requête
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const whereClause = isUuid ? { 'products.id': id } : { 'products.slug': id };

  const product = await db('products')
    .select([
      'products.*',
      'stores.name as store_name',
      'stores.slug as store_slug',
      'stores.logo_url as store_logo',
      'stores.description as store_description',
      'stores.country as store_country',
      'stores.city as store_city',
      'stores.average_rating as store_rating',
      'categories.name as category_name',
      'categories.slug as category_slug',
      'categories.description as category_description'
    ])
    .leftJoin('stores', 'products.store_id', 'stores.id')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .where(whereClause)
    .whereNull('products.deleted_at')
    .first();

  if (!product) {
    throw commonErrors.notFound('Produit');
  }

  // Incrémenter le compteur de vues
  await db('products')
    .where({ id: product.id })
    .increment('views_count', 1);

  // Récupérer les produits similaires
  const similarProducts = await db('products')
    .select(['id', 'name', 'slug', 'price', 'primary_image', 'average_rating'])
    .where('category_id', product.category_id)
    .where('id', '!=', product.id)
    .where('status', 'active')
    .whereNull('deleted_at')
    .limit(4);

  // Formater la réponse
  const formattedProduct = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    shortDescription: product.short_description,
    sku: product.sku,
    price: parseFloat(product.price),
    compareAtPrice: product.compare_at_price ? parseFloat(product.compare_at_price) : null,
    currency: product.currency,
    images: product.images || [],
    primaryImage: product.primary_image,
    videos: product.videos || [],
    
    // Attributs spécifiques à la mode africaine
    fabricType: product.fabric_type,
    fabricOrigin: product.fabric_origin,
    culturalSignificance: product.cultural_significance,
    careInstructions: product.care_instructions,
    artisanName: product.artisan_name,
    artisanStory: product.artisan_story,
    artisanLocation: product.artisan_location,
    
    // Attributs physiques
    dimensions: product.dimensions,
    weight: product.weight ? parseFloat(product.weight) : null,
    colorsAvailable: product.colors_available || [],
    sizesAvailable: product.sizes_available || [],
    materials: product.materials || [],
    
    // Inventaire
    stockQuantity: product.stock_quantity,
    reservedQuantity: product.reserved_quantity || 0,
    lowStockThreshold: product.low_stock_threshold,
    trackInventory: product.track_inventory,
    allowBackorders: product.allow_backorders,
    
    // Statut et paramètres
    status: product.status,
    featured: product.featured,
    customizable: product.customizable,
    
    // Expédition
    requiresShipping: product.requires_shipping,
    shippingWeight: product.shipping_weight ? parseFloat(product.shipping_weight) : null,
    shippingDimensions: product.shipping_dimensions,
    fragile: product.fragile,
    
    // SEO
    metaTitle: product.meta_title,
    metaDescription: product.meta_description,
    metaKeywords: product.meta_keywords,
    
    // Analytiques
    viewsCount: product.views_count || 0,
    salesCount: product.sales_count || 0,
    totalRevenue: product.total_revenue ? parseFloat(product.total_revenue) : 0,
    averageRating: product.average_rating ? parseFloat(product.average_rating) : 0,
    reviewsCount: product.reviews_count || 0,
    wishlistCount: product.wishlist_count || 0,
    
    // Attributs et variantes
    attributes: product.attributes,
    variants: product.variants,
    
    // Saisonnalité
    seasons: product.seasons || [],
    occasions: product.occasions || [],
    tags: product.tags || [],
    
    // Boutique
    store: {
      id: product.store_id,
      name: product.store_name,
      slug: product.store_slug,
      logo: product.store_logo,
      description: product.store_description,
      country: product.store_country,
      city: product.store_city,
      rating: product.store_rating ? parseFloat(product.store_rating) : 0
    },
    
    // Catégorie
    category: {
      id: product.category_id,
      name: product.category_name,
      slug: product.category_slug,
      description: product.category_description
    },
    
    // Produits similaires
    similarProducts: similarProducts.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: parseFloat(p.price),
      primaryImage: p.primary_image,
      averageRating: p.average_rating ? parseFloat(p.average_rating) : 0
    })),
    
    createdAt: product.created_at,
    updatedAt: product.updated_at
  };

  // Mettre en cache le produit
  await cache.set(cacheKey, formattedProduct, 1800); // 30 minutes

  res.json({
    success: true,
    data: formattedProduct
  });
});

/**
 * Créer un nouveau produit
 * POST /api/products
 */
const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    shortDescription,
    sku,
    storeId,
    categoryId,
    price,
    compareAtPrice,
    currency = 'FCFA',
    fabricType,
    fabricOrigin,
    culturalSignificance,
    careInstructions,
    dimensions,
    weight,
    colorsAvailable = [],
    sizesAvailable = [],
    materials = [],
    stockQuantity = 0,
    lowStockThreshold = 5,
    trackInventory = true,
    allowBackorders = false,
    status = 'draft',
    featured = false,
    customizable = false,
    requiresShipping = true,
    shippingWeight,
    shippingDimensions,
    fragile = false,
    metaTitle,
    metaDescription,
    metaKeywords,
    artisanName,
    artisanStory,
    artisanLocation,
    attributes,
    variants,
    seasons = [],
    occasions = [],
    tags = []
  } = req.body;

  // Validation des champs requis
  if (!name || !storeId || !categoryId || !price) {
    throw commonErrors.validation({
      name: !name ? 'Nom requis' : null,
      storeId: !storeId ? 'Boutique requise' : null,
      categoryId: !categoryId ? 'Catégorie requise' : null,
      price: !price ? 'Prix requis' : null
    });
  }

  // Vérifier que la boutique existe et appartient à l'utilisateur
  const store = await db('stores')
    .where({ id: storeId })
    .whereNull('deleted_at')
    .first();

  if (!store) {
    throw commonErrors.notFound('Boutique');
  }

  // Vérifier les permissions
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && store.owner_id !== req.user.id) {
    throw commonErrors.forbidden('Vous ne pouvez créer des produits que pour vos propres boutiques');
  }

  // Vérifier que la catégorie existe
  const category = await db('categories')
    .where({ id: categoryId })
    .whereNull('deleted_at')
    .first();

  if (!category) {
    throw commonErrors.notFound('Catégorie');
  }

  // Générer un slug unique
  let slug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const existingSlug = await db('products')
    .where({ slug, store_id: storeId })
    .whereNull('deleted_at')
    .first();

  if (existingSlug) {
    slug = `${slug}-${Date.now()}`;
  }

  // Créer le produit
  const [product] = await db('products')
    .insert({
      name,
      slug,
      description,
      short_description: shortDescription,
      sku,
      store_id: storeId,
      category_id: categoryId,
      price,
      compare_at_price: compareAtPrice,
      currency,
      fabric_type: fabricType,
      fabric_origin: fabricOrigin,
      cultural_significance: culturalSignificance,
      care_instructions: careInstructions,
      dimensions,
      weight,
      colors_available: JSON.stringify(colorsAvailable),
      sizes_available: JSON.stringify(sizesAvailable),
      materials: JSON.stringify(materials),
      stock_quantity: stockQuantity,
      low_stock_threshold: lowStockThreshold,
      track_inventory: trackInventory,
      allow_backorders: allowBackorders,
      status,
      featured,
      customizable,
      requires_shipping: requiresShipping,
      shipping_weight: shippingWeight,
      shipping_dimensions: shippingDimensions,
      fragile,
      meta_title: metaTitle,
      meta_description: metaDescription,
      meta_keywords: metaKeywords,
      artisan_name: artisanName,
      artisan_story: artisanStory,
      artisan_location: artisanLocation,
      attributes,
      variants,
      seasons: JSON.stringify(seasons),
      occasions: JSON.stringify(occasions),
      tags: JSON.stringify(tags),
      created_by: req.user.id,
      tenant_id: req.user.tenantId
    })
    .returning('*');

  // Mettre à jour le compteur de produits de la boutique
  await db('stores')
    .where({ id: storeId })
    .increment('total_products', 1);

  // Invalider les caches pertinents
  await cache.delPattern(`${CACHE_KEYS.PRODUCTS}*`);
  await cache.delPattern(`${CACHE_KEYS.STORES}*`);

  res.status(201).json({
    success: true,
    message: 'Produit créé avec succès',
    data: product
  });
});

/**
 * Rechercher des produits
 * GET /api/products/search
 */
const searchProducts = asyncHandler(async (req, res) => {
  const {
    q: query,
    page = 1,
    limit = 20,
    category,
    minPrice,
    maxPrice,
    fabric,
    sortBy = 'relevance'
  } = req.query;

  if (!query) {
    throw commonErrors.badRequest('Requête de recherche requise');
  }

  // Vérifier le cache
  const cacheKey = `${CACHE_KEYS.SEARCH_RESULTS(query)}:${page}:${limit}:${category || ''}:${minPrice || ''}:${maxPrice || ''}`;
  const cachedResults = await cache.get(cacheKey);
  
  if (cachedResults) {
    return res.json({
      success: true,
      data: cachedResults.products,
      pagination: cachedResults.pagination,
      searchQuery: query
    });
  }

  // Recherche avec PostgreSQL full-text search
  let searchQuery = db('products')
    .select([
      'products.id',
      'products.name',
      'products.slug',
      'products.short_description',
      'products.price',
      'products.primary_image',
      'products.fabric_type',
      'products.average_rating',
      'products.reviews_count',
      'stores.name as store_name',
      'categories.name as category_name'
    ])
    .leftJoin('stores', 'products.store_id', 'stores.id')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .where('products.status', 'active')
    .whereNull('products.deleted_at')
    .where(function() {
      this.whereILike('products.name', `%${query}%`)
        .orWhereILike('products.description', `%${query}%`)
        .orWhereILike('products.fabric_type', `%${query}%`)
        .orWhereILike('products.tags', `%${query}%`);
    });

  // Appliquer les filtres
  if (category) {
    searchQuery = searchQuery.where('categories.slug', category);
  }

  if (minPrice) {
    searchQuery = searchQuery.where('products.price', '>=', minPrice);
  }

  if (maxPrice) {
    searchQuery = searchQuery.where('products.price', '<=', maxPrice);
  }

  if (fabric) {
    searchQuery = searchQuery.whereILike('products.fabric_type', `%${fabric}%`);
  }

  // Tri
  if (sortBy === 'price_asc') {
    searchQuery = searchQuery.orderBy('products.price', 'asc');
  } else if (sortBy === 'price_desc') {
    searchQuery = searchQuery.orderBy('products.price', 'desc');
  } else if (sortBy === 'rating') {
    searchQuery = searchQuery.orderBy('products.average_rating', 'desc');
  } else {
    // Par défaut, trier par pertinence (featured d'abord, puis date de création)
    searchQuery = searchQuery.orderBy('products.featured', 'desc')
      .orderBy('products.created_at', 'desc');
  }

  const result = await db.helpers.paginate(searchQuery, page, limit);

  const searchResults = {
    products: result.data,
    pagination: result.pagination
  };

  // Mettre en cache les résultats
  await cache.set(cacheKey, searchResults, 600); // 10 minutes

  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
    searchQuery: query
  });
});

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  searchProducts
};