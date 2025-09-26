const request = require('supertest');
const app = require('../../src/server');
const User = require('../../src/models/User');
const Store = require('../../src/models/Store');
const Product = require('../../src/models/Product');
const Category = require('../../src/models/Category');
const jwt = require('jsonwebtoken');

describe('Product Controller', () => {
  let customerUser, vendorUser, anotherVendor, adminUser;
  let customerToken, vendorToken, anotherVendorToken, adminToken;
  let store, anotherStore, category, subCategory, product;

  beforeEach(async () => {
    // Créer les utilisateurs
    customerUser = await User.create({
      email: 'customer@test.com',
      password: 'Password123!',
      firstName: 'Customer',
      lastName: 'User',
      role: 'customer'
    });

    vendorUser = await User.create({
      email: 'vendor@test.com',
      password: 'Password123!',
      firstName: 'Vendor',
      lastName: 'User',
      role: 'vendor'
    });

    anotherVendor = await User.create({
      email: 'another-vendor@test.com',
      password: 'Password123!',
      firstName: 'Another',
      lastName: 'Vendor',
      role: 'vendor'
    });

    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'Password123!',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin'
    });

    // Générer les tokens
    customerToken = jwt.sign(
      { userId: customerUser.id, email: customerUser.email, role: customerUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    vendorToken = jwt.sign(
      { userId: vendorUser.id, email: vendorUser.email, role: vendorUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    anotherVendorToken = jwt.sign(
      { userId: anotherVendor.id, email: anotherVendor.email, role: anotherVendor.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, role: adminUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Créer les catégories
    category = await Category.create({
      name: 'Vêtements',
      description: 'Vêtements africains traditionnels'
    });

    subCategory = await Category.create({
      name: 'Robes',
      description: 'Robes traditionnelles',
      parentId: category.id
    });

    // Créer les boutiques
    store = await Store.create({
      name: 'Boutique Test',
      description: 'Boutique pour tests',
      ownerId: vendorUser.id,
      city: 'Lomé',
      address: '123 Test Street'
    });

    anotherStore = await Store.create({
      name: 'Autre Boutique',
      description: 'Autre boutique pour tests',
      ownerId: anotherVendor.id,
      city: 'Accra',
      address: '456 Test Avenue'
    });

    // Créer un produit test
    product = await Product.create({
      name: 'Robe Kente',
      description: 'Belle robe en tissu Kente',
      storeId: store.id,
      categoryId: category.id,
      price: 45000,
      stockQuantity: 15,
      culturalOrigin: 'Ghana',
      materials: ['Kente', 'Coton']
    });
  });

  describe('GET /products', () => {
    it('should return all products with pagination', async () => {
      const response = await request(app)
        .get('/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.products.length).toBeGreaterThan(0);
    });

    it('should filter products by category', async () => {
      const response = await request(app)
        .get(`/products?categoryId=${category.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products.every(p => p.categoryId === category.id)).toBe(true);
    });

    it('should search products by name', async () => {
      const response = await request(app)
        .get('/products?search=Kente')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products.length).toBeGreaterThan(0);
      expect(response.body.data.products[0].name).toContain('Kente');
    });

    it('should filter products by price range', async () => {
      const response = await request(app)
        .get('/products?minPrice=40000&maxPrice=50000')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products.every(p => 
        p.price >= 40000 && p.price <= 50000
      )).toBe(true);
    });

    it('should filter products by cultural origin', async () => {
      const response = await request(app)
        .get('/products?culturalOrigin=Ghana')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products.every(p => p.culturalOrigin === 'Ghana')).toBe(true);
    });

    it('should sort products by price', async () => {
      const response = await request(app)
        .get('/products?sortBy=price&sortOrder=asc')
        .expect(200);

      expect(response.body.success).toBe(true);
      const prices = response.body.data.products.map(p => p.price);
      const sortedPrices = [...prices].sort((a, b) => a - b);
      expect(prices).toEqual(sortedPrices);
    });

    it('should return only available products by default', async () => {
      const response = await request(app)
        .get('/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products.every(p => p.stockQuantity > 0)).toBe(true);
    });
  });

  describe('GET /products/:id', () => {
    it('should return product details', async () => {
      const response = await request(app)
        .get(`/products/${product.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product.id).toBe(product.id);
      expect(response.body.data.product.name).toBe(product.name);
      expect(response.body.data.product.store).toBeDefined();
      expect(response.body.data.product.category).toBeDefined();
    });

    it('should include similar products', async () => {
      const response = await request(app)
        .get(`/products/${product.id}?includeSimilar=true`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.similarProducts).toBeDefined();
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/products/99999')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should increment view count', async () => {
      const initialViews = product.viewCount || 0;

      await request(app)
        .get(`/products/${product.id}`)
        .expect(200);

      const updatedProduct = await Product.findById(product.id);
      expect(updatedProduct.viewCount).toBe(initialViews + 1);
    });
  });

  describe('POST /products', () => {
    it('should create product for vendor', async () => {
      const productData = {
        name: 'Nouveau Produit',
        description: 'Description du nouveau produit',
        storeId: store.id,
        categoryId: category.id,
        price: 25000,
        stockQuantity: 10,
        culturalOrigin: 'Togo',
        materials: ['Coton', 'Wax'],
        sizes: ['S', 'M', 'L'],
        colors: ['Rouge', 'Bleu']
      };

      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(productData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product.name).toBe(productData.name);
      expect(response.body.data.product.slug).toBeDefined();
      expect(response.body.data.product.sku).toBeDefined();
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        name: 'Produit Incomplet'
        // Manque description, storeId, categoryId, price
      };

      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required');
    });

    it('should not allow customer to create products', async () => {
      const productData = {
        name: 'Produit Non Autorisé',
        description: 'Description',
        storeId: store.id,
        categoryId: category.id,
        price: 25000,
        stockQuantity: 10
      };

      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(productData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should not allow vendor to create product in other vendor store', async () => {
      const productData = {
        name: 'Produit Volé',
        description: 'Tentative de création dans une autre boutique',
        storeId: anotherStore.id, // Boutique d'un autre vendeur
        categoryId: category.id,
        price: 25000,
        stockQuantity: 10
      };

      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(productData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should validate price is positive', async () => {
      const productData = {
        name: 'Produit Prix Négatif',
        description: 'Description',
        storeId: store.id,
        categoryId: category.id,
        price: -1000, // Prix négatif
        stockQuantity: 10
      };

      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(productData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /products/:id', () => {
    it('should update product by owner', async () => {
      const updateData = {
        name: 'Robe Kente Mise à Jour',
        price: 50000,
        stockQuantity: 20
      };

      const response = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product.name).toBe(updateData.name);
      expect(response.body.data.product.price).toBe(updateData.price);
    });

    it('should not allow other vendor to update product', async () => {
      const updateData = {
        name: 'Tentative de Modification'
      };

      const response = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${anotherVendorToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should allow admin to update any product', async () => {
      const updateData = {
        name: 'Mise à Jour Admin',
        isActive: false
      };

      const response = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product.name).toBe(updateData.name);
    });

    it('should not allow customer to update products', async () => {
      const updateData = {
        name: 'Tentative Client'
      };

      const response = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /products/:id', () => {
    it('should soft delete product by owner', async () => {
      const response = await request(app)
        .delete(`/products/${product.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Vérifier que le produit est marqué comme supprimé
      const deletedProduct = await Product.findById(product.id, { includeDeleted: true });
      expect(deletedProduct.isActive).toBe(false);
    });

    it('should not allow other vendor to delete product', async () => {
      const response = await request(app)
        .delete(`/products/${product.id}`)
        .set('Authorization', `Bearer ${anotherVendorToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should allow admin to delete any product', async () => {
      const response = await request(app)
        .delete(`/products/${product.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /products/:id/images', () => {
    it('should upload product images', async () => {
      const response = await request(app)
        .post(`/products/${product.id}/images`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .attach('images', Buffer.from('fake-image-1'), 'image1.jpg')
        .attach('images', Buffer.from('fake-image-2'), 'image2.jpg')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product.images).toHaveLength(2);
    });

    it('should validate image file types', async () => {
      const response = await request(app)
        .post(`/products/${product.id}/images`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .attach('images', Buffer.from('fake-content'), 'document.txt')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('type');
    });

    it('should limit number of images', async () => {
      const files = Array(11).fill().map((_, i) => ({ // Plus de 10 images
        buffer: Buffer.from(`fake-image-${i}`),
        filename: `image${i}.jpg`
      }));

      let request_builder = request(app)
        .post(`/products/${product.id}/images`)
        .set('Authorization', `Bearer ${vendorToken}`);

      files.forEach(file => {
        request_builder = request_builder.attach('images', file.buffer, file.filename);
      });

      const response = await request_builder.expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('limit');
    });
  });

  describe('PUT /products/:id/stock', () => {
    it('should update stock quantity', async () => {
      const stockData = {
        quantity: 25,
        operation: 'set' // ou 'add', 'subtract'
      };

      const response = await request(app)
        .put(`/products/${product.id}/stock`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(stockData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product.stockQuantity).toBe(25);
    });

    it('should add to stock', async () => {
      const initialStock = product.stockQuantity;
      const stockData = {
        quantity: 10,
        operation: 'add'
      };

      const response = await request(app)
        .put(`/products/${product.id}/stock`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(stockData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product.stockQuantity).toBe(initialStock + 10);
    });

    it('should not allow negative stock', async () => {
      const stockData = {
        quantity: 1000,
        operation: 'subtract' // Plus que le stock disponible
      };

      const response = await request(app)
        .put(`/products/${product.id}/stock`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send(stockData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /products/:id/reviews', () => {
    it('should return product reviews', async () => {
      const response = await request(app)
        .get(`/products/${product.id}/reviews`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reviews).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter reviews by rating', async () => {
      const response = await request(app)
        .get(`/products/${product.id}/reviews?rating=5`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reviews.every(r => r.rating === 5)).toBe(true);
    });
  });

  describe('GET /products/featured', () => {
    it('should return featured products', async () => {
      // Marquer le produit comme featured
      await Product.update(product.id, { isFeatured: true });

      const response = await request(app)
        .get('/products/featured')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products.length).toBeGreaterThan(0);
      expect(response.body.data.products.every(p => p.isFeatured === true)).toBe(true);
    });
  });

  describe('GET /products/trending', () => {
    it('should return trending products', async () => {
      const response = await request(app)
        .get('/products/trending')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toBeDefined();
      // Les produits tendance sont triés par vues, commandes, etc.
    });
  });

  describe('Product Analytics', () => {
    it('should track product views', async () => {
      const initialViews = product.viewCount || 0;

      // Voir le produit plusieurs fois
      await request(app).get(`/products/${product.id}`);
      await request(app).get(`/products/${product.id}`);
      await request(app).get(`/products/${product.id}`);

      const updatedProduct = await Product.findById(product.id);
      expect(updatedProduct.viewCount).toBe(initialViews + 3);
    });

    it('should get product analytics for admin', async () => {
      const response = await request(app)
        .get(`/products/${product.id}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.analytics).toBeDefined();
      expect(response.body.data.analytics.views).toBeDefined();
    });

    it('should get product analytics for owner', async () => {
      const response = await request(app)
        .get(`/products/${product.id}/analytics`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.analytics).toBeDefined();
    });

    it('should deny analytics access to other vendors', async () => {
      const response = await request(app)
        .get(`/products/${product.id}/analytics`)
        .set('Authorization', `Bearer ${anotherVendorToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });
});