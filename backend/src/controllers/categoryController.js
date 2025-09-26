const db = require('../config/database');
const { cache, CACHE_KEYS } = require('../config/redis');
const { asyncHandler, commonErrors } = require('../middleware/errorHandler');

/**
 * Construire l'arbre hiérarchique des catégories
 */
const buildCategoryTree = (categories, parentId = null) => {
  const tree = [];
  
  const children = categories.filter(cat => cat.parent_id === parentId);
  
  for (const category of children) {
    const categoryNode = {
      ...category,
      children: buildCategoryTree(categories, category.id)
    };
    tree.push(categoryNode);
  }
  
  return tree.sort((a, b) => a.sort_order - b.sort_order);
};

/**
 * Récupérer toutes les catégories avec hiérarchie
 * GET /api/categories
 */
const getAllCategories = asyncHandler(async (req, res) => {
  const {
    tree = 'false',
    featured,
    active = 'true',
    level,
    parentId,
    includeProducts = 'false'
  } = req.query;

  // Vérifier le cache
  const cacheKey = `${CACHE_KEYS.CATEGORIES}:${JSON.stringify(req.query)}`;
  const cachedCategories = await cache.get(cacheKey);
  
  if (cachedCategories) {
    return res.json({
      success: true,
      data: cachedCategories
    });
  }

  // Construire la requête de base
  let query = db('categories')
    .select([
      'id',
      'name', 
      'slug',
      'description',
      'image_url',
      'icon',
      'parent_id',
      'level',
      'path',
      'sort_order',
      'is_active',
      'featured',
      'show_in_menu',
      'products_count',
      'views_count',
      'meta_title',
      'meta_description',
      'translations',
      'created_at'
    ])
    .whereNull('deleted_at');

  // Appliquer les filtres
  if (active === 'true') {
    query = query.where('is_active', true);
  }

  if (featured === 'true') {
    query = query.where('featured', true);
  }

  if (level !== undefined) {
    query = query.where('level', parseInt(level));
  }

  if (parentId) {
    if (parentId === 'null') {
      query = query.whereNull('parent_id');
    } else {
      query = query.where('parent_id', parentId);
    }
  }

  // Ordonner par niveau et ordre de tri
  query = query.orderBy(['level', 'sort_order', 'name']);

  const categories = await query;

  // Formater les résultats
  let formattedCategories = categories.map(category => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: category.image_url,
    icon: category.icon,
    parentId: category.parent_id,
    level: category.level,
    path: category.path,
    sortOrder: category.sort_order,
    isActive: category.is_active,
    featured: category.featured,
    showInMenu: category.show_in_menu,
    productsCount: category.products_count || 0,
    viewsCount: category.views_count || 0,
    seo: {
      metaTitle: category.meta_title,
      metaDescription: category.meta_description
    },
    translations: category.translations,
    createdAt: category.created_at
  }));

  // Si includeProducts est demandé, ajouter quelques produits par catégorie
  if (includeProducts === 'true') {
    for (let category of formattedCategories) {
      const products = await db('products')
        .select(['id', 'name', 'slug', 'price', 'primary_image', 'average_rating'])
        .where('category_id', category.id)
        .where('status', 'active')
        .whereNull('deleted_at')
        .orderBy('featured', 'desc')
        .orderBy('average_rating', 'desc')
        .limit(4);

      category.featuredProducts = products.map(product => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: parseFloat(product.price),
        primaryImage: product.primary_image,
        averageRating: product.average_rating ? parseFloat(product.average_rating) : 0
      }));
    }
  }

  // Construire l'arbre hiérarchique si demandé
  if (tree === 'true') {
    formattedCategories = buildCategoryTree(formattedCategories);
  }

  // Mettre en cache
  await cache.set(cacheKey, formattedCategories, 1800); // 30 minutes

  res.json({
    success: true,
    data: formattedCategories
  });
});

/**
 * Récupérer une catégorie par ID ou slug
 * GET /api/categories/:id
 */
