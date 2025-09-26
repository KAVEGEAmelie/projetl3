/**
 * Migration: Create stores table
 * Date: 2024-01-01
 */

exports.up = function(knex) {
    return knex.schema.createTable('stores', (table) => {
      // Primary key
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      
      // Store basic information
      table.string('name', 200).notNullable();
      table.string('slug', 200).notNullable().unique();
      table.text('description');
      table.text('short_description');
      
      // Store owner
      table.uuid('owner_id').notNullable();
      table.foreign('owner_id').references('id').inTable('users');
      
      // Store configuration
      table.string('logo_url');
      table.string('banner_url');
      table.string('theme_color', 7).defaultTo('#8B2E2E');
      table.json('brand_colors'); // Store theme colors
      
      // Contact information
      table.string('email', 255);
      table.string('phone', 20);
      table.string('whatsapp', 20);
      table.string('website');
      table.json('social_links'); // Facebook, Instagram, etc.
      
      // Address information
      table.string('country', 100).notNullable();
      table.string('region', 100);
      table.string('city', 100).notNullable();
      table.text('address').notNullable();
      table.string('postal_code', 20);
      table.decimal('latitude', 10, 8);
      table.decimal('longitude', 11, 8);
      
      // Business information
      table.string('business_registration_number', 100);
      table.string('tax_number', 100);
      table.string('business_type', 50); // individual, company, cooperative
      
      // Store settings
      table.enum('status', ['pending', 'active', 'suspended', 'closed']).defaultTo('pending');
      table.boolean('is_verified').defaultTo(false);
      table.boolean('featured').defaultTo(false);
      table.decimal('commission_rate', 5, 2).defaultTo(10.00); // % commission
      
      // Store policies
      table.text('return_policy');
      table.text('shipping_policy');
      table.text('privacy_policy');
      table.text('terms_conditions');
      
      // Multi-language support
      table.json('translations'); // Store info in different languages
      table.string('default_language', 5).defaultTo('fr');
      table.json('supported_languages').defaultTo(JSON.stringify(['fr']));
      
      // Currency and payment settings
      table.string('default_currency', 5).defaultTo('FCFA');
      table.json('accepted_currencies');
      table.json('payment_methods'); // Available payment methods for this store
      
      // Store analytics
      table.integer('total_orders').defaultTo(0);
      table.decimal('total_revenue', 15, 2).defaultTo(0);
      table.decimal('average_rating', 3, 2).defaultTo(0);
      table.integer('total_reviews').defaultTo(0);
      table.integer('total_products').defaultTo(0);
      table.integer('followers_count').defaultTo(0);
      
      // SEO
      table.string('meta_title');
      table.text('meta_description');
      table.json('meta_keywords');
      
      // Store hours
      table.json('opening_hours'); // Store operating hours
      table.string('timezone', 50).defaultTo('Africa/Lome');
      
      // Multi-tenant support
      table.uuid('tenant_id').nullable();
      
      // Timestamps and audit
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('deleted_at').nullable();
      table.uuid('created_by').nullable();
      table.uuid('updated_by').nullable();
      table.uuid('deleted_by').nullable();
      
      // Indexes
      table.index(['owner_id']);
      table.index(['slug']);
      table.index(['status']);
      table.index(['country', 'city']);
      table.index(['featured']);
      table.index(['is_verified']);
      table.index(['tenant_id']);
      table.index(['created_at']);
      table.index(['deleted_at']);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTableIfExists('stores');
  };