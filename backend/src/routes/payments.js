const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { cacheMiddleware } = require('../config/redis');

/**
 * @route GET /api/payments/methods
 * @desc Récupérer les méthodes de paiement disponibles
 * @access Public
 */
router.get('/methods',
  cacheMiddleware(3600, (req) => `payment_methods:${req.query.country || 'TG'}`),
  paymentController.getPaymentMethods
);

/**
 * @route POST /api/payments/initiate
 * @desc Initier un paiement
 * @access Private
 */
router.post('/initiate',
  requireAuth,
  paymentController.initiatePayment
);

/**
 * @route GET /api/payments/history
 * @desc Récupérer l'historique des paiements de l'utilisateur
 * @access Private
 */
router.get('/history',
  requireAuth,
  paymentController.getPaymentHistory
);

/**
 * @route GET /api/payments/:id/status
 * @desc Vérifier le statut d'un paiement
 * @access Private
 */
router.get('/:id/status',
  requireAuth,
  paymentController.getPaymentStatus
);

/**
 * @route POST /api/payments/:id/refund
 * @desc Initier un remboursement
 * @access Private (Admin)
 */
router.post('/:id/refund',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  paymentController.initiateRefund
);

/**
 * @route GET /api/payments/stats
 * @desc Statistiques des paiements
 * @access Private (Admin)
 */
router.get('/stats',
  requireAuth,
  requireRole(['admin', 'super_admin', 'manager']),
  cacheMiddleware(1800, (req) => `payment_stats:${req.query.period || '30d'}`),
  paymentController.getPaymentStats
);

// ==========================================
// WEBHOOKS - Routes publiques sans auth
// ==========================================

/**
 * @route POST /api/payments/webhook/tmoney
 * @desc Webhook TMoney
 * @access Public (Webhook)
 */
router.post('/webhook/tmoney', paymentController.webhookTMoney);

/**
 * @route POST /api/payments/webhook/orange-money
 * @desc Webhook Orange Money
 * @access Public (Webhook)
 */
router.post('/webhook/orange-money', paymentController.webhookOrangeMoney);

/**
 * @route POST /api/payments/webhook/flooz
 * @desc Webhook Flooz
 * @access Public (Webhook)
 */
router.post('/webhook/flooz', paymentController.webhookFlooz);

/**
 * @route POST /api/payments/webhook/mtn-money
 * @desc Webhook MTN Mobile Money
 * @access Public (Webhook)
 */
router.post('/webhook/mtn-money', async (req, res) => {
  // TODO: Implémenter le webhook MTN Money
  try {
    console.log('Webhook MTN Money reçu:', req.body);
    
    res.status(200).json({
      success: true,
      message: 'Webhook MTN Money reçu (en développement)'
    });
  } catch (error) {
    console.error('Erreur webhook MTN Money:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur traitement webhook'
    });
  }
});

/**
 * @route GET /api/payments/test/methods
 * @desc Test des méthodes de paiement en mode développement
 * @access Private (Admin - Dev only)
 */
router.get('/test/methods',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(404).json({
        success: false,
        error: 'Route disponible uniquement en développement'
      });
    }

    const testMethods = [
      {
        id: 'test_success',
        name: 'Test Success',
        icon: 'test',
        available: true,
        fees: 0,
        description: 'Simulation de paiement réussi'
      },
      {
        id: 'test_failure',
        name: 'Test Failure',
        icon: 'test',
        available: true,
        fees: 0,
        description: 'Simulation d\'échec de paiement'
      },
      {
        id: 'test_pending',
        name: 'Test Pending',
        icon: 'test',
        available: true,
        fees: 0,
        description: 'Simulation de paiement en attente'
      }
    ];

    res.json({
      success: true,
      data: {
        country: 'TEST',
        methods: testMethods,
        note: 'Méthodes de test disponibles uniquement en développement'
      }
    });
  }
);

/**
 * @route POST /api/payments/test/simulate
 * @desc Simuler un paiement en mode développement
 * @access Private (Admin - Dev only)
 */
