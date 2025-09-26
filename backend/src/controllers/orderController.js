const db = require('../config/database');
const { asyncHandler, commonErrors } = require('../middleware/errorHandler');
const { paymentService } = require('../services/paymentService');
const emailService = require('../services/emailService');

/**
 * Générer un numéro de commande unique
 */
const generateOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `AFM-${year}${month}${day}-${random}`;
};

/**
 * Créer une nouvelle commande
 * POST /api/orders
 */
const createOrder = asyncHandler(async (req, res) => {
  const {
    items, // Array d'objets { productId, quantity, variantName, customization }
    deliveryAddress,
    billingAddress,
    paymentMethod,
    phoneNumber,
    customerNotes,
    couponCode,
    deliveryMethod = 'standard'
  } = req.body;

  // Validation des données requises
  if (!items || items.length === 0) {
    throw commonErrors.badRequest('Aucun article dans la commande');
  }

  if (!deliveryAddress || !deliveryAddress.address || !deliveryAddress.city) {
    throw commonErrors.badRequest('Adresse de livraison incomplète');
  }

  if (!paymentMethod) {
    throw commonErrors.badRequest('Méthode de paiement requise');
  }

  // Vérifier les produits et calculer les prix
  const validatedItems = [];
  let subtotal = 0;
  let totalWeight = 0;

  for (const item of items) {
    const product = await db('products')
      .select([
        'id', 'name', 'slug', 'price', 'stock_quantity', 'store_id',
        'shipping_weight', 'requires_shipping', 'customizable', 'status'
      ])
      .where({ id: item.productId })
      .where('status', 'active')
      .whereNull('deleted_at')
      .first();

    if (!product) {
      throw commonErrors.notFound(`Produit avec ID ${item.productId} introuvable`);
    }

    // Vérifier le stock
    if (product.stock_quantity < item.quantity) {
      throw commonErrors.badRequest(
        `Stock insuffisant pour ${product.name}. Stock disponible: ${product.stock_quantity}`
      );
    }

    // Calculer le prix de l'article
    const unitPrice = parseFloat(product.price);
    const totalPrice = unitPrice * item.quantity;
    
    subtotal += totalPrice;
    totalWeight += (product.shipping_weight || 0) * item.quantity;

    validatedItems.push({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      storeId: product.store_id,
      quantity: item.quantity,
      unitPrice,
      totalPrice,
      variantName: item.variantName || null,
      customization: product.customizable && item.customization ? item.customization : null,
      shippingWeight: product.shipping_weight || 0,
      requiresShipping: product.requires_shipping
    });
  }

  // Vérifier que tous les articles viennent de la même boutique (pour simplifier)
  const storeIds = [...new Set(validatedItems.map(item => item.storeId))];
  if (storeIds.length > 1) {
    throw commonErrors.badRequest('Les articles doivent provenir de la même boutique pour cette commande');
  }

  const storeId = storeIds[0];

  // Calculer les frais de livraison
  let shippingCost = 0;
  if (validatedItems.some(item => item.requiresShipping)) {
    // Logique simple de calcul des frais de port
    if (deliveryAddress.country === 'TG' && deliveryAddress.city.toLowerCase() === 'lomé') {
      shippingCost = subtotal >= 50000 ? 0 : 2000; // Gratuit au-dessus de 50 000 FCFA
    } else if (deliveryAddress.country === 'TG') {
      shippingCost = 3000; // Togo hors Lomé
    } else {
      shippingCost = 15000; // International
    }
  }

  // Appliquer le coupon de réduction
  let discountAmount = 0;
  if (couponCode) {
    // TODO: Implémenter le système de coupons
    // Pour l'instant, coupon fixe de démonstration
    if (couponCode === 'WELCOME10') {
      discountAmount = Math.round(subtotal * 0.1); // 10% de réduction
    }
  }

  // Calculer les frais de paiement
  const paymentFees = paymentService.calculatePaymentFees(subtotal + shippingCost - discountAmount, paymentMethod);

  // Montant total
  const totalAmount = subtotal + shippingCost - discountAmount + paymentFees;

  // Commencer la transaction
  const trx = await db.transaction();

  try {
    // Générer le numéro de commande
    const orderNumber = generateOrderNumber();

    // Créer la commande
    const [order] = await trx('orders')
      .insert({
        order_number: orderNumber,
        customer_id: req.user.id,
        store_id: storeId,
        status: 'pending',
        subtotal,
        shipping_cost: shippingCost,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        currency: 'FCFA',
        coupon_code: couponCode,
        delivery_address: JSON.stringify({
          ...deliveryAddress,
          coordinates: deliveryAddress.coordinates || null
        }),
        billing_address: JSON.stringify(billingAddress || deliveryAddress),
        delivery_method: deliveryMethod,
        delivery_notes: customerNotes,
        customer_phone: phoneNumber || req.user.phone,
        customer_email: req.user.email,
        customer_name: `${req.user.firstName} ${req.user.lastName}`,
        payment_method: paymentMethod,
        payment_status: 'pending',
        language: req.user.preferredLanguage || 'fr',
        source: 'web',
        created_by: req.user.id,
        tenant_id: req.user.tenantId
      })
      .returning('*');

    // Créer les articles de commande
    const orderItems = validatedItems.map(item => ({
      order_id: order.id,
      product_id: item.productId,
      store_id: item.storeId,
      product_name: item.productName,
      variant_name: item.variantName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
      customization_details: item.customization,
      status: 'pending'
    }));

    await trx('order_items').insert(orderItems);

    // Réserver le stock
    for (const item of validatedItems) {
      await trx('products')
        .where({ id: item.productId })
        .increment('reserved_quantity', item.quantity);
    }

    // Confirmer la transaction
    await trx.commit();

    // Initier le paiement si ce n'est pas un paiement à la livraison
    let paymentResult = null;
    if (paymentMethod !== 'cash_on_delivery') {
      try {
        paymentResult = await paymentService.initiatePayment({
          orderId: order.id,
          customerId: req.user.id,
          amount: totalAmount,
          currency: 'FCFA',
          paymentMethod,
          phoneNumber: phoneNumber || req.user.phone,
          description: `Commande ${orderNumber} - AfrikMode`
        });
      } catch (paymentError) {
        console.error('Erreur initiation paiement:', paymentError);
        // La commande est créée mais le paiement a échoué
        await db('orders')
          .where({ id: order.id })
          .update({ 
            status: 'cancelled',
            admin_notes: `Erreur paiement: ${paymentError.message}`
          });
          
        throw commonErrors.badRequest(`Erreur lors de l'initiation du paiement: ${paymentError.message}`);
      }
    }

    // Envoyer l'email de confirmation (en arrière-plan)
    const orderData = {
      orderNumber: order.order_number,
      total: totalAmount,
      items: validatedItems.map(item => ({
        name: item.productName,
        quantity: item.quantity,
        price: item.totalPrice
      }))
    };

    emailService.sendOrderConfirmationEmail(
      req.user.email,
      req.user.firstName,
      orderData
    ).catch(error => {
      console.error('Erreur envoi email confirmation:', error);
    });

    // Réponse
    const response = {
      success: true,
      message: 'Commande créée avec succès',
      data: {
        order: {
          id: order.id,
          orderNumber: order.order_number,
          status: order.status,
          totalAmount,
          currency: order.currency,
          paymentMethod: order.payment_method,
          paymentStatus: order.payment_status,
          createdAt: order.created_at
        },
        items: validatedItems.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        })),
        summary: {
          subtotal,
          shippingCost,
          discountAmount,
          paymentFees,
          totalAmount
        }
      }
    };

    // Ajouter les informations de paiement si disponibles
    if (paymentResult) {
      response.data.payment = {
        transactionId: paymentResult.transactionId,
        paymentUrl: paymentResult.paymentUrl,
        message: paymentResult.message
      };
    }

    res.status(201).json(response);

  } catch (error) {
    // Rollback en cas d'erreur
    await trx.rollback();
    throw error;
  }
});

