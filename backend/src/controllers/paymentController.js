const db = require('../config/database');
const { asyncHandler, commonErrors } = require('../middleware/errorHandler');
const { paymentService, cryptoUtils } = require('../services/paymentService');

/**
 * Récupérer les méthodes de paiement disponibles
 * GET /api/payments/methods
 */
const getPaymentMethods = asyncHandler(async (req, res) => {
  const { country = 'TG', amount } = req.query;
  
  // Récupérer les méthodes disponibles
  const methods = paymentService.getAvailablePaymentMethods(country);
  
  // Calculer les frais pour chaque méthode si un montant est fourni
  if (amount) {
    const parsedAmount = parseFloat(amount);
    if (parsedAmount > 0) {
      methods.forEach(method => {
        method.calculatedFees = paymentService.calculatePaymentFees(parsedAmount, method.id);
        method.totalAmount = parsedAmount + method.calculatedFees;
      });
    }
  }
  
  res.json({
    success: true,
    data: {
      country,
      methods,
      supportedCurrencies: ['FCFA', 'EUR', 'USD']
    }
  });
});

/**
 * Initier un paiement
 * POST /api/payments/initiate
 */
const initiatePayment = asyncHandler(async (req, res) => {
  const {
    orderId,
    paymentMethod,
    phoneNumber,
    amount,
    currency = 'FCFA',
    description
  } = req.body;
  
  // Validation des données
  if (!orderId || !paymentMethod || !amount) {
    throw commonErrors.badRequest('Données de paiement incomplètes');
  }
  
  // Vérifier que la commande existe et appartient à l'utilisateur
  const order = await db('orders')
    .select(['id', 'customer_id', 'total_amount', 'status', 'payment_status'])
    .where({ id: orderId })
    .first();
  
  if (!order) {
    throw commonErrors.notFound('Commande');
  }
  
  if (order.customer_id !== req.user.id) {
    throw commonErrors.forbidden('Cette commande ne vous appartient pas');
  }
  
  if (order.status === 'cancelled') {
    throw commonErrors.badRequest('Impossible de payer une commande annulée');
  }
  
  if (order.payment_status === 'paid') {
    throw commonErrors.badRequest('Cette commande est déjà payée');
  }
  
  // Vérifier que le montant correspond
  const orderAmount = parseFloat(order.total_amount);
  const paymentAmount = parseFloat(amount);
  
  if (Math.abs(orderAmount - paymentAmount) > 0.01) {
    throw commonErrors.badRequest('Le montant ne correspond pas à celui de la commande');
  }
  
  try {
    // Initier le paiement
    const paymentResult = await paymentService.initiatePayment({
      orderId,
      customerId: req.user.id,
      paymentMethod,
      phoneNumber: phoneNumber || req.user.phone,
      amount: paymentAmount,
      currency,
      description: description || `Commande ${order.order_number || orderId}`
    });
    
    res.json({
      success: true,
      message: 'Paiement initié avec succès',
      data: paymentResult
    });
    
  } catch (error) {
    console.error('Erreur initiation paiement:', error);
    throw commonErrors.badRequest(`Erreur lors de l'initiation du paiement: ${error.message}`);
  }
});

/**
 * Vérifier le statut d'un paiement
 * GET /api/payments/:id/status
 */
const getPaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Récupérer le paiement
  const payment = await db('payments')
    .select([
      'id', 'payment_reference', 'order_id', 'customer_id', 'payment_method',
      'status', 'amount', 'currency', 'provider_transaction_id', 
      'initiated_at', 'completed_at', 'failure_reason'
    ])
    .where({ id })
    .orWhere({ payment_reference: id })
    .first();
  
  if (!payment) {
    throw commonErrors.notFound('Paiement');
  }
  
  // Vérifier les permissions
  const isOwner = payment.customer_id === req.user.id;
  const isAdmin = ['admin', 'super_admin', 'manager'].includes(req.user.role);
  
  if (!isOwner && !isAdmin) {
    throw commonErrors.forbidden('Accès non autorisé à ce paiement');
  }
  
  // Si le paiement est en attente, vérifier le statut auprès du provider
  if (payment.status === 'pending' && payment.provider_transaction_id) {
    try {
      // TODO: Implémenter la vérification de statut selon le provider
      console.log(`Vérification statut paiement ${payment.provider_transaction_id}`);
    } catch (error) {
      console.error('Erreur vérification statut:', error);
    }
  }
  
  res.json({
    success: true,
    data: {
      id: payment.id,
      reference: payment.payment_reference,
      orderId: payment.order_id,
      method: payment.payment_method,
      status: payment.status,
      amount: parseFloat(payment.amount),
      currency: payment.currency,
      providerTransactionId: payment.provider_transaction_id,
      initiatedAt: payment.initiated_at,
      completedAt: payment.completed_at,
      failureReason: payment.failure_reason
    }
  });
});

