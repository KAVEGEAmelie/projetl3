const knex = require('../config/database');
const Redis = require('redis');
const redisClient = require('../config/redis');

/**
 * Service d'analytics pour AfrikMode
 * Collecte et analyse les données business de la plateforme
 */
class AnalyticsService {
  constructor() {
    this.cacheTimeout = 3600; // 1 heure en secondes
  }

  /**
   * Métriques générales de la plateforme
   */
  async getPlatformMetrics(period = '30d') {
    const cacheKey = `analytics:platform:${period}`;
    
    try {
      // Vérifier le cache
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const dateRange = this._getDateRange(period);
      
      // Exécuter toutes les requêtes en parallèle
      const [
        totalUsers,
        newUsers,
        totalStores,
        newStores,
        totalProducts,
        newProducts,
        totalOrders,
        newOrders,
        totalRevenue,
        newRevenue
      ] = await Promise.all([
        this._getTotalUsers(),
        this._getNewUsers(dateRange),
        this._getTotalStores(),
        this._getNewStores(dateRange),
        this._getTotalProducts(),
        this._getNewProducts(dateRange),
        this._getTotalOrders(),
        this._getNewOrders(dateRange),
        this._getTotalRevenue(),
        this._getNewRevenue(dateRange)
      ]);

      const metrics = {
        period,
        dateRange,
        users: {
          total: totalUsers,
          new: newUsers,
          growth: this._calculateGrowth(totalUsers, newUsers)
        },
        stores: {
          total: totalStores,
          new: newStores,
          growth: this._calculateGrowth(totalStores, newStores)
        },
        products: {
          total: totalProducts,
          new: newProducts,
          growth: this._calculateGrowth(totalProducts, newProducts)
        },
        orders: {
          total: totalOrders,
          new: newOrders,
          growth: this._calculateGrowth(totalOrders, newOrders)
        },
        revenue: {
          total: totalRevenue,
          new: newRevenue,
          growth: this._calculateGrowth(totalRevenue, newRevenue)
        },
        generatedAt: new Date().toISOString()
      };

      // Mettre en cache
      await redisClient.setex(cacheKey, this.cacheTimeout, JSON.stringify(metrics));
      
      return metrics;
    } catch (error) {
      console.error('Erreur lors de la récupération des métriques:', error);
      throw error;
    }
  }

