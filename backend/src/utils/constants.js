/**
 * CONSTANTES AFRIKMODE - Mode Africaine E-commerce
 * Toutes les constantes métier de la plateforme
 */

// ========================================
// RÔLES UTILISATEURS
// ========================================
const USER_ROLES = {
  CUSTOMER: 'customer',
  VENDOR: 'vendor', 
  MANAGER: 'manager',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
};

const USER_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
  DELETED: 'deleted'
};

// ========================================
// STATUTS COMMANDES
// ========================================
const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  RETURNED: 'returned'
};

// ========================================
// MÉTHODES DE PAIEMENT AFRICAINES
// ========================================
const PAYMENT_METHODS = {
  TMONEY: 'tmoney',
  ORANGE_MONEY: 'orange_money',
  FLOOZ: 'flooz',
  MTN_MONEY: 'mtn_money',
  CASH_ON_DELIVERY: 'cash_on_delivery',
  BANK_TRANSFER: 'bank_transfer',
  CARD: 'card'
};

const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

// ========================================
// TYPES DE TISSUS AFRICAINS
// ========================================
const FABRIC_TYPES = {
  WAX: 'wax',
  KENTE: 'kente',
  BOGOLAN: 'bogolan',
  ANKARA: 'ankara',
  DASHIKI: 'dashiki',
  BATIK: 'batik',
  SHWESHWE: 'shweshwe',
  ADINKRA: 'adinkra',
  MUDCLOTH: 'mudcloth',
  KUBA: 'kuba',
  SHOOWA: 'shoowa'
};

// ========================================
// PAYS AFRICAINS SUPPORTÉS
// ========================================
const AFRICAN_COUNTRIES = {
  TOGO: { code: 'TG', name: 'Togo', currency: 'XOF', phone: '+228' },
  BENIN: { code: 'BJ', name: 'Bénin', currency: 'XOF', phone: '+229' },
  GHANA: { code: 'GH', name: 'Ghana', currency: 'GHS', phone: '+233' },
  NIGERIA: { code: 'NG', name: 'Nigeria', currency: 'NGN', phone: '+234' },
  SENEGAL: { code: 'SN', name: 'Sénégal', currency: 'XOF', phone: '+221' },
  MALI: { code: 'ML', name: 'Mali', currency: 'XOF', phone: '+223' },
  BURKINA_FASO: { code: 'BF', name: 'Burkina Faso', currency: 'XOF', phone: '+226' },
  IVORY_COAST: { code: 'CI', name: 'Côte d\'Ivoire', currency: 'XOF', phone: '+225' },
  CAMEROON: { code: 'CM', name: 'Cameroun', currency: 'XAF', phone: '+237' },
  KENYA: { code: 'KE', name: 'Kenya', currency: 'KES', phone: '+254' },
  SOUTH_AFRICA: { code: 'ZA', name: 'Afrique du Sud', currency: 'ZAR', phone: '+27' }
};

// ========================================
// DEVISES SUPPORTÉES
// ========================================
const CURRENCIES = {
  XOF: { code: 'XOF', symbol: 'F CFA', name: 'Franc CFA BCEAO' },
  XAF: { code: 'XAF', symbol: 'FCFA', name: 'Franc CFA BEAC' },
  NGN: { code: 'NGN', symbol: '₦', name: 'Naira Nigérian' },
  GHS: { code: 'GHS', symbol: '₵', name: 'Cedi Ghanéen' },
  KES: { code: 'KES', symbol: 'KSh', name: 'Shilling Kenyan' },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'Rand Sud-Africain' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro' },
  USD: { code: 'USD', symbol: '$', name: 'Dollar Américain' }
};

// ========================================
// LANGUES SUPPORTÉES
// ========================================
const LANGUAGES = {
  FR: { code: 'fr', name: 'Français', native: 'Français' },
  EN: { code: 'en', name: 'English', native: 'English' },
  YO: { code: 'yo', name: 'Yoruba', native: 'Yorùbá' },
  HAU: { code: 'hau', name: 'Hausa', native: 'Hausa' },
  SWA: { code: 'swa', name: 'Swahili', native: 'Kiswahili' }
};

// ========================================
// CATÉGORIES PRODUITS MODE AFRICAINE
// ========================================
const PRODUCT_CATEGORIES = {
  WOMENS_CLOTHING: 'womens_clothing',
  MENS_CLOTHING: 'mens_clothing',
  TRADITIONAL_WEAR: 'traditional_wear',
  ACCESSORIES: 'accessories',
  JEWELRY: 'jewelry',
  BAGS_PURSES: 'bags_purses',
  SHOES: 'shoes',
  HOME_DECOR: 'home_decor',
  ART_CRAFTS: 'art_crafts',
  CHILDREN_WEAR: 'children_wear'
};