const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Vérifier le cache
  const cacheKey = `${CACHE_KEYS.CATEGORIES}:${id}`;
  const cachedCategory = await cache.get(cacheKey);
  
  if (cachedCategory) {
    return res.json({
      success: true,
      data: cachedCategory
    });
  }

  // Déterminer si c'est un UUID ou un slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const whereClause = isUuid ? { 'categories.id': id } : { 'categories.slug': id };

  const category = await db('categories')
    .select([
      'categories.*',
      'parent.name as parent_name',
      'parent.slug as parent_slug'
    ])
    .leftJoin('categories as parent', 'categories.parent_id', 'parent.id')
    .where(whereClause)
    .whereNull('categories.deleted_at')
    .first();

  if (!category) {
    throw commonErrors.notFound('Catégorie');
  }

  // Incrémenter le compteur de vues
  await db('categories')
    .where({ id: category.id })
    .increment('views_count', 1);

  // Récupérer les sous-catégories
  const children = await db('categories')
    .select(['id', 'name', 'slug', 'description', 'image_url', 'products_count'])
    .where('parent_id', category.id)
    .where('is_active', true)
    .whereNull('deleted_at')
    .orderBy('sort_order');

  // Récupérer les catégories sœurs (même niveau)
  let siblings = [];
  if (category.parent_id) {
    siblings = await db('categories')
      .select(['id', 'name', 'slug', 'image_url'])
      .where('parent_id', category.parent_id)
      .where('id', '!=', category.id)
      .where('is_active', true)
      .whereNull('deleted_at')
      .orderBy('sort_order');
  }

  // Construire le breadcrumb
  const breadcrumb = [];
  let currentCategory = category;
  
  while (currentCategory && currentCategory.parent_id) {
    const parent = await db('categories')
      .select(['id', 'name', 'slug', 'parent_id'])
      .where('id', currentCategory.parent_id)
      .first();
    
    if (parent) {
      breadcrumb.unshift({
        id: parent.id,
        name: parent.name,
        slug: parent.slug
      });
      currentCategory = parent;
    } else {
      break;
    }
  }

  // Ajouter la catégorie racine si nécessaire
  if (breadcrumb.length > 0) {
    breadcrumb.unshift({
      id: null,
      name: 'Accueil',
      slug: ''
    });
  }

  // Formater la réponse
  const formattedCategory = {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: category.image_url,
    icon: category.icon,
    level: category.level,
    path: category.path,
    sortOrder: category.sort_order,
    isActive: category.is_active,
    featured: category.featured,
    showInMenu: category.show_in_menu,
    productsCount: category.products_count || 0,
    viewsCount: category.views_count || 0,
    
    // Parent
    parent: category.parent_id ? {
      id: category.parent_id,
      name: category.parent_name,
      slug: category.parent_slug
    } : null,
    
    // Navigation
    breadcrumb,
    children: children.map(child => ({
      id: child.id,
      name: child.name,
      slug: child.slug,
      description: child.description,
      imageUrl: child.image_url,
      productsCount: child.products_count || 0
    })),
    siblings: siblings.map(sibling => ({
      id: sibling.id,
      name: sibling.name,
      slug: sibling.slug,
      imageUrl: sibling.image_url
    })),
    
    // SEO
    seo: {
      metaTitle: category.meta_title || category.name,
      metaDescription: category.meta_description || category.description,
      metaKeywords: category.meta_keywords
    },
    
    // Multi-langue
    translations: category.translations,
    
    createdAt: category.created_at,
    updatedAt: category.updated_at
  };

  // Mettre en cache
  await cache.set(cacheKey, formattedCategory, 1800); // 30 minutes

  res.json({
    success: true,
    data: formattedCategory
  });
});

/**
 * Récupérer les produits d'une catégorie
 * GET /api/categories/:id/products
 */
const getCategoryProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    page = 1,
    limit = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
    minPrice,
    maxPrice,
    fabric,
    size,
    color,
    store,
    featured
  } = req.query;

  // Vérifier que la catégorie existe
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const whereClause = isUuid ? { 'categories.id': id } : { 'categories.slug': id };

  const category = await db('categories')
    .select(['id', 'name', 'slug', 'level'])
    .where(whereClause)
    .whereNull('deleted_at')
    .first();

  if (!category) {
    throw commonErrors.notFound('Catégorie');
  }

  // Construire la requête des produits
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
      'stores.logo_url as store_logo'
    ])
    .leftJoin('stores', 'products.store_id', 'stores.id')
    .where('products.category_id', category.id)
    .where('products.status', 'active')
    .whereNull('products.deleted_at')
    .whereNull('stores.deleted_at');

  // Si c'est une catégorie parent, inclure aussi les produits des sous-catégories
  if (category.level < 2) {
    const childCategories = await db('categories')
      .select('id')
      .where('path', 'like', `${category.id}%`)
      .where('id', '!=', category.id);
    
    if (childCategories.length > 0) {
      const childIds = childCategories.map(c => c.id);
      query = query.orWhereIn('products.category_id', childIds);
    }
  }

  // Appliquer les filtres
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

  if (store) {
    query = query.where('stores.slug', store);
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

  // Formater les produits
  const products = result.data.map(product => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.short_description,
    price: parseFloat(product.price),
    compareAtPrice: product.compare_at_price ? parseFloat(product.compare_at_price) : null,
    currency: product.currency,
    primaryImage: product.primary_image,
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
    }
  }));

  res.json({
    success: true,
    data: products,
    pagination: result.pagination,
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug
    }
  });
});

/**
 * Créer une nouvelle catégorie (admin seulement)
 * POST /api/categories
 */
