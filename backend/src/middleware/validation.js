const Joi = require('joi');
const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('./errorHandler');

/**
 * Schémas de validation Joi pour les entités principales
 */
const schemas = {
  // Validation des utilisateurs
  user: {
    register: Joi.object({
      email: Joi.string().email().required().messages({
        'string.email': 'Format d\'email invalide',
        'string.empty': 'L\'email est requis',
        'any.required': 'L\'email est requis'
      }),
      password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required().messages({
        'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
        'string.pattern.base': 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
        'string.empty': 'Le mot de passe est requis',
        'any.required': 'Le mot de passe est requis'
      }),
      firstName: Joi.string().min(2).max(50).required().messages({
        'string.min': 'Le prénom doit contenir au moins 2 caractères',
        'string.max': 'Le prénom ne peut pas dépasser 50 caractères',
        'string.empty': 'Le prénom est requis',
        'any.required': 'Le prénom est requis'
      }),
      lastName: Joi.string().min(2).max(50).required().messages({
        'string.min': 'Le nom doit contenir au moins 2 caractères',
        'string.max': 'Le nom ne peut pas dépasser 50 caractères',
        'string.empty': 'Le nom est requis',
        'any.required': 'Le nom est requis'
      }),
      phone: Joi.string().pattern(/^(\+228|228|00228)?[79]\d{7}$/).optional().messages({
        'string.pattern.base': 'Format de téléphone togolais invalide (ex: +22870123456 ou 70123456)'
      }),
      birthDate: Joi.date().max('now').optional(),
      gender: Joi.string().valid('male', 'female', 'other').optional(),
      country: Joi.string().length(2).default('TG'),
      city: Joi.string().max(100).optional(),
      address: Joi.string().max(255).optional(),
      preferredLanguage: Joi.string().valid('fr', 'en').default('fr')
    }),

    login: Joi.object({
      email: Joi.string().email().required().messages({
        'string.email': 'Format d\'email invalide',
        'string.empty': 'L\'email est requis',
        'any.required': 'L\'email est requis'
      }),
      password: Joi.string().required().messages({
        'string.empty': 'Le mot de passe est requis',
        'any.required': 'Le mot de passe est requis'
      })
    }),

    update: Joi.object({
      firstName: Joi.string().min(2).max(50).optional(),
      lastName: Joi.string().min(2).max(50).optional(),
      phone: Joi.string().pattern(/^(\+228|228|00228)?[79]\d{7}$/).optional(),
      birthDate: Joi.date().max('now').optional(),
      gender: Joi.string().valid('male', 'female', 'other').optional(),
      bio: Joi.string().max(500).optional(),
      city: Joi.string().max(100).optional(),
      address: Joi.string().max(255).optional(),
      preferredLanguage: Joi.string().valid('fr', 'en').optional(),
      preferredCurrency: Joi.string().valid('FCFA', 'EUR', 'USD').optional()
    })
  },

  // Validation des boutiques
  store: {
    create: Joi.object({
      name: Joi.string().min(2).max(200).required().messages({
        'string.min': 'Le nom de la boutique doit contenir au moins 2 caractères',
        'string.max': 'Le nom ne peut pas dépasser 200 caractères',
        'string.empty': 'Le nom de la boutique est requis',
        'any.required': 'Le nom de la boutique est requis'
      }),
      description: Joi.string().min(10).max(2000).required().messages({
        'string.min': 'La description doit contenir au moins 10 caractères',
        'string.max': 'La description ne peut pas dépasser 2000 caractères'
      }),
      shortDescription: Joi.string().max(300).optional(),
      email: Joi.string().email().optional(),
      phone: Joi.string().pattern(/^(\+228|228|00228)?[79]\d{7}$/).optional(),
      whatsapp: Joi.string().pattern(/^(\+228|228|00228)?[79]\d{7}$/).optional(),
      website: Joi.string().uri().optional(),
      country: Joi.string().length(2).default('TG'),
      city: Joi.string().min(2).max(100).required(),
      address: Joi.string().min(5).max(255).required(),
      businessType: Joi.string().valid('fashion', 'beauty', 'crafts', 'food', 'other').default('fashion'),
      specialties: Joi.array().items(Joi.string()).optional(),
      deliveryZones: Joi.array().items(Joi.string()).optional(),
      deliveryFee: Joi.number().min(0).default(0),
      minOrderAmount: Joi.number().min(0).default(0)
    }),

    update: Joi.object({
      name: Joi.string().min(2).max(200).optional(),
      description: Joi.string().min(10).max(2000).optional(),
      shortDescription: Joi.string().max(300).optional(),
      email: Joi.string().email().allow('').optional(),
      phone: Joi.string().pattern(/^(\+228|228|00228)?[79]\d{7}$/).allow('').optional(),
      whatsapp: Joi.string().pattern(/^(\+228|228|00228)?[79]\d{7}$/).allow('').optional(),
      website: Joi.string().uri().allow('').optional(),
      city: Joi.string().min(2).max(100).optional(),
      address: Joi.string().min(5).max(255).optional(),
      specialties: Joi.array().items(Joi.string()).optional(),
      deliveryZones: Joi.array().items(Joi.string()).optional(),
      deliveryFee: Joi.number().min(0).optional(),
      minOrderAmount: Joi.number().min(0).optional()
    })
  },

  // Validation des produits
  product: {
    create: Joi.object({
      name: Joi.string().min(2).max(300).required().messages({
        'string.min': 'Le nom du produit doit contenir au moins 2 caractères',
        'string.max': 'Le nom ne peut pas dépasser 300 caractères',
        'string.empty': 'Le nom du produit est requis',
        'any.required': 'Le nom du produit est requis'
      }),
      description: Joi.string().min(10).max(5000).required().messages({
        'string.min': 'La description doit contenir au moins 10 caractères',
        'string.max': 'La description ne peut pas dépasser 5000 caractères'
      }),
      shortDescription: Joi.string().max(500).optional(),
      categoryId: Joi.string().uuid().required().messages({
        'string.uuid': 'ID de catégorie invalide',
        'any.required': 'La catégorie est requise'
      }),
      price: Joi.number().positive().required().messages({
        'number.positive': 'Le prix doit être positif',
        'any.required': 'Le prix est requis'
      }),
      compareAtPrice: Joi.number().positive().optional(),
      currency: Joi.string().valid('FCFA', 'EUR', 'USD').default('FCFA'),
      fabricType: Joi.string().max(100).optional(),
      fabricOrigin: Joi.string().max(100).optional(),
      genderTarget: Joi.string().valid('male', 'female', 'unisex', 'kids').default('unisex'),
      ageGroup: Joi.string().valid('baby', 'kids', 'teen', 'adult', 'senior').default('adult'),
      season: Joi.string().valid('spring', 'summer', 'autumn', 'winter', 'all').default('all'),
      colorOptions: Joi.array().items(Joi.string()).optional(),
      sizeOptions: Joi.array().items(Joi.string()).optional(),
      styleTags: Joi.array().items(Joi.string()).optional(),
      stockQuantity: Joi.number().min(0).default(0),
      lowStockThreshold: Joi.number().min(0).default(5)
    }),

    update: Joi.object({
      name: Joi.string().min(2).max(300).optional(),
      description: Joi.string().min(10).max(5000).optional(),
      shortDescription: Joi.string().max(500).optional(),
      categoryId: Joi.string().uuid().optional(),
      price: Joi.number().positive().optional(),
      compareAtPrice: Joi.number().positive().optional(),
      fabricType: Joi.string().max(100).allow('').optional(),
      fabricOrigin: Joi.string().max(100).allow('').optional(),
      genderTarget: Joi.string().valid('male', 'female', 'unisex', 'kids').optional(),
      ageGroup: Joi.string().valid('baby', 'kids', 'teen', 'adult', 'senior').optional(),
      season: Joi.string().valid('spring', 'summer', 'autumn', 'winter', 'all').optional(),
      colorOptions: Joi.array().items(Joi.string()).optional(),
      sizeOptions: Joi.array().items(Joi.string()).optional(),
      styleTags: Joi.array().items(Joi.string()).optional(),
      status: Joi.string().valid('draft', 'active', 'inactive', 'archived').optional()
    })
  },

  // Validation des commandes
  order: {
    create: Joi.object({
      items: Joi.array().items(Joi.object({
        productId: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).required(),
        price: Joi.number().positive().required()
      })).min(1).required().messages({
        'array.min': 'Au moins un article est requis',
        'any.required': 'Les articles sont requis'
      }),
      shippingAddress: Joi.object({
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        address: Joi.string().required(),
        city: Joi.string().required(),
        postalCode: Joi.string().optional(),
        phone: Joi.string().pattern(/^(\+228|228|00228)?[79]\d{7}$/).required()
      }).required(),
      paymentMethod: Joi.string().valid('mobile_money', 'bank_card', 'cash_on_delivery').default('mobile_money'),
      shippingMethod: Joi.string().valid('standard', 'express', 'overnight').default('standard'),
      notes: Joi.string().max(500).optional()
    })
  },

  // Validation des avis
  review: {
    create: Joi.object({
      productId: Joi.string().uuid().required().messages({
        'string.uuid': 'ID de produit invalide',
        'any.required': 'Le produit est requis'
      }),
      rating: Joi.number().integer().min(1).max(5).required().messages({
        'number.min': 'La note doit être entre 1 et 5',
        'number.max': 'La note doit être entre 1 et 5',
        'any.required': 'La note est requise'
      }),
      title: Joi.string().max(200).optional(),
      comment: Joi.string().min(10).max(2000).optional().messages({
        'string.min': 'Le commentaire doit contenir au moins 10 caractères',
        'string.max': 'Le commentaire ne peut pas dépasser 2000 caractères'
      }),
      pros: Joi.array().items(Joi.string().max(100)).optional(),
      cons: Joi.array().items(Joi.string().max(100)).optional(),
      recommend: Joi.boolean().default(true)
    })
  }
};

