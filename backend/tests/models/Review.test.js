const Review = require('../../src/models/Review');
const User = require('../../src/models/User');
const Store = require('../../src/models/Store');
const Product = require('../../src/models/Product');
const Category = require('../../src/models/Category');
const Order = require('../../src/models/Order');

describe('Review Model', () => {
  let customer, vendor, anotherCustomer, store, category, product, order;

  beforeEach(async () => {
    // Créer un client
    customer = await User.create({
      email: 'review-customer@test.com',
      password: 'Password123!',
      firstName: 'Review',
      lastName: 'Customer',
      role: 'customer'
    });

    // Créer un autre client
    anotherCustomer = await User.create({
      email: 'another-reviewer@test.com',
      password: 'Password123!',
      firstName: 'Another',
      lastName: 'Reviewer',
      role: 'customer'
    });

    // Créer un vendeur
    vendor = await User.create({
      email: 'review-vendor@test.com',
      password: 'Password123!',
      firstName: 'Review',
      lastName: 'Vendor',
      role: 'vendor'
    });

    // Créer une boutique
    store = await Store.create({
      name: 'Review Test Store',
      description: 'Store for review tests',
      ownerId: vendor.id,
      city: 'Lomé',
      address: '123 Review Street'
    });

    // Créer une catégorie
    category = await Category.create({
      name: 'Review Category',
      description: 'Category for review tests'
    });

    // Créer un produit
    product = await Product.create({
      name: 'Review Test Product',
      description: 'Product for review tests',
      storeId: store.id,
      categoryId: category.id,
      price: 15000,
      stockQuantity: 10
    });

    // Créer une commande
    order = await Order.create({
      userId: customer.id,
      storeId: store.id,
      items: [
        {
          productId: product.id,
          quantity: 1,
          price: product.price
        }
      ],
      shippingAddress: {
        firstName: 'Review',
        lastName: 'Customer',
        address: '456 Review Street',
        city: 'Lomé',
        phone: '+22770123456'
      }
    });

    // Marquer la commande comme livrée pour permettre les avis
    await Order.updateStatus(order.id, 'delivered');
  });

  describe('create', () => {
    it('should create a new product review', async () => {
      const reviewData = {
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 5,
        comment: 'Excellent produit, très bonne qualité!'
      };

      const review = await Review.create(reviewData);

      expect(review).toBeDefined();
      expect(review.id).toBeDefined();
      expect(review.userId).toBe(customer.id);
      expect(review.productId).toBe(product.id);
      expect(review.orderId).toBe(order.id);
      expect(review.rating).toBe(5);
      expect(review.comment).toBe('Excellent produit, très bonne qualité!');
      expect(review.type).toBe('product');
      expect(review.isVerified).toBe(true);
    });

    it('should create a store review', async () => {
      const reviewData = {
        userId: customer.id,
        storeId: store.id,
        orderId: order.id,
        rating: 4,
        comment: 'Très bon service client!'
      };

      const review = await Review.create(reviewData);

      expect(review).toBeDefined();
      expect(review.storeId).toBe(store.id);
      expect(review.type).toBe('store');
      expect(review.rating).toBe(4);
    });

    it('should validate rating between 1 and 5', async () => {
      const invalidRatingData = {
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 6,
        comment: 'Rating trop élevé'
      };

      await expect(Review.create(invalidRatingData)).rejects.toThrow();
    });

    it('should not allow duplicate reviews for same product by same user', async () => {
      const reviewData = {
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 5,
        comment: 'Premier avis'
      };

      await Review.create(reviewData);

      const duplicateReviewData = {
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 3,
        comment: 'Deuxième avis'
      };

      await expect(Review.create(duplicateReviewData)).rejects.toThrow();
    });
  });

  describe('findByProduct', () => {
    it('should find reviews for a product with pagination', async () => {
      // Créer plusieurs avis
      const review1 = await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 5,
        comment: 'Excellent!'
      });

      const review2 = await Review.create({
        userId: anotherCustomer.id,
        productId: product.id,
        rating: 4,
        comment: 'Très bien'
      });

      const reviews = await Review.findByProduct(product.id, { 
        page: 1, 
        limit: 10 
      });

      expect(reviews.data).toHaveLength(2);
      expect(reviews.total).toBe(2);
      expect(reviews.data[0].rating).toBeGreaterThanOrEqual(1);
      expect(reviews.data[0].rating).toBeLessThanOrEqual(5);
    });

    it('should include user information in product reviews', async () => {
      await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 5,
        comment: 'Avec info utilisateur'
      });

      const reviews = await Review.findByProduct(product.id, { 
        includeUser: true 
      });

      expect(reviews.data[0].user).toBeDefined();
      expect(reviews.data[0].user.firstName).toBe(customer.firstName);
      expect(reviews.data[0].user.email).toBeUndefined(); // Email ne doit pas être exposé
    });
  });

  describe('findByStore', () => {
    it('should find reviews for a store', async () => {
      await Review.create({
        userId: customer.id,
        storeId: store.id,
        orderId: order.id,
        rating: 4,
        comment: 'Bonne boutique'
      });

      const reviews = await Review.findByStore(store.id);

      expect(reviews.data).toHaveLength(1);
      expect(reviews.data[0].storeId).toBe(store.id);
      expect(reviews.data[0].type).toBe('store');
    });
  });

  describe('findByUser', () => {
    it('should find all reviews by a user', async () => {
      await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 5,
        comment: 'Avis produit'
      });

      await Review.create({
        userId: customer.id,
        storeId: store.id,
        orderId: order.id,
        rating: 4,
        comment: 'Avis boutique'
      });

      const userReviews = await Review.findByUser(customer.id);

      expect(userReviews).toHaveLength(2);
      expect(userReviews.every(review => review.userId === customer.id)).toBe(true);
    });
  });

  describe('updateReview', () => {
    it('should update review rating and comment', async () => {
      const review = await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 3,
        comment: 'Avis initial'
      });

      const updatedReview = await Review.update(review.id, {
        rating: 5,
        comment: 'Avis mis à jour après utilisation'
      });

      expect(updatedReview.rating).toBe(5);
      expect(updatedReview.comment).toBe('Avis mis à jour après utilisation');
      expect(updatedReview.updatedAt).toBeDefined();
    });

    it('should not allow updating review by different user', async () => {
      const review = await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 3,
        comment: 'Avis original'
      });

      await expect(Review.update(review.id, {
        rating: 1,
        comment: 'Tentative de modification'
      }, anotherCustomer.id)).rejects.toThrow();
    });
  });

  describe('deleteReview', () => {
    it('should soft delete a review', async () => {
      const review = await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 4,
        comment: 'Avis à supprimer'
      });

      const deleted = await Review.delete(review.id, customer.id);

      expect(deleted).toBe(true);

      // Vérifier que l'avis n'apparaît plus dans les listes
      const productReviews = await Review.findByProduct(product.id);
      expect(productReviews.data).toHaveLength(0);
    });
  });

  describe('helpful votes', () => {
    it('should mark review as helpful', async () => {
      const review = await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 5,
        comment: 'Avis très utile'
      });

      const updated = await Review.markAsHelpful(review.id, anotherCustomer.id);

      expect(updated.helpfulCount).toBe(1);
    });

    it('should not allow same user to vote helpful multiple times', async () => {
      const review = await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 5,
        comment: 'Avis utile'
      });

      await Review.markAsHelpful(review.id, anotherCustomer.id);
      
      await expect(Review.markAsHelpful(review.id, anotherCustomer.id))
        .rejects.toThrow();
    });

    it('should not allow author to mark own review as helpful', async () => {
      const review = await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 5,
        comment: 'Mon propre avis'
      });

      await expect(Review.markAsHelpful(review.id, customer.id))
        .rejects.toThrow();
    });
  });

  describe('report review', () => {
    it('should report inappropriate review', async () => {
      const review = await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 1,
        comment: 'Avis inapproprié'
      });

      const reported = await Review.report(review.id, anotherCustomer.id, 'Contenu offensant');

      expect(reported).toBe(true);
    });
  });

  describe('getAverageRating', () => {
    it('should calculate average rating for product', async () => {
      await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 5,
        comment: 'Excellent'
      });

      await Review.create({
        userId: anotherCustomer.id,
        productId: product.id,
        rating: 3,
        comment: 'Moyen'
      });

      const avgRating = await Review.getAverageRating('product', product.id);

      expect(avgRating).toBe(4); // (5 + 3) / 2
    });

    it('should calculate average rating for store', async () => {
      await Review.create({
        userId: customer.id,
        storeId: store.id,
        orderId: order.id,
        rating: 4,
        comment: 'Bonne boutique'
      });

      await Review.create({
        userId: anotherCustomer.id,
        storeId: store.id,
        rating: 5,
        comment: 'Excellente boutique'
      });

      const avgRating = await Review.getAverageRating('store', store.id);

      expect(avgRating).toBe(4.5); // (4 + 5) / 2
    });
  });

  describe('getRatingDistribution', () => {
    it('should return rating distribution for product', async () => {
      await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 5,
        comment: '5 étoiles'
      });

      await Review.create({
        userId: anotherCustomer.id,
        productId: product.id,
        rating: 4,
        comment: '4 étoiles'
      });

      const distribution = await Review.getRatingDistribution('product', product.id);

      expect(distribution).toBeDefined();
      expect(distribution['5']).toBe(1);
      expect(distribution['4']).toBe(1);
      expect(distribution['3']).toBe(0);
      expect(distribution['2']).toBe(0);
      expect(distribution['1']).toBe(0);
    });
  });

  describe('getStatistics', () => {
    it('should return review statistics', async () => {
      await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 5,
        comment: 'Excellent'
      });

      await Review.create({
        userId: anotherCustomer.id,
        storeId: store.id,
        rating: 4,
        comment: 'Bonne boutique'
      });

      const stats = await Review.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalReviews).toBe(2);
      expect(stats.productReviews).toBe(1);
      expect(stats.storeReviews).toBe(1);
      expect(stats.averageRating).toBeGreaterThan(0);
      expect(stats.verifiedReviews).toBe(2);
    });
  });

  describe('moderate reviews', () => {
    it('should moderate review content', async () => {
      const review = await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 1,
        comment: 'Avis avec contenu à modérer'
      });

      const moderated = await Review.moderate(review.id, 'approved', 'Content is appropriate');

      expect(moderated.status).toBe('approved');
      expect(moderated.moderationReason).toBe('Content is appropriate');
    });

    it('should reject inappropriate review', async () => {
      const review = await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 1,
        comment: 'Contenu inapproprié'
      });

      const rejected = await Review.moderate(review.id, 'rejected', 'Inappropriate content');

      expect(rejected.status).toBe('rejected');
      expect(rejected.moderationReason).toBe('Inappropriate content');
    });
  });

  describe('getTopReviewers', () => {
    it('should return top reviewers', async () => {
      // Customer fait 2 avis
      await Review.create({
        userId: customer.id,
        productId: product.id,
        orderId: order.id,
        rating: 5,
        comment: 'Premier avis'
      });

      await Review.create({
        userId: customer.id,
        storeId: store.id,
        orderId: order.id,
        rating: 4,
        comment: 'Deuxième avis'
      });

      // AnotherCustomer fait 1 avis
      await Review.create({
        userId: anotherCustomer.id,
        productId: product.id,
        rating: 3,
        comment: 'Un seul avis'
      });

      const topReviewers = await Review.getTopReviewers({ limit: 5 });

      expect(topReviewers).toHaveLength(2);
      expect(topReviewers[0].reviewCount).toBe(2);
      expect(topReviewers[1].reviewCount).toBe(1);
      expect(topReviewers[0].userId).toBe(customer.id);
    });
  });
});