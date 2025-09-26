/**
 * Migration: Create order_items table
 * Date: 2024-01-01
 */

exports.up = function(knex) {
    return knex.schema.createTable('order_items', (table) => {
      // Primary key
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      
      // Order association
      table.uuid('order_id').notNullable();
      table.foreign('order_id').references('id').inTable('orders').onDelete('CASCADE');
      
      // Product information
      table.uuid('product_id').notNullable();
      table.foreign('product_id').references('id').inTable('products');
      
      // Store information (for multi-vendor orders)
      table.uuid('store_id').notNullable();
      table.foreign('store_id').references('id').inTable('stores');
      
      // Product details at time of order (snapshot)
      table.string('product_name', 300).notNullable();
      table.string('product_sku', 100).nullable();
      table.text('product_description');
      table.string('product_image');
      
      // Variant information
      table.string('variant_name', 200); // e.g., "Rouge - Taille M"
      table.json('variant_attributes'); // Color, size, fabric, etc.
      
      // Pricing
      table.integer('quantity').notNullable();
      table.decimal('unit_price', 12, 2).notNullable(); // Prix unitaire au moment de la commande
      table.decimal('total_price', 12, 2).notNullable(); // Prix total (quantity * unit_price)
      table.string('currency', 5).defaultTo('FCFA');
      
      // Discounts applied to this item
      table.decimal('discount_amount', 12, 2).defaultTo(0);
      table.string('discount_reason', 200); // Promotion, coupon, etc.
      
      // African fashion specific attributes (snapshot from product)
      table.string('fabric_type', 100);
      table.string('fabric_origin', 100);
      table.string('artisan_name', 200);
      table.string('artisan_location', 100);
      table.json('cultural_significance');
      
      // Customization details (if customizable product)
      table.boolean('is_customized').defaultTo(false);
      table.json('customization_details'); // Special requests, modifications
      table.text('customization_notes');
      table.decimal('customization_fee', 12, 2).defaultTo(0);
      
      // Item status (useful for partial shipping)
      table.enum('status', [
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'returned',
        'refunded'
      ]).defaultTo('pending');
      
      // Tracking for individual items (if shipped separately)
      table.string('tracking_number', 100).nullable();
      table.timestamp('shipped_at').nullable();
      table.timestamp('delivered_at').nullable();
      
      // Reviews (once delivered)
      table.boolean('reviewed').defaultTo(false);
      table.integer('rating').nullable(); // 1-5 stars
      table.text('review_text').nullable();
      table.timestamp('reviewed_at').nullable();
      
      // Multi-tenant support
      table.uuid('tenant_id').nullable();
      
      // Timestamps
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // Indexes
      table.index(['order_id']);
      table.index(['product_id']);
      table.index(['store_id']);
      table.index(['status']);
      table.index(['tenant_id']);
      table.index(['created_at']);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTableIfExists('order_items');
  };