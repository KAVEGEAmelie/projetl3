const db = require('../config/database');
const { cache } = require('../config/redis');
const { asyncHandler, commonErrors } = require('../middleware/errorHandler');

/**
 * Dashboard analytics global (admin)
 * GET /api/analytics/dashboard
 */
const getGlobalDashboard = asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  
  // Calculer les filtres de date
  const getDateFilter = (period) => {
    switch (period) {
      case '7d':
        return db.raw("created_at >= NOW() - INTERVAL '7 days'");
      case '30d':
        return db.raw("created_at >= NOW() - INTERVAL '30 days'");
      case '90d':
        return db.raw("created_at >= NOW() - INTERVAL '90 days'");
      case '1y':
        return db.raw("created_at >= NOW() - INTERVAL '1 year'");
      default:
        return db.raw("created_at >= NOW() - INTERVAL '30 days'");
    }
  };
  
  const dateFilter = getDateFilter(period);
  
  // Statistiques des utilisateurs
  const userStats = await db('users')
    .select([
      db.raw('COUNT(*) as total_users'),
      db.raw('COUNT(CASE WHEN created_at >= NOW() - INTERVAL \'30 days\' THEN 1 END) as new_users_30d'),
      db.raw('COUNT(CASE WHEN role = \'vendor\' THEN 1 END) as total_vendors'),
      db.raw('COUNT(CASE WHEN role = \'customer\' THEN 1 END) as total_customers'),
      db.raw('COUNT(CASE WHEN status = \'active\' THEN 1 END) as active_users')
    ])
    .whereNull('deleted_at')
    .first();
    
  // Statistiques des boutiques
  const storeStats = await db('stores')
    .select([
      db.raw('COUNT(*) as total_stores'),
      db.raw('COUNT(CASE WHEN status = \'active\' THEN 1 END) as active_stores'),
      db.raw('COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_stores'),
      db.raw('COUNT(CASE WHEN featured = true THEN 1 END) as featured_stores')
    ])
    .whereNull('deleted_at')
    .first();
    
  // Statistiques des produits
  const productStats = await db('products')
    .select([
      db.raw('COUNT(*) as total_products'),
      db.raw('COUNT(CASE WHEN status = \'active\' THEN 1 END) as active_products'),
      db.raw('COUNT(CASE WHEN featured = true THEN 1 END) as featured_products'),
      db.raw('SUM(stock_quantity) as total_stock'),
      db.raw('AVG(price) as average_price')
    ])
    .whereNull('deleted_at')
    .first();
    
  // Statistiques des commandes
  const orderStats = await db('orders')
    .where(dateFilter)
    .select([
      db.raw('COUNT(*) as total_orders'),
      db.raw('SUM(total_amount) as total_revenue'),
      db.raw('AVG(total_amount) as average_order_value'),
      db.raw('COUNT(CASE WHEN status = \'delivered\' THEN 1 END) as completed_orders'),
      db.raw('COUNT(CASE WHEN status = \'cancelled\' THEN 1 END) as cancelled_orders')
    ])
    .first();
    
  // Statistiques des paiements
  const paymentStats = await db('payments')
    .where(dateFilter)
    .select([
      db.raw('COUNT(*) as total_transactions'),
      db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as successful_payments'),
      db.raw('SUM(CASE WHEN status = \'completed\' THEN amount ELSE 0 END) as successful_volume')
    ])
    .first();
    
  // Évolution des revenus (30 derniers jours)
  const revenueEvolution = await db('orders')
    .where('status', 'delivered')
    .where(db.raw("created_at >= NOW() - INTERVAL '30 days'"))
    .select([
      db.raw('DATE(created_at) as date'),
      db.raw('COUNT(*) as orders'),
      db.raw('SUM(total_amount) as revenue')
    ])
    .groupBy(db.raw('DATE(created_at)'))
    .orderBy('date')
    .limit(30);
    
  // Top categories par revenue
  const topCategories = await db('order_items')
    .join('orders', 'order_items.order_id', 'orders.id')
    .join('products', 'order_items.product_id', 'products.id')
    .join('categories', 'products.category_id', 'categories.id')
    .where('orders.status', 'delivered')
    .where(dateFilter)
    .select([
      'categories.name',
      db.raw('SUM(order_items.total_price) as revenue'),
      db.raw('COUNT(*) as orders')
    ])
    .groupBy('categories.id', 'categories.name')
    .orderBy('revenue', 'desc')
    .limit(5);
    
  // Top produits
  const topProducts = await db('order_items')
    .join('orders', 'order_items.order_id', 'orders.id')
    .where('orders.status', 'delivered')
    .where(dateFilter)
    .select([
      'order_items.product_name',
      db.raw('SUM(order_items.quantity) as quantity_sold'),
      db.raw('SUM(order_items.total_price) as revenue')
    ])
    .groupBy('order_items.product_id', 'order_items.product_name')
    .orderBy('revenue', 'desc')
    .limit(5);
    
  // Répartition par méthodes de paiement
  const paymentMethods = await db('orders')
    .where(dateFilter)
    .where('payment_status', 'paid')
    .select('payment_method')
    .count('* as count')
    .sum('total_amount as revenue')
    .groupBy('payment_method')
    .orderBy('count', 'desc');
  
  res.json({
    success: true,
    data: {
      period,
      summary: {
        users: {
          total: parseInt(userStats.total_users) || 0,
          new30d: parseInt(userStats.new_users_30d) || 0,
          vendors: parseInt(userStats.total_vendors) || 0,
          customers: parseInt(userStats.total_customers) || 0,
          active: parseInt(userStats.active_users) || 0
        },
        stores: {
          total: parseInt(storeStats.total_stores) || 0,
          active: parseInt(storeStats.active_stores) || 0,
          verified: parseInt(storeStats.verified_stores) || 0,
          featured: parseInt(storeStats.featured_stores) || 0
        },
        products: {
          total: parseInt(productStats.total_products) || 0,
          active: parseInt(productStats.active_products) || 0,
          featured: parseInt(productStats.featured_products) || 0,
          totalStock: parseInt(productStats.total_stock) || 0,
          averagePrice: parseFloat(productStats.average_price) || 0
        },
        orders: {
          total: parseInt(orderStats.total_orders) || 0,
          revenue: parseFloat(orderStats.total_revenue) || 0,
          averageOrderValue: parseFloat(orderStats.average_order_value) || 0,
          completed: parseInt(orderStats.completed_orders) || 0,
          cancelled: parseInt(orderStats.cancelled_orders) || 0,
          completionRate: orderStats.total_orders > 0 
            ? ((orderStats.completed_orders / orderStats.total_orders) * 100).toFixed(2)
            : 0
        },
        payments: {
          total: parseInt(paymentStats.total_transactions) || 0,
          successful: parseInt(paymentStats.successful_payments) || 0,
          successfulVolume: parseFloat(paymentStats.successful_volume) || 0,
          successRate: paymentStats.total_transactions > 0 
            ? ((paymentStats.successful_payments / paymentStats.total_transactions) * 100).toFixed(2)
            : 0
        }
      },
      charts: {
        revenueEvolution: revenueEvolution.map(day => ({
          date: day.date,
          orders: parseInt(day.orders),
          revenue: parseFloat(day.revenue)
        })),
        topCategories: topCategories.map(cat => ({
          name: cat.name,
          revenue: parseFloat(cat.revenue),
          orders: parseInt(cat.orders)
        })),
        topProducts: topProducts.map(product => ({
          name: product.product_name,
          quantitySold: parseInt(product.quantity_sold),
          revenue: parseFloat(product.revenue)
        })),
        paymentMethods: paymentMethods.map(method => ({
          method: method.payment_method,
          count: parseInt(method.count),
          revenue: parseFloat(method.revenue)
        }))
      }
    }
  });
});

