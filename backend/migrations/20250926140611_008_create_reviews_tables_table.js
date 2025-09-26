/**
 * Migration: Create reviews tables
 * Date: 2024-01-01
 */

exports.up = async function(knex) {
    // Table des avis sur les produits
    await knex.schema.createTable('product_reviews', (table) => {
      // Primary key
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      
      // Relations
      table.uuid('product_id').notNullable();
      table.foreign('product_id').references('id').inTable('products');
      
      table.uuid('customer_id').notNullable();
      table.foreign('customer_id').references('id').inTable('users');
      
      table.uuid('order_id').nullable(); // Si l'avis vient d'un achat vérifié
      table.foreign('order_id').references('id').inTable('orders');
      
      // Contenu de l'avis
      table.integer('rating').notNullable(); // 1-5 étoiles
      table.string('title', 200);
      table.text('comment');
      
      // Images/vidéos d'avis
      table.json('media_urls'); // URLs des images/vidéos postées par le client
      
      // Statut de modération
      table.enum('status', ['pending', 'published', 'rejected', 'hidden']).defaultTo('pending');
      table.text('moderation_notes');
      table.uuid('moderated_by').nullable();
      table.timestamp('moderated_at').nullable();
      
      // Informations d'achat vérifié
      table.boolean('verified_purchase').defaultTo(false);
      table.string('purchase_variant'); // Variante achetée
      
      // Utilité de l'avis
      table.integer('helpful_count').defaultTo(0); // Nombre de "utile"
      table.integer('not_helpful_count').defaultTo(0); // Nombre de "pas utile"
      
      // Réponse du vendeur
      table.text('seller_response');
      table.timestamp('seller_response_date').nullable();
      table.uuid('seller_response_by').nullable();
      
      // Multi-tenant support
      table.uuid('tenant_id').nullable();
      
      // Timestamps
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('deleted_at').nullable();
      
      // Indexes
      table.index(['product_id']);
      table.index(['customer_id']);
      table.index(['order_id']);
      table.index(['rating']);
      table.index(['status']);
      table.index(['verified_purchase']);
      table.index(['created_at']);
      table.index(['tenant_id']);
      
      // Un client ne peut laisser qu'un seul avis par produit
      table.unique(['product_id', 'customer_id']);
    });
  
    // Table des avis sur les commandes/boutiques
    await knex.schema.createTable('order_reviews', (table) => {
      // Primary key
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      
      // Relations
      table.uuid('order_id').notNullable();
      table.foreign('order_id').references('id').inTable('orders');
      
      table.uuid('customer_id').notNullable();
      table.foreign('customer_id').references('id').inTable('users');
      
      table.uuid('store_id').notNullable();
      table.foreign('store_id').references('id').inTable('stores');
      
      // Évaluation globale
      table.integer('rating').notNullable(); // 1-5 étoiles
      table.text('comment');
      
      // Évaluations détaillées
      table.integer('product_quality_rating').nullable(); // 1-5
      table.integer('delivery_speed_rating').nullable(); // 1-5
      table.integer('customer_service_rating').nullable(); // 1-5
      table.integer('packaging_rating').nullable(); // 1-5
      
      // Recommandation
      table.boolean('would_recommend').defaultTo(true);
      
      // Multi-tenant support
      table.uuid('tenant_id').nullable();
      
      // Timestamps
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // Indexes
      table.index(['order_id']);
      table.index(['customer_id']);
      table.index(['store_id']);
      table.index(['rating']);
      table.index(['created_at']);
      table.index(['tenant_id']);
      
      // Un seul avis par commande
      table.unique(['order_id']);
    });
  
    // Table des votes d'utilité sur les avis
    await knex.schema.createTable('review_helpfulness', (table) => {
      // Primary key
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      
      // Relations
      table.uuid('review_id').notNullable();
      table.foreign('review_id').references('id').inTable('product_reviews').onDelete('CASCADE');
      
      table.uuid('user_id').notNullable();
      table.foreign('user_id').references('id').inTable('users');
      
      // Vote
      table.boolean('is_helpful').notNullable(); // true = utile, false = pas utile
      
      // Timestamps
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // Indexes
      table.index(['review_id']);
      table.index(['user_id']);
      
      // Un utilisateur ne peut voter qu'une fois par avis
      table.unique(['review_id', 'user_id']);
    });
  };
  
  exports.down = async function(knex) {
    await knex.schema.dropTableIfExists('review_helpfulness');
    await knex.schema.dropTableIfExists('order_reviews');
    await knex.schema.dropTableIfExists('product_reviews');
  };