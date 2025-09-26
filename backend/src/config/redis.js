const { createClient } = require('redis');
require('dotenv').config();

/**
 * Configuration Redis pour la mise en cache et les sessions
 */
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
  retryDelayOnFailover: 100,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3,
  lazyConnect: true
};

// Créer le client Redis
const client = createClient({
  socket: {
    host: redisConfig.host,
    port: redisConfig.port,
  },
  password: redisConfig.password,
  database: redisConfig.db
});

// Gestion des événements Redis
client.on('connect', () => {
  console.log('🔄 Connexion à Redis en cours...');
});

client.on('ready', () => {
  console.log('✅ Redis connecté et prêt');
});

client.on('error', (err) => {
  console.error('❌ Erreur Redis:', err.message);
});

client.on('end', () => {
  console.log('🔌 Connexion Redis fermée');
});

client.on('reconnecting', () => {
  console.log('🔄 Reconnexion à Redis...');
});

// Connecter le client
if (process.env.REDIS_HOST) {
  client.connect().catch(err => {
    console.error('❌ Impossible de se connecter à Redis:', err.message);
  });
}

/**
 * Fonctions utilitaires pour la cache
 */
const cache = {
  /**
   * Définir une valeur dans le cache
   */
  set: async (key, value, ttl = 3600) => {
    try {
      const serializedValue = JSON.stringify(value);
      await client.setEx(key, ttl, serializedValue);
      return true;
    } catch (error) {
      console.error('❌ Erreur cache SET:', error);
      return false;
    }
  },

  /**
   * Récupérer une valeur du cache
   */
  get: async (key) => {
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('❌ Erreur cache GET:', error);
      return null;
    }
  },

  /**
   * Supprimer une clé du cache
   */
  del: async (key) => {
    try {
      await client.del(key);
      return true;
    } catch (error) {
      console.error('❌ Erreur cache DEL:', error);
      return false;
    }
  },

  /**
   * Supprimer plusieurs clés par pattern
   */
  delPattern: async (pattern) => {
    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
      return keys.length;
    } catch (error) {
      console.error('❌ Erreur cache DEL PATTERN:', error);
      return 0;
    }
  },

  /**
   * Vérifier si une clé existe
   */
  exists: async (key) => {
    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('❌ Erreur cache EXISTS:', error);
      return false;
    }
  },

  /**
   * Définir un TTL sur une clé existante
   */
  expire: async (key, ttl) => {
    try {
      await client.expire(key, ttl);
      return true;
    } catch (error) {
      console.error('❌ Erreur cache EXPIRE:', error);
      return false;
    }
  },

  /**
   * Incrémenter une valeur numérique
   */
  incr: async (key, amount = 1) => {
    try {
      if (amount === 1) {
        return await client.incr(key);
      } else {
        return await client.incrBy(key, amount);
      }
    } catch (error) {
      console.error('❌ Erreur cache INCR:', error);
      return null;
    }
  },

  /**
   * Définir une valeur avec expiration si elle n'existe pas
   */
  setNX: async (key, value, ttl = 3600) => {
    try {
      const serializedValue = JSON.stringify(value);
      const result = await client.set(key, serializedValue, {
        EX: ttl,
        NX: true
      });
      return result === 'OK';
    } catch (error) {
      console.error('❌ Erreur cache SETNX:', error);
      return false;
    }
  }
};

/**
 * Fonctions pour les listes Redis (utile pour les queues)
 */
