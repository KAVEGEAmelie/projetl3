const rateLimit = require('express-rate-limit');
const redis = require('redis');

// Configuration Redis pour le stockage des compteurs
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  retry_strategy: (times) => Math.min(times * 50, 2000)
});

redisClient.on('error', (err) => {
  console.error('Erreur Redis (Rate Limiter):', err);
});

/**
 * Store personnalisé Redis pour express-rate-limit
 */
class RedisStore {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rate_limit:';
    this.client = redisClient;
  }

  async incr(key) {
    const fullKey = this.prefix + key;
    
    try {
      const multi = this.client.multi();
      multi.incr(fullKey);
      multi.expire(fullKey, this.windowMs / 1000);
      const results = await multi.exec();
      
      return {
        totalHits: results[0][1],
        resetTime: new Date(Date.now() + this.windowMs)
      };
    } catch (error) {
      console.error('Erreur Redis Store:', error);
      // Fallback: autoriser la requête en cas d'erreur Redis
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key) {
    const fullKey = this.prefix + key;
    try {
      await this.client.decr(fullKey);
    } catch (error) {
      console.error('Erreur Redis decrement:', error);
    }
  }

  async resetKey(key) {
    const fullKey = this.prefix + key;
    try {
      await this.client.del(fullKey);
    } catch (error) {
      console.error('Erreur Redis reset:', error);
    }
  }
}

/**
 * Générateur de clés personnalisé
 */
const generateKey = (req, suffix = '') => {
  // Utiliser l'IP + User-Agent + ID utilisateur si disponible
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';
  const userId = req.user?.id || 'anonymous';
  
  const baseKey = `${ip}_${Buffer.from(userAgent).toString('base64').slice(0, 10)}_${userId}`;
  return suffix ? `${baseKey}_${suffix}` : baseKey;
};

/**
 * Messages d'erreur personnalisés
 */
const getRateLimitMessage = (type, limit, windowMs) => {
  const windowMinutes = Math.floor(windowMs / 60000);
  const windowSeconds = Math.floor((windowMs % 60000) / 1000);
  const window = windowMinutes > 0 ? `${windowMinutes} minute(s)` : `${windowSeconds} seconde(s)`;
  
  const messages = {
    general: `Trop de requêtes. Limite: ${limit} requêtes par ${window}`,
    auth: `Trop de tentatives de connexion. Veuillez patienter ${window} avant de réessayer`,
    api: `Limite d'API atteinte. ${limit} requêtes autorisées par ${window}`,
    upload: `Trop de téléchargements. Limite: ${limit} fichiers par ${window}`,
    payment: `Trop de tentatives de paiement. Veuillez patienter ${window}`,
    registration: `Trop d'inscriptions depuis cette IP. Limite: ${limit} par ${window}`
  };
  
  return messages[type] || messages.general;
};

/**
 * Rate limiter général (toutes les requêtes)
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requêtes par IP
  message: getRateLimitMessage('general', 1000, 15 * 60 * 1000),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => generateKey(req, 'general'),
  store: new RedisStore({ prefix: 'general_limit:' }),
  skip: (req) => {
    // Skip pour les admins
    return req.user?.role === 'super_admin' || req.user?.role === 'admin';
  }
});

/**
 * Rate limiter strict pour l'authentification
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives par IP
  message: getRateLimitMessage('auth', 5, 15 * 60 * 1000),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => generateKey(req, 'auth'),
  store: new RedisStore({ prefix: 'auth_limit:' }),
  skipSuccessfulRequests: true, // Ne pas compter les requêtes réussies
  onLimitReached: (req, res, options) => {
    console.warn(`Rate limit atteint pour l'auth - IP: ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
  }
});

/**
 * Rate limiter pour les APIs sensibles
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requêtes par minute
  message: getRateLimitMessage('api', 100, 60 * 1000),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => generateKey(req, 'api'),
  store: new RedisStore({ prefix: 'api_limit:' }),
  skip: (req) => {
    // Limites plus élevées pour les utilisateurs authentifiés
    if (req.user) {
      return false; // Appliquer un rate limit différent
    }
    return false;
  }
});

/**
 * Rate limiter pour les téléchargements
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 50, // 50 uploads par heure
  message: getRateLimitMessage('upload', 50, 60 * 60 * 1000),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => generateKey(req, 'upload'),
  store: new RedisStore({ prefix: 'upload_limit:' })
});

/**
 * Rate limiter pour les paiements
 */
