const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const { asyncHandler, commonErrors } = require('../middleware/errorHandler');
const emailService = require('../services/emailService');

/**
 * Générer un token JWT
 */
const generateToken = (userId, role, tenantId = null) => {
  const payload = {
    userId,
    role,
    tenantId,
    iat: Math.floor(Date.now() / 1000)
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

/**
 * Générer un refresh token
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

/**
 * Inscription d'un nouvel utilisateur
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const {
    email,
    password,
    firstName,
    lastName,
    phone,
    role = 'customer',
    country = 'TG',
    city,
    address,
    preferredLanguage = 'fr'
  } = req.body;
  
  // Validation des données requises
  if (!email || !password || !firstName || !lastName) {
    throw commonErrors.validation({
      email: !email ? 'Email requis' : null,
      password: !password ? 'Mot de passe requis' : null,
      firstName: !firstName ? 'Prénom requis' : null,
      lastName: !lastName ? 'Nom de famille requis' : null
    }.filter(Boolean));
  }
  
  // Validation du format email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw commonErrors.badRequest('Format d\'email invalide');
  }
  
  // Validation de la force du mot de passe
  if (password.length < 8) {
    throw commonErrors.badRequest('Le mot de passe doit contenir au moins 8 caractères');
  }
  
  // Vérifier si l'utilisateur existe déjà
  const existingUser = await db('users').where({ email }).first();
  if (existingUser) {
    throw commonErrors.conflict('Un utilisateur avec cet email existe déjà');
  }
  
  // Hasher le mot de passe
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  
  // Générer un token de vérification email
  const emailVerificationToken = crypto.randomBytes(32).toString('hex');
  const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures
  
  // Créer l'utilisateur
  const [user] = await db('users')
    .insert({
      email: email.toLowerCase(),
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      phone,
      role,
      country,
      city,
      address,
      preferred_language: preferredLanguage,
      status: 'pending', // En attente de vérification email
      email_verification_token: emailVerificationToken,
      email_verification_expires: emailVerificationExpires
    })
    .returning(['id', 'email', 'first_name', 'last_name', 'role', 'status', 'created_at']);
  
  // Envoyer l'email de vérification
  try {
    await emailService.sendVerificationEmail(email, emailVerificationToken, firstName);
  } catch (emailError) {
    console.error('Erreur envoi email de vérification:', emailError);
    // Continue même si l'email échoue
  }
  
  res.status(201).json({
    success: true,
    message: 'Inscription réussie. Veuillez vérifier votre email pour activer votre compte.',
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        status: user.status,
        createdAt: user.created_at
      }
    }
  });
});

/**
 * Connexion utilisateur
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe = false } = req.body;
  
  if (!email || !password) {
    throw commonErrors.badRequest('Email et mot de passe requis');
  }
  
  // Trouver l'utilisateur
  const user = await db('users')
    .where({ email: email.toLowerCase() })
    .whereNull('deleted_at')
    .first();
  
  if (!user) {
    throw commonErrors.unauthorized('Identifiants invalides');
  }
  
  // Vérifier le mot de passe
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw commonErrors.unauthorized('Identifiants invalides');
  }
  
  // Vérifier le statut du compte
  if (user.status === 'banned') {
    throw commonErrors.forbidden('Votre compte a été suspendu. Contactez le support.');
  }
  
  if (user.status === 'suspended') {
    throw commonErrors.forbidden('Votre compte est temporairement suspendu.');
  }
  
  // Générer les tokens
  const token = generateToken(user.id, user.role, user.tenant_id);
  const refreshToken = generateRefreshToken();
  
  // Mettre à jour les informations de connexion
  await db('users')
    .where({ id: user.id })
    .update({
      last_login: db.fn.now(),
      last_login_ip: req.ip
    });
  
  // Préparer la réponse
  const tokenExpiration = rememberMe ? '30d' : '7d';
  
  res.json({
    success: true,
    message: 'Connexion réussie',
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        status: user.status,
        emailVerified: user.email_verified,
        preferredLanguage: user.preferred_language,
        preferredCurrency: user.preferred_currency,
        avatarUrl: user.avatar_url
      },
      token,
      refreshToken,
      expiresIn: tokenExpiration
    }
  });
});

/**
 * Vérification de l'email
 * POST /api/auth/verify-email
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    throw commonErrors.badRequest('Token de vérification requis');
  }
  
  const user = await db('users')
    .where({
      email_verification_token: token,
      email_verified: false
    })
    .where('email_verification_expires', '>', db.fn.now())
    .whereNull('deleted_at')
    .first();
  
  if (!user) {
    throw commonErrors.badRequest('Token de vérification invalide ou expiré');
  }
  
  // Activer le compte
  await db('users')
    .where({ id: user.id })
    .update({
      email_verified: true,
      status: 'active',
      email_verification_token: null,
      email_verification_expires: null
    });
  
  res.json({
    success: true,
    message: 'Email vérifié avec succès. Votre compte est maintenant activé.'
  });
});

/**
 * Mot de passe oublié
 * POST /api/auth/forgot-password
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    throw commonErrors.badRequest('Email requis');
  }
  
  const user = await db('users')
    .where({ email: email.toLowerCase() })
    .whereNull('deleted_at')
    .first();
  
  // Toujours retourner succès pour éviter l'énumération d'utilisateurs
  if (!user) {
    return res.json({
      success: true,
      message: 'Si cet email existe, vous recevrez un lien de réinitialisation.'
    });
  }
  
  // Générer un token de réinitialisation
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure
  
  await db('users')
    .where({ id: user.id })
    .update({
      password_reset_token: resetToken,
      password_reset_expires: resetExpires
    });
  
  // Envoyer l'email de réinitialisation
  try {
    await emailService.sendPasswordResetEmail(user.email, resetToken, user.first_name);
  } catch (emailError) {
    console.error('Erreur envoi email de réinitialisation:', emailError);
  }
  
  res.json({
    success: true,
    message: 'Si cet email existe, vous recevrez un lien de réinitialisation.'
  });
});

/**
 * Réinitialisation du mot de passe
 * POST /api/auth/reset-password
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  
  if (!token || !password) {
    throw commonErrors.badRequest('Token et nouveau mot de passe requis');
  }
  
  if (password.length < 8) {
    throw commonErrors.badRequest('Le mot de passe doit contenir au moins 8 caractères');
  }
  
  const user = await db('users')
    .where({
      password_reset_token: token
    })
    .where('password_reset_expires', '>', db.fn.now())
    .whereNull('deleted_at')
    .first();
  
  if (!user) {
    throw commonErrors.badRequest('Token de réinitialisation invalide ou expiré');
  }
  
  // Hasher le nouveau mot de passe
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  
  // Mettre à jour le mot de passe
  await db('users')
    .where({ id: user.id })
    .update({
      password_hash: passwordHash,
      password_reset_token: null,
      password_reset_expires: null
    });
  
  res.json({
    success: true,
    message: 'Mot de passe réinitialisé avec succès'
  });
});

/**
 * Déconnexion
 * POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  // Dans une implémentation plus avancée, on pourrait blacklister le token
  res.json({
    success: true,
    message: 'Déconnexion réussie'
  });
});

/**
 * Refresh token
 * POST /api/auth/refresh
 */
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    throw commonErrors.unauthorized('Refresh token requis');
  }
  
  // Dans une implémentation plus avancée, on vérifierait le refresh token en base
  // Pour l'instant, on génère simplement un nouveau token
  
  if (!req.user) {
    throw commonErrors.unauthorized('Utilisateur non authentifié');
  }
  
  const newToken = generateToken(req.user.id, req.user.role, req.user.tenantId);
  
  res.json({
    success: true,
    data: {
      token: newToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  });
});

module.exports = {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  logout,
  refreshToken
};