router.post('/test/simulate',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(404).json({
        success: false,
        error: 'Route disponible uniquement en développement'
      });
    }

    const { paymentId, status = 'completed' } = req.body;
    const db = require('../config/database');
    const { commonErrors } = require('../middleware/errorHandler');

    try {
      if (!paymentId) {
        throw commonErrors.badRequest('ID de paiement requis');
      }

      const payment = await db('payments')
        .where({ id: paymentId })
        .orWhere({ payment_reference: paymentId })
        .first();

      if (!payment) {
        throw commonErrors.notFound('Paiement');
      }

      // Simuler la mise à jour du statut
      const updateData = {
        status,
        updated_at: db.fn.now()
      };

      if (status === 'completed') {
        updateData.completed_at = db.fn.now();
        updateData.processed_at = db.fn.now();
      } else if (status === 'failed') {
        updateData.failure_reason = 'Échec simulé pour test';
      }

      await db('payments')
        .where({ id: payment.id })
        .update(updateData);

      // Mettre à jour la commande si succès
      if (status === 'completed') {
        await db('orders')
          .where({ id: payment.order_id })
          .update({
            status: 'paid',
            payment_status: 'paid',
            payment_date: db.fn.now()
          });
      }

      res.json({
        success: true,
        message: `Paiement simulé avec statut: ${status}`,
        data: {
          paymentId: payment.id,
          reference: payment.payment_reference,
          status,
          simulatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Erreur simulation paiement:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/payments/reconciliation
 * @desc Rapport de réconciliation des paiements
 * @access Private (Admin)
 */
router.get('/reconciliation',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res) => {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    const db = require('../config/database');

    try {
      // Paiements du jour
      const paymentsToday = await db('payments')
        .select([
          'payment_method',
          'status',
          db.raw('COUNT(*) as count'),
          db.raw('SUM(amount) as total_amount'),
          db.raw('SUM(fee_amount) as total_fees')
        ])
        .whereRaw('DATE(initiated_at) = ?', [date])
        .groupBy(['payment_method', 'status'])
        .orderBy(['payment_method', 'status']);

      // Commandes payées du jour
      const ordersToday = await db('orders')
        .select([
          'payment_method',
          db.raw('COUNT(*) as count'),
          db.raw('SUM(total_amount) as total_amount')
        ])
        .where('payment_status', 'paid')
        .whereRaw('DATE(payment_date) = ?', [date])
        .groupBy('payment_method')
        .orderBy('payment_method');

      // Réconciliation par méthode
      const reconciliation = {};
      
      paymentsToday.forEach(payment => {
        if (!reconciliation[payment.payment_method]) {
          reconciliation[payment.payment_method] = {
            method: payment.payment_method,
            payments: {},
            orders: { count: 0, amount: 0 }
          };
        }
        
        reconciliation[payment.payment_method].payments[payment.status] = {
          count: parseInt(payment.count),
          amount: parseFloat(payment.total_amount),
          fees: parseFloat(payment.total_fees) || 0
        };
      });

      ordersToday.forEach(order => {
        if (reconciliation[order.payment_method]) {
          reconciliation[order.payment_method].orders = {
            count: parseInt(order.count),
            amount: parseFloat(order.total_amount)
          };
        }
      });

      res.json({
        success: true,
        data: {
          date,
          reconciliation: Object.values(reconciliation),
          summary: {
            totalPayments: paymentsToday.reduce((acc, p) => acc + parseInt(p.count), 0),
            totalVolume: paymentsToday.reduce((acc, p) => acc + parseFloat(p.total_amount), 0),
            totalFees: paymentsToday.reduce((acc, p) => acc + (parseFloat(p.total_fees) || 0), 0),
            totalOrders: ordersToday.reduce((acc, o) => acc + parseInt(o.count), 0)
          }
        }
      });

    } catch (error) {
      console.error('Erreur réconciliation:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la génération du rapport de réconciliation'
      });
    }
  }
);

module.exports = router;