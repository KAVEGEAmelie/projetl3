const db = require('../config/database');

/**
 * Modèle Payment - Gestion des paiements et transactions
 */
class Payment {
  /**
   * Créer un nouveau paiement
   */
  static async create(paymentData) {
    const {
      order_id,
      user_id,
      amount,
      currency = 'FCFA',
      payment_method,
      payment_provider = null,
      provider_transaction_id = null,
      customer_phone = null,
      customer_email = null,
      metadata = {}
    } = paymentData;

    // Générer un ID de transaction unique
    const transaction_id = this.generateTransactionId();

    const [payment] = await db('payments')
      .insert({
        transaction_id,
        order_id,
        user_id,
        amount,
        currency,
        payment_method,
        payment_provider,
        provider_transaction_id,
        customer_phone,
        customer_email,
        status: 'pending',
        metadata: JSON.stringify(metadata)
      })
      .returning('*');

    return this.formatPayment(payment);
  }

  /**
   * Trouver un paiement par ID
   */
  static async findById(id) {
    const payment = await db('payments')
      .select('payments.*', 'orders.order_number', 'users.first_name', 'users.last_name')
      .leftJoin('orders', 'payments.order_id', 'orders.id')
      .leftJoin('users', 'payments.user_id', 'users.id')
      .where('payments.id', id)
      .first();

    return payment ? this.formatPayment(payment) : null;
  }

  /**
   * Trouver un paiement par ID de transaction
   */
  static async findByTransactionId(transactionId) {
    const payment = await db('payments')
      .select('payments.*', 'orders.order_number', 'users.first_name', 'users.last_name')
      .leftJoin('orders', 'payments.order_id', 'orders.id')
      .leftJoin('users', 'payments.user_id', 'users.id')
      .where('payments.transaction_id', transactionId)
      .first();

    return payment ? this.formatPayment(payment) : null;
  }

  /**
   * Trouver un paiement par ID de transaction du provider
   */
  static async findByProviderTransactionId(providerTransactionId) {
    const payment = await db('payments')
      .select('payments.*', 'orders.order_number', 'users.first_name', 'users.last_name')
      .leftJoin('orders', 'payments.order_id', 'orders.id')
      .leftJoin('users', 'payments.user_id', 'users.id')
      .where('payments.provider_transaction_id', providerTransactionId)
      .first();

    return payment ? this.formatPayment(payment) : null;
  }

