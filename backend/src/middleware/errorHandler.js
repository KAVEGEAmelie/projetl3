const fs = require('fs');
const path = require('path');

/**
 * Classes d'erreurs personnalisées pour AfrikMode
 */
class AppError extends Error {
  constructor(message, statusCode, code = null, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentification requise') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Accès refusé') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Ressource non trouvée') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

class ConflictError extends AppError {
  constructor(message, details = null) {
    super(message, 409, 'CONFLICT_ERROR', details);
  }
}

class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500, 'DATABASE_ERROR', originalError?.message);
    this.originalError = originalError;
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Trop de tentatives, réessayez plus tard', retryAfter = null) {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.retryAfter = retryAfter;
  }
}

class PaymentError extends AppError {
  constructor(message, paymentCode = null) {
    super(message, 402, 'PAYMENT_ERROR', { paymentCode });
  }
}

class StockError extends AppError {
  constructor(message, availableQuantity = 0) {
    super(message, 409, 'STOCK_ERROR', { availableQuantity });
  }
}

/**
 * Logger pour les erreurs
 */
class ErrorLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatError(error, req = null) {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      level: this.getLogLevel(error.statusCode),
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      stack: error.stack,
      details: error.details
    };

    if (req) {
      errorInfo.request = {
        method: req.method,
        url: req.originalUrl || req.url,
        headers: this.sanitizeHeaders(req.headers),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id || null
      };
    }

    return errorInfo;
  }

  getLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    delete sanitized.authorization;
    delete sanitized.cookie;
    return sanitized;
  }

  async log(error, req = null) {
    const errorInfo = this.formatError(error, req);
    
    // Log dans la console en développement
    if (process.env.NODE_ENV === 'development') {
      console.error('💥 Erreur capturée:', errorInfo);
    }

    // Écriture dans fichier
    await this.writeToFile(errorInfo);
    
    // En production, envoyer vers service de monitoring externe
    if (process.env.NODE_ENV === 'production') {
      await this.sendToExternalService(errorInfo);
    }
  }

  async writeToFile(errorInfo) {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `error-${date}.log`);
    
    const logEntry = JSON.stringify(errorInfo) + '\n';
    
    try {
      await fs.promises.appendFile(logFile, logEntry);
    } catch (writeError) {
      console.error('Erreur lors de l\'écriture du log:', writeError);
    }
  }

  async sendToExternalService(errorInfo) {
    // Ici vous pouvez intégrer des services comme Sentry, LogRocket, etc.
    // Exemple avec Sentry:
    // Sentry.captureException(error, { extra: errorInfo });
    
    console.log('🔴 Erreur envoyée au service de monitoring:', {
      level: errorInfo.level,
      message: errorInfo.message,
      code: errorInfo.code
    });
  }
}

const logger = new ErrorLogger();

/**
 * Middleware principal de gestion d'erreurs
 */