/**
 * Analytics de ventes
 * GET /api/analytics/sales
 */
const getSalesAnalytics = asyncHandler(async (req, res) => {
  const { 
    period = '30d', 
    storeId, 
    categoryId,
    groupBy = 'day' // day, week, month
  } = req.query;
  
  // Filtres
  let query = db('orders')
    .join('order_items', 'orders.id', 'order_items.order_id')
    .where('orders.status', 'delivered');
    
  // Période
  switch (period) {
    case '7d':
      query = query.where(db.raw("orders.created_at >= NOW() - INTERVAL '7 days'"));
      break;
    case '30d':
      query = query.where(db.raw("orders.created_at >= NOW() - INTERVAL '30 days'"));
      break;
    case '90d':
      query = query.where(db.raw("orders.created_at >= NOW() - INTERVAL '90 days'"));
      break;
    case '1y':
      query = query.where(db.raw("orders.created_at >= NOW() - INTERVAL '1 year'"));
      break;
  }
  
  // Boutique spécifique
  if (storeId) {
    query = query.where('orders.store_id', storeId);
  }
  
  // Catégorie spécifique
  if (categoryId) {
    query = query.join('products', 'order_items.product_id', 'products.id')
      .where('products.category_id', categoryId);
  }
  
  // Grouper par période
  let dateFormat;
  switch (groupBy) {
    case 'week':
      dateFormat = "DATE_TRUNC('week', orders.created_at)";
      break;
    case 'month':
      dateFormat = "DATE_TRUNC('month', orders.created_at)";
      break;
    default:
      dateFormat = "DATE(orders.created_at)";
  }
  
  const salesData = await query
    .select([
      db.raw(`${dateFormat} as period`),
      db.raw('COUNT(DISTINCT orders.id) as orders'),
      db.raw('SUM(order_items.quantity) as items_sold'),
      db.raw('SUM(order_items.total_price) as revenue')
    ])
    .groupBy(db.raw(dateFormat))
    .orderBy('period');
    
  // Comparaison avec la période précédente
  const previousPeriodQuery = db('orders')
    .join('order_items', 'orders.id', 'order_items.order_id')
    .where('orders.status', 'delivered');
    
  switch (period) {
    case '7d':
      previousPeriodQuery.whereBetween('orders.created_at', [
        db.raw("NOW() - INTERVAL '14 days'"),
        db.raw("NOW() - INTERVAL '7 days'")
      ]);
      break;
    case '30d':
      previousPeriodQuery.whereBetween('orders.created_at', [
        db.raw("NOW() - INTERVAL '60 days'"),
        db.raw("NOW() - INTERVAL '30 days'")
      ]);
      break;
  }
  
  if (storeId) {
    previousPeriodQuery.where('orders.store_id', storeId);
  }
  
  const previousStats = await previousPeriodQuery
    .select([
      db.raw('COUNT(DISTINCT orders.id) as orders'),
      db.raw('SUM(order_items.total_price) as revenue')
    ])
    .first();
    
  // Calcul des variations
  const currentStats = {
    orders: salesData.reduce((acc, day) => acc + parseInt(day.orders), 0),
    revenue: salesData.reduce((acc, day) => acc + parseFloat(day.revenue), 0)
  };
  
  const orderGrowth = previousStats.orders > 0 
    ? ((currentStats.orders - previousStats.orders) / previousStats.orders * 100).toFixed(2)
    : 0;
    
  const revenueGrowth = previousStats.revenue > 0
    ? ((currentStats.revenue - previousStats.revenue) / previousStats.revenue * 100).toFixed(2)
    : 0;
  
  res.json({
    success: true,
    data: {
      period,
      groupBy,
      summary: {
        totalOrders: currentStats.orders,
        totalRevenue: currentStats.revenue,
        averageOrderValue: currentStats.orders > 0 
          ? (currentStats.revenue / currentStats.orders).toFixed(2)
          : 0,
        growth: {
          orders: parseFloat(orderGrowth),
          revenue: parseFloat(revenueGrowth)
        }
      },
      chartData: salesData.map(item => ({
        period: item.period,
        orders: parseInt(item.orders),
        itemsSold: parseInt(item.items_sold),
        revenue: parseFloat(item.revenue)
      }))
    }
  });
});

