const axios = require('axios');
const crypto = require('crypto');
const db = require('../config/database');
require('dotenv').config();

/**
 * Configuration des providers de paiement
 */
const PAYMENT_PROVIDERS = {
  TMONEY: {
    name: 'TMoney',
    baseUrl: process.env.TMONEY_API_URL,
    merchantId: process.env.TMONEY_MERCHANT_ID,
    apiKey: process.env.TMONEY_API_KEY,
    secretKey: process.env.TMONEY_SECRET_KEY,
    currency: 'FCFA',
    country: 'TG'
  },
  
  FLOOZ: {
    name: 'Flooz',
    baseUrl: process.env.FLOOZ_API_URL,
    merchantId: process.env.FLOOZ_MERCHANT_ID,
    apiKey: process.env.FLOOZ_API_KEY,
    secretKey: process.env.FLOOZ_SECRET_KEY,
    currency: 'FCFA',
    country: 'TG'
  },
  
  ORANGE_MONEY: {
    name: 'Orange Money',
    baseUrl: process.env.ORANGE_MONEY_API_URL,
    clientId: process.env.ORANGE_MONEY_CLIENT_ID,
    clientSecret: process.env.ORANGE_MONEY_CLIENT_SECRET,
    currency: 'FCFA',
    countries: ['TG', 'SN', 'ML', 'BF', 'CI', 'CM', 'MG']
  },
  
  MTN_MONEY: {
    name: 'MTN Mobile Money',
    baseUrl: process.env.MTN_MONEY_API_URL,
    userId: process.env.MTN_MONEY_USER_ID,
    apiKey: process.env.MTN_MONEY_API_KEY,
    currency: 'FCFA',
    countries: ['GH', 'UG', 'RW', 'ZM', 'CI', 'CM', 'BJ']
  }
};

/**
 * Utilitaires de cryptographie et sécurité
 */