/**
 * Récupérer les commandes de l'utilisateur
 * GET /api/orders
 */
const getUserOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = req.query;

  let query = db('orders')
    .select([
      'orders.id',
      'orders.order_number',
      'orders.status',
      'orders.payment_status',
      'orders.total_amount',
      'orders.currency',
      'orders.delivery_method',
      'orders.created_at',
      'orders.updated_at',
      'stores.name as store_name',
      'stores.slug as store_slug',
      'stores.logo_url as store_logo'
    ])
    .leftJoin('stores', 'orders.store_id', 'stores.id')
    .where('orders.customer_id', req.user.id);

  // Filtre par statut
  if (status) {
    query = query.where('orders.status', status);
  }

  // Tri
  const validSortFields = ['created_at', 'total_amount', 'status'];
  const sortField = validSortFields.includes(sortBy) ? `orders.${sortBy}` : 'orders.created_at';
  const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';
  
  query = query.orderBy(sortField, order);

  // Pagination
  const result = await db.helpers.paginate(query, page, limit);

  // Pour chaque commande, récupérer les articles
  for (let order of result.data) {
    const items = await db('order_items')
      .select([
        'product_name',
        'variant_name', 
        'quantity',
        'unit_price',
        'total_price',
        'status'
      ])
      .where('order_id', order.id);
    
    order.items = items;
  }

  res.json({
    success: true,
    data: result.data.map(order => ({
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      totalAmount: parseFloat(order.total_amount),
      currency: order.currency,
      deliveryMethod: order.delivery_method,
      store: {
        name: order.store_name,
        slug: order.store_slug,
        logo: order.store_logo
      },
      items: order.items.map(item => ({
        productName: item.product_name,
        variantName: item.variant_name,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unit_price),
        totalPrice: parseFloat(item.total_price),
        status: item.status
      })),
      createdAt: order.created_at,
      updatedAt: order.updated_at
    })),
    pagination: result.pagination
  });
});

