/**
 * VALIDATEURS AFRIKMODE
 * Fonctions de validation spécialisées pour l'e-commerce africain
 */

const { REGEX_PATTERNS, AFRICAN_COUNTRIES, CURRENCIES, FABRIC_TYPES, USER_ROLES } = require('./constants');

// ========================================
// VALIDATION UTILISATEURS
// ========================================

/**
 * Valider une adresse email
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return REGEX_PATTERNS.EMAIL.test(email.trim().toLowerCase());
};

/**
 * Valider un mot de passe fort
 */
const isStrongPassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  
  // Minimum 8 caractères
  if (password.length < 8) return false;
  
  // Au moins une minuscule, une majuscule, un chiffre et un caractère spécial
  return REGEX_PATTERNS.PASSWORD_STRONG.test(password);
};

/**
 * Valider un numéro de téléphone africain
 */
const isValidAfricanPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  
  const cleanPhone = phone.replace(/[\s-()]/g, '');
  return REGEX_PATTERNS.PHONE_AFRICAN.test(cleanPhone);
};

/**
 * Valider un rôle utilisateur
 */
const isValidUserRole = (role) => {
  return Object.values(USER_ROLES).includes(role);
};

/**
 * Valider l'âge minimum (13 ans)
 */
const isValidAge = (birthDate) => {
  if (!birthDate) return false;
  
  const birth = new Date(birthDate);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age >= 13;
};

// ========================================
// VALIDATION PRODUITS
// ========================================

/**
 * Valider un SKU produit
 */
const isValidSKU = (sku) => {
  if (!sku || typeof sku !== 'string') return false;
  return REGEX_PATTERNS.SKU.test(sku);
};

/**
 * Valider un slug
 */
const isValidSlug = (slug) => {
  if (!slug || typeof slug !== 'string') return false;
  return REGEX_PATTERNS.SLUG.test(slug) && slug.length >= 3 && slug.length <= 100;
};

/**
 * Valider un prix
 */
const isValidPrice = (price) => {
  const numPrice = parseFloat(price);
  return !isNaN(numPrice) && numPrice > 0 && numPrice <= 10000000; // Max 10M
};

/**
 * Valider une quantité de stock
 */
const isValidStockQuantity = (quantity) => {
  const numQuantity = parseInt(quantity);
  return !isNaN(numQuantity) && numQuantity >= 0 && numQuantity <= 100000;
};

/**
 * Valider un type de tissu africain
 */
const isValidFabricType = (fabricType) => {
  return Object.values(FABRIC_TYPES).includes(fabricType);
};

/**
 * Valider les dimensions d'un produit
 */
const isValidDimensions = (dimensions) => {
  if (!dimensions || typeof dimensions !== 'object') return false;
  
  const { length, width, height } = dimensions;
  
  return (
    isValidMeasurement(length) &&
    isValidMeasurement(width) &&
    isValidMeasurement(height)
  );
};

/**
 * Valider une mesure (longueur, largeur, hauteur)
 */
const isValidMeasurement = (measurement) => {
  const num = parseFloat(measurement);
  return !isNaN(num) && num > 0 && num <= 1000; // Max 1000cm
};

/**
 * Valider un poids en grammes
 */
const isValidWeight = (weight) => {
  const numWeight = parseFloat(weight);
  return !isNaN(numWeight) && numWeight > 0 && numWeight <= 50000; // Max 50kg
};

// ========================================
// VALIDATION GÉOGRAPHIQUE
// ========================================

/**
 * Valider un code pays africain
 */
const isValidAfricanCountry = (countryCode) => {
  return Object.keys(AFRICAN_COUNTRIES).includes(countryCode);
};

/**
 * Valider des coordonnées GPS
 */
const isValidCoordinates = (latitude, longitude) => {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  
  return (
    !isNaN(lat) && lat >= -90 && lat <= 90 &&
    !isNaN(lng) && lng >= -180 && lng <= 180
  );
};

/**
 * Valider une adresse postale africaine
 */