// ========================================
// TAILLES VÊTEMENTS
// ========================================
const CLOTHING_SIZES = {
  // Tailles internationales
  XS: 'xs',
  S: 's', 
  M: 'm',
  L: 'l',
  XL: 'xl',
  XXL: 'xxl',
  XXXL: 'xxxl',
  
  // Tailles numériques
  SIZE_34: '34',
  SIZE_36: '36',
  SIZE_38: '38',
  SIZE_40: '40',
  SIZE_42: '42',
  SIZE_44: '44',
  SIZE_46: '46',
  SIZE_48: '48',
  SIZE_50: '50',
  
  // Tailles chaussures (européennes)
  SHOE_35: '35',
  SHOE_36: '36', 
  SHOE_37: '37',
  SHOE_38: '38',
  SHOE_39: '39',
  SHOE_40: '40',
  SHOE_41: '41',
  SHOE_42: '42',
  SHOE_43: '43',
  SHOE_44: '44',
  SHOE_45: '45'
};

// ========================================
// OCCASIONS CULTURELLES AFRICAINES
// ========================================
const CULTURAL_OCCASIONS = {
  WEDDING: 'wedding',
  FUNERAL: 'funeral',
  NAMING_CEREMONY: 'naming_ceremony',
  FESTIVAL: 'festival',
  GRADUATION: 'graduation',
  RELIGIOUS_CEREMONY: 'religious_ceremony',
  BUSINESS: 'business',
  CASUAL: 'casual',
  TRADITIONAL_DANCE: 'traditional_dance',
  CULTURAL_EVENT: 'cultural_event'
};

// ========================================
// TYPES D'ARTISANAT
// ========================================
const ARTISAN_CRAFTS = {
  WEAVING: 'weaving',
  EMBROIDERY: 'embroidery',
  BEADING: 'beading',
  WOOD_CARVING: 'wood_carving',
  METAL_WORK: 'metal_work',
  POTTERY: 'pottery',
  LEATHER_WORK: 'leather_work',
  BASKET_WEAVING: 'basket_weaving',
  TEXTILE_PRINTING: 'textile_printing',
  JEWELRY_MAKING: 'jewelry_making'
};

// ========================================
// STATUTS BOUTIQUES
// ========================================
const STORE_STATUS = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  CLOSED: 'closed'
};

// ========================================
// TYPES DE LIVRAISON
// ========================================
const DELIVERY_TYPES = {
  STANDARD: 'standard',
  EXPRESS: 'express',
  SAME_DAY: 'same_day',
  PICKUP: 'pickup',
  INTERNATIONAL: 'international'
};

// ========================================
// TRANSPORTEURS AFRICAINS
// ========================================
const SHIPPING_CARRIERS = {
  DHL_AFRICA: 'dhl_africa',
  FEDEX_AFRICA: 'fedex_africa',
  UPS_AFRICA: 'ups_africa',
  CHRONOPOST_AFRICA: 'chronopost_africa',
  LOCAL_COURIER: 'local_courier',
  PICKUP_STATION: 'pickup_station'
};

// ========================================
// FRAIS DE PAIEMENT (%)
// ========================================
const PAYMENT_FEES = {
  [PAYMENT_METHODS.TMONEY]: { rate: 0.02, min: 100, max: 5000 }, // 2%
  [PAYMENT_METHODS.ORANGE_MONEY]: { rate: 0.025, min: 150, max: 7500 }, // 2.5%
  [PAYMENT_METHODS.FLOOZ]: { rate: 0.02, min: 100, max: 5000 }, // 2%
  [PAYMENT_METHODS.MTN_MONEY]: { rate: 0.03, min: 200, max: 10000 }, // 3%
  [PAYMENT_METHODS.CASH_ON_DELIVERY]: { rate: 0.01, min: 500, max: 2000 }, // 1%
  [PAYMENT_METHODS.BANK_TRANSFER]: { rate: 0.005, min: 1000, max: 15000 }, // 0.5%
  [PAYMENT_METHODS.CARD]: { rate: 0.035, min: 300, max: 12000 } // 3.5%
};