  /**
   * Obtenir tous les paiements avec filtres
   */
  static async getAll(options = {}) {
    const {
      page = 1,
      limit = 20,
      user_id = null,
      order_id = null,
      status = null,
      payment_method = null,
      payment_provider = null,
      date_from = null,
      date_to = null,
      amount_min = null,
      amount_max = null,
      search = null,
      sort = 'created_at',
      order = 'desc'
    } = options;

    let query = db('payments')
      .select('payments.*', 'orders.order_number', 'users.first_name', 'users.last_name', 'users.email')
      .leftJoin('orders', 'payments.order_id', 'orders.id')
      .leftJoin('users', 'payments.user_id', 'users.id');

    // Filtres
    if (user_id) query = query.where('payments.user_id', user_id);
    if (order_id) query = query.where('payments.order_id', order_id);
    if (status) query = query.where('payments.status', status);
    if (payment_method) query = query.where('payments.payment_method', payment_method);
    if (payment_provider) query = query.where('payments.payment_provider', payment_provider);
    if (date_from) query = query.where('payments.created_at', '>=', date_from);
    if (date_to) query = query.where('payments.created_at', '<=', date_to);
    if (amount_min) query = query.where('payments.amount', '>=', amount_min);
    if (amount_max) query = query.where('payments.amount', '<=', amount_max);
    
    if (search) {
      query = query.where(function() {
        this.where('payments.transaction_id', 'ilike', `%${search}%`)
          .orWhere('orders.order_number', 'ilike', `%${search}%`)
          .orWhere('users.first_name', 'ilike', `%${search}%`)
          .orWhere('users.last_name', 'ilike', `%${search}%`)
          .orWhere('users.email', 'ilike', `%${search}%`);
      });
    }

    // Tri
    const validSorts = ['created_at', 'amount', 'status', 'payment_method'];
    const sortField = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = ['asc', 'desc'].includes(order) ? order : 'desc';
    
    query = query.orderBy(`payments.${sortField}`, sortOrder);

    // Pagination
    const offset = (page - 1) * limit;
    const payments = await query.limit(limit).offset(offset);

    // Compter le total
    const totalQuery = db('payments')
      .leftJoin('orders', 'payments.order_id', 'orders.id')
      .leftJoin('users', 'payments.user_id', 'users.id');

    // Appliquer les mêmes filtres
    if (user_id) totalQuery.where('payments.user_id', user_id);
    if (order_id) totalQuery.where('payments.order_id', order_id);
    if (status) totalQuery.where('payments.status', status);
    if (payment_method) totalQuery.where('payments.payment_method', payment_method);
    if (payment_provider) totalQuery.where('payments.payment_provider', payment_provider);
    if (date_from) totalQuery.where('payments.created_at', '>=', date_from);
    if (date_to) totalQuery.where('payments.created_at', '<=', date_to);
    if (amount_min) totalQuery.where('payments.amount', '>=', amount_min);
    if (amount_max) totalQuery.where('payments.amount', '<=', amount_max);
    if (search) {
      totalQuery.where(function() {
        this.where('payments.transaction_id', 'ilike', `%${search}%`)
          .orWhere('orders.order_number', 'ilike', `%${search}%`)
          .orWhere('users.first_name', 'ilike', `%${search}%`)
          .orWhere('users.last_name', 'ilike', `%${search}%`)
          .orWhere('users.email', 'ilike', `%${search}%`);
      });
    }
    
    const [{ count }] = await totalQuery.count('payments.id as count');
    const total = parseInt(count);

    return {
      payments: payments.map(payment => this.formatPayment(payment)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Mettre à jour le statut d'un paiement
   */
  static async updateStatus(id, status, metadata = {}) {
    const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'];

    if (!validStatuses.includes(status)) {
      throw new Error(`Statut de paiement invalide: ${status}`);
    }

    const updateData = {
      status,
      updated_at: db.fn.now()
    };

    // Ajouter des timestamps pour certains statuts
    switch (status) {
      case 'completed':
        updateData.completed_at = db.fn.now();
        break;
      case 'failed':
        updateData.failed_at = db.fn.now();
        break;
      case 'cancelled':
        updateData.cancelled_at = db.fn.now();
        break;
      case 'refunded':
        updateData.refunded_at = db.fn.now();
        break;
    }

    // Mettre à jour les métadonnées si fournies
    if (Object.keys(metadata).length > 0) {
      const currentPayment = await this.findById(id);
      const currentMetadata = currentPayment.metadata || {};
      const newMetadata = { ...currentMetadata, ...metadata };
      updateData.metadata = JSON.stringify(newMetadata);
    }

    return await db.transaction(async (trx) => {
      const [payment] = await trx('payments')
        .where({ id })
        .update(updateData)
        .returning('*');

      // Mettre à jour la commande correspondante si le paiement est complété ou échoué
      if (payment && payment.order_id) {
        if (status === 'completed') {
          await trx('orders')
            .where({ id: payment.order_id })
            .update({
              payment_status: 'paid',
              paid_at: trx.fn.now(),
              updated_at: trx.fn.now()
            });
        } else if (status === 'failed') {
          await trx('orders')
            .where({ id: payment.order_id })
            .update({
              payment_status: 'failed',
              updated_at: trx.fn.now()
            });
        }
      }

      return payment ? this.formatPayment(payment) : null;
    });
  }

  /**
   * Traiter un paiement mobile money
   */
  static async processMobileMoneyPayment(paymentId, phoneNumber, provider = 'moov_money') {
    const payment = await this.findById(paymentId);
    
    if (!payment) {
      throw new Error('Paiement non trouvé');
    }

    if (payment.status !== 'pending') {
      throw new Error('Le paiement ne peut plus être traité');
    }

    // Mise à jour du statut en processing
    await this.updateStatus(paymentId, 'processing', {
      phone_number: phoneNumber,
      provider: provider,
      processing_started_at: new Date().toISOString()
    });

    // Simuler l'appel à l'API du provider mobile money
    // En production, vous intégreriez les vrais APIs (Moov Money, Orange Money, etc.)
    const mockApiResult = await this.mockMobileMoneyAPI(payment.amount, phoneNumber, provider);

    if (mockApiResult.success) {
      await this.updateStatus(paymentId, 'completed', {
        provider_transaction_id: mockApiResult.transaction_id,
        provider_response: mockApiResult
      });
    } else {
      await this.updateStatus(paymentId, 'failed', {
        error_message: mockApiResult.error,
        provider_response: mockApiResult
      });
    }

    return await this.findById(paymentId);
  }

  /**
   * Traiter un remboursement
   */
  static async processRefund(paymentId, amount = null, reason = null) {
    const payment = await this.findById(paymentId);
    
    if (!payment) {
      throw new Error('Paiement non trouvé');
    }

    if (payment.status !== 'completed') {
      throw new Error('Seuls les paiements complétés peuvent être remboursés');
    }

    const refundAmount = amount || payment.amount;

    if (refundAmount > payment.amount) {
      throw new Error('Le montant du remboursement ne peut pas dépasser le montant initial');
    }

    // Créer une entrée de remboursement
    const [refund] = await db('payments')
      .insert({
        transaction_id: this.generateTransactionId(),
        order_id: payment.order_id,
        user_id: payment.user_id,
        amount: -refundAmount, // Montant négatif pour le remboursement
        currency: payment.currency,
        payment_method: payment.payment_method,
        payment_provider: payment.payment_provider,
        parent_payment_id: payment.id,
        status: 'completed',
        completed_at: db.fn.now(),
        metadata: JSON.stringify({
          type: 'refund',
          original_payment_id: payment.id,
          refund_reason: reason,
          refund_type: refundAmount === payment.amount ? 'full' : 'partial'
        })
      })
      .returning('*');

    // Mettre à jour le paiement original
    await this.updateStatus(paymentId, 'refunded', {
      refund_amount: refundAmount,
      refund_reason: reason,
      refunded_at: new Date().toISOString()
    });

    return this.formatPayment(refund);
  }

  /**
   * Obtenir les statistiques des paiements
   */
  static async getStats(options = {}) {
    const { 
      date_from = null, 
      date_to = null, 
      payment_method = null,
      payment_provider = null 
    } = options;

    let query = db('payments');
    
    if (date_from) query = query.where('created_at', '>=', date_from);
    if (date_to) query = query.where('created_at', '<=', date_to);
    if (payment_method) query = query.where('payment_method', payment_method);
    if (payment_provider) query = query.where('payment_provider', payment_provider);

    const [stats] = await query
      .select(
        db.raw('COUNT(*) as total_payments'),
        db.raw('COUNT(*) FILTER (WHERE status = \'completed\') as completed'),
        db.raw('COUNT(*) FILTER (WHERE status = \'pending\') as pending'),
        db.raw('COUNT(*) FILTER (WHERE status = \'processing\') as processing'),
        db.raw('COUNT(*) FILTER (WHERE status = \'failed\') as failed'),
        db.raw('COUNT(*) FILTER (WHERE status = \'refunded\') as refunded'),
        db.raw('SUM(amount) FILTER (WHERE status = \'completed\' AND amount > 0) as total_revenue'),
        db.raw('SUM(amount) FILTER (WHERE status = \'refunded\' AND amount < 0) as total_refunds'),
        db.raw('AVG(amount) FILTER (WHERE status = \'completed\' AND amount > 0) as average_payment'),
        db.raw('MAX(amount) FILTER (WHERE status = \'completed\') as highest_payment')
      );

    // Statistiques par méthode de paiement
    const methodStats = await db('payments')
      .select('payment_method')
      .select(db.raw('COUNT(*) as count'))
      .select(db.raw('SUM(amount) FILTER (WHERE status = \'completed\') as revenue'))
      .where(function() {
        if (date_from) this.where('created_at', '>=', date_from);
        if (date_to) this.where('created_at', '<=', date_to);
      })
      .groupBy('payment_method')
      .orderBy('revenue', 'desc');

    return {
      total_payments: parseInt(stats.total_payments) || 0,
      completed: parseInt(stats.completed) || 0,
      pending: parseInt(stats.pending) || 0,
      processing: parseInt(stats.processing) || 0,
      failed: parseInt(stats.failed) || 0,
      refunded: parseInt(stats.refunded) || 0,
      total_revenue: parseFloat(stats.total_revenue) || 0,
      total_refunds: Math.abs(parseFloat(stats.total_refunds)) || 0,
      net_revenue: (parseFloat(stats.total_revenue) || 0) + (parseFloat(stats.total_refunds) || 0),
      average_payment: parseFloat(stats.average_payment) || 0,
      highest_payment: parseFloat(stats.highest_payment) || 0,
      success_rate: stats.total_payments > 0 ? (parseInt(stats.completed) / parseInt(stats.total_payments) * 100).toFixed(2) : 0,
      by_method: methodStats.map(method => ({
        ...method,
        count: parseInt(method.count),
        revenue: parseFloat(method.revenue) || 0
      }))
    };
  }

  /**
   * Générer un ID de transaction unique
   */
  static generateTransactionId() {
    const date = new Date();
    const timestamp = date.getTime().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TXN${timestamp.slice(-8)}${random}`;
  }

  /**
   * Mock API Mobile Money (à remplacer par l'intégration réelle)
   */
  static async mockMobileMoneyAPI(amount, phoneNumber, provider) {
    // Simulation d'une réponse API
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simule le délai d'API

    // 90% de chance de succès pour la simulation
    const success = Math.random() > 0.1;

    if (success) {
      return {
        success: true,
        transaction_id: `${provider.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        amount,
        phone_number: phoneNumber,
        provider,
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        success: false,
        error: 'Insufficient balance or network error',
        error_code: 'PAYMENT_FAILED',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Obtenir l'historique des paiements d'un utilisateur
   */
  static async getUserPaymentHistory(userId, options = {}) {
    const { page = 1, limit = 10 } = options;

    return await this.getAll({
      ...options,
      user_id: userId,
      page,
      limit,
      sort: 'created_at',
      order: 'desc'
    });
  }

  /**
   * Obtenir les paiements d'une commande
   */
  static async getOrderPayments(orderId) {
    const payments = await db('payments')
      .select('*')
      .where({ order_id: orderId })
      .orderBy('created_at', 'desc');

    return payments.map(payment => this.formatPayment(payment));
  }

  /**
   * Vérifier si une commande est entièrement payée
   */
  static async isOrderFullyPaid(orderId) {
    const order = await db('orders').where({ id: orderId }).first();
    if (!order) return false;

    const [result] = await db('payments')
      .select(db.raw('SUM(amount) as total_paid'))
      .where({ order_id: orderId })
      .where('status', 'completed')
      .where('amount', '>', 0); // Exclure les remboursements

    const totalPaid = parseFloat(result.total_paid) || 0;
    return totalPaid >= parseFloat(order.total_amount);
  }

  /**
   * Formater les données de paiement
   */
  static formatPayment(payment) {
    if (!payment) return null;

    const formatted = { ...payment };

    // Parser les métadonnées JSON
    try {
      if (formatted.metadata && typeof formatted.metadata === 'string') {
        formatted.metadata = JSON.parse(formatted.metadata);
      }
    } catch (error) {
      console.error('Erreur lors du parsing des métadonnées:', error);
      formatted.metadata = {};
    }

    // Convertir le montant en nombre
    formatted.amount = parseFloat(formatted.amount) || 0;

    return formatted;
  }
}

module.exports = Payment;