const errorHandler = (error, req, res, next) => {
  // Log de l'erreur
  logger.log(error, req).catch(console.error);

  // Définir les valeurs par défaut
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Erreur interne du serveur';
  let code = error.code || 'INTERNAL_SERVER_ERROR';
  let details = error.details || null;

  // Gestion spécifique des erreurs de base de données Knex
  if (error.code && typeof error.code === 'string') {
    switch (error.code) {
      case '23505': // Violation de contrainte unique PostgreSQL
        statusCode = 409;
        code = 'DUPLICATE_ENTRY';
        message = 'Cette ressource existe déjà';
        details = error.detail;
        break;
      case '23503': // Violation de contrainte de clé étrangère
        statusCode = 400;
        code = 'FOREIGN_KEY_VIOLATION';
        message = 'Référence invalide vers une ressource liée';
        break;
      case '23514': // Violation de contrainte check
        statusCode = 400;
        code = 'CHECK_CONSTRAINT_VIOLATION';
        message = 'Données invalides selon les règles de validation';
        break;
      case 'ECONNREFUSED':
        statusCode = 503;
        code = 'DATABASE_CONNECTION_ERROR';
        message = 'Service de base de données indisponible';
        break;
    }
  }

  // Gestion des erreurs de validation Joi
  if (error.isJoi || error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Données de requête invalides';
    
    if (error.details) {
      details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
        value: detail.context?.value
      }));
    }
  }

  // Gestion des erreurs JWT
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Token d\'authentification invalide';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token d\'authentification expiré';
  }

  // Gestion des erreurs de syntaxe JSON
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Format JSON invalide';
  }

  // Gestion des erreurs de Multer (upload de fichiers)
  if (error.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    code = 'FILE_TOO_LARGE';
    message = 'Fichier trop volumineux';
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    statusCode = 400;
    code = 'TOO_MANY_FILES';
    message = 'Trop de fichiers uploadés';
  }

  // Gestion des erreurs de limite de taux
  if (error.statusCode === 429) {
    const retryAfter = error.retryAfter || 60;
    res.set('Retry-After', retryAfter);
  }

  // Réponse d'erreur
  const errorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && { stack: error.stack }),
      timestamp: new Date().toISOString()
    }
  };

  // Ajouter les headers CORS si nécessaire
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Middleware pour les routes non trouvées
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} non trouvée`);
  next(error);
};

/**
 * Wrapper pour les fonctions async
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Créateur d'erreurs personnalisées
 */
const createError = (statusCode, message, code = null, details = null) => {
  const error = new AppError(message, statusCode, code, details);
  return error;
};

/**
 * Erreurs prédéfinies courantes
 */
const commonErrors = {
  notFound: (resource = 'Ressource') => 
    new NotFoundError(`${resource} non trouvée`),
    
  unauthorized: (message = 'Authentification requise') => 
    new AuthenticationError(message),
    
  forbidden: (message = 'Accès refusé') => 
    new AuthorizationError(message),
    
  badRequest: (message = 'Requête invalide') => 
    new ValidationError(message),
    
  validation: (message = 'Données invalides', details = null) => 
    new ValidationError(message, details),
    
  conflict: (message = 'Conflit de ressource', details = null) => 
    new ConflictError(message, details),
    
  rateLimit: (message = 'Trop de tentatives', retryAfter = null) => 
    new RateLimitError(message, retryAfter),
    
  database: (message = 'Erreur de base de données', originalError = null) => 
    new DatabaseError(message, originalError),
    
  payment: (message = 'Erreur de paiement', paymentCode = null) => 
    new PaymentError(message, paymentCode),
    
  stock: (message = 'Stock insuffisant', availableQuantity = 0) => 
    new StockError(message, availableQuantity),

  internal: (message = 'Erreur interne du serveur') => 
    new AppError(message, 500, 'INTERNAL_SERVER_ERROR')
};

/**
 * Middleware de gestion d'erreurs pour les opérations CRUD
 */
const crudErrorHandler = (operation) => {
  return (error, req, res, next) => {
    // Personnaliser les messages selon l'opération CRUD
    switch (operation) {
      case 'create':
        if (error.code === '23505') {
          error.message = 'Un élément avec ces informations existe déjà';
        }
        break;
      case 'read':
        if (error.statusCode === 404) {
          error.message = 'Aucun élément trouvé avec cet identifiant';
        }
        break;
      case 'update':
        if (error.statusCode === 404) {
          error.message = 'Impossible de modifier : élément non trouvé';
        }
        break;
      case 'delete':
        if (error.statusCode === 404) {
          error.message = 'Impossible de supprimer : élément non trouvé';
        }
        break;
    }
    
    next(error);
  };
};

/**
 * Validation des erreurs opérationnelles
 */
const isOperationalError = (error) => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

/**
 * Gestionnaire d'arrêt gracieux en cas d'erreur critique
 */
const handleCriticalError = (error) => {
  logger.log(error).catch(console.error);
  
  if (!isOperationalError(error)) {
    console.error('💥 Erreur critique non opérationnelle détectée:', error);
    
    // En production, vous pourriez vouloir redémarrer le processus
    if (process.env.NODE_ENV === 'production') {
      console.log('🔄 Redémarrage du processus...');
      process.exit(1);
    }
  }
};

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  handleCriticalError(error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  handleCriticalError(new Error(reason));
});

module.exports = {
  // Classes d'erreur
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  RateLimitError,
  PaymentError,
  StockError,
  
  // Middleware
  errorHandler,
  notFoundHandler,
  asyncHandler,
  crudErrorHandler,
  
  // Utilitaires
  createError,
  commonErrors,
  isOperationalError,
  handleCriticalError,
  
  // Logger
  ErrorLogger
};