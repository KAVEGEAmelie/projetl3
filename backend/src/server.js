const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration des middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route de santé
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// ========================================
// ROUTES D'AUTHENTIFICATION TEMPORAIRES
// (en attendant la configuration complète)
// ========================================

// REGISTER
app.post('/api/auth/register', (req, res) => {
  console.log('Register request:', req.body);
  const { email, password, firstName, lastName } = req.body;
  
  // Validation basique
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email et mot de passe requis'
    });
  }
  
  res.status(201).json({
    success: true,
    message: 'Inscription réussie',
    data: {
      user: {
        id: 'user_' + Date.now(),
        email,
        firstName,
        lastName,
        role: 'CLIENT'
      },
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + Buffer.from(JSON.stringify({email})).toString('base64'),
      refreshToken: 'refresh_' + Date.now()
    }
  });
});

// LOGIN
app.post('/api/auth/login', (req, res) => {
  console.log('Login request:', req.body);
  const { email, password } = req.body;
  
  // Validation basique
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email et mot de passe requis'
    });
  }
  
  // Simulation de vérification
  if (password !== 'Test@1234') {
    return res.status(401).json({
      success: false,
      message: 'Identifiants invalides'
    });
  }
  
  res.status(200).json({
    success: true,
    message: 'Connexion réussie',
    data: {
      user: {
        id: 'user_123',
        email,
        firstName: 'John',
        lastName: 'Doe',
        role: 'CLIENT'
      },
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + Buffer.from(JSON.stringify({email})).toString('base64'),
      refreshToken: 'refresh_' + Date.now()
    }
  });
});

// GET PROFILE
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token manquant'
    });
  }
  
  res.status(200).json({
    success: true,
    message: 'Profil récupéré',
    data: {
      id: 'user_123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'CLIENT',
      createdAt: new Date().toISOString()
    }
  });
});

// REFRESH TOKEN
app.post('/api/auth/refresh-token', (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token requis'
    });
  }
  
  res.status(200).json({
    success: true,
    message: 'Token rafraîchi',
    data: {
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new.' + Date.now(),
      refreshToken: 'refresh_new_' + Date.now()
    }
  });
});

// FORGOT PASSWORD
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  console.log('Password reset request for:', email);
  
  res.status(200).json({
    success: true,
    message: 'Si cet email existe, un lien de réinitialisation sera envoyé'
  });
});

// RESET PASSWORD
app.post('/api/auth/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Token et nouveau mot de passe requis'
    });
  }
  
  res.status(200).json({
    success: true,
    message: 'Mot de passe réinitialisé avec succès'
  });
});

// CHANGE PASSWORD
app.post('/api/auth/change-password', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Non authentifié'
    });
  }
  
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Mots de passe requis'
    });
  }
  
  res.status(200).json({
    success: true,
    message: 'Mot de passe changé avec succès'
  });
});

// LOGOUT
app.post('/api/auth/logout', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Déconnexion réussie'
  });
});

// Route 404 pour les routes non trouvées
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} non trouvée`
  });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Erreur serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('\n📋 Available endpoints:');
  console.log('  GET  http://localhost:' + PORT + '/health');
  console.log('  POST http://localhost:' + PORT + '/api/auth/register');
  console.log('  POST http://localhost:' + PORT + '/api/auth/login');
  console.log('  GET  http://localhost:' + PORT + '/api/auth/me');
  console.log('  POST http://localhost:' + PORT + '/api/auth/refresh-token');
  console.log('  POST http://localhost:' + PORT + '/api/auth/forgot-password');
  console.log('  POST http://localhost:' + PORT + '/api/auth/reset-password');
  console.log('  POST http://localhost:' + PORT + '/api/auth/change-password');
  console.log('  POST http://localhost:' + PORT + '/api/auth/logout');
});

module.exports = app;
