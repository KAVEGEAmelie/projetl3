const db = require('../config/database');

/**
 * Modèle Review - Gestion des avis et évaluations
 */
class Review {
  /**
   * Créer un nouvel avis
   */
  static async create(reviewData) {
    const {
      user_id,
      product_id,
      order_id = null,
      rating,
      title = null,
      comment = null,
      pros = [],
      cons = [],
      images = [],
      recommend = true,
      verified_purchase = false
    } = reviewData;

    // Vérifier si l'utilisateur a déjà donné un avis pour ce produit
    const existingReview = await db('reviews')
      .where({ user_id, product_id })
      .whereNull('deleted_at')
      .first();

    if (existingReview) {
      throw new Error('Vous avez déjà donné un avis pour ce produit');
    }

    // Vérifier si c'est un achat vérifié
    let isVerifiedPurchase = verified_purchase;
    if (order_id) {
      const purchase = await db('order_items')
        .join('orders', 'order_items.order_id', 'orders.id')
        .where('order_items.product_id', product_id)
        .where('orders.user_id', user_id)
        .where('orders.status', 'delivered')
        .whereNull('orders.deleted_at')
        .first();
      
      isVerifiedPurchase = !!purchase;
    }

    const [review] = await db('reviews')
      .insert({
        user_id,
        product_id,
        order_id,
        rating,
        title,
        comment,
        pros: JSON.stringify(pros),
        cons: JSON.stringify(cons),
        images: JSON.stringify(images),
        recommend,
        verified_purchase: isVerifiedPurchase,
        status: 'published' // ou 'pending' si modération requise
      })
      .returning('*');

    // Mettre à jour les statistiques du produit
    await this.updateProductRating(product_id);

    return this.formatReview(review);
  }

  /**
   * Trouver un avis par ID
   */
  static async findById(id) {
    const review = await db('reviews')
      .select(
        'reviews.*',
        'users.first_name',
        'users.last_name',
        'users.avatar_url',
        'products.name as product_name',
        'products.slug as product_slug',
        'stores.name as store_name'
      )
      .leftJoin('users', 'reviews.user_id', 'users.id')
      .leftJoin('products', 'reviews.product_id', 'products.id')
      .leftJoin('stores', 'products.store_id', 'stores.id')
      .where('reviews.id', id)
      .whereNull('reviews.deleted_at')
      .first();

    return review ? this.formatReview(review) : null;
  }

