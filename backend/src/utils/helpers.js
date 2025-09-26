/**
 * FONCTIONS HELPERS AFRIKMODE
 * Utilitaires pour la logique métier e-commerce africain
 */

const crypto = require('crypto');
const moment = require('moment');
const { CURRENCIES, AFRICAN_COUNTRIES, PAYMENT_FEES, LOYALTY_TIERS } = require('./constants');

// ========================================
// FORMATAGE MONÉTAIRE AFRICAIN
// ========================================

/**
 * Formater un montant selon la devise
 */
const formatCurrency = (amount, currencyCode = 'XOF', locale = 'fr-TG') => {
  try {
    const currency = CURRENCIES[currencyCode];
    if (!currency) {
      throw new Error(`Devise non supportée: ${currencyCode}`);
    }

    // Configuration spéciale pour les francs CFA
    if (currencyCode === 'XOF' || currencyCode === 'XAF') {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount).replace(currencyCode, currency.symbol);
    }

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    return `${amount} ${currencyCode}`;
  }
};

/**
 * Convertir entre devises (simulation - à remplacer par API réelle)
 */
const convertCurrency = (amount, fromCurrency, toCurrency) => {
  // Taux de change simulés (à remplacer par API temps réel)
  const exchangeRates = {
    'XOF-EUR': 0.00152,
    'EUR-XOF': 656.957,
    'XOF-USD': 0.00162,
    'USD-XOF': 617.284,
    'NGN-USD': 0.0013,
    'USD-NGN': 769.23,
    'GHS-USD': 0.084,
    'USD-GHS': 11.90
  };

  const key = `${fromCurrency}-${toCurrency}`;
  const rate = exchangeRates[key];
  
  if (!rate) {
    throw new Error(`Conversion ${fromCurrency} vers ${toCurrency} non disponible`);
  }

  return Math.round(amount * rate * 100) / 100;
};

// ========================================
// GÉNÉRATION DE CODES UNIQUES
// ========================================

/**
 * Générer un numéro de commande unique AfrikMode
 */
const generateOrderNumber = (storeId = null) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  const prefix = storeId ? `AFM-${storeId.slice(-4)}` : 'AFM';
  return `${prefix}-${year}${month}${day}-${random}`;
};

/**
 * Générer un SKU automatique pour un produit
 */
const generateSKU = (categorySlug, productName, storeId) => {
  const category = categorySlug.toUpperCase().slice(0, 3);
  const name = productName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
  const store = storeId.replace('-', '').slice(-4);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `${category}-${name}-${store}-${random}`;
};

/**
 * Générer un slug unique
 */
const generateSlug = (text, suffix = '') => {
  let slug = text
    .toLowerCase()
    .trim()
    .replace(/[àáâäãåą]/g, 'a')
    .replace(/[çć]/g, 'c')
    .replace(/[èéêëę]/g, 'e')
    .replace(/[ìíîïį]/g, 'i')
    .replace(/[òóôöõø]/g, 'o')
    .replace(/[ùúûüų]/g, 'u')
    .replace(/[ñń]/g, 'n')
    .replace(/[^a-z0-9 -]/g, '') // Supprimer caractères spéciaux
    .replace(/\s+/g, '-') // Remplacer espaces par tirets
    .replace(/-+/g, '-'); // Supprimer tirets multiples

  if (suffix) {
    slug += `-${suffix}`;
  }

  return slug;
};

/**
 * Générer un code de référence unique
 */
const generateReferenceCode = (prefix = 'REF') => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
};

// ========================================
// CALCULS COMMERCIAUX
// ========================================

/**
 * Calculer les frais de paiement
 */
const calculatePaymentFees = (amount, paymentMethod) => {
  const fees = PAYMENT_FEES[paymentMethod];
  if (!fees) {
    return 0;
  }

  let calculatedFees = amount * fees.rate;
  
  // Appliquer minimum et maximum
  if (calculatedFees < fees.min) {
    calculatedFees = fees.min;
  } else if (calculatedFees > fees.max) {
    calculatedFees = fees.max;
  }

  return Math.round(calculatedFees);
};