const lists = {
  /**
   * Ajouter un élément à la fin d'une liste
   */
  push: async (key, value) => {
    try {
      const serializedValue = JSON.stringify(value);
      return await client.rPush(key, serializedValue);
    } catch (error) {
      console.error('❌ Erreur liste PUSH:', error);
      return 0;
    }
  },

  /**
   * Retirer et récupérer le premier élément d'une liste
   */
  pop: async (key) => {
    try {
      const value = await client.lPop(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('❌ Erreur liste POP:', error);
      return null;
    }
  },

  /**
   * Récupérer la longueur d'une liste
   */
  length: async (key) => {
    try {
      return await client.lLen(key);
    } catch (error) {
      console.error('❌ Erreur liste LENGTH:', error);
      return 0;
    }
  },

  /**
   * Récupérer des éléments d'une liste
   */
  range: async (key, start = 0, end = -1) => {
    try {
      const values = await client.lRange(key, start, end);
      return values.map(value => JSON.parse(value));
    } catch (error) {
      console.error('❌ Erreur liste RANGE:', error);
      return [];
    }
  }
};

/**
 * Fonctions pour les sets Redis (utile pour les tags, favoris, etc.)
 */
const sets = {
  /**
   * Ajouter un membre à un set
   */
  add: async (key, value) => {
    try {
      const serializedValue = JSON.stringify(value);
      return await client.sAdd(key, serializedValue);
    } catch (error) {
      console.error('❌ Erreur set ADD:', error);
      return 0;
    }
  },

  /**
   * Supprimer un membre d'un set
   */
  remove: async (key, value) => {
    try {
      const serializedValue = JSON.stringify(value);
      return await client.sRem(key, serializedValue);
    } catch (error) {
      console.error('❌ Erreur set REMOVE:', error);
      return 0;
    }
  },

  /**
   * Vérifier si un membre existe dans un set
   */
  isMember: async (key, value) => {
    try {
      const serializedValue = JSON.stringify(value);
      const result = await client.sIsMember(key, serializedValue);
      return result === 1;
    } catch (error) {
      console.error('❌ Erreur set ISMEMBER:', error);
      return false;
    }
  },

  /**
   * Récupérer tous les membres d'un set
   */
  members: async (key) => {
    try {
      const values = await client.sMembers(key);
      return values.map(value => JSON.parse(value));
    } catch (error) {
      console.error('❌ Erreur set MEMBERS:', error);
      return [];
    }
  },

  /**
   * Récupérer le nombre de membres d'un set
   */
  count: async (key) => {
    try {
      return await client.sCard(key);
    } catch (error) {
      console.error('❌ Erreur set COUNT:', error);
      return 0;
    }
  }
};

/**
 * Middleware de cache pour Express
 */
const cacheMiddleware = (ttl = 3600, keyGenerator = null) => {
  return async (req, res, next) => {
    // Ignorer la cache si Redis n'est pas disponible
    if (!client.isReady) {
      return next();
    }

    try {
      // Générer la clé de cache
      const cacheKey = keyGenerator 
        ? keyGenerator(req) 
        : `cache:${req.method}:${req.originalUrl}`;

      // Vérifier si la réponse est en cache
      const cachedData = await cache.get(cacheKey);
      
      if (cachedData) {
        console.log(`📦 Cache HIT: ${cacheKey}`);
        return res.json(cachedData);
      }

      // Intercepter la réponse pour la mettre en cache
      const originalJson = res.json;
      res.json = function(data) {
        // Mettre en cache seulement les réponses de succès
        if (res.statusCode === 200 && data.success !== false) {
          cache.set(cacheKey, data, ttl).catch(err => {
            console.error('❌ Erreur mise en cache:', err);
          });
          console.log(`💾 Cache SET: ${cacheKey}`);
        }
        
        return originalJson.call(this, data);
      };

      next();

    } catch (error) {
      console.error('❌ Erreur middleware cache:', error);
      next();
    }
  };
};

/**
 * Rate limiting utilisant Redis
 */
const rateLimitMiddleware = (windowMs = 900000, max = 100, message = 'Trop de requêtes') => {
  return async (req, res, next) => {
    if (!client.isReady) {
      return next();
    }

    try {
      const key = `rate_limit:${req.ip}`;
      const current = await cache.incr(key);
      
      if (current === 1) {
        await cache.expire(key, Math.ceil(windowMs / 1000));
      }
      
      if (current > max) {
        return res.status(429).json({
          success: false,
          error: message,
          code: 'TOO_MANY_REQUESTS'
        });
      }
      
      next();
    } catch (error) {
      console.error('❌ Erreur rate limiting:', error);
      next();
    }
  };
};

// Clés prédéfinies pour différents types de cache
const CACHE_KEYS = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories', 
  STORES: 'stores',
  USER_PROFILE: (userId) => `user:${userId}`,
  USER_WISHLIST: (userId) => `wishlist:${userId}`,
  USER_CART: (userId) => `cart:${userId}`,
  PRODUCT_VIEWS: (productId) => `product:${productId}:views`,
  SEARCH_RESULTS: (query) => `search:${Buffer.from(query).toString('base64')}`,
  ANALYTICS: 'analytics',
  POPULAR_PRODUCTS: 'popular_products',
  FEATURED_PRODUCTS: 'featured_products'
};

module.exports = {
  client,
  cache,
  lists,
  sets,
  cacheMiddleware,
  rateLimitMiddleware,
  CACHE_KEYS,
  isConnected: () => client.isReady
};