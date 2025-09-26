/**
 * Migration: Create products table
 * Date: 2024-01-01
 */

exports.up = function(knex) {
    return knex.schema.createTable('products', (table) => {
      // Primary key
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      
      // Basic product information
      table.string('name', 300).notNullable();
      table.string('slug', 300).notNullable();
      table.text('description');
      table.text('short_description');
      table.string('sku', 100).nullable(); // Stock Keeping Unit
      table.string('barcode', 100).nullable();
      
      // Store association
      table.uuid('store_id').notNullable();
      table.foreign('store_id').references('id').inTable('stores');
      
      // Category association
      table.uuid('category_id').notNullable();
      table.foreign('category_id').references('id').inTable('categories');
      
      // Pricing
      table.decimal('price', 12, 2).notNullable();
      table.decimal('compare_at_price', 12, 2).nullable(); // Original price for sales
      table.decimal('cost_price', 12, 2).nullable(); // Cost for vendor
      table.string('currency', 5).defaultTo('FCFA');
      
      // African fashion specific attributes
      table.string('fabric_type', 100); // Wax, Kente, Bogolan, etc.
      table.string('fabric_origin', 100); // Ghana, Nigeria, Mali, etc.
      table.json('cultural_significance'); // Cultural meaning/story
      table.string('care_instructions'); // How to care for the item
      
      // Physical attributes
      table.json('dimensions'); // Length, width, height
      table.decimal('weight', 8, 2); // In grams
      table.json('colors_available'); // Available colors
      table.json('sizes_available'); // Available sizes (XS, S, M, L, XL, etc.)
      table.json('materials'); // List of materials used
      
      // Inventory management
      table.integer('stock_quantity').defaultTo(0);
      table.integer('reserved_quantity').defaultTo(0); // Reserved for pending orders
      table.integer('low_stock_threshold').defaultTo(5);
      table.boolean('track_inventory').defaultTo(true);
      table.boolean('allow_backorders').defaultTo(false);
      
      // Product status and visibility
      table.enum('status', ['draft', 'active', 'inactive', 'out_of_stock']).defaultTo('draft');
      table.boolean('featured').defaultTo(false);
      table.boolean('customizable').defaultTo(false); // Can be customized by customer
      
      // Media
      table.json('images'); // Array of image URLs
      table.json('videos'); // Array of video URLs
      table.string('primary_image'); // Main product image
      
      // Shipping
      table.boolean('requires_shipping').defaultTo(true);
      table.decimal('shipping_weight', 8, 2); // Shipping weight
      table.json('shipping_dimensions'); // For shipping calculations
      table.boolean('fragile').defaultTo(false);
      
      // SEO
      table.string('meta_title');
      table.text('meta_description');
      table.json('meta_keywords');
      
      // Multi-language support
      table.json('translations'); // Product info in different languages
      
      // Product analytics
      table.integer('views_count').defaultTo(0);
      table.integer('sales_count').defaultTo(0);
      table.decimal('total_revenue', 15, 2).defaultTo(0);
      table.decimal('average_rating', 3, 2).defaultTo(0);
      table.integer('reviews_count').defaultTo(0);
      table.integer('wishlist_count').defaultTo(0);
      
      // Vendor/artisan information
      table.string('artisan_name', 200); // Name of the artisan who made it
      table.text('artisan_story'); // Story about the artisan
      table.string('artisan_location', 100); // Where it was made
      
      // Product attributes (flexible JSON for additional properties)
      table.json('attributes'); // Custom attributes (color, pattern, etc.)
      table.json('variants'); // Product variants (different combinations)
      
      // Seasonality and trends
      table.json('seasons'); // Which seasons this product is for
      table.json('occasions'); // Occasions (wedding, festival, daily, etc.)
      table.json('tags'); // Free-form tags
      
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
      table.index(['store_id']);
      table.index(['category_id']);
      table.index(['slug']);
      table.index(['sku']);
      table.index(['status']);
      table.index(['featured']);
      table.index(['price']);
      table.index(['stock_quantity']);
      table.index(['tenant_id']);
      table.index(['fabric_type']);
      table.index(['created_at']);
      table.index(['deleted_at']);
      
      // Unique constraints
      table.unique(['slug', 'store_id']);
      table.unique(['sku', 'store_id'], { indexName: 'products_sku_store_unique' });
    })
    .then(() => {
      // Create full-text search index after table creation
      return knex.raw(`
        CREATE INDEX products_search_idx ON products 
        USING gin(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'')))
      `);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('products');
};