// ========================================
// LIMITES SYSTÈME
// ========================================
const SYSTEM_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_IMAGES_PER_PRODUCT: 10,
  MAX_PRODUCTS_PER_STORE: 1000,
  MAX_CART_ITEMS: 50,
  MAX_SEARCH_RESULTS: 100,
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24h
  RATE_LIMIT_REQUESTS: 100, // par minute
  PAGINATION_DEFAULT_LIMIT: 20,
  PAGINATION_MAX_LIMIT: 100
};

// ========================================
// TYPES DE NOTIFICATIONS
// ========================================
const NOTIFICATION_TYPES = {
  ORDER_PLACED: 'order_placed',
  ORDER_CONFIRMED: 'order_confirmed',
  ORDER_SHIPPED: 'order_shipped',
  ORDER_DELIVERED: 'order_delivered',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  PRODUCT_LOW_STOCK: 'product_low_stock',
  STORE_APPROVED: 'store_approved',
  NEW_REVIEW: 'new_review',
  NEWSLETTER: 'newsletter',
  PROMOTION: 'promotion'
};

// ========================================
// NIVEAUX DE FIDÉLITÉ
// ========================================
const LOYALTY_TIERS = {
  BRONZE: { name: 'Bronze', minPoints: 0, discount: 0 },
  SILVER: { name: 'Silver', minPoints: 1000, discount: 0.05 }, // 5%
  GOLD: { name: 'Gold', minPoints: 5000, discount: 0.10 }, // 10%
  PLATINUM: { name: 'Platinum', minPoints: 15000, discount: 0.15 }, // 15%
  DIAMOND: { name: 'Diamond', minPoints: 50000, discount: 0.20 } // 20%
};

// ========================================
// MOTIFS DE RETOUR
// ========================================
const RETURN_REASONS = {
  DEFECTIVE: 'defective',
  WRONG_SIZE: 'wrong_size',
  NOT_AS_DESCRIBED: 'not_as_described',
  DAMAGED_SHIPPING: 'damaged_shipping',
  CHANGED_MIND: 'changed_mind',
  BETTER_PRICE_FOUND: 'better_price_found',
  LATE_DELIVERY: 'late_delivery'
};

// ========================================
// TYPES DE CONTENU
// ========================================
const CONTENT_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document',
  AUDIO: 'audio'
};

// ========================================
// FORMATS DE FICHIERS ACCEPTÉS
// ========================================
const ALLOWED_FILE_FORMATS = {
  IMAGES: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  VIDEOS: ['mp4', 'avi', 'mov', 'webm'],
  DOCUMENTS: ['pdf', 'doc', 'docx', 'txt'],
  AUDIO: ['mp3', 'wav', 'ogg']
};

// ========================================
// REGEX PATTERNS
// ========================================
const REGEX_PATTERNS = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PHONE_AFRICAN: /^(\+2[0-9]{1,3})[0-9]{6,10}$/,
  PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  SLUG: /^[a-z0-9-]+$/,
  SKU: /^[A-Z0-9-_]{3,50}$/,
  POSTAL_CODE_AFRICAN: /^[A-Z0-9]{2,10}$/
};

// ========================================
// COULEURS THÈME AFRIKMODE
// ========================================
const BRAND_COLORS = {
  PRIMARY: '#8B2E2E', // Rouge-brun
  SECONDARY_BEIGE: '#F5E4D7', // Beige
  SECONDARY_ORANGE: '#D9744F', // Orange
  NEUTRAL_OFF_WHITE: '#FFF9F6', // Blanc cassé
  NEUTRAL_GRAY: '#3A3A3A', // Gris
  ACCENT_SAGE: '#6B8E23' // Vert sauge
};

// ========================================
// EXPORTS
// ========================================
module.exports = {
  USER_ROLES,
  USER_STATUS,
  ORDER_STATUS,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  FABRIC_TYPES,
  AFRICAN_COUNTRIES,
  CURRENCIES,
  LANGUAGES,
  PRODUCT_CATEGORIES,
  CLOTHING_SIZES,
  CULTURAL_OCCASIONS,
  ARTISAN_CRAFTS,
  STORE_STATUS,
  DELIVERY_TYPES,
  SHIPPING_CARRIERS,
  PAYMENT_FEES,
  SYSTEM_LIMITS,
  NOTIFICATION_TYPES,
  LOYALTY_TIERS,
  RETURN_REASONS,
  CONTENT_TYPES,
  ALLOWED_FILE_FORMATS,
  REGEX_PATTERNS,
  BRAND_COLORS
};