const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 tentatives de paiement par 5 minutes
  message: getRateLimitMessage('payment', 3, 5 * 60 * 1000),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => generateKey(req, 'payment'),
  store: new RedisStore({ prefix: 'payment_limit:' }),
  onLimitReached: (req, res, options) => {
    console.warn(`Tentatives de paiement suspectes - IP: ${req.ip}, User: ${req.user?.id}`);
    // Notifier l'équipe de sécurité si nécessaire
  }
});

/**
 * Rate limiter pour les inscriptions
 */
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3, // 3 inscriptions par IP par heure
  message: getRateLimitMessage('registration', 3, 60 * 60 * 1000),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  store: new RedisStore({ prefix: 'registration_limit:' })
});

/**
 * Rate limiter adaptatif basé sur l'utilisateur
 */
const createUserBasedLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    guestMax = 100,
    userMax = 500,
    vendorMax = 1000,
    adminMax = 5000
  } = options;

  return rateLimit({
    windowMs,
    max: (req) => {
      if (!req.user) return guestMax;
      
      switch (req.user.role) {
        case 'super_admin':
        case 'admin':
          return adminMax;
        case 'vendor':
        case 'manager':
          return vendorMax;
        case 'customer':
          return userMax;
        default:
          return guestMax;
      }
    },
    message: (req, res) => {
      const max = res.locals.limit;
      return getRateLimitMessage('api', max, windowMs);
    },
    keyGenerator: (req) => generateKey(req, 'user_based'),
    store: new RedisStore({ prefix: 'user_limit:' }),
    standardHeaders: true,
    legacyHeaders: false
  });
};

/**
 * Rate limiter pour la recherche
 */
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 recherches par minute
  message: getRateLimitMessage('general', 60, 60 * 1000),
  keyGenerator: (req) => generateKey(req, 'search'),
  store: new RedisStore({ prefix: 'search_limit:' }),
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Middleware pour réinitialiser les compteurs en cas de succès
 */
const resetOnSuccess = (limiterType) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(body) {
      // Si la réponse est un succès, réinitialiser le compteur
      if (res.statusCode < 400) {
        const key = generateKey(req, limiterType);
        const store = new RedisStore({ prefix: `${limiterType}_limit:` });
        store.resetKey(key).catch(err => {
          console.error('Erreur lors de la réinitialisation du rate limit:', err);
        });
      }
      
      return originalSend.call(this, body);
    };
    
    next();
  };
};

/**
 * Middleware pour la détection d'abus
 */
const abuseDetection = (req, res, next) => {
  const suspiciousPatterns = [
    // Trop de requêtes vers des endpoints sensibles
    /\/(admin|api\/admin|debug|test)/i,
    // Tentatives d'injection
    /(union|select|insert|delete|drop|script|eval)/i,
    // Scanning de vulnérabilités
    /(wp-admin|phpmyadmin|\.env|config)/i
  ];

  const url = req.originalUrl || req.url;
  const userAgent = req.get('User-Agent') || '';
  
  // Détecter les patterns suspects
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(url)) ||
                      userAgent.includes('bot') ||
                      userAgent.includes('crawler') ||
                      userAgent.length < 10;

  if (isSuspicious) {
    console.warn(`Activité suspecte détectée - IP: ${req.ip}, URL: ${url}, UA: ${userAgent}`);
    
    // Appliquer un rate limit très strict pour cette IP
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 heure
      max: 5, // 5 requêtes maximum
      message: 'Activité suspecte détectée. Accès temporairement restreint.',
      keyGenerator: () => req.ip,
      store: new RedisStore({ prefix: 'abuse_limit:' })
    })(req, res, next);
  }

  next();
};

module.exports = {
  generalLimiter,
  authLimiter,
  apiLimiter,
  uploadLimiter,
  paymentLimiter,
  registrationLimiter,
  searchLimiter,
  createUserBasedLimiter,
  resetOnSuccess,
  abuseDetection,
  RedisStore
};
