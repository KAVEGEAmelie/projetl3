const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Middleware d'authentification JWT
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification manquant ou invalide',
        code: 'NO_TOKEN'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await db('users')
      .where({ id: decoded.userId })
      .whereNull('deleted_at')
      .first();
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur introuvable ou désactivé',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Compte utilisateur inactif',
        code: 'ACCOUNT_INACTIVE'
      });
    }
    
    // Add user to request object
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      tenantId: user.tenant_id
    };
    
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification invalide',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification expiré',
        code: 'EXPIRED_TOKEN'
      });
    }
    
    console.error('Erreur middleware auth:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Middleware pour vérifier les rôles d'utilisateur
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Convert single role to array
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Permissions insuffisantes',
        code: 'INSUFFICIENT_PERMISSIONS',
        required_roles: allowedRoles,
        user_role: req.user.role
      });
    }
    
    next();
  };
};

/**
 * Middleware pour vérifier si l'utilisateur est propriétaire de la ressource
 */
const requireOwnership = (resourceField = 'user_id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentification requise',
          code: 'AUTH_REQUIRED'
        });
      }
      
      // Admin and super admin can access everything
      if (['admin', 'super_admin'].includes(req.user.role)) {
        return next();
      }
      
      const resourceId = req.params.id;
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: 'ID de ressource manquant',
          code: 'MISSING_RESOURCE_ID'
        });
      }
      
      // Add resource ownership check to request
      req.checkOwnership = { resourceField, resourceId };
      
      next();
      
    } catch (error) {
      console.error('Erreur middleware ownership:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

/**
 * Middleware pour vérifier l'accès multi-tenant
 */
const requireTenant = async (req, res, next) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID manquant',
        code: 'MISSING_TENANT'
      });
    }
    
    req.tenantId = tenantId;
    next();
    
  } catch (error) {
    console.error('Erreur middleware tenant:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Middleware pour les vendeurs (accès à leur boutique)
 */
const requireStoreAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Admin and super admin can access all stores
    if (['admin', 'super_admin'].includes(req.user.role)) {
      return next();
    }
    
    const storeId = req.params.storeId || req.params.id;
    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'ID de boutique manquant',
        code: 'MISSING_STORE_ID'
      });
    }
    
    // Check if user owns or has access to the store
    const store = await db('stores')
      .where({ id: storeId })
      .whereNull('deleted_at')
      .first();
    
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Boutique introuvable',
        code: 'STORE_NOT_FOUND'
      });
    }
    
    // Check ownership or manager access
    if (store.owner_id !== req.user.id && req.user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette boutique',
        code: 'STORE_ACCESS_DENIED'
      });
    }
    
    req.store = store;
    next();
    
  } catch (error) {
    console.error('Erreur middleware store access:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Middleware optionnel (authentification si présente)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await db('users')
      .where({ id: decoded.userId })
      .whereNull('deleted_at')
      .first();
    
    if (user && user.status === 'active') {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        tenantId: user.tenant_id
      };
    }
    
    next();
    
  } catch (error) {
    // Silent fail for optional auth
    next();
  }
};

module.exports = {
  requireAuth,
  requireRole,
  requireOwnership,
  requireTenant,
  requireStoreAccess,
  optionalAuth
};