const createCategory = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    parentId,
    icon,
    sortOrder = 0,
    featured = false,
    showInMenu = true,
    metaTitle,
    metaDescription,
    metaKeywords,
    translations
  } = req.body;

  // Validation
  if (!name) {
    throw commonErrors.badRequest('Nom de catégorie requis');
  }

  // Générer un slug unique
  let slug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const existingSlug = await db('categories')
    .where({ slug })
    .whereNull('deleted_at')
    .first();

  if (existingSlug) {
    slug = `${slug}-${Date.now()}`;
  }

  // Calculer le niveau et le chemin
  let level = 0;
  let path = '';
  
  if (parentId) {
    const parent = await db('categories')
      .where({ id: parentId })
      .whereNull('deleted_at')
      .first();

    if (!parent) {
      throw commonErrors.notFound('Catégorie parent');
    }

    level = parent.level + 1;
    path = parent.path ? `${parent.path}.${parentId}` : parentId;
  }

  // Créer la catégorie
  const [category] = await db('categories')
    .insert({
      name,
      slug,
      description,
      parent_id: parentId,
      level,
      path,
      icon,
      sort_order: sortOrder,
      is_active: true,
      featured,
      show_in_menu: showInMenu,
      meta_title: metaTitle,
      meta_description: metaDescription,
      meta_keywords: metaKeywords ? JSON.stringify(metaKeywords) : null,
      translations: translations ? JSON.stringify(translations) : null,
      created_by: req.user.id,
      tenant_id: req.user.tenantId
    })
    .returning('*');

  // Invalider les caches
  await cache.delPattern(`${CACHE_KEYS.CATEGORIES}*`);

  res.status(201).json({
    success: true,
    message: 'Catégorie créée avec succès',
    data: category
  });
});

/**
 * Mettre à jour une catégorie (admin seulement)
 * PUT /api/categories/:id
 */
const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  // Vérifier que la catégorie existe
  const category = await db('categories')
    .where({ id })
    .whereNull('deleted_at')
    .first();

  if (!category) {
    throw commonErrors.notFound('Catégorie');
  }

  // Supprimer les champs non modifiables
  delete updateData.id;
  delete updateData.slug;
  delete updateData.level;
  delete updateData.path;
  delete updateData.created_at;
  delete updateData.products_count;

  // Ajouter les métadonnées de mise à jour
  updateData.updated_at = db.fn.now();
  updateData.updated_by = req.user.id;

  // Si le parent change, recalculer niveau et chemin
  if (updateData.parentId !== undefined && updateData.parentId !== category.parent_id) {
    if (updateData.parentId) {
      const parent = await db('categories')
        .where({ id: updateData.parentId })
        .whereNull('deleted_at')
        .first();

      if (!parent) {
        throw commonErrors.notFound('Catégorie parent');
      }

      updateData.level = parent.level + 1;
      updateData.path = parent.path ? `${parent.path}.${updateData.parentId}` : updateData.parentId;
      updateData.parent_id = updateData.parentId;
    } else {
      updateData.level = 0;
      updateData.path = null;
      updateData.parent_id = null;
    }
  }

  delete updateData.parentId;

  // Mettre à jour la catégorie
  const [updatedCategory] = await db('categories')
    .where({ id })
    .update(updateData)
    .returning('*');

  // Invalider les caches
  await cache.delPattern(`${CACHE_KEYS.CATEGORIES}*`);

  res.json({
    success: true,
    message: 'Catégorie mise à jour avec succès',
    data: updatedCategory
  });
});

/**
 * Supprimer une catégorie (admin seulement)
 * DELETE /api/categories/:id
 */
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await db('categories')
    .where({ id })
    .whereNull('deleted_at')
    .first();

  if (!category) {
    throw commonErrors.notFound('Catégorie');
  }

  // Vérifier qu'il n'y a pas de produits dans cette catégorie
  const productCount = await db('products')
    .where({ category_id: id })
    .whereNull('deleted_at')
    .count('id as count')
    .first();

  if (parseInt(productCount.count) > 0) {
    throw commonErrors.conflict(
      'Impossible de supprimer une catégorie contenant des produits'
    );
  }

  // Vérifier qu'il n'y a pas de sous-catégories
  const childCount = await db('categories')
    .where({ parent_id: id })
    .whereNull('deleted_at')
    .count('id as count')
    .first();

  if (parseInt(childCount.count) > 0) {
    throw commonErrors.conflict(
      'Impossible de supprimer une catégorie ayant des sous-catégories'
    );
  }

  // Soft delete
  await db('categories')
    .where({ id })
    .update({
      deleted_at: db.fn.now(),
      deleted_by: req.user.id
    });

  // Invalider les caches
  await cache.delPattern(`${CACHE_KEYS.CATEGORIES}*`);

  res.json({
    success: true,
    message: `Catégorie "${category.name}" supprimée avec succès`
  });
});

module.exports = {
  getAllCategories,
  getCategoryById,
  getCategoryProducts,
  createCategory,
  updateCategory,
  deleteCategory
};