/**
 * Middleware de validation Joi
 */
const validateJoi = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Retourner toutes les erreurs
      allowUnknown: false, // Rejeter les champs non définis
      stripUnknown: true // Supprimer les champs non définis
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
        value: detail.context?.value
      }));

      throw new ValidationError('Données invalides', details);
    }

    // Remplacer req.body par les données validées
    req.body = value;
    next();
  };
};

/**
 * Validateurs express-validator pour les paramètres d'URL et query
 */
const validators = {
  // Paramètres communs
  id: param('id').isUUID().withMessage('ID invalide'),
  slug: param('slug').isSlug().withMessage('Slug invalide'),
  
  // Pagination
  page: query('page').optional().isInt({ min: 1 }).withMessage('Le numéro de page doit être un entier positif').toInt(),
  limit: query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('La limite doit être entre 1 et 100').toInt(),
  
  // Filtres de recherche
  search: query('search').optional().trim().isLength({ min: 2, max: 100 }).withMessage('La recherche doit contenir entre 2 et 100 caractères'),
  status: query('status').optional().isIn(['active', 'inactive', 'pending', 'draft', 'archived']).withMessage('Statut invalide'),
  
  // Filtres pour produits
  category: query('category').optional().isUUID().withMessage('ID de catégorie invalide'),
  priceMin: query('price_min').optional().isFloat({ min: 0 }).withMessage('Prix minimum invalide').toFloat(),
  priceMax: query('price_max').optional().isFloat({ min: 0 }).withMessage('Prix maximum invalide').toFloat(),
  
  // Filtres pour commandes
  dateFrom: query('date_from').optional().isISO8601().withMessage('Date de début invalide').toDate(),
  dateTo: query('date_to').optional().isISO8601().withMessage('Date de fin invalide').toDate(),
  
  // Upload de fichiers
  imageUpload: body('images').optional().isArray({ max: 10 }).withMessage('Maximum 10 images autorisées')
};

