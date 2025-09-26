const db = require('../config/database');

/**
 * Modèle Order - Gestion des commandes avec workflow complet
 */
class Order {
  /**
   * Créer une nouvelle commande
   */
  static async create(orderData) {
    const {
      user_id,
      items = [], // Array d'objets {product_id, quantity, price}
      shipping_address = {},
      billing_address = {},
      shipping_method = 'standard',
      payment_method = 'mobile_money',
      notes = '',
      coupon_code = null,
      currency = 'FCFA'
    } = orderData;

    // Valider les produits et calculer les totaux
    let subtotal = 0;
    let total_weight = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = await db('products')
        .where({ id: item.product_id })
        .where('status', 'active')
        .whereNull('deleted_at')
        .first();

      if (!product) {
        throw new Error(`Produit non trouvé: ${item.product_id}`);
      }

      if (product.inventory_tracking && product.stock_quantity < item.quantity) {
        throw new Error(`Stock insuffisant pour le produit: ${product.name}`);
      }

      const itemSubtotal = item.price * item.quantity;
      subtotal += itemSubtotal;
      total_weight += (product.weight || 0) * item.quantity;

      validatedItems.push({
        product_id: item.product_id,
        product_name: product.name,
        product_sku: product.sku,
        quantity: item.quantity,
        price: item.price,
        subtotal: itemSubtotal,
        store_id: product.store_id
      });
    }

    // Calculer les frais et taxes
    const shipping_fee = await this.calculateShippingFee(shipping_address, total_weight, shipping_method);
    const tax_amount = this.calculateTax(subtotal);
    const total_amount = subtotal + shipping_fee + tax_amount;

    // Générer un numéro de commande unique
    const order_number = await this.generateOrderNumber();

