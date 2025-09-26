const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiting spécifique à l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Maximum 10 tentatives par IP
  message: {
    success: false,
    error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
    code: 'TOO_MANY_AUTH_ATTEMPTS'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // Maximum 5 tentatives de réinitialisation par IP
  message: {
    success: false,
    error: 'Trop de demandes de réinitialisation. Réessayez dans 1 heure.',
    code: 'TOO_MANY_PASSWORD_ATTEMPTS'
  }
});

/**
 * @route POST /api/auth/register
 * @desc Inscription d'un nouvel utilisateur
 * @access Public
 */
router.post('/register', authLimiter, authController.register);

/**
 * @route POST /api/auth/login
 * @desc Connexion utilisateur
 * @access Public
 */
router.post('/login', authLimiter, authController.login);

/**
 * @route POST /api/auth/verify-email
 * @desc Vérification de l'email utilisateur
 * @access Public
 */
router.post('/verify-email', authController.verifyEmail);

/**
 * @route POST /api/auth/forgot-password
 * @desc Demande de réinitialisation de mot de passe
 * @access Public
 */
router.post('/forgot-password', passwordLimiter, authController.forgotPassword);

/**
 * @route POST /api/auth/reset-password
 * @desc Réinitialisation du mot de passe
 * @access Public
 */
router.post('/reset-password', passwordLimiter, authController.resetPassword);

/**
 * @route POST /api/auth/logout
 * @desc Déconnexion utilisateur
 * @access Private
 */
router.post('/logout', requireAuth, authController.logout);

/**
 * @route POST /api/auth/refresh
 * @desc Actualisation du token d'authentification
 * @access Private
 */
router.post('/refresh', requireAuth, authController.refreshToken);

/**
 * @route GET /api/auth/me
 * @desc Obtenir les informations de l'utilisateur connecté
 * @access Private
 */
router.get('/me', requireAuth, async (req, res) => {
  const db = require('../config/database');
  
  try {
    const user = await db('users')
      .select([
        'id', 'email', 'first_name', 'last_name', 'phone', 'birth_date',
        'gender', 'avatar_url', 'bio', 'preferred_language', 'preferred_currency',
        'country', 'city', 'address', 'postal_code', 'role', 'status',
        'email_verified', 'phone_verified', 'loyalty_points', 'loyalty_tier',
        'marketing_emails', 'marketing_sms', 'order_notifications',
        'created_at', 'last_login'
      ])
      .where({ id: req.user.id })
      .first();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur introuvable',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Obtenir les boutiques de l'utilisateur s'il est vendeur
    let stores = null;
    if (['vendor', 'manager', 'admin'].includes(user.role)) {
      stores = await db('stores')
        .select(['id', 'name', 'slug', 'logo_url', 'status', 'is_verified'])
        .where({ owner_id: user.id })
        .whereNull('deleted_at');
    }
    
    res.json({
      success: true,
      data: {
        user: {
          ...user,
          stores
        }
      }
    });
    
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @route GET /api/auth/check-email
 * @desc Vérifier si un email existe déjà
 * @access Public
 */
router.get('/check-email', async (req, res) => {
  const { email } = req.query;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email requis',
      code: 'EMAIL_REQUIRED'
    });
  }
  
  const db = require('../config/database');
  
  try {
    const existingUser = await db('users')
      .where({ email: email.toLowerCase() })
      .whereNull('deleted_at')
      .first();
    
    res.json({
      success: true,
      data: {
        exists: !!existingUser,
        available: !existingUser
      }
    });
    
  } catch (error) {
    console.error('Erreur vérification email:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @route POST /api/auth/resend-verification
 * @desc Renvoyer l'email de vérification
 * @access Public
 */
router.post('/resend-verification', authLimiter, async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email requis',
      code: 'EMAIL_REQUIRED'
    });
  }
  
  const db = require('../config/database');
  const crypto = require('crypto');
  const emailService = require('../services/emailService');
  
  try {
    const user = await db('users')
      .where({
        email: email.toLowerCase(),
        email_verified: false
      })
      .whereNull('deleted_at')
      .first();
    
    if (!user) {
      return res.json({
        success: true,
        message: 'Si cet email nécessite une vérification, un nouvel email a été envoyé.'
      });
    }
    
    // Générer un nouveau token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await db('users')
      .where({ id: user.id })
      .update({
        email_verification_token: emailVerificationToken,
        email_verification_expires: emailVerificationExpires
      });
    
    // Envoyer l'email
    try {
      await emailService.sendVerificationEmail(email, emailVerificationToken, user.first_name);
    } catch (emailError) {
      console.error('Erreur envoi email de vérification:', emailError);
    }
    
    res.json({
      success: true,
      message: 'Si cet email nécessite une vérification, un nouvel email a été envoyé.'
    });
    
  } catch (error) {
    console.error('Erreur renvoi vérification:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;