/**
 * Middleware pour vérifier les résultats de express-validator
 */
const handleValidationResult = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const details = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    throw new ValidationError('Validation échouée', details);
  }
  
  next();
};

/**
 * Validation personnalisée pour les uploads
 */
const validateFileUpload = (options = {}) => {
  const {
    allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'],
    maxFileSize = 5 * 1024 * 1024, // 5MB
    maxFiles = 5
  } = options;

  return (req, res, next) => {
    if (!req.files || req.files.length === 0) {
      return next();
    }

    // Vérifier le nombre de fichiers
    if (req.files.length > maxFiles) {
      throw new ValidationError(`Maximum ${maxFiles} fichiers autorisés`);
    }

    // Vérifier chaque fichier
    for (const file of req.files) {
      // Vérifier le type MIME
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new ValidationError(
          `Type de fichier non autorisé: ${file.mimetype}. Types acceptés: ${allowedMimeTypes.join(', ')}`
        );
      }

      // Vérifier la taille
      if (file.size > maxFileSize) {
        throw new ValidationError(
          `Fichier trop volumineux: ${file.originalname}. Taille maximale: ${maxFileSize / 1024 / 1024}MB`
        );
      }
    }

    next();
  };
};

/**
 * Validation des coordonnées géographiques
 */
const validateLocation = (req, res, next) => {
  const { latitude, longitude } = req.body;

  if (latitude && longitude) {
    if (
      !Number.isFinite(latitude) || 
      !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      throw new ValidationError('Coordonnées géographiques invalides');
    }
  }

  next();
};