/**
 * Récupérer une commande spécifique
 * GET /api/orders/:id
 */
const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Requête principale pour récupérer la commande
  const order = await db('orders')
    .select([
      'orders.*',
      'stores.name as store_name',
      'stores.slug as store_slug',
      'stores.logo_url as store_logo',
      'stores.email as store_email',
      'stores.phone as store_phone'
    ])
    .leftJoin('stores', 'orders.store_id', 'stores.id')
    .where('orders.id', id)
    .first();

  if (!order) {
    throw commonErrors.notFound('Commande');
  }

  // Vérifier les permissions
  const isOwner = order.customer_id === req.user.id;
  const isStoreOwner = req.user.role === 'vendor' && await db('stores')
    .where({ id: order.store_id, owner_id: req.user.id })
    .first();
  const isAdmin = ['admin', 'super_admin', 'manager'].includes(req.user.role);

  if (!isOwner && !isStoreOwner && !isAdmin) {
    throw commonErrors.forbidden('Accès non autorisé à cette commande');
  }

  // Récupérer les articles de la commande
  const items = await db('order_items')
    .select([
      'id',
      'product_id',
      'product_name',
      'product_sku',
      'variant_name',
      'variant_attributes',
      'quantity',
      'unit_price',
      'total_price',
      'discount_amount',
      'customization_details',
      'status',
      'tracking_number',
      'shipped_at',
      'delivered_at'
    ])
    .where('order_id', order.id);

  // Récupérer l'historique de paiement
  const payments = await db('payments')
    .select([
      'id',
      'payment_reference',
      'payment_method',
      'status',
      'amount',
      'currency',
      'phone_number',
      'operator',
      'initiated_at',
      'completed_at',
      'failure_reason'
    ])
    .where('order_id', order.id)
    .orderBy('initiated_at', 'desc');

  // Formater la réponse
  const formattedOrder = {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    
    // Montants
    subtotal: parseFloat(order.subtotal),
    shippingCost: parseFloat(order.shipping_cost),
    taxAmount: parseFloat(order.tax_amount) || 0,
    discountAmount: parseFloat(order.discount_amount) || 0,
    totalAmount: parseFloat(order.total_amount),
    currency: order.currency,
    
    // Coupon
    couponCode: order.coupon_code,
    
    // Adresses
    deliveryAddress: order.delivery_address,
    billingAddress: order.billing_address,
    
    // Livraison
    deliveryMethod: order.delivery_method,
    deliveryNotes: order.delivery_notes,
    estimatedDeliveryDate: order.estimated_delivery_date,
    actualDeliveryDate: order.actual_delivery_date,
    
    // Suivi
    trackingNumber: order.tracking_number,
    trackingUrl: order.tracking_url,
    carrier: order.carrier,
    
    // Contact
    customerPhone: order.customer_phone,
    customerEmail: order.customer_email,
    customerName: order.customer_name,
    
    // Notes
    customerNotes: order.customer_notes,
    adminNotes: order.admin_notes,
    
    // Boutique
    store: {
      id: order.store_id,
      name: order.store_name,
      slug: order.store_slug,
      logo: order.store_logo,
      email: order.store_email,
      phone: order.store_phone
    },
    
    // Articles
    items: items.map(item => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      productSku: item.product_sku,
      variantName: item.variant_name,
      variantAttributes: item.variant_attributes,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unit_price),
      totalPrice: parseFloat(item.total_price),
      discountAmount: parseFloat(item.discount_amount) || 0,
      customization: item.customization_details,
      status: item.status,
      tracking: {
        number: item.tracking_number,
        shippedAt: item.shipped_at,
        deliveredAt: item.delivered_at
      }
    })),
    
    // Paiements
    payments: payments.map(payment => ({
      id: payment.id,
      reference: payment.payment_reference,
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
    
    // Dates
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    paymentDate: order.payment_date
  };

  res.json({
    success: true,
    data: formattedOrder
  });
});