  /**
   * Obtenir tous les avis avec filtres
   */
  static async getAll(options = {}) {
    const {
      page = 1,
      limit = 20,
      user_id = null,
      product_id = null,
      store_id = null,
      rating = null,
      status = 'published',
      verified_purchase = null,
      sort = 'created_at',
      order = 'desc'
    } = options;

    let query = db('reviews')
      .select(
        'reviews.*',
        'users.first_name',
        'users.last_name',
        'users.avatar_url',
        'products.name as product_name',
        'products.slug as product_slug',
        'stores.name as store_name'
      )
      .leftJoin('users', 'reviews.user_id', 'users.id')
      .leftJoin('products', 'reviews.product_id', 'products.id')
      .leftJoin('stores', 'products.store_id', 'stores.id')
      .whereNull('reviews.deleted_at');

    // Filtres
    if (user_id) query = query.where('reviews.user_id', user_id);
    if (product_id) query = query.where('reviews.product_id', product_id);
    if (store_id) query = query.where('products.store_id', store_id);
    if (rating) query = query.where('reviews.rating', rating);
    if (status) query = query.where('reviews.status', status);
    if (verified_purchase !== null) query = query.where('reviews.verified_purchase', verified_purchase);

    // Tri
    const validSorts = ['created_at', 'rating', 'helpful_votes'];
    const sortField = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = ['asc', 'desc'].includes(order) ? order : 'desc';
    
    query = query.orderBy(`reviews.${sortField}`, sortOrder);

    // Pagination
    const offset = (page - 1) * limit;
    const reviews = await query.limit(limit).offset(offset);

    // Compter le total
    const totalQuery = db('reviews')
      .leftJoin('products', 'reviews.product_id', 'products.id')
      .whereNull('reviews.deleted_at');

    // Appliquer les mêmes filtres
    if (user_id) totalQuery.where('reviews.user_id', user_id);
    if (product_id) totalQuery.where('reviews.product_id', product_id);
    if (store_id) totalQuery.where('products.store_id', store_id);
    if (rating) totalQuery.where('reviews.rating', rating);
    if (status) totalQuery.where('reviews.status', status);
    if (verified_purchase !== null) totalQuery.where('reviews.verified_purchase', verified_purchase);
    
    const [{ count }] = await totalQuery.count('reviews.id as count');
    const total = parseInt(count);

    return {
      reviews: reviews.map(review => this.formatReview(review)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Obtenir les avis d'un produit
   */
  static async getProductReviews(productId, options = {}) {
    return await this.getAll({
      ...options,
      product_id: productId,
      status: 'published'
    });
  }

  /**
   * Obtenir les avis d'une boutique
   */
  static async getStoreReviews(storeId, options = {}) {
    return await this.getAll({
      ...options,
      store_id: storeId,
      status: 'published'
    });
  }

  /**
   * Obtenir les avis d'un utilisateur
   */
  static async getUserReviews(userId, options = {}) {
    return await this.getAll({
      ...options,
      user_id: userId
    });
  }

  /**
   * Mettre à jour un avis
   */
  static async update(id, updateData, userId = null) {
    const allowedFields = ['rating', 'title', 'comment', 'pros', 'cons', 'images', 'recommend'];
    
    // Vérifier que l'utilisateur peut modifier cet avis
    if (userId) {
      const review = await this.findById(id);
      if (!review || review.user_id !== userId) {
        throw new Error('Vous ne pouvez modifier que vos propres avis');
      }
    }

    const filteredData = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (['pros', 'cons', 'images'].includes(field) && typeof updateData[field] === 'object') {
          filteredData[field] = JSON.stringify(updateData[field]);
        } else {
          filteredData[field] = updateData[field];
        }
      }
    }

    filteredData.updated_at = db.fn.now();
    filteredData.status = 'published'; // Remettre en attente de modération si nécessaire

    const [review] = await db('reviews')
      .where({ id })
      .whereNull('deleted_at')
      .update(filteredData)
      .returning('*');

    if (review && filteredData.rating !== undefined) {
      // Mettre à jour les statistiques du produit si la note a changé
      await this.updateProductRating(review.product_id);
    }

    return review ? this.formatReview(review) : null;
  }

  /**
   * Marquer un avis comme utile
   */
  static async markHelpful(reviewId, userId, isHelpful = true) {
    // Vérifier si l'utilisateur a déjà voté
    const existingVote = await db('review_votes')
      .where({ review_id: reviewId, user_id: userId })
      .first();

    if (existingVote) {
      if (existingVote.is_helpful === isHelpful) {
        // L'utilisateur enlève son vote
        await db('review_votes')
          .where({ review_id: reviewId, user_id: userId })
          .del();
      } else {
        // L'utilisateur change son vote
        await db('review_votes')
          .where({ review_id: reviewId, user_id: userId })
          .update({ is_helpful: isHelpful, updated_at: db.fn.now() });
      }
    } else {
      // Nouveau vote
      await db('review_votes')
        .insert({
          review_id: reviewId,
          user_id: userId,
          is_helpful: isHelpful
        });
    }

    // Mettre à jour les compteurs dans l'avis
    const [helpfulCount] = await db('review_votes')
      .where({ review_id: reviewId, is_helpful: true })
      .count('* as count');

    const [notHelpfulCount] = await db('review_votes')
      .where({ review_id: reviewId, is_helpful: false })
      .count('* as count');

    await db('reviews')
      .where({ id: reviewId })
      .update({
        helpful_votes: parseInt(helpfulCount.count),
        not_helpful_votes: parseInt(notHelpfulCount.count),
        updated_at: db.fn.now()
      });

    return await this.findById(reviewId);
  }

  /**
   * Signaler un avis
   */
  static async report(reviewId, userId, reason, description = null) {
    const validReasons = ['inappropriate', 'spam', 'fake', 'offensive', 'other'];
    
    if (!validReasons.includes(reason)) {
      throw new Error('Raison de signalement invalide');
    }

    // Vérifier si l'utilisateur a déjà signalé cet avis
    const existingReport = await db('review_reports')
      .where({ review_id: reviewId, reporter_id: userId })
      .first();

    if (existingReport) {
      throw new Error('Vous avez déjà signalé cet avis');
    }

    await db('review_reports')
      .insert({
        review_id: reviewId,
        reporter_id: userId,
        reason,
        description,
        status: 'pending'
      });

    // Incrémenter le compteur de signalements
    await db('reviews')
      .where({ id: reviewId })
      .increment('report_count', 1)
      .update('updated_at', db.fn.now());

    return true;
  }

  /**
   * Modérer un avis
   */
  static async moderate(reviewId, status, moderatorId, notes = null) {
    const validStatuses = ['published', 'pending', 'rejected', 'spam'];
    
    if (!validStatuses.includes(status)) {
      throw new Error('Statut de modération invalide');
    }

    const [review] = await db('reviews')
      .where({ id: reviewId })
      .update({
        status,
        moderated_by: moderatorId,
        moderated_at: db.fn.now(),
        moderator_notes: notes,
        updated_at: db.fn.now()
      })
      .returning('*');

    return review ? this.formatReview(review) : null;
  }

  /**
   * Obtenir les statistiques des avis d'un produit
   */
  static async getProductReviewStats(productId) {
    const [stats] = await db('reviews')
      .select(
        db.raw('COUNT(*) as total_reviews'),
        db.raw('AVG(rating) as average_rating'),
        db.raw('COUNT(*) FILTER (WHERE rating = 1) as rating_1'),
        db.raw('COUNT(*) FILTER (WHERE rating = 2) as rating_2'),
        db.raw('COUNT(*) FILTER (WHERE rating = 3) as rating_3'),
        db.raw('COUNT(*) FILTER (WHERE rating = 4) as rating_4'),
        db.raw('COUNT(*) FILTER (WHERE rating = 5) as rating_5'),
        db.raw('COUNT(*) FILTER (WHERE verified_purchase = true) as verified_reviews'),
        db.raw('COUNT(*) FILTER (WHERE recommend = true) as recommendations')
      )
      .where({ product_id: productId })
      .where('status', 'published')
      .whereNull('deleted_at');

    const totalReviews = parseInt(stats.total_reviews) || 0;
    const verifiedReviews = parseInt(stats.verified_reviews) || 0;
    const recommendations = parseInt(stats.recommendations) || 0;

    return {
      total_reviews: totalReviews,
      average_rating: parseFloat(stats.average_rating) || 0,
      rating_distribution: {
        1: parseInt(stats.rating_1) || 0,
        2: parseInt(stats.rating_2) || 0,
        3: parseInt(stats.rating_3) || 0,
        4: parseInt(stats.rating_4) || 0,
        5: parseInt(stats.rating_5) || 0
      },
      verified_reviews: verifiedReviews,
      verified_percentage: totalReviews > 0 ? (verifiedReviews / totalReviews * 100).toFixed(1) : 0,
      recommendations,
      recommendation_percentage: totalReviews > 0 ? (recommendations / totalReviews * 100).toFixed(1) : 0
    };
  }

  /**
   * Obtenir les statistiques des avis d'une boutique
   */
  static async getStoreReviewStats(storeId) {
    const [stats] = await db('reviews')
      .join('products', 'reviews.product_id', 'products.id')
      .select(
        db.raw('COUNT(*) as total_reviews'),
        db.raw('AVG(reviews.rating) as average_rating'),
        db.raw('COUNT(*) FILTER (WHERE reviews.verified_purchase = true) as verified_reviews'),
        db.raw('COUNT(*) FILTER (WHERE reviews.recommend = true) as recommendations')
      )
      .where('products.store_id', storeId)
      .where('reviews.status', 'published')
      .whereNull('reviews.deleted_at');

    const totalReviews = parseInt(stats.total_reviews) || 0;
    const verifiedReviews = parseInt(stats.verified_reviews) || 0;
    const recommendations = parseInt(stats.recommendations) || 0;

    return {
      total_reviews: totalReviews,
      average_rating: parseFloat(stats.average_rating) || 0,
      verified_reviews: verifiedReviews,
      verified_percentage: totalReviews > 0 ? (verifiedReviews / totalReviews * 100).toFixed(1) : 0,
      recommendations,
      recommendation_percentage: totalReviews > 0 ? (recommendations / totalReviews * 100).toFixed(1) : 0
    };
  }

  /**
   * Mettre à jour la note moyenne d'un produit
   */
  static async updateProductRating(productId) {
    const stats = await this.getProductReviewStats(productId);
    
    await db('products')
      .where({ id: productId })
      .update({
        average_rating: stats.average_rating,
        review_count: stats.total_reviews,
        updated_at: db.fn.now()
      });
  }

  /**
   * Obtenir les avis les plus récents
   */
  static async getRecent(limit = 10) {
    const reviews = await db('reviews')
      .select(
        'reviews.*',
        'users.first_name',
        'users.last_name',
        'users.avatar_url',
        'products.name as product_name',
        'products.slug as product_slug',
        'products.images as product_images',
        'stores.name as store_name'
      )
      .leftJoin('users', 'reviews.user_id', 'users.id')
      .leftJoin('products', 'reviews.product_id', 'products.id')
      .leftJoin('stores', 'products.store_id', 'stores.id')
      .where('reviews.status', 'published')
      .whereNull('reviews.deleted_at')
      .orderBy('reviews.created_at', 'desc')
      .limit(limit);

    return reviews.map(review => this.formatReview(review));
  }

  /**
   * Obtenir les meilleurs avis (les plus utiles)
   */
  static async getTopRated(options = {}) {
    const { limit = 10, product_id = null, store_id = null } = options;

    let query = db('reviews')
      .select(
        'reviews.*',
        'users.first_name',
        'users.last_name',
        'users.avatar_url',
        'products.name as product_name',
        'products.slug as product_slug',
        'stores.name as store_name'
      )
      .leftJoin('users', 'reviews.user_id', 'users.id')
      .leftJoin('products', 'reviews.product_id', 'products.id')
      .leftJoin('stores', 'products.store_id', 'stores.id')
      .where('reviews.status', 'published')
      .whereNull('reviews.deleted_at')
      .where('reviews.helpful_votes', '>', 0);

    if (product_id) query = query.where('reviews.product_id', product_id);
    if (store_id) query = query.where('products.store_id', store_id);

    const reviews = await query
      .orderBy('reviews.helpful_votes', 'desc')
      .orderBy('reviews.rating', 'desc')
      .limit(limit);

    return reviews.map(review => this.formatReview(review));
  }

  /**
   * Supprimer un avis (soft delete)
   */
  static async delete(id, userId = null) {
    // Vérifier les permissions si un userId est fourni
    if (userId) {
      const review = await this.findById(id);
      if (!review || review.user_id !== userId) {
        throw new Error('Vous ne pouvez supprimer que vos propres avis');
      }
    }

    const review = await db('reviews')
      .where({ id })
      .whereNull('deleted_at')
      .first();

    if (!review) {
      throw new Error('Avis non trouvé');
    }

    await db('reviews')
      .where({ id })
      .update({ deleted_at: db.fn.now() });

    // Mettre à jour les statistiques du produit
    await this.updateProductRating(review.product_id);

    return true;
  }

  /**
   * Formater les données d'avis
   */
  static formatReview(review) {
    if (!review) return null;

    const formatted = { ...review };

    // Parser les champs JSON
    const jsonFields = ['pros', 'cons', 'images', 'product_images'];
    
    jsonFields.forEach(field => {
      try {
        if (formatted[field] && typeof formatted[field] === 'string') {
          formatted[field] = JSON.parse(formatted[field]);
        }
      } catch (error) {
        console.error(`Erreur lors du parsing de ${field}:`, error);
        formatted[field] = [];
      }
    });

    // Convertir les nombres
    formatted.rating = parseInt(formatted.rating) || 0;
    formatted.helpful_votes = parseInt(formatted.helpful_votes) || 0;
    formatted.not_helpful_votes = parseInt(formatted.not_helpful_votes) || 0;
    formatted.report_count = parseInt(formatted.report_count) || 0;

    // Masquer les informations sensibles pour les utilisateurs non propriétaires
    if (!formatted.is_owner) {
      delete formatted.report_count;
      delete formatted.moderator_notes;
    }

    return formatted;
  }
}

module.exports = Review;