const cryptoUtils = {
  /**
   * Générer une signature HMAC
   */
  generateSignature: (data, secretKey, algorithm = 'sha256') => {
    return crypto
      .createHmac(algorithm, secretKey)
      .update(data)
      .digest('hex');
  },

  /**
   * Générer un ID de transaction unique
   */
  generateTransactionId: (prefix = 'AFM') => {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  },

  /**
   * Valider la signature d'un webhook
   */
  validateWebhookSignature: (payload, signature, secretKey) => {
    const expectedSignature = cryptoUtils.generateSignature(payload, secretKey);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
};

/**
 * Service TMoney (Togo)
 */
const tmoneyService = {
  /**
   * Initier un paiement TMoney
   */
  initiatePayment: async (paymentData) => {
    const { amount, phoneNumber, description, orderId, customerId } = paymentData;
    
    try {
      const transactionId = cryptoUtils.generateTransactionId('TMO');
      const timestamp = Date.now().toString();
      
      // Préparer les données de la requête
      const requestData = {
        merchant_id: PAYMENT_PROVIDERS.TMONEY.merchantId,
        amount: parseInt(amount),
        phone_number: phoneNumber,
        description: description,
        transaction_id: transactionId,
        callback_url: `${process.env.BASE_URL}/api/payments/webhook/tmoney`,
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
        timestamp: timestamp
      };
      
      // Générer la signature
      const signatureString = `${requestData.merchant_id}${requestData.amount}${requestData.phone_number}${requestData.transaction_id}${timestamp}`;
      const signature = cryptoUtils.generateSignature(signatureString, PAYMENT_PROVIDERS.TMONEY.secretKey);
      
      // Faire la requête à l'API TMoney
      const response = await axios.post(`${PAYMENT_PROVIDERS.TMONEY.baseUrl}/payment/request`, {
        ...requestData,
        signature: signature
      }, {
        headers: {
          'Authorization': `Bearer ${PAYMENT_PROVIDERS.TMONEY.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Enregistrer le paiement en base
      await db('payments').insert({
        payment_reference: transactionId,
        order_id: orderId,
        customer_id: customerId,
        payment_method: 'tmoney',
        status: 'pending',
        amount: amount,
        currency: 'FCFA',
        phone_number: phoneNumber,
        operator: 'tmoney',
        provider_transaction_id: response.data.transaction_id,
        provider_response: JSON.stringify(response.data),
        initiated_at: db.fn.now()
      });
      
      return {
        success: true,
        transactionId,
        providerTransactionId: response.data.transaction_id,
        paymentUrl: response.data.payment_url,
        message: response.data.message
      };
      
    } catch (error) {
      console.error('Erreur initiation paiement TMoney:', error);
      throw new Error(`Erreur TMoney: ${error.response?.data?.message || error.message}`);
    }
  },

  /**
   * Vérifier le statut d'un paiement TMoney
   */
  checkPaymentStatus: async (transactionId) => {
    try {
      const response = await axios.get(
        `${PAYMENT_PROVIDERS.TMONEY.baseUrl}/payment/status/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${PAYMENT_PROVIDERS.TMONEY.apiKey}`
          }
        }
      );
      
      return {
        status: response.data.status,
        message: response.data.message,
        data: response.data
      };
      
    } catch (error) {
      console.error('Erreur vérification statut TMoney:', error);
      throw new Error(`Erreur vérification TMoney: ${error.message}`);
    }
  }
};

/**
 * Service Orange Money
 */
const orangeMoneyService = {
  /**
   * Obtenir un token d'accès
   */
  getAccessToken: async () => {
    try {
      const credentials = Buffer.from(
        `${PAYMENT_PROVIDERS.ORANGE_MONEY.clientId}:${PAYMENT_PROVIDERS.ORANGE_MONEY.clientSecret}`
      ).toString('base64');
      
      const response = await axios.post(
        `${PAYMENT_PROVIDERS.ORANGE_MONEY.baseUrl}/oauth/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return response.data.access_token;
      
    } catch (error) {
      console.error('Erreur récupération token Orange Money:', error);
      throw new Error('Impossible d\'obtenir le token Orange Money');
    }
  },

  /**
   * Initier un paiement Orange Money
   */
  initiatePayment: async (paymentData) => {
    const { amount, phoneNumber, description, orderId, customerId } = paymentData;
    
    try {
      const accessToken = await orangeMoneyService.getAccessToken();
      const transactionId = cryptoUtils.generateTransactionId('ORA');
      
      const requestData = {
        merchant: {
          id: PAYMENT_PROVIDERS.ORANGE_MONEY.clientId
        },
        customer: {
          phone: phoneNumber
        },
        transaction: {
          amount: parseInt(amount),
          currency: 'XOF', // Franc CFA
          id: transactionId,
          reference: orderId
        },
        callback_url: `${process.env.BASE_URL}/api/payments/webhook/orange-money`,
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
        description: description
      };
      
      const response = await axios.post(
        `${PAYMENT_PROVIDERS.ORANGE_MONEY.baseUrl}/payment/request`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Enregistrer le paiement
      await db('payments').insert({
        payment_reference: transactionId,
        order_id: orderId,
        customer_id: customerId,
        payment_method: 'orange_money',
        status: 'pending',
        amount: amount,
        currency: 'FCFA',
        phone_number: phoneNumber,
        operator: 'orange',
        provider_transaction_id: response.data.txn_id,
        provider_response: JSON.stringify(response.data),
        initiated_at: db.fn.now()
      });
      
      return {
        success: true,
        transactionId,
        providerTransactionId: response.data.txn_id,
        paymentUrl: response.data.payment_url,
        message: 'Paiement initié avec succès'
      };
      
    } catch (error) {
      console.error('Erreur initiation paiement Orange Money:', error);
      throw new Error(`Erreur Orange Money: ${error.response?.data?.message || error.message}`);
    }
  }
};

/**
 * Service principal de paiement
 */
const paymentService = {
  /**
   * Initier un paiement selon la méthode choisie
   */
  initiatePayment: async (paymentData) => {
    const { paymentMethod, amount, phoneNumber, orderId, customerId } = paymentData;
    
    // Valider les données
    if (!paymentMethod || !amount || !orderId || !customerId) {
      throw new Error('Données de paiement incomplètes');
    }

    if (paymentMethod !== 'cash_on_delivery' && !phoneNumber) {
      throw new Error('Numéro de téléphone requis pour le paiement mobile');
    }

    // Valider le format du numéro de téléphone
    if (phoneNumber && !/^\+?[0-9]{8,15}$/.test(phoneNumber.replace(/\s/g, ''))) {
      throw new Error('Format de numéro de téléphone invalide');
    }

    try {
      let result;
      
      switch (paymentMethod) {
        case 'tmoney':
          result = await tmoneyService.initiatePayment(paymentData);
          break;
          
        case 'orange_money':
          result = await orangeMoneyService.initiatePayment(paymentData);
          break;
          
        case 'flooz':
          // À implémenter selon l'API Flooz
          throw new Error('Service Flooz en cours de développement');
          
        case 'mtn_money':
          // À implémenter selon l'API MTN
          throw new Error('Service MTN Money en cours de développement');
          
        case 'cash_on_delivery':
          result = await paymentService.processCashOnDelivery(paymentData);
          break;
          
        default:
          throw new Error(`Méthode de paiement non supportée: ${paymentMethod}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('Erreur initiation paiement:', error);
      
      // Enregistrer l'échec en base
      await db('payments').insert({
        payment_reference: cryptoUtils.generateTransactionId('FAIL'),
        order_id: orderId,
        customer_id: customerId,
        payment_method: paymentMethod,
        status: 'failed',
        amount: amount,
        currency: 'FCFA',
        phone_number: phoneNumber,
        failure_reason: error.message,
        initiated_at: db.fn.now()
      });
      
      throw error;
    }
  },

  /**
   * Traiter un paiement à la livraison
   */
  processCashOnDelivery: async (paymentData) => {
    const { amount, orderId, customerId, description } = paymentData;
    
    try {
      const transactionId = cryptoUtils.generateTransactionId('COD');
      
      await db('payments').insert({
        payment_reference: transactionId,
        order_id: orderId,
        customer_id: customerId,
        payment_method: 'cash_on_delivery',
        status: 'pending',
        amount: amount,
        currency: 'FCFA',
        net_amount: amount,
        initiated_at: db.fn.now()
      });
      
      return {
        success: true,
        transactionId,
        message: 'Paiement à la livraison enregistré'
      };
      
    } catch (error) {
      console.error('Erreur paiement à la livraison:', error);
      throw new Error('Erreur lors de l\'enregistrement du paiement à la livraison');
    }
  },

  /**
   * Traiter les webhooks de paiement
   */
  handleWebhook: async (provider, payload, signature) => {
    try {
      // Valider la signature
      const secretKey = PAYMENT_PROVIDERS[provider.toUpperCase()]?.secretKey;
      if (secretKey && !cryptoUtils.validateWebhookSignature(JSON.stringify(payload), signature, secretKey)) {
        throw new Error('Signature webhook invalide');
      }
      
      const { transaction_id, status, amount } = payload;
      
      // Mettre à jour le paiement
      const payment = await db('payments')
        .where({ provider_transaction_id: transaction_id })
        .first();
      
      if (!payment) {
        throw new Error(`Paiement introuvable: ${transaction_id}`);
      }
      
      const updateData = {
        status: status === 'SUCCESS' ? 'completed' : 'failed',
        provider_status: status,
        webhook_data: JSON.stringify(payload),
        webhook_received_at: db.fn.now(),
        webhook_verified: true
      };
      
      if (status === 'SUCCESS') {
        updateData.completed_at = db.fn.now();
        updateData.processed_at = db.fn.now();
      }
      
      await db('payments')
        .where({ id: payment.id })
        .update(updateData);
      
      // Mettre à jour le statut de la commande
      if (status === 'SUCCESS') {
        await db('orders')
          .where({ id: payment.order_id })
          .update({
            status: 'paid',
            payment_status: 'paid',
            payment_date: db.fn.now()
          });
      }
      
      return {
        success: true,
        message: 'Webhook traité avec succès'
      };
      
    } catch (error) {
      console.error('Erreur traitement webhook:', error);
      throw error;
    }
  },

  /**
   * Obtenir les méthodes de paiement disponibles
   */
  getAvailablePaymentMethods: (country = 'TG') => {
    const methods = [
      {
        id: 'cash_on_delivery',
        name: 'Paiement à la livraison',
        icon: 'cash',
        available: true,
        fees: 0,
        description: 'Payez en espèces lors de la réception'
      }
    ];
    
    // TMoney et Flooz (Togo)
    if (country === 'TG') {
      methods.push({
        id: 'tmoney',
        name: 'TMoney',
        icon: 'tmoney',
        available: !!PAYMENT_PROVIDERS.TMONEY.apiKey,
        fees: 1.5,
        description: 'Paiement via TMoney Togo'
      });
      
      methods.push({
        id: 'flooz',
        name: 'Flooz',
        icon: 'flooz',
        available: !!PAYMENT_PROVIDERS.FLOOZ.apiKey,
        fees: 1.5,
        description: 'Paiement via Flooz'
      });
    }
    
    // Orange Money (multi-pays)
    if (PAYMENT_PROVIDERS.ORANGE_MONEY.countries.includes(country)) {
      methods.push({
        id: 'orange_money',
        name: 'Orange Money',
        icon: 'orange-money',
        available: !!PAYMENT_PROVIDERS.ORANGE_MONEY.clientId,
        fees: 2.0,
        description: 'Paiement via Orange Money'
      });
    }
    
    // MTN Money
    if (PAYMENT_PROVIDERS.MTN_MONEY.countries.includes(country)) {
      methods.push({
        id: 'mtn_money',
        name: 'MTN Mobile Money',
        icon: 'mtn-money',
        available: !!PAYMENT_PROVIDERS.MTN_MONEY.apiKey,
        fees: 2.0,
        description: 'Paiement via MTN Mobile Money'
      });
    }
    
    return methods.filter(method => method.available);
  },

  /**
   * Calculer les frais de paiement
   */
  calculatePaymentFees: (amount, paymentMethod) => {
    const method = paymentService.getAvailablePaymentMethods().find(m => m.id === paymentMethod);
    
    if (!method) {
      return 0;
    }
    
    if (paymentMethod === 'cash_on_delivery') {
      return 0;
    }
    
    // Frais en pourcentage
    const feeRate = method.fees / 100;
    const fees = Math.round(amount * feeRate);
    
    // Frais minimum et maximum
    const minFee = 100; // 100 FCFA minimum
    const maxFee = 2000; // 2000 FCFA maximum
    
    return Math.max(minFee, Math.min(fees, maxFee));
  }
};

module.exports = {
  paymentService,
  cryptoUtils,
  PAYMENT_PROVIDERS
};