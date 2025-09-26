const Product = require('../../src/models/Product');
const Store = require('../../src/models/Store');
const Category = require('../../src/models/Category');
const User = require('../../src/models/User');

describe('Product Model', () => {
  let store, category, owner;

  beforeEach(async () => {
    // Créer un propriétaire de boutique
    owner = await User.create({
      email: 'product-owner@test.com',
      password: 'Password123!',
      firstName: 'Product',
      lastName: 'Owner',
      role: 'vendor'
    });

    // Créer une boutique
    store = await Store.create({
      name: 'Product Store',
      description: 'Store for product tests',
      ownerId: owner.id,
      city: 'Lomé',
      address: '123 Product Street'
    });

    // Créer une catégorie
    category = await Category.create({
      name: 'Test Category',
      description: 'Category for product tests'
    });
  });

  describe('create', () => {
    it('should create a new product', async () => {
      const productData = {
        name: 'Beautiful Kente Dress',
        description: 'A beautiful traditional Kente dress',
        shortDescription: 'Traditional Kente dress',
        storeId: store.id,
        categoryId: category.id,
        price: 50000,
        currency: 'FCFA',
        fabricType: 'Kente',
        fabricOrigin: 'Ghana',
        genderTarget: 'female',
        stockQuantity: 10
      };

      const product = await Product.create(productData);

      expect(product).toBeDefined();
      expect(product.id).toBeDefined();
      expect(product.name).toBe(productData.name);
      expect(product.slug).toBe('beautiful-kente-dress');
      expect(product.description).toBe(productData.description);
      expect(product.price).toBe(productData.price);
      expect(product.status).toBe('active');
      expect(product.views).toBe(0);
      expect(product.sales).toBe(0);
    });

    it('should generate unique slug', async () => {
      const productData1 = {
        name: 'Test Product',
        description: 'Test description',
        storeId: store.id,
        categoryId: category.id,
        price: 25000
      };

      const productData2 = {
        name: 'Test Product',
        description: 'Another test description',
        storeId: store.id,
        categoryId: category.id,
        price: 30000
      };

      const product1 = await Product.create(productData1);
      const product2 = await Product.create(productData2);

      expect(product1.slug).toBe('test-product');
      expect(product2.slug).toBe('test-product-1');
    });

    it('should set default values', async () => {
      const minimalData = {
        name: 'Minimal Product',
        description: 'Minimal description',
        storeId: store.id,
        categoryId: category.id,
        price: 15000
      };

      const product = await Product.create(minimalData);

      expect(product.currency).toBe('FCFA');
      expect(product.genderTarget).toBe('unisex');
      expect(product.ageGroup).toBe('adult');
      expect(product.season).toBe('all');
      expect(product.stockQuantity).toBe(0);
      expect(product.lowStockThreshold).toBe(5);
    });
  });

  describe('findBySlug', () => {
    it('should find product by slug', async () => {
      const productData = {
        name: 'Findable Product',
        description: 'A product to find',
        storeId: store.id,
        categoryId: category.id,
        price: 20000
      };

      const createdProduct = await Product.create(productData);
      const foundProduct = await Product.findBySlug('findable-product');

      expect(foundProduct).toBeDefined();
      expect(foundProduct.id).toBe(createdProduct.id);
      expect(foundProduct.slug).toBe('findable-product');
    });

    it('should return null for non-existent slug', async () => {
      const product = await Product.findBySlug('non-existent-product');
      expect(product).toBeNull();
    });
  });

  describe('findByStore', () => {
    it('should find products by store', async () => {
      await Product.create({
        name: 'Store Product 1',
        description: 'First store product',
        storeId: store.id,
        categoryId: category.id,
        price: 20000
      });

      await Product.create({
        name: 'Store Product 2',
        description: 'Second store product',
        storeId: store.id,
        categoryId: category.id,
        price: 25000
      });

      const products = await Product.findByStore(store.id);

      expect(products).toHaveLength(2);
      expect(products.every(product => product.storeId === store.id)).toBe(true);
    });
  });

  describe('findByCategory', () => {
    it('should find products by category', async () => {
      await Product.create({
        name: 'Category Product 1',
        description: 'First category product',
        storeId: store.id,
        categoryId: category.id,
        price: 20000
      });

      await Product.create({
        name: 'Category Product 2',
        description: 'Second category product',
        storeId: store.id,
        categoryId: category.id,
        price: 25000
      });

      const products = await Product.findByCategory(category.id);

      expect(products).toHaveLength(2);
      expect(products.every(product => product.categoryId === category.id)).toBe(true);
    });
  });

  describe('updateById', () => {
    it('should update product information', async () => {
      const product = await Product.create({
        name: 'Update Product',
        description: 'Product to update',
        storeId: store.id,
        categoryId: category.id,
        price: 20000
      });

      const updates = {
        description: 'Updated description',
        price: 22000,
        stockQuantity: 15
      };

      const updatedProduct = await Product.updateById(product.id, updates);

      expect(updatedProduct.description).toBe(updates.description);
      expect(updatedProduct.price).toBe(updates.price);
      expect(updatedProduct.stockQuantity).toBe(updates.stockQuantity);
      expect(updatedProduct.name).toBe('Update Product'); // Should remain unchanged
    });

    it('should not allow updating store through regular update', async () => {
      const product = await Product.create({
        name: 'Secure Product',
        description: 'Secure product',
        storeId: store.id,
        categoryId: category.id,
        price: 20000
      });

      // Créer une autre boutique
      const anotherOwner = await User.create({
        email: 'another-product-owner@test.com',
        password: 'Password123!',
        firstName: 'Another',
        lastName: 'Owner',
        role: 'vendor'
      });

      const anotherStore = await Store.create({
        name: 'Another Store',
        description: 'Another store',
        ownerId: anotherOwner.id,
        city: 'Kara',
        address: '456 Another Street'
      });

      const maliciousUpdate = {
        storeId: anotherStore.id
      };

      const updatedProduct = await Product.updateById(product.id, maliciousUpdate);

      expect(updatedProduct.storeId).toBe(store.id); // Should remain unchanged
    });
  });

  describe('updateStock', () => {
    it('should update stock quantity', async () => {
      const product = await Product.create({
        name: 'Stock Product',
        description: 'Product for stock test',
        storeId: store.id,
        categoryId: category.id,
        price: 20000,
        stockQuantity: 10
      });

      const updatedProduct = await Product.updateStock(product.id, 15);

      expect(updatedProduct.stockQuantity).toBe(15);
    });

    it('should not allow negative stock', async () => {
      const product = await Product.create({
        name: 'Negative Stock Product',
        description: 'Product for negative stock test',
        storeId: store.id,
        categoryId: category.id,
        price: 20000,
        stockQuantity: 5
      });

      await expect(Product.updateStock(product.id, -1)).rejects.toThrow();
    });
  });

  describe('incrementViews', () => {
    it('should increment product views', async () => {
      const product = await Product.create({
        name: 'View Product',
        description: 'Product for view test',
        storeId: store.id,
        categoryId: category.id,
        price: 20000
      });

      expect(product.views).toBe(0);

      const updatedProduct = await Product.incrementViews(product.id);

      expect(updatedProduct.views).toBe(1);
    });
  });

  describe('search', () => {
    it('should search products by name', async () => {
      await Product.create({
        name: 'Searchable Kente Dress',
        description: 'A beautiful kente dress',
        storeId: store.id,
        categoryId: category.id,
        price: 30000
      });

      await Product.create({
        name: 'African Print Shirt',
        description: 'A nice african print shirt',
        storeId: store.id,
        categoryId: category.id,
        price: 15000
      });

      const searchResults = await Product.search('kente');

      expect(searchResults.results).toHaveLength(1);
      expect(searchResults.results[0].name).toBe('Searchable Kente Dress');
    });

    it('should search products with filters', async () => {
      await Product.create({
        name: 'Expensive Dress',
        description: 'An expensive dress',
        storeId: store.id,
        categoryId: category.id,
        price: 100000,
        genderTarget: 'female'
      });

      await Product.create({
        name: 'Cheap Shirt',
        description: 'A cheap shirt',
        storeId: store.id,
        categoryId: category.id,
        price: 10000,
        genderTarget: 'male'
      });

      const filters = {
        priceMin: 50000,
        priceMax: 150000,
        genderTarget: 'female'
      };

      const searchResults = await Product.search('', filters);

      expect(searchResults.results).toHaveLength(1);
      expect(searchResults.results[0].name).toBe('Expensive Dress');
    });
  });

  describe('findSimilar', () => {
    it('should find similar products', async () => {
      const mainProduct = await Product.create({
        name: 'Main Kente Product',
        description: 'Main kente product',
        storeId: store.id,
        categoryId: category.id,
        price: 30000,
        fabricType: 'Kente',
        genderTarget: 'female'
      });

      await Product.create({
        name: 'Similar Kente Product',
        description: 'Similar kente product',
        storeId: store.id,
        categoryId: category.id,
        price: 32000,
        fabricType: 'Kente',
        genderTarget: 'female'
      });

      await Product.create({
        name: 'Different Product',
        description: 'Different product',
        storeId: store.id,
        categoryId: category.id,
        price: 15000,
        fabricType: 'Cotton',
        genderTarget: 'male'
      });

      const similarProducts = await Product.findSimilar(mainProduct.id, 5);

      expect(similarProducts).toHaveLength(1);
      expect(similarProducts[0].name).toBe('Similar Kente Product');
    });
  });

  describe('getStatistics', () => {
    it('should return product statistics', async () => {
      await Product.create({
        name: 'Stats Product 1',
        description: 'Stats product 1',
        storeId: store.id,
        categoryId: category.id,
        price: 20000,
        status: 'active'
      });

      await Product.create({
        name: 'Stats Product 2',
        description: 'Stats product 2',
        storeId: store.id,
        categoryId: category.id,
        price: 25000,
        status: 'inactive'
      });

      const stats = await Product.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalProducts).toBeGreaterThan(0);
      expect(stats.activeProducts).toBeGreaterThan(0);
      expect(stats.averagePrice).toBeGreaterThan(0);
    });
  });

  describe('deleteById', () => {
    it('should soft delete product', async () => {
      const product = await Product.create({
        name: 'Delete Product',
        description: 'Product to delete',
        storeId: store.id,
        categoryId: category.id,
        price: 20000
      });

      const result = await Product.deleteById(product.id);

      expect(result).toBe(true);

      const deletedProduct = await Product.findById(product.id);
      expect(deletedProduct).toBeNull();
    });
  });
});