/**
 * Calculer la remise de fidélité
 */
const calculateLoyaltyDiscount = (amount, loyaltyPoints) => {
  let tier = 'BRONZE';
  
  for (const [tierName, tierInfo] of Object.entries(LOYALTY_TIERS)) {
    if (loyaltyPoints >= tierInfo.minPoints) {
      tier = tierName;
    }
  }

  const discount = LOYALTY_TIERS[tier].discount;
  return Math.round(amount * discount);
};

/**
 * Calculer les frais de livraison par distance
 */
const calculateShippingCost = (distance, weight, deliveryType = 'standard') => {
  const baseRates = {
    standard: { base: 1000, perKm: 50, perKg: 200 },
    express: { base: 2000, perKm: 100, perKg: 300 },
    same_day: { base: 5000, perKm: 200, perKg: 500 }
  };

  const rate = baseRates[deliveryType] || baseRates.standard;
  const distanceCost = distance * rate.perKm;
  const weightCost = weight * rate.perKg;
  
  return rate.base + distanceCost + weightCost;
};

/**
 * Calculer la distance entre deux points (approximation)
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// ========================================
// FORMATAGE TÉLÉPHONE AFRICAIN
// ========================================

/**
 * Formater un numéro de téléphone africain
 */
const formatAfricanPhoneNumber = (phone, countryCode = 'TG') => {
  if (!phone) return null;

  // Nettoyer le numéro
  let cleanPhone = phone.replace(/[^0-9+]/g, '');

  // Si pas de code pays, l'ajouter
  if (!cleanPhone.startsWith('+')) {
    const country = AFRICAN_COUNTRIES[countryCode];
    if (country && !cleanPhone.startsWith('00')) {
      cleanPhone = country.phone + cleanPhone;
    }
  }

  return cleanPhone;
};

/**
 * Valider un numéro de téléphone africain
 */
const isValidAfricanPhone = (phone) => {
  const phoneRegex = /^(\+2[0-9]{1,3})[0-9]{6,10}$/;
  return phoneRegex.test(phone);
};

// ========================================
// GESTION DATES AFRICAINES
// ========================================

/**
 * Formater une date selon la locale africaine
 */
const formatAfricanDate = (date, locale = 'fr-TG') => {
  return moment(date).locale(locale.split('-')[0]).format('DD MMMM YYYY');
};

/**
 * Calculer les jours ouvrés (sans dimanche)
 */
const calculateBusinessDays = (startDate, endDate) => {
  const start = moment(startDate);
  const end = moment(endDate);
  let businessDays = 0;

  while (start.isSameOrBefore(end)) {
    if (start.day() !== 0) { // Pas dimanche
      businessDays++;
    }
    start.add(1, 'day');
  }

  return businessDays;
};

/**
 * Ajouter des jours ouvrés à une date
 */
const addBusinessDays = (date, days) => {
  const result = moment(date);
  let addedDays = 0;

  while (addedDays < days) {
    result.add(1, 'day');
    if (result.day() !== 0) { // Pas dimanche
      addedDays++;
    }
  }

  return result.toDate();
};

// ========================================
// SÉCURITÉ ET CRYPTOGRAPHIE
// ========================================

/**
 * Hacher une chaîne avec SHA-256
 */
const hashString = (str, salt = '') => {
  return crypto.createHash('sha256').update(str + salt).digest('hex');
};

/**
 * Générer un token sécurisé
 */
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Masquer un email
 */
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email;
  
  const [user, domain] = email.split('@');
  const maskedUser = user.slice(0, 2) + '*'.repeat(user.length - 4) + user.slice(-2);
  return `${maskedUser}@${domain}`;
};

/**
 * Masquer un numéro de téléphone
 */