    // Créer la commande dans une transaction
    return await db.transaction(async (trx) => {
      // Créer la commande
      const [order] = await trx('orders')
        .insert({
          order_number,
          user_id,
          status: 'pending',
          payment_status: 'pending',
          subtotal,
          tax_amount,
          shipping_fee,
          total_amount,
          currency,
          shipping_address: JSON.stringify(shipping_address),
          billing_address: JSON.stringify(billing_address),
          shipping_method,
          payment_method,
          notes,
          coupon_code,
          total_items: items.reduce((sum, item) => sum + item.quantity, 0),
          total_weight
        })
        .returning('*');

      // Créer les articles de commande
      for (const item of validatedItems) {
        await trx('order_items').insert({
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          store_id: item.store_id,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal
        });

        // Décrémenter le stock si nécessaire
        const product = await trx('products').where({ id: item.product_id }).first();
        if (product.inventory_tracking) {
          await trx('products')
            .where({ id: item.product_id })
            .update({
              stock_quantity: product.stock_quantity - item.quantity,
              total_sales: (product.total_sales || 0) + item.quantity,
              updated_at: trx.fn.now()
            });
        }
      }

      return this.formatOrder(order);
    });
  }

  /**
   * Trouver une commande par ID
   */
  static async findById(id, userId = null) {
    let query = db('orders')
      .select('orders.*', 'users.first_name', 'users.last_name', 'users.email')
      .leftJoin('users', 'orders.user_id', 'users.id')
      .where('orders.id', id)
      .whereNull('orders.deleted_at');

    if (userId) {
      query = query.where('orders.user_id', userId);
    }

    const order = await query.first();
    
    if (!order) return null;

    // Récupérer les articles de commande
    const items = await db('order_items')
      .select('*')
      .where({ order_id: id });

    return this.formatOrder({ ...order, items });
  }

  /**
   * Trouver une commande par numéro
   */
  static async findByOrderNumber(orderNumber, userId = null) {
    let query = db('orders')
      .select('orders.*', 'users.first_name', 'users.last_name', 'users.email')
      .leftJoin('users', 'orders.user_id', 'users.id')
      .where('orders.order_number', orderNumber)
      .whereNull('orders.deleted_at');

    if (userId) {
      query = query.where('orders.user_id', userId);
    }

    const order = await query.first();
    
    if (!order) return null;

    const items = await db('order_items')
      .select('*')
      .where({ order_id: order.id });

    return this.formatOrder({ ...order, items });
  }

  /**
   * Obtenir toutes les commandes avec filtres
   */
  static async getAll(options = {}) {
    const {
      page = 1,
      limit = 20,
      user_id = null,
      store_id = null,
      status = null,
      payment_status = null,
      date_from = null,
      date_to = null,
      search = null,
      sort = 'created_at',
      order = 'desc'
    } = options;

    let query = db('orders')
      .select('orders.*', 'users.first_name', 'users.last_name', 'users.email')
      .leftJoin('users', 'orders.user_id', 'users.id')
      .whereNull('orders.deleted_at');

    // Filtres
    if (user_id) query = query.where('orders.user_id', user_id);
    if (status) query = query.where('orders.status', status);
    if (payment_status) query = query.where('orders.payment_status', payment_status);
    if (date_from) query = query.where('orders.created_at', '>=', date_from);
    if (date_to) query = query.where('orders.created_at', '<=', date_to);
    
    if (store_id) {
      query = query.whereExists(function() {
        this.select('*')
          .from('order_items')
          .whereRaw('order_items.order_id = orders.id')
          .where('order_items.store_id', store_id);
      });
    }
    
    if (search) {
      query = query.where(function() {
        this.where('orders.order_number', 'ilike', `%${search}%`)
          .orWhere('users.first_name', 'ilike', `%${search}%`)
          .orWhere('users.last_name', 'ilike', `%${search}%`)
          .orWhere('users.email', 'ilike', `%${search}%`);
      });
    }

    // Tri
    const validSorts = ['created_at', 'order_number', 'total_amount', 'status'];
    const sortField = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = ['asc', 'desc'].includes(order) ? order : 'desc';
    
    query = query.orderBy(`orders.${sortField}`, sortOrder);

    // Pagination
    const offset = (page - 1) * limit;
    const orders = await query.limit(limit).offset(offset);

    // Compter le total
    const totalQuery = db('orders')
      .leftJoin('users', 'orders.user_id', 'users.id')
      .whereNull('orders.deleted_at');

    // Appliquer les mêmes filtres
    if (user_id) totalQuery.where('orders.user_id', user_id);
    if (status) totalQuery.where('orders.status', status);
    if (payment_status) totalQuery.where('orders.payment_status', payment_status);
    if (date_from) totalQuery.where('orders.created_at', '>=', date_from);
    if (date_to) totalQuery.where('orders.created_at', '<=', date_to);
    if (store_id) {
      totalQuery.whereExists(function() {
        this.select('*')
          .from('order_items')
          .whereRaw('order_items.order_id = orders.id')
          .where('order_items.store_id', store_id);
      });
    }
    if (search) {
      totalQuery.where(function() {
        this.where('orders.order_number', 'ilike', `%${search}%`)
          .orWhere('users.first_name', 'ilike', `%${search}%`)
          .orWhere('users.last_name', 'ilike', `%${search}%`)
          .orWhere('users.email', 'ilike', `%${search}%`);
      });
    }
    
    const [{ count }] = await totalQuery.count('orders.id as count');
    const total = parseInt(count);

    return {
      orders: orders.map(order => this.formatOrder(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Mettre à jour le statut d'une commande
   */
  static async updateStatus(id, status, notes = null) {
    const validStatuses = [
      'pending', 'confirmed', 'processing', 'shipped', 
      'out_for_delivery', 'delivered', 'cancelled', 'refunded'
    ];

    if (!validStatuses.includes(status)) {
      throw new Error(`Statut invalide: ${status}`);
    }

    const updateData = {
      status,
      updated_at: db.fn.now()
    };

    // Ajouter des timestamps pour certains statuts
    switch (status) {
      case 'confirmed':
        updateData.confirmed_at = db.fn.now();
        break;
      case 'shipped':
        updateData.shipped_at = db.fn.now();
        break;
      case 'delivered':
        updateData.delivered_at = db.fn.now();
        break;
      case 'cancelled':
        updateData.cancelled_at = db.fn.now();
        break;
    }

    if (notes) {
      updateData.status_notes = notes;
    }

    const [order] = await db('orders')
      .where({ id })
      .whereNull('deleted_at')
      .update(updateData)
      .returning('*');

    // Si la commande est annulée, restaurer le stock
    if (status === 'cancelled') {
      await this.restoreStock(id);
    }

    return order ? this.formatOrder(order) : null;
  }

  /**
   * Mettre à jour le statut de paiement
   */
  static async updatePaymentStatus(id, paymentStatus, transactionId = null) {
    const validStatuses = ['pending', 'processing', 'paid', 'failed', 'refunded'];

    if (!validStatuses.includes(paymentStatus)) {
      throw new Error(`Statut de paiement invalide: ${paymentStatus}`);
    }

    const updateData = {
      payment_status: paymentStatus,
      updated_at: db.fn.now()
    };

    if (transactionId) {
      updateData.transaction_id = transactionId;
    }

    if (paymentStatus === 'paid') {
      updateData.paid_at = db.fn.now();
      // Auto-confirmer la commande si le paiement est validé
      if ((await this.findById(id)).status === 'pending') {
        updateData.status = 'confirmed';
        updateData.confirmed_at = db.fn.now();
      }
    }

    const [order] = await db('orders')
      .where({ id })
      .whereNull('deleted_at')
      .update(updateData)
      .returning('*');

    return order ? this.formatOrder(order) : null;
  }

  /**
   * Ajouter un numéro de suivi
   */
  static async addTracking(id, trackingNumber, carrier = null, trackingUrl = null) {
    const [order] = await db('orders')
      .where({ id })
      .update({
        tracking_number: trackingNumber,
        tracking_carrier: carrier,
        tracking_url: trackingUrl,
        status: 'shipped',
        shipped_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');

    return order ? this.formatOrder(order) : null;
  }

  /**
   * Calculer les frais de livraison
   */
  static async calculateShippingFee(address, weight = 0, method = 'standard') {
    // Logique simplifiée - à adapter selon vos besoins
    const baseRate = 2000; // 2000 FCFA de base
    const weightRate = weight * 100; // 100 FCFA par kg
    
    let methodMultiplier = 1;
    switch (method) {
      case 'express':
        methodMultiplier = 2;
        break;
      case 'overnight':
        methodMultiplier = 3;
        break;
      default:
        methodMultiplier = 1;
    }

    return (baseRate + weightRate) * methodMultiplier;
  }

  /**
   * Calculer les taxes
   */
  static calculateTax(subtotal) {
    // TVA de 18% au Togo (exemple)
    const taxRate = 0.18;
    return subtotal * taxRate;
  }

  /**
   * Générer un numéro de commande unique
   */
  static async generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const prefix = `AFM${year}${month}${day}`;
    
    // Trouver le dernier numéro du jour
    const lastOrder = await db('orders')
      .where('order_number', 'like', `${prefix}%`)
      .orderBy('order_number', 'desc')
      .first();

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.order_number.slice(-4));
      sequence = lastSequence + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Restaurer le stock après annulation
   */
  static async restoreStock(orderId) {
    const items = await db('order_items')
      .where({ order_id: orderId });

    for (const item of items) {
      const product = await db('products')
        .where({ id: item.product_id })
        .first();

      if (product && product.inventory_tracking) {
        await db('products')
          .where({ id: item.product_id })
          .update({
            stock_quantity: product.stock_quantity + item.quantity,
            total_sales: Math.max(0, (product.total_sales || 0) - item.quantity),
            updated_at: db.fn.now()
          });
      }
    }
  }

  /**
   * Obtenir les statistiques des commandes
   */
  static async getStats(options = {}) {
    const { store_id = null, date_from = null, date_to = null } = options;

    let query = db('orders').whereNull('deleted_at');
    
    if (store_id) {
      query = query.whereExists(function() {
        this.select('*')
          .from('order_items')
          .whereRaw('order_items.order_id = orders.id')
          .where('order_items.store_id', store_id);
      });
    }
    
    if (date_from) query = query.where('created_at', '>=', date_from);
    if (date_to) query = query.where('created_at', '<=', date_to);

    const [stats] = await query
      .select(
        db.raw('COUNT(*) as total_orders'),
        db.raw('COUNT(*) FILTER (WHERE status = \'pending\') as pending'),
        db.raw('COUNT(*) FILTER (WHERE status = \'confirmed\') as confirmed'),
        db.raw('COUNT(*) FILTER (WHERE status = \'shipped\') as shipped'),
        db.raw('COUNT(*) FILTER (WHERE status = \'delivered\') as delivered'),
        db.raw('COUNT(*) FILTER (WHERE status = \'cancelled\') as cancelled'),
        db.raw('COUNT(*) FILTER (WHERE payment_status = \'paid\') as paid'),
        db.raw('SUM(total_amount) as total_revenue'),
        db.raw('AVG(total_amount) as average_order_value')
      );

    return {
      total_orders: parseInt(stats.total_orders) || 0,
      pending: parseInt(stats.pending) || 0,
      confirmed: parseInt(stats.confirmed) || 0,
      shipped: parseInt(stats.shipped) || 0,
      delivered: parseInt(stats.delivered) || 0,
      cancelled: parseInt(stats.cancelled) || 0,
      paid: parseInt(stats.paid) || 0,
      total_revenue: parseFloat(stats.total_revenue) || 0,
      average_order_value: parseFloat(stats.average_order_value) || 0
    };
  }

  /**
   * Supprimer une commande (soft delete)
   */
  static async delete(id) {
    const order = await this.findById(id);
    
    if (!order) {
      throw new Error('Commande non trouvée');
    }

    if (!['cancelled', 'refunded'].includes(order.status)) {
      throw new Error('Seules les commandes annulées ou remboursées peuvent être supprimées');
    }

    await db('orders')
      .where({ id })
      .update({ deleted_at: db.fn.now() });

    return true;
  }

  /**
   * Formater les données de commande
   */
  static formatOrder(order) {
    if (!order) return null;

    const formatted = { ...order };

    // Parser les adresses JSON
    try {
      if (formatted.shipping_address && typeof formatted.shipping_address === 'string') {
        formatted.shipping_address = JSON.parse(formatted.shipping_address);
      }
      if (formatted.billing_address && typeof formatted.billing_address === 'string') {
        formatted.billing_address = JSON.parse(formatted.billing_address);
      }
    } catch (error) {
      console.error('Erreur lors du parsing des adresses:', error);
    }

    // Convertir les montants en nombres
    formatted.subtotal = parseFloat(formatted.subtotal) || 0;
    formatted.tax_amount = parseFloat(formatted.tax_amount) || 0;
    formatted.shipping_fee = parseFloat(formatted.shipping_fee) || 0;
    formatted.total_amount = parseFloat(formatted.total_amount) || 0;
    formatted.total_items = parseInt(formatted.total_items) || 0;
    formatted.total_weight = parseFloat(formatted.total_weight) || 0;

    return formatted;
  }
}

module.exports = Order;
