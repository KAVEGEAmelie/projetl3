/**
 * Migration: Create payments table
 * Date: 2024-01-01
 */

exports.up = function(knex) {
    return knex.schema.createTable('payments', (table) => {
      // Primary key
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      
      // Payment identification
      table.string('payment_reference', 100).notNullable().unique(); // Référence unique de paiement
      
      // Order association
      table.uuid('order_id').notNullable();
      table.foreign('order_id').references('id').inTable('orders');
      
      // Customer information
      table.uuid('customer_id').notNullable();
      table.foreign('customer_id').references('id').inTable('users');
      
      // Store information (commission calculation)
      table.uuid('store_id').nullable();
      table.foreign('store_id').references('id').inTable('stores');
      
      // Payment method details
      table.enum('payment_method', [
        'tmoney',           // TMoney Togo
        'flooz',           // Flooz
        'orange_money',    // Orange Money
        'mtn_money',       // MTN Mobile Money
        'moov_money',      // Moov Money
        'cash_on_delivery', // Paiement à la livraison
        'bank_transfer',   // Virement bancaire
        'paypal',          // PayPal
        'stripe',          // Stripe
        'wave',            // Wave (Sénégal)
        'other'            // Autre méthode
      ]).notNullable();
      
      // Payment status
      table.enum('status', [
        'pending',          // En attente
        'processing',       // En cours de traitement
        'completed',        // Complété avec succès
        'failed',          // Échec
        'cancelled',       // Annulé
        'expired',         // Expiré
        'refunded',        // Remboursé
        'partially_refunded' // Partiellement remboursé
      ]).defaultTo('pending');
      
      // Financial details
      table.decimal('amount', 12, 2).notNullable(); // Montant du paiement
      table.string('currency', 5).defaultTo('FCFA');
      table.decimal('exchange_rate', 10, 6).defaultTo(1); // Taux de change si nécessaire
      table.decimal('fee_amount', 12, 2).defaultTo(0); // Frais de transaction
      table.decimal('net_amount', 12, 2).notNullable(); // Montant net après frais
      
      // Provider-specific information
      table.string('provider_transaction_id', 255); // ID de transaction du provider
      table.string('provider_reference', 255); // Référence du provider
      table.json('provider_response'); // Réponse complète du provider
      table.string('provider_status', 100); // Statut côté provider
      
      // Mobile money specific fields
      table.string('phone_number', 20); // Numéro de téléphone pour mobile money
      table.string('operator', 50); // Opérateur (Orange, MTN, Moov, etc.)
      table.string('wallet_id', 100); // ID du portefeuille mobile
      
      // Bank transfer specific fields
      table.string('bank_name', 200);
      table.string('account_number', 100);
      table.string('account_holder', 200);
      table.string('swift_code', 20);
      table.string('iban', 50);
      
      // Card payment specific fields (si applicable)
      table.string('card_last_four', 4); // 4 derniers chiffres de la carte
      table.string('card_brand', 20); // Visa, Mastercard, etc.
      table.string('card_type', 20); // Credit, Debit
      
      // Timestamps
      table.timestamp('initiated_at').defaultTo(knex.fn.now()); // Quand le paiement a été initié
      table.timestamp('processed_at').nullable(); // Quand le paiement a été traité
      table.timestamp('completed_at').nullable(); // Quand le paiement a été complété
      table.timestamp('expires_at').nullable(); // Expiration du paiement (si applicable)
      
      // Retry mechanism
      table.integer('retry_count').defaultTo(0);
      table.timestamp('last_retry_at').nullable();
      table.integer('max_retries').defaultTo(3);
      
      // Webhook and callback information
      table.json('webhook_data'); // Données reçues via webhook
      table.timestamp('webhook_received_at').nullable();
      table.boolean('webhook_verified').defaultTo(false);
      
      // Notifications
      table.boolean('customer_notified').defaultTo(false);
      table.boolean('store_notified').defaultTo(false);
      table.timestamp('notification_sent_at').nullable();
      
      // Reconciliation
      table.boolean('reconciled').defaultTo(false);
      table.timestamp('reconciled_at').nullable();
      table.uuid('reconciled_by').nullable();
      
      // Commission and fees
      table.decimal('platform_commission', 12, 2).defaultTo(0); // Commission de la plateforme
      table.decimal('store_payout', 12, 2).notNullable(); // Montant à verser au vendeur
      table.boolean('payout_processed').defaultTo(false);
      table.timestamp('payout_date').nullable();
      
      // Additional information
      table.text('notes'); // Notes internes
      table.text('failure_reason'); // Raison de l'échec si applicable
      table.json('metadata'); // Métadonnées additionnelles
      
      // Customer information snapshot
      table.string('customer_name', 200);
      table.string('customer_email', 255);
      table.string('customer_phone', 20);
      
      // Multi-tenant support
      table.uuid('tenant_id').nullable();
      
      // Audit trails
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.uuid('created_by').nullable();
      table.uuid('updated_by').nullable();
      
      // Indexes for performance
      table.index(['order_id']);
      table.index(['customer_id']);
      table.index(['store_id']);
      table.index(['payment_reference']);
      table.index(['payment_method']);
      table.index(['status']);
      table.index(['provider_transaction_id']);
      table.index(['phone_number']);
      table.index(['initiated_at']);
      table.index(['completed_at']);
      table.index(['tenant_id']);
      table.index(['reconciled']);
      table.index(['payout_processed']);
      
      // Composite indexes
      table.index(['status', 'payment_method']);
      table.index(['customer_id', 'status']);
      table.index(['store_id', 'status']);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTableIfExists('payments');
  };