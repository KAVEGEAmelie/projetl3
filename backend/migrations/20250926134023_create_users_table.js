/**
 * Migration: Create users table
 * Date: 2024-01-01
 */

exports.up = function(knex) {
    return knex.schema.createTable('users', (table) => {
      // Primary key
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      
      // Basic information
      table.string('email', 255).notNullable().unique();
      table.string('password_hash', 255).notNullable();
      table.string('first_name', 100).notNullable();
      table.string('last_name', 100).notNullable();
      table.string('phone', 20);
      table.date('birth_date');
      table.enum('gender', ['male', 'female', 'other']);
      
      // Profile
      table.text('avatar_url');
      table.text('bio');
      table.string('preferred_language', 5).defaultTo('fr');
      table.string('preferred_currency', 5).defaultTo('FCFA');
      
      // Address information
      table.string('country', 100);
      table.string('city', 100);
      table.text('address');
      table.string('postal_code', 20);
      
      // User role and status
      table.enum('role', ['customer', 'vendor', 'manager', 'admin', 'super_admin']).defaultTo('customer');
      table.enum('status', ['pending', 'active', 'suspended', 'banned']).defaultTo('pending');
      table.boolean('email_verified').defaultTo(false);
      table.boolean('phone_verified').defaultTo(false);
      
      // Multi-tenant support
      table.uuid('tenant_id').nullable();
      
      // Authentication
      table.string('email_verification_token', 255);
      table.timestamp('email_verification_expires');
      table.string('password_reset_token', 255);
      table.timestamp('password_reset_expires');
      table.string('two_factor_secret', 255);
      table.boolean('two_factor_enabled').defaultTo(false);
      table.timestamp('last_login');
      table.string('last_login_ip', 45);
      
      // Loyalty system
      table.integer('loyalty_points').defaultTo(0);
      table.enum('loyalty_tier', ['bronze', 'silver', 'gold', 'platinum']).defaultTo('bronze');
      
      // Marketing preferences
      table.boolean('marketing_emails').defaultTo(true);
      table.boolean('marketing_sms').defaultTo(false);
      table.boolean('order_notifications').defaultTo(true);
      
      // Timestamps and audit
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('deleted_at').nullable();
      table.uuid('created_by').nullable();
      table.uuid('updated_by').nullable();
      table.uuid('deleted_by').nullable();
      
      // Indexes
      table.index(['email']);
      table.index(['role']);
      table.index(['status']);
      table.index(['tenant_id']);
      table.index(['created_at']);
      table.index(['deleted_at']);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTableIfExists('users');
  };