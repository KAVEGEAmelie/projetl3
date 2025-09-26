/**
 * Migration: Create orders table
 * Date: 2024-01-01
 */

exports.up = function(knex) {
    return knex.schema.createTable('orders', (table) => {
      // Primary key
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      
      // Order identification
      table.string('order_number', 50).notNullable().unique(); // e.g., AFM-2024-001234
      
      // Customer information
      table.uuid('customer_id').notNullable();
      table.foreign('customer_id').references('id').inTable('users');
      
      // Store information (can be null for multi-vendor orders)
      table.uuid('store_id').nullable();
      table.foreign('store_id').references('id').inTable('stores');
      
      // Order status
      table.enum('status', [
        'pending',        // En attente de paiement
        'paid',          // Payée
        'confirmed',     // Confirmée par le vendeur
        'processing',    // En préparation
        'shipped',       // Expédiée
        'delivered',     // Livrée
        'cancelled',     // Annulée
        'refunded',      // Remboursée
        'returned'       // Retournée
      ]).defaultTo('pending');
      
      // Financial information
      table.decimal('subtotal', 12, 2).notNullable(); // Sous-total produits
      table.decimal('shipping_cost', 12, 2).defaultTo(0); // Frais de livraison
      table.decimal('tax_amount', 12, 2).defaultTo(0); // Montant des taxes
      table.decimal('discount_amount', 12, 2).defaultTo(0); // Montant de la réduction
      table.decimal('total_amount', 12, 2).notNullable(); // Montant total
      table.string('currency', 5).defaultTo('FCFA');
      
      // Coupon/Promotion
      table.string('coupon_code', 50).nullable();
      table.decimal('coupon_discount', 12, 2).defaultTo(0);
      
      // Delivery information
      table.json('delivery_address'); // Adresse de livraison complète
      table.json('billing_address'); // Adresse de facturation
      table.string('delivery_method', 100); // Méthode de livraison
      table.string('delivery_notes'); // Instructions de livraison
      table.timestamp('estimated_delivery_date').nullable();
      table.timestamp('actual_delivery_date').nullable();
      
      // Contact information
      table.string('customer_phone', 20);
      table.string('customer_email', 255);
      table.string('customer_name', 200);
      
      // Tracking information
      table.string('tracking_number', 100).nullable();
      table.string('tracking_url').nullable();
      table.string('carrier', 100).nullable(); // Transporteur
      
      // Payment information
      table.enum('payment_method', [
        'tmoney',
        'flooz', 
        'orange_money',
        'mtn_money',
        'cash_on_delivery',
        'bank_transfer',
        'paypal',
        'stripe'
      ]);
      table.enum('payment_status', [
        'pending',
        'paid',
        'failed',
        'refunded',
        'partially_refunded'
      ]).defaultTo('pending');
      table.timestamp('payment_date').nullable();
      table.string('payment_reference', 255).nullable();
      table.text('payment_notes').nullable();
      
      // Customer notes and special requests
      table.text('customer_notes');
      table.text('admin_notes'); // Notes internes
      
      // Multi-language support
      table.string('language', 5).defaultTo('fr');
      
      // Order source
      table.enum('source', ['web', 'mobile', 'admin', 'import']).defaultTo('web');
      
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
      table.index(['customer_id']);
      table.index(['store_id']);
      table.index(['order_number']);
      table.index(['status']);
      table.index(['payment_status']);
      table.index(['payment_method']);
      table.index(['tracking_number']);
      table.index(['tenant_id']);
      table.index(['created_at']);
      table.index(['deleted_at']);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTableIfExists('orders');
  };