  /**
   * Analytics pour une boutique spécifique
   */
  async getStoreAnalytics(storeId, period = '30d') {
    const cacheKey = `analytics:store:${storeId}:${period}`;
    
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const dateRange = this._getDateRange(period);
      
      const [
        storeInfo,
        productMetrics,
        orderMetrics,
        revenueMetrics,
        customerMetrics,
        topProducts,
        recentOrders
      ] = await Promise.all([
        this._getStoreInfo(storeId),
        this._getStoreProductMetrics(storeId, dateRange),
        this._getStoreOrderMetrics(storeId, dateRange),
        this._getStoreRevenueMetrics(storeId, dateRange),
        this._getStoreCustomerMetrics(storeId, dateRange),
        this._getTopProducts(storeId, dateRange),
        this._getRecentOrders(storeId, 10)
      ]);

      const analytics = {
        store: storeInfo,
        period,
        dateRange,
        products: productMetrics,
        orders: orderMetrics,
        revenue: revenueMetrics,
        customers: customerMetrics,
        topProducts,
        recentOrders,
        generatedAt: new Date().toISOString()
      };

      await redisClient.setex(cacheKey, this.cacheTimeout, JSON.stringify(analytics));
      
      return analytics;
    } catch (error) {
      console.error('Erreur lors de la récupération des analytics de boutique:', error);
      throw error;
    }
  }

  /**
   * Analytics des ventes par période
   */
  async getSalesAnalytics(storeId = null, period = '30d', groupBy = 'day') {
    const cacheKey = `analytics:sales:${storeId || 'platform'}:${period}:${groupBy}`;
    
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const dateRange = this._getDateRange(period);
      const salesData = await this._getSalesData(storeId, dateRange, groupBy);
      
      const analytics = {
        storeId,
        period,
        dateRange,
        groupBy,
        data: salesData,
        summary: {
          totalSales: salesData.reduce((sum, item) => sum + item.revenue, 0),
          totalOrders: salesData.reduce((sum, item) => sum + item.orders, 0),
          averageOrderValue: salesData.length > 0 
            ? salesData.reduce((sum, item) => sum + item.revenue, 0) / salesData.reduce((sum, item) => sum + item.orders, 0)
            : 0
        },
        generatedAt: new Date().toISOString()
      };

      await redisClient.setex(cacheKey, this.cacheTimeout, JSON.stringify(analytics));
      
      return analytics;
    } catch (error) {
      console.error('Erreur lors de la récupération des analytics de ventes:', error);
      throw error;
    }
  }

  /**
   * Analytics des produits les plus populaires
   */
  async getProductAnalytics(period = '30d', limit = 10) {
    const cacheKey = `analytics:products:${period}:${limit}`;
    
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const dateRange = this._getDateRange(period);
      
      const [topProducts, categoryStats, priceRangeStats] = await Promise.all([
        this._getTopSellingProducts(dateRange, limit),
        this._getCategoryStats(dateRange),
        this._getPriceRangeStats(dateRange)
      ]);

      const analytics = {
        period,
        dateRange,
        topProducts,
        categoryStats,
        priceRangeStats,
        generatedAt: new Date().toISOString()
      };

      await redisClient.setex(cacheKey, this.cacheTimeout, JSON.stringify(analytics));
      
      return analytics;
    } catch (error) {
      console.error('Erreur lors de la récupération des analytics produits:', error);
      throw error;
    }
  }

  /**
   * Analytics des utilisateurs
   */
  async getUserAnalytics(period = '30d') {
    const cacheKey = `analytics:users:${period}`;
    
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const dateRange = this._getDateRange(period);
      
      const [
        registrationStats,
        roleDistribution,
        locationStats,
        activityStats
      ] = await Promise.all([
        this._getRegistrationStats(dateRange),
        this._getUserRoleDistribution(),
        this._getUserLocationStats(),
        this._getUserActivityStats(dateRange)
      ]);

      const analytics = {
        period,
        dateRange,
        registrations: registrationStats,
        roleDistribution,
        locationStats,
        activityStats,
        generatedAt: new Date().toISOString()
      };

      await redisClient.setex(cacheKey, this.cacheTimeout, JSON.stringify(analytics));
      
      return analytics;
    } catch (error) {
      console.error('Erreur lors de la récupération des analytics utilisateurs:', error);
      throw error;
    }
  }

  /**
   * Enregistrer un événement d'analytics
   */
  async trackEvent(eventType, data, userId = null, sessionId = null) {
    try {
      const eventData = {
        id: require('crypto').randomUUID(),
        type: eventType,
        data: JSON.stringify(data),
        userId,
        sessionId,
        userAgent: data.userAgent || null,
        ipAddress: data.ipAddress || null,
        createdAt: new Date()
      };

      // Enregistrer l'événement (vous pourriez créer une table events)
      await this._saveEvent(eventData);
      
      // Mettre à jour les compteurs en temps réel dans Redis
      await this._updateRealTimeCounters(eventType, data);
      
      return eventData.id;
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de l\'événement:', error);
      throw error;
    }
  }

  /**
   * Méthodes privées pour les requêtes de base de données
   */
  
  async _getTotalUsers() {
    const result = await knex('users').count('id as count').first();
    return parseInt(result.count);
  }

  async _getNewUsers(dateRange) {
    const result = await knex('users')
      .count('id as count')
      .whereBetween('createdAt', [dateRange.from, dateRange.to])
      .first();
    return parseInt(result.count);
  }

  async _getTotalStores() {
    const result = await knex('stores').count('id as count').first();
    return parseInt(result.count);
  }

  async _getNewStores(dateRange) {
    const result = await knex('stores')
      .count('id as count')
      .whereBetween('createdAt', [dateRange.from, dateRange.to])
      .first();
    return parseInt(result.count);
  }

  async _getTotalProducts() {
    const result = await knex('products').count('id as count').first();
    return parseInt(result.count);
  }

  async _getNewProducts(dateRange) {
    const result = await knex('products')
      .count('id as count')
      .whereBetween('createdAt', [dateRange.from, dateRange.to])
      .first();
    return parseInt(result.count);
  }

  async _getTotalOrders() {
    const result = await knex('orders').count('id as count').first();
    return parseInt(result.count);
  }

  async _getNewOrders(dateRange) {
    const result = await knex('orders')
      .count('id as count')
      .whereBetween('createdAt', [dateRange.from, dateRange.to])
      .first();
    return parseInt(result.count);
  }

  async _getTotalRevenue() {
    const result = await knex('orders')
      .sum('totalAmount as total')
      .where('status', 'completed')
      .first();
    return parseFloat(result.total) || 0;
  }

  async _getNewRevenue(dateRange) {
    const result = await knex('orders')
      .sum('totalAmount as total')
      .where('status', 'completed')
      .whereBetween('createdAt', [dateRange.from, dateRange.to])
      .first();
    return parseFloat(result.total) || 0;
  }

  async _getStoreInfo(storeId) {
    return await knex('stores')
      .select('id', 'name', 'slug', 'description', 'createdAt', 'isActive', 'isVerified')
      .where('id', storeId)
      .first();
  }

  async _getStoreProductMetrics(storeId, dateRange) {
    const [total, active, newProducts] = await Promise.all([
      knex('products').count('id as count').where('storeId', storeId).first(),
      knex('products').count('id as count').where('storeId', storeId).where('status', 'active').first(),
      knex('products').count('id as count').where('storeId', storeId).whereBetween('createdAt', [dateRange.from, dateRange.to]).first()
    ]);

    return {
      total: parseInt(total.count),
      active: parseInt(active.count),
      new: parseInt(newProducts.count)
    };
  }

  async _getStoreOrderMetrics(storeId, dateRange) {
    const [total, newOrders, completedOrders] = await Promise.all([
      knex('orders').count('id as count').where('storeId', storeId).first(),
      knex('orders').count('id as count').where('storeId', storeId).whereBetween('createdAt', [dateRange.from, dateRange.to]).first(),
      knex('orders').count('id as count').where('storeId', storeId).where('status', 'completed').whereBetween('createdAt', [dateRange.from, dateRange.to]).first()
    ]);

    return {
      total: parseInt(total.count),
      new: parseInt(newOrders.count),
      completed: parseInt(completedOrders.count)
    };
  }

  async _getStoreRevenueMetrics(storeId, dateRange) {
    const [totalRevenue, newRevenue] = await Promise.all([
      knex('orders').sum('totalAmount as total').where('storeId', storeId).where('status', 'completed').first(),
      knex('orders').sum('totalAmount as total').where('storeId', storeId).where('status', 'completed').whereBetween('createdAt', [dateRange.from, dateRange.to]).first()
    ]);

    return {
      total: parseFloat(totalRevenue.total) || 0,
      new: parseFloat(newRevenue.total) || 0
    };
  }

  async _getStoreCustomerMetrics(storeId, dateRange) {
    const [totalCustomers, newCustomers, repeatCustomers] = await Promise.all([
      knex('orders').countDistinct('userId as count').where('storeId', storeId).first(),
      knex('orders').countDistinct('userId as count').where('storeId', storeId).whereBetween('createdAt', [dateRange.from, dateRange.to]).first(),
      knex('orders')
        .countDistinct('userId as count')
        .where('storeId', storeId)
        .havingRaw('COUNT(*) > 1')
        .groupBy('userId')
        .then(results => results.length)
    ]);

    return {
      total: parseInt(totalCustomers.count),
      new: parseInt(newCustomers.count),
      repeat: repeatCustomers
    };
  }

  async _getTopProducts(storeId, dateRange, limit = 5) {
    return await knex('products')
      .select(
        'products.id',
        'products.name',
        'products.price',
        knex.raw('COALESCE(SUM(order_items.quantity), 0) as totalSold'),
        knex.raw('COALESCE(SUM(order_items.quantity * order_items.price), 0) as revenue')
      )
      .leftJoin('order_items', 'products.id', 'order_items.productId')
      .leftJoin('orders', function() {
        this.on('order_items.orderId', 'orders.id')
          .andOn('orders.status', knex.raw('?', ['completed']))
          .andOn('orders.createdAt', '>=', knex.raw('?', [dateRange.from]))
          .andOn('orders.createdAt', '<=', knex.raw('?', [dateRange.to]));
      })
      .where('products.storeId', storeId)
      .groupBy('products.id', 'products.name', 'products.price')
      .orderBy('totalSold', 'desc')
      .limit(limit);
  }

  async _getRecentOrders(storeId, limit = 10) {
    return await knex('orders')
      .select(
        'orders.id',
        'orders.orderNumber',
        'orders.totalAmount',
        'orders.status',
        'orders.createdAt',
        'users.firstName',
        'users.lastName'
      )
      .join('users', 'orders.userId', 'users.id')
      .where('orders.storeId', storeId)
      .orderBy('orders.createdAt', 'desc')
      .limit(limit);
  }

  async _getSalesData(storeId, dateRange, groupBy) {
    let dateFormat;
    switch (groupBy) {
      case 'hour':
        dateFormat = 'YYYY-MM-DD HH24:00:00';
        break;
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        dateFormat = 'YYYY-"W"WW';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
    }

    let query = knex('orders')
      .select(
        knex.raw(`TO_CHAR(created_at, '${dateFormat}') as period`),
        knex.raw('COUNT(*) as orders'),
        knex.raw('COALESCE(SUM(total_amount), 0) as revenue')
      )
      .where('status', 'completed')
      .whereBetween('createdAt', [dateRange.from, dateRange.to])
      .groupBy('period')
      .orderBy('period');

    if (storeId) {
      query = query.where('storeId', storeId);
    }

    return await query;
  }

  async _getTopSellingProducts(dateRange, limit) {
    return await knex('products')
      .select(
        'products.id',
        'products.name',
        'products.price',
        'stores.name as storeName',
        knex.raw('SUM(order_items.quantity) as totalSold'),
        knex.raw('SUM(order_items.quantity * order_items.price) as revenue')
      )
      .join('order_items', 'products.id', 'order_items.productId')
      .join('orders', function() {
        this.on('order_items.orderId', 'orders.id')
          .andOn('orders.status', knex.raw('?', ['completed']))
          .andOn('orders.createdAt', '>=', knex.raw('?', [dateRange.from]))
          .andOn('orders.createdAt', '<=', knex.raw('?', [dateRange.to]));
      })
      .join('stores', 'products.storeId', 'stores.id')
      .groupBy('products.id', 'products.name', 'products.price', 'stores.name')
      .orderBy('totalSold', 'desc')
      .limit(limit);
  }

  async _getCategoryStats(dateRange) {
    return await knex('categories')
      .select(
        'categories.name',
        knex.raw('COUNT(DISTINCT products.id) as productCount'),
        knex.raw('COALESCE(SUM(order_items.quantity), 0) as totalSold'),
        knex.raw('COALESCE(SUM(order_items.quantity * order_items.price), 0) as revenue')
      )
      .leftJoin('products', 'categories.id', 'products.categoryId')
      .leftJoin('order_items', 'products.id', 'order_items.productId')
      .leftJoin('orders', function() {
        this.on('order_items.orderId', 'orders.id')
          .andOn('orders.status', knex.raw('?', ['completed']))
          .andOn('orders.createdAt', '>=', knex.raw('?', [dateRange.from]))
          .andOn('orders.createdAt', '<=', knex.raw('?', [dateRange.to]));
      })
      .groupBy('categories.id', 'categories.name')
      .orderBy('revenue', 'desc');
  }

  async _getPriceRangeStats(dateRange) {
    return await knex('products')
      .select(
        knex.raw(`
          CASE 
            WHEN price < 10000 THEN '< 10,000 FCFA'
            WHEN price < 25000 THEN '10,000 - 25,000 FCFA'
            WHEN price < 50000 THEN '25,000 - 50,000 FCFA'
            WHEN price < 100000 THEN '50,000 - 100,000 FCFA'
            ELSE '> 100,000 FCFA'
          END as priceRange
        `),
        knex.raw('COUNT(*) as productCount'),
        knex.raw('COALESCE(SUM(order_items.quantity), 0) as totalSold')
      )
      .leftJoin('order_items', 'products.id', 'order_items.productId')
      .leftJoin('orders', function() {
        this.on('order_items.orderId', 'orders.id')
          .andOn('orders.status', knex.raw('?', ['completed']))
          .andOn('orders.createdAt', '>=', knex.raw('?', [dateRange.from]))
          .andOn('orders.createdAt', '<=', knex.raw('?', [dateRange.to]));
      })
      .groupBy('priceRange')
      .orderBy(knex.raw('MIN(price)'));
  }

  async _getRegistrationStats(dateRange) {
    return await knex('users')
      .select(
        knex.raw('DATE(created_at) as date'),
        knex.raw('COUNT(*) as registrations')
      )
      .whereBetween('createdAt', [dateRange.from, dateRange.to])
      .groupBy('date')
      .orderBy('date');
  }

  async _getUserRoleDistribution() {
    return await knex('users')
      .select('role')
      .count('* as count')
      .groupBy('role');
  }

  async _getUserLocationStats() {
    return await knex('users')
      .select('country', 'city')
      .count('* as count')
      .whereNotNull('country')
      .groupBy('country', 'city')
      .orderBy('count', 'desc')
      .limit(20);
  }

  async _getUserActivityStats(dateRange) {
    // Cette méthode nécessiterait une table d'activité utilisateur
    // Pour l'instant, on retourne les dernières connexions basées sur updatedAt
    return await knex('users')
      .select(
        knex.raw('DATE(updated_at) as date'),
        knex.raw('COUNT(DISTINCT id) as activeUsers')
      )
      .whereBetween('updatedAt', [dateRange.from, dateRange.to])
      .groupBy('date')
      .orderBy('date');
  }

  async _saveEvent(eventData) {
    // Implémentation simple avec Redis pour stocker les événements
    // En production, vous pourriez créer une table events
    const eventKey = `event:${eventData.id}`;
    await redisClient.setex(eventKey, 86400 * 7, JSON.stringify(eventData)); // 7 jours
  }

  async _updateRealTimeCounters(eventType, data) {
    const today = new Date().toISOString().split('T')[0];
    
    // Compteurs journaliers
    await redisClient.hincrby(`counters:${today}`, eventType, 1);
    
    // Compteurs globaux
    await redisClient.hincrby('counters:global', eventType, 1);
    
    // Expiration des compteurs journaliers (30 jours)
    await redisClient.expire(`counters:${today}`, 86400 * 30);
  }

  /**
   * Utilitaires
   */
  
  _getDateRange(period) {
    const now = new Date();
    const from = new Date();
    
    switch (period) {
      case '24h':
        from.setDate(now.getDate() - 1);
        break;
      case '7d':
        from.setDate(now.getDate() - 7);
        break;
      case '30d':
        from.setDate(now.getDate() - 30);
        break;
      case '90d':
        from.setDate(now.getDate() - 90);
        break;
      case '1y':
        from.setFullYear(now.getFullYear() - 1);
        break;
      default:
        from.setDate(now.getDate() - 30);
    }
    
    return {
      from: from.toISOString(),
      to: now.toISOString()
    };
  }

  _calculateGrowth(total, newCount) {
    const previous = total - newCount;
    if (previous === 0) return newCount > 0 ? 100 : 0;
    return Math.round((newCount / previous) * 100);
  }

  /**
   * Nettoyer le cache
   */
  async clearAnalyticsCache(pattern = 'analytics:*') {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error('Erreur lors du nettoyage du cache:', error);
      throw error;
    }
  }
}

module.exports = new AnalyticsService();