/**
 * Validation des prix et montants
 */
const validatePricing = (req, res, next) => {
  const { price, compareAtPrice, deliveryFee } = req.body;

  // Vérifier que le prix de comparaison est supérieur au prix de vente
  if (compareAtPrice && price && compareAtPrice <= price) {
    throw new ValidationError('Le prix de comparaison doit être supérieur au prix de vente');
  }

  // Vérifier que les frais de livraison sont raisonnables
  if (deliveryFee && deliveryFee > 50000) { // 50,000 FCFA max
    throw new ValidationError('Les frais de livraison semblent trop élevés');
  }

  next();
};

/**
 * Sanitization des données
 */
const sanitizeInput = (req, res, next) => {
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    return str
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Supprimer les scripts
      .replace(/<[^>]*>/g, '') // Supprimer les balises HTML
      .replace(/javascript:/gi, '') // Supprimer javascript:
      .replace(/on\w+\s*=/gi, ''); // Supprimer les event handlers
  };

  const sanitizeObject = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj !== null && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return typeof obj === 'string' ? sanitizeString(obj) : obj;
  };

  // Sanitizer le body, query et params
  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  req.params = sanitizeObject(req.params);

  next();
};

/**
 * Validations composées prêtes à utiliser
 */
const validationChains = {
  // Utilisateurs
  userRegister: [
    sanitizeInput,
    validateJoi(schemas.user.register)
  ],
  
  userLogin: [
    sanitizeInput,
    validateJoi(schemas.user.login)
  ],
  
  userUpdate: [
    sanitizeInput,
    validators.id,
    handleValidationResult,
    validateJoi(schemas.user.update)
  ],

  // Boutiques
  storeCreate: [
    sanitizeInput,
    validateJoi(schemas.store.create),
    validateLocation
  ],
  
  storeUpdate: [
    sanitizeInput,
    validators.id,
    handleValidationResult,
    validateJoi(schemas.store.update),
    validateLocation
  ],

  // Produits
  productCreate: [
    sanitizeInput,
    validateJoi(schemas.product.create),
    validatePricing
  ],
  
  productUpdate: [
    sanitizeInput,
    validators.id,
    handleValidationResult,
    validateJoi(schemas.product.update),
    validatePricing
  ],

  // Commandes
  orderCreate: [
    sanitizeInput,
    validateJoi(schemas.order.create)
  ],

  // Avis
  reviewCreate: [
    sanitizeInput,
    validateJoi(schemas.review.create)
  ],

  // Paramètres communs
  getById: [
    validators.id,
    handleValidationResult
  ],
  
  getBySlug: [
    validators.slug,
    handleValidationResult
  ],
  
  pagination: [
    validators.page,
    validators.limit,
    handleValidationResult
  ],
  
  search: [
    validators.search,
    validators.page,
    validators.limit,
    handleValidationResult
  ]
};

module.exports = {
  // Schémas Joi
  schemas,
  
  // Middleware de validation Joi
  validateJoi,
  
  // Validateurs express-validator
  validators,
  handleValidationResult,
  
  // Validations spécialisées
  validateFileUpload,
  validateLocation,
  validatePricing,
  sanitizeInput,
  
  // Chaînes de validation prêtes à utiliser
  validationChains
};