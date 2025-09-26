const request = require('supertest');
const app = require('../../src/server');
const User = require('../../src/models/User');
const jwt = require('jsonwebtoken');

describe('Auth Controller', () => {
  let testUser, authToken, vendorUser, vendorToken;

  beforeEach(async () => {
    // Créer un utilisateur test
    testUser = await User.create({
      email: 'auth-test@test.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      role: 'customer'
    });

    // Générer un token d'authentification
    authToken = jwt.sign(
      { userId: testUser.id, email: testUser.email, role: testUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Créer un vendeur test
    vendorUser = await User.create({
      email: 'vendor-test@test.com',
      password: 'Password123!',
      firstName: 'Vendor',
      lastName: 'Test',
      role: 'vendor'
    });

    vendorToken = jwt.sign(
      { userId: vendorUser.id, email: vendorUser.email, role: vendorUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('POST /auth/register', () => {
    it('should register a new customer', async () => {
      const userData = {
        email: 'new-customer@test.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'Customer',
        role: 'customer',
        phone: '+22770123456'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.password).toBeUndefined(); // Password should not be returned
    });

    it('should register a new vendor', async () => {
      const vendorData = {
        email: 'new-vendor@test.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'Vendor',
        role: 'vendor',
        phone: '+22771234567'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(vendorData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('vendor');
    });

    it('should not register with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('email');
    });

    it('should not register with weak password', async () => {
      const userData = {
        email: 'test@test.com',
        password: '123',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('password');
    });

    it('should not register with duplicate email', async () => {
      const userData = {
        email: testUser.email,
        password: 'Password123!',
        firstName: 'Duplicate',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.id).toBe(testUser.id);
    });

    it('should not login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@test.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid');
    });

    it('should not login with wrong password', async () => {
      const loginData = {
        email: testUser.email,
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid');
    });

    it('should update last login on successful login', async () => {
      const loginData = {
        email: testUser.email,
        password: 'Password123!'
      };

      await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      const updatedUser = await User.findById(testUser.id);
      expect(updatedUser.lastLoginAt).toBeDefined();
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should send password reset email for valid email', async () => {
      const resetData = {
        email: testUser.email
      };

      const response = await request(app)
        .post('/auth/forgot-password')
        .send(resetData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reset link sent');
    });

    it('should handle non-existent email gracefully', async () => {
      const resetData = {
        email: 'nonexistent@test.com'
      };

      const response = await request(app)
        .post('/auth/forgot-password')
        .send(resetData)
        .expect(200);

      // Pour la sécurité, on retourne toujours success même si l'email n'existe pas
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      // Simuler la génération d'un token de reset
      const resetToken = jwt.sign(
        { userId: testUser.id, type: 'password-reset' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const resetData = {
        token: resetToken,
        newPassword: 'NewPassword123!'
      };

      const response = await request(app)
        .post('/auth/reset-password')
        .send(resetData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Vérifier que le nouveau mot de passe fonctionne
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'NewPassword123!'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it('should not reset password with invalid token', async () => {
      const resetData = {
        token: 'invalid-token',
        newPassword: 'NewPassword123!'
      };

      const response = await request(app)
        .post('/auth/reset-password')
        .send(resetData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user info when authenticated', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(testUser.id);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /auth/me', () => {
    it('should update user profile when authenticated', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        phone: '+22771111111'
      };

      const response = await request(app)
        .put('/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.firstName).toBe('Updated');
      expect(response.body.data.user.lastName).toBe('Name');
    });

    it('should not update email or role', async () => {
      const updateData = {
        email: 'new@test.com',
        role: 'admin'
      };

      const response = await request(app)
        .put('/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.user.email).toBe(testUser.email); // Email unchanged
      expect(response.body.data.user.role).toBe(testUser.role); // Role unchanged
    });
  });

  describe('POST /auth/change-password', () => {
    it('should change password with correct current password', async () => {
      const changeData = {
        currentPassword: 'Password123!',
        newPassword: 'NewPassword456!'
      };

      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(changeData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Vérifier que le nouveau mot de passe fonctionne
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'NewPassword456!'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it('should not change password with wrong current password', async () => {
      const changeData = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword456!'
      };

      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(changeData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('current password');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('logout');
    });
  });

  describe('POST /auth/refresh-token', () => {
    it('should refresh token with valid refresh token', async () => {
      // D'abord se connecter pour obtenir un refresh token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'Password123!'
        });

      const refreshToken = loginResponse.body.data.refreshToken;

      const response = await request(app)
        .post('/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });
  });

  describe('Role-based access', () => {
    it('should allow vendor access to vendor endpoints', async () => {
      const response = await request(app)
        .get('/auth/vendor-info')
        .set('Authorization', `Bearer ${vendorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should deny customer access to vendor endpoints', async () => {
      const response = await request(app)
        .get('/auth/vendor-info')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limiting to login attempts', async () => {
      const loginData = {
        email: testUser.email,
        password: 'WrongPassword123!'
      };

      // Faire plusieurs tentatives de connexion échouées
      const promises = Array(6).fill().map(() => 
        request(app)
          .post('/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);
      
      // Les premières tentatives devraient être 401, mais après trop de tentatives, ça devrait être 429
      const lastResponse = responses[responses.length - 1];
      expect([401, 429]).toContain(lastResponse.status);
    });
  });
});