const maskPhoneNumber = (phone) => {
  if (!phone) return phone;
  
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.length < 8) return phone;
  
  return cleaned.slice(0, 4) + '*'.repeat(cleaned.length - 8) + cleaned.slice(-4);
};

// ========================================
// MANIPULATION TEXTE
// ========================================

/**
 * Tronquer un texte avec ellipse
 */
const truncateText = (text, length = 100, suffix = '...') => {
  if (!text || text.length <= length) return text;
  return text.substring(0, length).trim() + suffix;
};

/**
 * Capitaliser la première lettre
 */
const capitalize = (str) => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Convertir en title case
 */
const toTitleCase = (str) => {
  if (!str) return str;
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

// ========================================
// VALIDATION MÉTIER
// ========================================

/**
 * Vérifier si une commande peut être annulée
 */
const canCancelOrder = (orderStatus, createdAt) => {
  const prohibitedStatuses = ['shipped', 'delivered', 'cancelled', 'refunded'];
  if (prohibitedStatuses.includes(orderStatus)) return false;
  
  // Pas d'annulation après 24h
  const hoursSinceCreation = moment().diff(moment(createdAt), 'hours');
  return hoursSinceCreation < 24;
};

/**
 * Vérifier si un produit peut être retourné
 */
const canReturnProduct = (orderDate, deliveryDate, categoryType = 'standard') => {
  if (!deliveryDate) return false;
  
  const returnPeriods = {
    standard: 14, // 14 jours
    jewelry: 7,   // 7 jours
    custom: 0     // Pas de retour pour produits personnalisés
  };
  
  const period = returnPeriods[categoryType] || 14;
  if (period === 0) return false;
  
  const daysSinceDelivery = moment().diff(moment(deliveryDate), 'days');
  return daysSinceDelivery <= period;
};

// ========================================
// UTILITAIRES TABLEAU
// ========================================

/**
 * Paginer un tableau
 */
const paginateArray = (array, page = 1, limit = 20) => {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  return {
    data: array.slice(startIndex, endIndex),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: array.length,
      totalPages: Math.ceil(array.length / limit),
      hasNext: endIndex < array.length,
      hasPrev: page > 1
    }
  };
};

/**
 * Grouper un tableau par propriété
 */
const groupBy = (array, key) => {
  return array.reduce((groups, item) => {
    const group = item[key];
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(item);
    return groups;
  }, {});
};

/**
 * Supprimer les doublons d'un tableau d'objets
 */
const uniqueBy = (array, key) => {
  const seen = new Set();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};

// ========================================
// UTILITAIRES COULEURS
// ========================================

/**
 * Convertir hex en RGB
 */
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

/**
 * Calculer la luminance d'une couleur
 */
const calculateLuminance = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  
  const { r, g, b } = rgb;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

/**
 * Déterminer si utiliser texte blanc ou noir sur une couleur
 */
const getContrastColor = (backgroundColor) => {
  const luminance = calculateLuminance(backgroundColor);
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

// ========================================
// EXPORTS
// ========================================
module.exports = {
  // Formatage monétaire
  formatCurrency,
  convertCurrency,
  
  // Génération codes
  generateOrderNumber,
  generateSKU,
  generateSlug,
  generateReferenceCode,
  
  // Calculs commerciaux
  calculatePaymentFees,
  calculateLoyaltyDiscount,
  calculateShippingCost,
  calculateDistance,
  
  // Téléphone
  formatAfricanPhoneNumber,
  isValidAfricanPhone,
  
  // Dates
  formatAfricanDate,
  calculateBusinessDays,
  addBusinessDays,
  
  // Sécurité
  hashString,
  generateSecureToken,
  maskEmail,
  maskPhoneNumber,
  
  // Texte
  truncateText,
  capitalize,
  toTitleCase,
  
  // Validation métier
  canCancelOrder,
  canReturnProduct,
  
  // Tableaux
  paginateArray,
  groupBy,
  uniqueBy,
  
  // Couleurs
  hexToRgb,
  calculateLuminance,
  getContrastColor
};
