const db = require('../config/database');
const bcrypt = require('bcrypt');

/**
 * Modèle User - Gestion des utilisateurs
 * Rôles: customer, vendor, manager, admin, super_admin
 */
class User {
  /**
   * Créer un nouvel utilisateur
   */
  static async create(userData) {
    const {
      email,
      password,
      first_name,
      last_name,
      phone,
      birth_date,
      gender,
      bio,
      country = 'TG',
      city,
      address,
      postal_code,
      role = 'customer',
      preferred_language = 'fr',
      preferred_currency = 'FCFA',
      tenant_id = null
    } = userData;

    // Hash du mot de passe
    const password_hash = await bcrypt.hash(password, 12);

    const [user] = await db('users')
      .insert({
        email: email.toLowerCase(),
        password_hash,
        first_name,
        last_name,
        phone,
        birth_date,
        gender,
        bio,
        country,
        city,
        address,
        postal_code,
        role,
        preferred_language,
        preferred_currency,
        tenant_id,
        status: 'pending',
        email_verified: false,
        phone_verified: false
      })
      .returning('*');

    // Retourner l'utilisateur sans le hash du mot de passe
    delete user.password_hash;
    return user;
  }

  /**
   * Trouver un utilisateur par ID
   */
  static async findById(id) {
    const user = await db('users')
      .select('*')
      .where({ id })
      .whereNull('deleted_at')
      .first();

    if (user) {
      delete user.password_hash;
    }
    return user;
  }

  /**
   * Trouver un utilisateur par email
   */
  static async findByEmail(email) {
    return await db('users')
      .select('*')
      .where({ email: email.toLowerCase() })
      .whereNull('deleted_at')
      .first();
  }

  /**
   * Vérifier le mot de passe
   */
  static async verifyPassword(user, password) {
    return await bcrypt.compare(password, user.password_hash);
  }

  /**
   * Mettre à jour un utilisateur
   */
  static async update(id, updateData) {
    const allowedFields = [
      'first_name', 'last_name', 'phone', 'birth_date', 'gender',
      'avatar_url', 'bio', 'country', 'city', 'address', 'postal_code',
      'preferred_language', 'preferred_currency'
    ];

    const filteredData = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }

    filteredData.updated_at = db.fn.now();

    const [user] = await db('users')
      .where({ id })
      .whereNull('deleted_at')
      .update(filteredData)
      .returning('*');

    if (user) {
      delete user.password_hash;
    }
    return user;
  }

  /**
   * Vérifier l'email d'un utilisateur
   */
  static async verifyEmail(id) {
    const [user] = await db('users')
      .where({ id })
      .update({
        email_verified: true,
        email_verified_at: db.fn.now(),
        status: 'active',
        updated_at: db.fn.now()
      })
      .returning('*');

    if (user) {
      delete user.password_hash;
    }
    return user;
  }

  /**
   * Changer le mot de passe
   */
  static async changePassword(id, newPassword) {
    const password_hash = await bcrypt.hash(newPassword, 12);
    
    await db('users')
      .where({ id })
      .update({
        password_hash,
        updated_at: db.fn.now()
      });

    return true;
  }

  /**
   * Obtenir tous les utilisateurs avec pagination
   */
  static async getAll(options = {}) {
    const {
      page = 1,
      limit = 10,
      role = null,
      status = null,
      search = null,
      tenant_id = null
    } = options;

    let query = db('users')
      .select('id', 'email', 'first_name', 'last_name', 'phone', 'role', 'status', 'email_verified', 'created_at')
      .whereNull('deleted_at');

    // Filtres
    if (role) query = query.where({ role });
    if (status) query = query.where({ status });
    if (tenant_id) query = query.where({ tenant_id });
    
    if (search) {
      query = query.where(function() {
        this.where('first_name', 'ilike', `%${search}%`)
          .orWhere('last_name', 'ilike', `%${search}%`)
          .orWhere('email', 'ilike', `%${search}%`);
      });
    }

    // Pagination
    const offset = (page - 1) * limit;
    const users = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Compter le total
    const totalQuery = db('users').whereNull('deleted_at');
    if (role) totalQuery.where({ role });
    if (status) totalQuery.where({ status });
    if (tenant_id) totalQuery.where({ tenant_id });
    if (search) {
      totalQuery.where(function() {
        this.where('first_name', 'ilike', `%${search}%`)
          .orWhere('last_name', 'ilike', `%${search}%`)
          .orWhere('email', 'ilike', `%${search}%`);
      });
    }
    
    const [{ count }] = await totalQuery.count('* as count');
    const total = parseInt(count);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Obtenir les boutiques d'un utilisateur vendeur
   */
  static async getStores(userId) {
    return await db('stores')
      .select('*')
      .where({ owner_id: userId })
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc');
  }

  /**
   * Obtenir les commandes d'un utilisateur
   */
  static async getOrders(userId, options = {}) {
    const { page = 1, limit = 10, status = null } = options;

    let query = db('orders')
      .select('*')
      .where({ user_id: userId })
      .whereNull('deleted_at');

    if (status) {
      query = query.where({ status });
    }

    const offset = (page - 1) * limit;
    const orders = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return orders;
  }

  /**
   * Suspendre un utilisateur
   */
  static async suspend(id, reason = null) {
    const [user] = await db('users')
      .where({ id })
      .update({
        status: 'suspended',
        suspension_reason: reason,
        suspended_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');

    if (user) {
      delete user.password_hash;
    }
    return user;
  }

  /**
   * Réactiver un utilisateur
   */
  static async reactivate(id) {
    const [user] = await db('users')
      .where({ id })
      .update({
        status: 'active',
        suspension_reason: null,
        suspended_at: null,
        updated_at: db.fn.now()
      })
      .returning('*');

    if (user) {
      delete user.password_hash;
    }
    return user;
  }

  /**
   * Supprimer un utilisateur (soft delete)
   */
  static async delete(id) {
    await db('users')
      .where({ id })
      .update({
        deleted_at: db.fn.now(),
        status: 'banned'
      });

    return true;
  }

  /**
   * Statistiques des utilisateurs
   */
  static async getStats() {
    const stats = await db('users')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('COUNT(*) FILTER (WHERE status = \'active\') as active'),
        db.raw('COUNT(*) FILTER (WHERE status = \'pending\') as pending'),
        db.raw('COUNT(*) FILTER (WHERE status = \'suspended\') as suspended'),
        db.raw('COUNT(*) FILTER (WHERE role = \'customer\') as customers'),
        db.raw('COUNT(*) FILTER (WHERE role = \'vendor\') as vendors'),
        db.raw('COUNT(*) FILTER (WHERE email_verified = true) as verified')
      )
      .whereNull('deleted_at')
      .first();

    return {
      total: parseInt(stats.total),
      active: parseInt(stats.active),
      pending: parseInt(stats.pending),
      suspended: parseInt(stats.suspended),
      customers: parseInt(stats.customers),
      vendors: parseInt(stats.vendors),
      verified: parseInt(stats.verified)
    };
  }
}

module.exports = User;
