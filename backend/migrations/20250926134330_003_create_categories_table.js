/**
 * Migration: Create categories table
 * Date: 2024-01-01
 */

exports.up = function(knex) {
    return knex.schema.createTable('categories', (table) => {
      // Primary key
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      
      // Category information
      table.string('name', 200).notNullable();
      table.string('slug', 200).notNullable();
      table.text('description');
      table.string('image_url');
      table.string('icon'); // CSS class or icon name
      
      // Hierarchy support
      table.uuid('parent_id').nullable();
      table.foreign('parent_id').references('id').inTable('categories');
      table.integer('level').defaultTo(0); // 0 = root, 1 = child, etc.
      table.string('path'); // For materialized path (e.g., '1.2.5')
      table.integer('sort_order').defaultTo(0);
      
      // Category settings
      table.boolean('is_active').defaultTo(true);
      table.boolean('featured').defaultTo(false);
      table.boolean('show_in_menu').defaultTo(true);
      
      // SEO
      table.string('meta_title');
      table.text('meta_description');
      table.json('meta_keywords');
      
      // Multi-language support
      table.json('translations'); // Category info in different languages
      
      // Category analytics
      table.integer('products_count').defaultTo(0);
      table.integer('views_count').defaultTo(0);
      
      // Store specific (if category belongs to specific store)
      table.uuid('store_id').nullable();
      table.foreign('store_id').references('id').inTable('stores');
      
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
      table.index(['slug']);
      table.index(['parent_id']);
      table.index(['level']);
      table.index(['path']);
      table.index(['is_active']);
      table.index(['featured']);
      table.index(['store_id']);
      table.index(['tenant_id']);
      table.index(['sort_order']);
      table.index(['created_at']);
      table.index(['deleted_at']);
      
      // Unique constraints
      table.unique(['slug', 'tenant_id']);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTableIfExists('categories');
  };