/**
 * Annuler une commande
 * POST /api/orders/:id/cancel
 */
const cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const order = await db('orders')
    .where({ id })
    .first();

  if (!order) {
    throw commonErrors.notFound('Commande');
  }

  // Vérifier les permissions
  const isOwner = order.customer_id === req.user.id;
  const isStoreOwner = req.user.role === 'vendor' && await db('stores')
    .where({ id: order.store_id, owner_id: req.user.id })
    .first();
  const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

  if (!isOwner && !isStoreOwner && !isAdmin) {
    throw commonErrors.forbidden('Vous ne pouvez pas annuler cette commande');
  }

  // Vérifier que la commande peut être annulée
  const cancellableStatuses = ['pending', 'paid', 'confirmed'];
  if (!cancellableStatuses.includes(order.status)) {
    throw commonErrors.badRequest(`Impossible d'annuler une commande avec le statut: ${order.status}`);
  }

  const trx = await db.transaction();

  try {
    // Mettre à jour le statut de la commande
    await trx('orders')
      .where({ id })
      .update({
        status: 'cancelled',
        admin_notes: reason || 'Commande annulée',
        updated_at: trx.fn.now(),
        updated_by: req.user.id
      });

    // Libérer le stock réservé
    const orderItems = await trx('order_items')
      .select(['product_id', 'quantity'])
      .where({ order_id: id });

    for (const item of orderItems) {
      await trx('products')
        .where({ id: item.product_id })
        .decrement('reserved_quantity', item.quantity);
    }

    // Marquer les articles comme annulés
    await trx('order_items')
      .where({ order_id: id })
      .update({ status: 'cancelled' });

    // Si la commande était payée, initier le remboursement
    if (order.payment_status === 'paid') {
      await trx('orders')
        .where({ id })
        .update({ payment_status: 'refunded' });
      
      // TODO: Initier le processus de remboursement automatique
      console.log(`Remboursement à initier pour la commande ${order.order_number}`);
    }

    await trx.commit();

    res.json({
      success: true,
      message: 'Commande annulée avec succès'
    });

  } catch (error) {
    await trx.rollback();
    throw error;
  }
});

/**
 * Mettre à jour le statut d'une commande (vendeur/admin)
 * PUT /api/orders/:id/status
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, trackingNumber, carrier, notes } = req.body;

  if (!status) {
    throw commonErrors.badRequest('Statut requis');
  }

  const validStatuses = ['confirmed', 'processing', 'shipped', 'delivered'];
  if (!validStatuses.includes(status)) {
    throw commonErrors.badRequest('Statut invalide');
  }

  const order = await db('orders')
    .where({ id })
    .first();

  if (!order) {
    throw commonErrors.notFound('Commande');
  }

  // Vérifier les permissions (vendeur de la boutique ou admin)
  const isStoreOwner = req.user.role === 'vendor' && await db('stores')
    .where({ id: order.store_id, owner_id: req.user.id })
    .first();
  const isAdmin = ['admin', 'super_admin', 'manager'].includes(req.user.role);

  if (!isStoreOwner && !isAdmin) {
    throw commonErrors.forbidden('Accès non autorisé');
  }

  const updateData = {
    status,
    updated_at: db.fn.now(),
    updated_by: req.user.id
  };

  if (trackingNumber) {
    updateData.tracking_number = trackingNumber;
  }

  if (carrier) {
    updateData.carrier = carrier;
  }

  if (notes) {
    updateData.admin_notes = notes;
  }

  // Mettre à jour automatiquement certains champs selon le statut
  if (status === 'delivered') {
    updateData.actual_delivery_date = db.fn.now();
    
    // Mettre à jour les statistiques de la boutique
    await db('stores')
      .where({ id: order.store_id })
      .increment('total_orders', 1)
      .increment('total_revenue', order.total_amount);

    // Libérer le stock réservé et ajouter aux ventes
    const orderItems = await db('order_items')
      .select(['product_id', 'quantity', 'total_price'])
      .where({ order_id: id });

    for (const item of orderItems) {
      await db('products')
        .where({ id: item.product_id })
        .decrement('reserved_quantity', item.quantity)
        .decrement('stock_quantity', item.quantity)
        .increment('sales_count', item.quantity)
        .increment('total_revenue', item.total_price);
    }
  }

  await db('orders')
    .where({ id })
    .update(updateData);

  // Mettre à jour le statut des articles
  await db('order_items')
    .where({ order_id: id })
    .update({ status });

  res.json({
    success: true,
    message: `Commande mise à jour: ${status}`,
    data: { 
      status,
      trackingNumber,
      carrier
    }
  });
});

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  updateOrderStatus
};