const bcrypt = require('bcrypt');

/**
 * Seed pour créer des utilisateurs de test
 */
exports.seed = async function(knex) {
  // Supprimer les données existantes
  await knex('users').del();

  // Hash password pour tous les utilisateurs de test
  const password = await bcrypt.hash('AfrikMode2024!', 12);

  // Insérer les utilisateurs de test
  await knex('users').insert([
    // Super Admin
    {
      id: knex.raw('gen_random_uuid()'),
      email: 'admin@afrikmode.com',
      password_hash: password,
      first_name: 'Admin',
      last_name: 'AfrikMode',
      phone: '+228 90 00 00 01',
      role: 'super_admin',
      status: 'active',
      email_verified: true,
      country: 'TG',
      city: 'Lomé',
      address: 'Quartier Administratif, Lomé',
      preferred_language: 'fr',
      preferred_currency: 'FCFA',
      loyalty_points: 0,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },

    // Admin régulier
    {
      id: knex.raw('gen_random_uuid()'),
      email: 'manager@afrikmode.com',
      password_hash: password,
      first_name: 'Marie',
      last_name: 'Kouassi',
      phone: '+228 90 00 00 02',
      role: 'admin',
      status: 'active',
      email_verified: true,
      country: 'TG',
      city: 'Lomé',
      address: 'Tokoin, Lomé',
      preferred_language: 'fr',
      preferred_currency: 'FCFA',
      loyalty_points: 0,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },

    // Vendeur 1 - Créatrice de mode
    {
      id: knex.raw('gen_random_uuid()'),
      email: 'fatou@afrikstyle.tg',
      password_hash: password,
      first_name: 'Fatou',
      last_name: 'Bamba',
      phone: '+228 90 12 34 56',
      role: 'vendor',
      status: 'active',
      email_verified: true,
      country: 'TG',
      city: 'Lomé',
      address: 'Hedzranawoé, Lomé',
      preferred_language: 'fr',
      preferred_currency: 'FCFA',
      bio: 'Créatrice passionnée de mode africaine moderne. Spécialisée dans les robes en wax et les ensembles traditionnels revisités.',
      avatar_url: '/uploads/users/fatou-avatar.jpg',
      loyalty_points: 150,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },

    // Vendeur 2 - Artisan traditionnel
    {
      id: knex.raw('gen_random_uuid()'),
      email: 'koffi@bogolan.tg',
      password_hash: password,
      first_name: 'Koffi',
      last_name: 'Mensah',
      phone: '+228 90 23 45 67',
      role: 'vendor',
      status: 'active',
      email_verified: true,
      country: 'TG',
      city: 'Kpalimé',
      address: 'Centre-ville, Kpalimé',
      preferred_language: 'fr',
      preferred_currency: 'FCFA',
      bio: 'Artisan spécialisé dans le tissage traditionnel et la création de textiles Kente et Bogolan authentiques.',
      avatar_url: '/uploads/users/koffi-avatar.jpg',
      loyalty_points: 89,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },

    // Vendeur 3 - Styliste moderne
    {
      id: knex.raw('gen_random_uuid()'),
      email: 'aisha@elegancetogo.com',
      password_hash: password,
      first_name: 'Aïsha',
      last_name: 'Diallo',
      phone: '+228 90 34 56 78',
      role: 'vendor',
      status: 'active',
      email_verified: true,
      country: 'TG',
      city: 'Lomé',
      address: 'Bè, Lomé',
      preferred_language: 'fr',
      preferred_currency: 'FCFA',
      bio: 'Styliste spécialisée dans la mode africaine contemporaine. Créations uniques mélangeant tradition et tendances actuelles.',
      avatar_url: '/uploads/users/aisha-avatar.jpg',
      loyalty_points: 267,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },

    // Manager
    {
      id: knex.raw('gen_random_uuid()'),
      email: 'regional@afrikmode.com',
      password_hash: password,
      first_name: 'Jean-Baptiste',
      last_name: 'Agbeko',
      phone: '+228 90 45 67 89',
      role: 'manager',
      status: 'active',
      email_verified: true,
      country: 'TG',
      city: 'Sokodé',
      address: 'Centre commercial, Sokodé',
      preferred_language: 'fr',
      preferred_currency: 'FCFA',
      bio: 'Manager régional responsable de la supervision des boutiques et de la logistique dans la région centrale.',
      loyalty_points: 45,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },

    // Clients de test
    {
      id: knex.raw('gen_random_uuid()'),
      email: 'client1@test.com',
      password_hash: password,
      first_name: 'Adjoua',
      last_name: 'Koné',
      phone: '+228 90 56 78 90',
      role: 'customer',
      status: 'active',
      email_verified: true,
      country: 'TG',
      city: 'Lomé',
      address: 'Adidogomé, Lomé',
      preferred_language: 'fr',
      preferred_currency: 'FCFA',
      loyalty_points: 425,
      loyalty_tier: 'silver',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },

    {
      id: knex.raw('gen_random_uuid()'),
      email: 'client2@test.com',
      password_hash: password,
      first_name: 'Kwame',
      last_name: 'Asante',
      phone: '+228 90 67 89 01',
      role: 'customer',
      status: 'active',
      email_verified: true,
      country: 'GH',
      city: 'Accra',
      address: 'East Legon, Accra',
      preferred_language: 'en',
      preferred_currency: 'FCFA',
      loyalty_points: 156,
      loyalty_tier: 'bronze',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },

    {
      id: knex.raw('gen_random_uuid()'),
      email: 'client3@test.com',
      password_hash: password,
      first_name: 'Aminata',
      last_name: 'Traoré',
      phone: '+228 90 78 90 12',
      role: 'customer',
      status: 'active',
      email_verified: true,
      country: 'BF',
      city: 'Ouagadougou',
      address: 'Ouaga 2000, Ouagadougou',
      preferred_language: 'fr',
      preferred_currency: 'FCFA',
      loyalty_points: 892,
      loyalty_tier: 'gold',
      marketing_emails: true,
      marketing_sms: false,
      order_notifications: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },

    // Client international
    {
      id: knex.raw('gen_random_uuid()'),
      email: 'international@test.com',
      password_hash: password,
      first_name: 'Sarah',
      last_name: 'Johnson',
      phone: '+1 555 123 4567',
      role: 'customer',
      status: 'active',
      email_verified: true,
      country: 'US',
      city: 'New York',
      address: '123 Main St, New York, NY',
      preferred_language: 'en',
      preferred_currency: 'USD',
      loyalty_points: 234,
      loyalty_tier: 'bronze',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);

  console.log('✅ Utilisateurs de test créés avec succès');
  console.log('📧 Email de test: admin@afrikmode.com');
  console.log('🔑 Mot de passe: AfrikMode2024!');
};