/**
 * Webhook TMoney
 * POST /api/payments/webhook/tmoney
 */
const webhookTMoney = asyncHandler(async (req, res) => {
  const signature = req.headers['x-tmoney-signature'];
  const payload = req.body;
  
  try {
    await paymentService.handleWebhook('tmoney', payload, signature);
    
    res.status(200).json({
      success: true,
      message: 'Webhook traité avec succès'
    });
    
  } catch (error) {
    console.error('Erreur webhook TMoney:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Webhook Orange Money
 * POST /api/payments/webhook/orange-money
 */
const webhookOrangeMoney = asyncHandler(async (req, res) => {
  const signature = req.headers['x-orange-signature'];
  const payload = req.body;
  
  try {
    await paymentService.handleWebhook('orange_money', payload, signature);
    
    res.status(200).json({
      success: true,
      message: 'Webhook traité avec succès'
    });
    
  } catch (error) {
    console.error('Erreur webhook Orange Money:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Webhook Flooz
 * POST /api/payments/webhook/flooz
 */
const webhookFlooz = asyncHandler(async (req, res) => {
  const signature = req.headers['x-flooz-signature'];
  const payload = req.body;
  
  try {
    await paymentService.handleWebhook('flooz', payload, signature);
    
    res.status(200).json({
      success: true,
      message: 'Webhook traité avec succès'
    });
    
  } catch (error) {
    console.error('Erreur webhook Flooz:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Récupérer l'historique des paiements d'un utilisateur
 * GET /api/payments/history
 */
const getPaymentHistory = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    method,
    sortBy = 'initiated_at',
    sortOrder = 'desc'
  } = req.query;
  
  let query = db('payments')
    .select([
      'payments.id',
      'payments.payment_reference',
      'payments.order_id',
      'payments.payment_method',
      'payments.status',
      'payments.amount',
      'payments.currency',
      'payments.phone_number',
      'payments.operator',
      'payments.initiated_at',
      'payments.completed_at',
      'payments.failure_reason',
      'orders.order_number'
    ])
    .leftJoin('orders', 'payments.order_id', 'orders.id')
    .where('payments.customer_id', req.user.id);
  
  // Filtres
  if (status) {
    query = query.where('payments.status', status);
  }
  
  if (method) {
    query = query.where('payments.payment_method', method);
  }
  
  // Tri
  const validSortFields = ['initiated_at', 'completed_at', 'amount', 'status'];
  const sortField = validSortFields.includes(sortBy) ? `payments.${sortBy}` : 'payments.initiated_at';
  const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';
  
  query = query.orderBy(sortField, order);
  
  // Pagination
  const result = await db.helpers.paginate(query, page, limit);
  
  res.json({
    success: true,
    data: result.data.map(payment => ({
      id: payment.id,
      reference: payment.payment_reference,
      orderId: payment.order_id,
      orderNumber: payment.order_number,
      method: payment.payment_method,
      status: payment.status,
      amount: parseFloat(payment.amount),
      currency: payment.currency,
      phoneNumber: payment.phone_number,
      operator: payment.operator,
      initiatedAt: payment.initiated_at,
      completedAt: payment.completed_at,
      failureReason: payment.failure_reason
    })),
    pagination: result.pagination
  });
});

/**
 * Initier un remboursement (admin seulement)
 * POST /api/payments/:id/refund
 */
const initiateRefund = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, reason } = req.body;
  
  // Récupérer le paiement
  const payment = await db('payments')
    .select(['id', 'order_id', 'payment_method', 'status', 'amount', 'currency'])
    .where({ id })
    .first();
  
  if (!payment) {
    throw commonErrors.notFound('Paiement');
  }
  
  if (payment.status !== 'completed') {
    throw commonErrors.badRequest('Seuls les paiements complétés peuvent être remboursés');
  }
  
  const refundAmount = amount ? parseFloat(amount) : parseFloat(payment.amount);
  
  if (refundAmount > parseFloat(payment.amount)) {
    throw commonErrors.badRequest('Le montant du remboursement ne peut pas dépasser le montant payé');
  }
  
  try {
    // TODO: Implémenter la logique de remboursement selon le provider
    // Pour l'instant, marquer comme remboursé en base
    
    await db('payments')
      .where({ id })
      .update({
        status: amount ? 'partially_refunded' : 'refunded',
        updated_at: db.fn.now(),
        updated_by: req.user.id
      });
    
    // Mettre à jour le statut de la commande
    await db('orders')
      .where({ id: payment.order_id })
      .update({
        status: 'refunded',
        payment_status: amount ? 'partially_refunded' : 'refunded',
        admin_notes: reason || 'Remboursement initié par admin',
        updated_at: db.fn.now(),
        updated_by: req.user.id
      });
    
    res.json({
      success: true,
      message: `Remboursement de ${refundAmount} ${payment.currency} initié avec succès`,
      data: {
        refundAmount,
        currency: payment.currency,
        reason
      }
    });
    
  } catch (error) {
    console.error('Erreur remboursement:', error);
    throw commonErrors.badRequest(`Erreur lors du remboursement: ${error.message}`);
  }
});

/**
 * Statistiques des paiements (admin)
 * GET /api/payments/stats
 */
const getPaymentStats = asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  
  // Calculer la période
  let dateFilter = db.raw('1=1');
  if (period === '7d') {
    dateFilter = db.raw("initiated_at >= NOW() - INTERVAL '7 days'");
  } else if (period === '30d') {
    dateFilter = db.raw("initiated_at >= NOW() - INTERVAL '30 days'");
  } else if (period === '90d') {
    dateFilter = db.raw("initiated_at >= NOW() - INTERVAL '90 days'");
  }
  
  // Statistiques générales
  const generalStats = await db('payments')
    .where(dateFilter)
    .select([
      db.raw('COUNT(*) as total_transactions'),
      db.raw('SUM(amount) as total_volume'),
      db.raw('AVG(amount) as average_amount'),
      db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as successful_payments'),
      db.raw('COUNT(CASE WHEN status = \'failed\' THEN 1 END) as failed_payments'),
      db.raw('SUM(CASE WHEN status = \'completed\' THEN amount ELSE 0 END) as successful_volume')
    ])
    .first();
  
  // Répartition par méthode de paiement
  const methodStats = await db('payments')
    .where(dateFilter)
    .select('payment_method')
    .count('* as count')
    .sum('amount as volume')
    .groupBy('payment_method')
    .orderBy('count', 'desc');
  
  // Répartition par statut
  const statusStats = await db('payments')
    .where(dateFilter)
    .select('status')
    .count('* as count')
    .groupBy('status');
  
  // Évolution quotidienne (derniers 30 jours)
  const dailyStats = await db('payments')
    .where('initiated_at', '>=', db.raw("NOW() - INTERVAL '30 days'"))
    .select([
      db.raw('DATE(initiated_at) as date'),
      db.raw('COUNT(*) as transactions'),
      db.raw('SUM(CASE WHEN status = \'completed\' THEN amount ELSE 0 END) as volume')
    ])
    .groupBy(db.raw('DATE(initiated_at)'))
    .orderBy('date', 'desc')
    .limit(30);
  
  res.json({
    success: true,
    data: {
      period,
      summary: {
        totalTransactions: parseInt(generalStats.total_transactions) || 0,
        totalVolume: parseFloat(generalStats.total_volume) || 0,
        averageAmount: parseFloat(generalStats.average_amount) || 0,
        successfulPayments: parseInt(generalStats.successful_payments) || 0,
        failedPayments: parseInt(generalStats.failed_payments) || 0,
        successfulVolume: parseFloat(generalStats.successful_volume) || 0,
        successRate: generalStats.total_transactions > 0 
          ? ((generalStats.successful_payments / generalStats.total_transactions) * 100).toFixed(2)
          : 0
      },
      byMethod: methodStats.map(stat => ({
        method: stat.payment_method,
        count: parseInt(stat.count),
        volume: parseFloat(stat.volume)
      })),
      byStatus: statusStats.map(stat => ({
        status: stat.status,
        count: parseInt(stat.count)
      })),
      dailyEvolution: dailyStats.map(day => ({
        date: day.date,
        transactions: parseInt(day.transactions),
        volume: parseFloat(day.volume)
      })).reverse()
    }
  });
});

module.exports = {
  getPaymentMethods,
  initiatePayment,
  getPaymentStatus,
  webhookTMoney,
  webhookOrangeMoney,
  webhookFlooz,
  getPaymentHistory,
  initiateRefund,
  getPaymentStats
};