const isValidAfricanPostalCode = (postalCode, countryCode = null) => {
  if (!postalCode || typeof postalCode !== 'string') return false;
  
  // Validation générale pour codes postaux africains
  if (!REGEX_PATTERNS.POSTAL_CODE_AFRICAN.test(postalCode)) {
    return false;
  }
  
  // Validations spécifiques par pays si nécessaire
  if (countryCode) {
    switch (countryCode) {
      case 'TG': // Togo - Format: 01BP234
        return /^[0-9]{2}BP[0-9]{3,4}$/.test(postalCode);
      case 'BJ': // Bénin - Format similaire au Togo
        return /^[0-9]{2}BP[0-9]{3,4}$/.test(postalCode);
      case 'GH': // Ghana - Format: ABCD1234
        return /^[A-Z]{2,4}[0-9]{4}$/.test(postalCode);
      default:
        return true; // Validation générale pour autres pays
    }
  }
  
  return true;
};

/**
 * Valider une adresse complète
 */
const isValidAddress = (address) => {
  if (!address || typeof address !== 'object') return false;
  
  const { street, city, country } = address;
  
  return (
    street && street.trim().length >= 5 &&
    city && city.trim().length >= 2 &&
    country && isValidAfricanCountry(country)
  );
};

// ========================================
// VALIDATION FINANCIÈRE
// ========================================

/**
 * Valider une devise
 */
const isValidCurrency = (currencyCode) => {
  return Object.keys(CURRENCIES).includes(currencyCode);
};

/**
 * Valider un montant pour une devise spécifique
 */
const isValidAmountForCurrency = (amount, currencyCode) => {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount < 0) return false;
  
  // Limites par devise
  const limits = {
    'XOF': { min: 100, max: 50000000 }, // 100 F CFA à 50M F CFA
    'XAF': { min: 100, max: 50000000 },
    'NGN': { min: 50, max: 20000000 }, // 50 à 20M Naira
    'GHS': { min: 1, max: 500000 }, // 1 à 500k Cedi
    'EUR': { min: 0.5, max: 100000 }, // 0.5€ à 100k€
    'USD': { min: 0.5, max: 100000 }
  };
  
  const limit = limits[currencyCode];
  if (!limit) return numAmount <= 1000000; // Limite générale 1M
  
  return numAmount >= limit.min && numAmount <= limit.max;
};

/**
 * Valider un numéro de carte de crédit (algorithme de Luhn)
 */
const isValidCreditCard = (cardNumber) => {
  if (!cardNumber || typeof cardNumber !== 'string') return false;
  
  const cleanNumber = cardNumber.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(cleanNumber)) return false;
  
  // Algorithme de Luhn
  let sum = 0;
  let isEven = false;
  
  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber.charAt(i));
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
};

// ========================================
// VALIDATION FICHIERS
// ========================================

/**
 * Valider un type de fichier image
 */
const isValidImageFile = (file) => {
  if (!file || !file.mimetype) return false;
  
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif'
  ];
  
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  return allowedTypes.includes(file.mimetype) && file.size <= maxSize;
};

/**
 * Valider un nom de fichier
 */
const isValidFileName = (filename) => {
  if (!filename || typeof filename !== 'string') return false;
  
  // Caractères interdits
  const forbiddenChars = /[<>:"/\\|?*]/;
  if (forbiddenChars.test(filename)) return false;
  
  // Noms réservés Windows
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];
  
  const nameWithoutExt = filename.split('.')[0].toUpperCase();
  if (reservedNames.includes(nameWithoutExt)) return false;
  
  // Longueur
  return filename.length >= 1 && filename.length <= 255;
};

/**
 * Valider une extension de fichier
 */
const isValidFileExtension = (filename, allowedExtensions) => {
  if (!filename || !allowedExtensions || !Array.isArray(allowedExtensions)) {
    return false;
  }
  
  const extension = filename.toLowerCase().split('.').pop();
  return allowedExtensions.includes(extension);
};

// ========================================
// VALIDATION MÉTIER SPÉCIFIQUE
// ========================================

/**
 * Valider une description culturelle
 */
const isValidCulturalDescription = (description) => {
  if (!description || typeof description !== 'string') return false;
  
  const trimmed = description.trim();
  return trimmed.length >= 10 && trimmed.length <= 1000;
};

/**
 * Valider une tranche de prix
 */
const isValidPriceRange = (minPrice, maxPrice) => {
  const min = parseFloat(minPrice);
  const max = parseFloat(maxPrice);
  
  if (isNaN(min) || isNaN(max)) return false;
  if (min < 0 || max < 0) return false;
  
  return min <= max;
};

/**
 * Valider un rayon de livraison
 */
const isValidDeliveryRadius = (radius) => {
  const numRadius = parseInt(radius);
  return !isNaN(numRadius) && numRadius > 0 && numRadius <= 100; // Max 100km
};