/**
 * Analytics des produits
 * GET /api/analytics/products
 */
const getProductAnalytics = asyncHandler(async (req, res) => {
  const { period = '30d', storeId, limit = 20 } = req.query;
  
  let dateFilter = db.raw('1=1');
  switch (period) {
    case '7d':
      dateFilter = db.raw("orders.created_at >= NOW() - INTERVAL '7 days'");
      break;
    case '30d':
      dateFilter = db.raw("orders.created_at >= NOW() - INTERVAL '30 days'");
      break;
    case '90d':
      dateFilter = db.raw("orders.created_at >= NOW() - INTERVAL '90 days'");
      break;
  }
  
  let baseQuery = db('order_items')
    .join('orders', 'order_items.order_id', 'orders.id')
    .join('products', 'order_items.product_id', 'products.id')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .where('orders.status', 'delivered')
    .where(dateFilter);
    
  if (storeId) {
    baseQuery = baseQuery.where('order_items.store_id', storeId);
  }
  
  // Top produits par revenus
  const topByRevenue = await baseQuery.clone()
    .select([
      'products.id',
      'products.name',
      'products.primary_image',
      'categories.name as category_name',
      db.raw('SUM(order_items.quantity) as quantity_sold'),
      db.raw('SUM(order_items.total_price) as revenue'),
      db.raw('COUNT(DISTINCT order_items.order_id) as orders')
    ])
    .groupBy('products.id', 'products.name', 'products.primary_image', 'categories.name')
    .orderBy('revenue', 'desc')
    .limit(limit);
    
  // Top produits par quantité
  const topByQuantity = await baseQuery.clone()
    .select([
      'products.id',
      'products.name',
      'products.primary_image',
      db.raw('SUM(order_items.quantity) as quantity_sold'),
      db.raw('SUM(order_items.total_price) as revenue')
    ])
    .groupBy('products.id', 'products.name', 'products.primary_image')
    .orderBy('quantity_sold', 'desc')
    .limit(limit);
    
  // Performance par catégorie
  const categoryPerformance = await db('order_items')
    .join('orders', 'order_items.order_id', 'orders.id')
    .join('products', 'order_items.product_id', 'products.id')
    .join('categories', 'products.category_id', 'categories.id')
    .where('orders.status', 'delivered')
    .where(dateFilter)
    .modify(query => {
      if (storeId) query.where('order_items.store_id', storeId);
    })
    .select([
      'categories.name',
      db.raw('COUNT(DISTINCT products.id) as unique_products'),
      db.raw('SUM(order_items.quantity) as total_sold'),
      db.raw('SUM(order_items.total_price) as revenue'),
      db.raw('AVG(order_items.unit_price) as avg_price')
    ])
    .groupBy('categories.id', 'categories.name')
    .orderBy('revenue', 'desc');
    
  // Produits à faible stock
  let lowStockQuery = db('products')
    .select([
      'id', 'name', 'stock_quantity', 'low_stock_threshold',
      'reserved_quantity'
    ])
    .where('status', 'active')
    .whereRaw('stock_quantity <= low_stock_threshold')
    .whereNull('deleted_at')
    .orderBy('stock_quantity');
    
  if (storeId) {
    lowStockQuery = lowStockQuery.where('store_id', storeId);
  }
  
  const lowStock = await lowStockQuery.limit(20);
  
  res.json({
    success: true,
    data: {
      period,
      topByRevenue: topByRevenue.map(product => ({
        id: product.id,
        name: product.name,
        image: product.primary_image,
        category: product.category_name,
        quantitySold: parseInt(product.quantity_sold),
        revenue: parseFloat(product.revenue),
        orders: parseInt(product.orders),
        avgRevenuePerOrder: product.orders > 0 
          ? (product.revenue / product.orders).toFixed(2)
          : 0
      })),
      topByQuantity: topByQuantity.map(product => ({
        id: product.id,
        name: product.name,
        image: product.primary_image,
        quantitySold: parseInt(product.quantity_sold),
        revenue: parseFloat(product.revenue)
      })),
      categoryPerformance: categoryPerformance.map(cat => ({
        name: cat.name,
        uniqueProducts: parseInt(cat.unique_products),
        totalSold: parseInt(cat.total_sold),
        revenue: parseFloat(cat.revenue),
        averagePrice: parseFloat(cat.avg_price)
      })),
      inventory: {
        lowStock: lowStock.map(product => ({
          id: product.id,
          name: product.name,
          currentStock: product.stock_quantity,
          threshold: product.low_stock_threshold,
          reserved: product.reserved_quantity || 0,
          available: product.stock_quantity - (product.reserved_quantity || 0)
        }))
      }
    }
  });
});