/**
 * Valider des horaires d'ouverture
 */
const isValidBusinessHours = (hours) => {
  if (!hours || typeof hours !== 'object') return false;
  
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  for (const day of days) {
    if (!hours[day]) continue;
    
    const dayHours = hours[day];
    
    if (dayHours.closed) continue;
    
    if (!dayHours.open || !dayHours.close) return false;
    
    // Valider format heure (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(dayHours.open) || !timeRegex.test(dayHours.close)) {
      return false;
    }
    
    // Vérifier que l'ouverture est avant la fermeture
    const openTime = dayHours.open.split(':').map(Number);
    const closeTime = dayHours.close.split(':').map(Number);
    
    const openMinutes = openTime[0] * 60 + openTime[1];
    const closeMinutes = closeTime[0] * 60 + closeTime[1];
    
    if (openMinutes >= closeMinutes) return false;
  }
  
  return true;
};

/**
 * Détecter du contenu suspect (injection, XSS, etc.)
 */
const isSuspiciousInput = (input) => {
  if (!input || typeof input !== 'string') return false;
  
  const suspiciousPatterns = [
    /<script[^>]*>.*?<\/script>/gi, // Scripts
    /javascript:/gi, // URLs JavaScript
    /on\w+\s*=/gi, // Event handlers
    /eval\s*\(/gi, // eval()
    /expression\s*\(/gi, // CSS expressions
    /vbscript:/gi, // VBScript
    /SELECT.*FROM/gi, // SQL injection
    /UNION.*SELECT/gi,
    /INSERT.*INTO/gi,
    /DELETE.*FROM/gi,
    /DROP.*TABLE/gi,
    /\.\.\/|\.\.\\/gi, // Path traversal
    /%2e%2e%2f|%2e%2e\\/gi // Encoded path traversal
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(input));
};

/**
 * Valider un token de sécurité
 */
const isValidSecurityToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  
  // Token hexadécimal de 32 à 128 caractères
  return /^[a-f0-9]{32,128}$/i.test(token);
};

/**
 * Valider une signature de webhook
 */
const isValidWebhookSignature = (signature, expectedSignature) => {
  if (!signature || !expectedSignature) return false;
  
  // Comparaison sécurisée pour éviter les attaques de timing
  const crypto = require('crypto');
  
  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  
  if (sigBuffer.length !== expectedBuffer.length) return false;
  
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
};

// ========================================
// VALIDATION PAGINATION
// ========================================

/**
 * Valider les paramètres de pagination
 */
const isValidPagination = (page, limit) => {
  const numPage = parseInt(page);
  const numLimit = parseInt(limit);
  
  return (
    !isNaN(numPage) && numPage >= 1 && numPage <= 10000 &&
    !isNaN(numLimit) && numLimit >= 1 && numLimit <= 100
  );
};

/**
 * Valider un champ de tri
 */
const isValidSortField = (field, allowedFields) => {
  if (!field || typeof field !== 'string') return false;
  if (!allowedFields || !Array.isArray(allowedFields)) return false;
  
  return allowedFields.includes(field);
};

/**
 * Valider un ordre de tri
 */
const isValidSortOrder = (order) => {
  return ['asc', 'desc'].includes(order);
};

// ========================================
// EXPORTS
// ========================================
module.exports = {
  // Validation utilisateurs
  isValidEmail,
  isStrongPassword,
  isValidAfricanPhoneNumber,
  isValidUserRole,
  isValidAge,
  
  // Validation produits
  isValidSKU,
  isValidSlug,
  isValidPrice,
  isValidStockQuantity,
  isValidFabricType,
  isValidDimensions,
  isValidMeasurement,
  isValidWeight,
  
  // Validation géographique
  isValidAfricanCountry,
  isValidCoordinates,
  isValidAfricanPostalCode,
  isValidAddress,
  
  // Validation financière
  isValidCurrency,
  isValidAmountForCurrency,
  isValidCreditCard,
  
  // Validation fichiers
  isValidImageFile,
  isValidFileName,
  isValidFileExtension,
  
  // Validation métier spécifique
  isValidCulturalDescription,
  isValidPriceRange,
  isValidDeliveryRadius,
  isValidBusinessHours,
  isSuspiciousInput,
  isValidSecurityToken,
  isValidWebhookSignature,
  
  // Validation pagination
  isValidPagination,
  isValidSortField,
  isValidSortOrder
};