/**
 * Analytics des clients
 * GET /api/analytics/customers
 */
const getCustomerAnalytics = asyncHandler(async (req, res) => {
  const { period = '30d', storeId } = req.query;
  
  let dateFilter = db.raw('1=1');
  switch (period) {
    case '7d':
      dateFilter = db.raw("orders.created_at >= NOW() - INTERVAL '7 days'");
      break;
    case '30d':
      dateFilter = db.raw("orders.created_at >= NOW() - INTERVAL '30 days'");
      break;
    case '90d':
      dateFilter = db.raw("orders.created_at >= NOW() - INTERVAL '90 days'");
      break;
  }
  
  let baseQuery = db('orders')
    .join('users', 'orders.customer_id', 'users.id')
    .where('orders.status', 'delivered')
    .where(dateFilter);
    
  if (storeId) {
    baseQuery = baseQuery.where('orders.store_id', storeId);
  }
  
  // Top clients par revenus
  const topCustomers = await baseQuery.clone()
    .select([
      'users.id',
      'users.first_name',
      'users.last_name',
      'users.email',
      'users.loyalty_tier',
      db.raw('COUNT(*) as total_orders'),
      db.raw('SUM(orders.total_amount) as total_spent'),
      db.raw('AVG(orders.total_amount) as avg_order_value'),
      db.raw('MAX(orders.created_at) as last_order')
    ])
    .groupBy('users.id', 'users.first_name', 'users.last_name', 'users.email', 'users.loyalty_tier')
    .orderBy('total_spent', 'desc')
    .limit(20);
    
  // Segmentation des clients
  const customerSegments = await db('orders')
    .join('users', 'orders.customer_id', 'users.id')
    .where('orders.status', 'delivered')
    .select([
      'users.loyalty_tier',
      'users.country',
      db.raw('COUNT(DISTINCT users.id) as customer_count'),
      db.raw('AVG(orders.total_amount) as avg_order_value'),
      db.raw('SUM(orders.total_amount) as total_revenue')
    ])
    .modify(query => {
      if (storeId) query.where('orders.store_id', storeId);
    })
    .groupBy('users.loyalty_tier', 'users.country')
    .orderBy('total_revenue', 'desc');
    
  // Nouveaux clients
  const newCustomers = await db('users')
    .select([
      db.raw('COUNT(*) as new_customers'),
      db.raw('COUNT(CASE WHEN role = \'customer\' THEN 1 END) as new_regular_customers'),
      db.raw('COUNT(CASE WHEN role = \'vendor\' THEN 1 END) as new_vendors')
    ])
    .where(dateFilter.toString().replace('orders.created_at', 'users.created_at'))
    .first();
    
  // Rétention client (clients qui ont commandé plusieurs fois)
  const retention = await baseQuery.clone()
    .select([
      db.raw('COUNT(DISTINCT customer_id) as total_customers'),
      db.raw('COUNT(CASE WHEN order_count > 1 THEN 1 END) as repeat_customers')
    ])
    .from(
      baseQuery.clone()
        .select([
          'customer_id',
          db.raw('COUNT(*) as order_count')
        ])
        .groupBy('customer_id')
        .as('customer_orders')
    )
    .first();
  
  res.json({
    success: true,
    data: {
      period,
      summary: {
        newCustomers: parseInt(newCustomers.new_customers) || 0,
        newRegularCustomers: parseInt(newCustomers.new_regular_customers) || 0,
        newVendors: parseInt(newCustomers.new_vendors) || 0,
        totalCustomers: parseInt(retention.total_customers) || 0,
        repeatCustomers: parseInt(retention.repeat_customers) || 0,
        retentionRate: retention.total_customers > 0 
          ? ((retention.repeat_customers / retention.total_customers) * 100).toFixed(2)
          : 0
      },
      topCustomers: topCustomers.map(customer => ({
        id: customer.id,
        name: `${customer.first_name} ${customer.last_name}`,
        email: customer.email,
        loyaltyTier: customer.loyalty_tier,
        totalOrders: parseInt(customer.total_orders),
        totalSpent: parseFloat(customer.total_spent),
        avgOrderValue: parseFloat(customer.avg_order_value),
        lastOrder: customer.last_order
      })),
      segments: customerSegments.map(segment => ({
        loyaltyTier: segment.loyalty_tier,
        country: segment.country,
        customerCount: parseInt(segment.customer_count),
        avgOrderValue: parseFloat(segment.avg_order_value),
        totalRevenue: parseFloat(segment.total_revenue)
      }))
    }
  });
});

/**
 * Exporter les données analytics
 * GET /api/analytics/export
 */
const exportAnalytics = asyncHandler(async (req, res) => {
  const { type = 'sales', format = 'csv', period = '30d' } = req.query;
  
  // TODO: Implémenter l'export en CSV/Excel
  res.json({
    success: false,
    message: 'Fonctionnalité d\'export en cours de développement',
    data: {
      type,
      format,
      period,
      note: 'L\'export sera disponible prochainement'
    }
  });
});

module.exports = {
  getGlobalDashboard,
  getSalesAnalytics,
  getProductAnalytics,
  getCustomerAnalytics,
  exportAnalytics
};