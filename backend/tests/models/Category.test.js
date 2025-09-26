const Category = require('../../src/models/Category');

describe('Category Model', () => {
  describe('create', () => {
    it('should create a root category', async () => {
      const categoryData = {
        name: 'Women Fashion',
        description: 'Fashion items for women'
      };

      const category = await Category.create(categoryData);

      expect(category).toBeDefined();
      expect(category.id).toBeDefined();
      expect(category.name).toBe(categoryData.name);
      expect(category.slug).toBe('women-fashion');
      expect(category.description).toBe(categoryData.description);
      expect(category.parentId).toBeNull();
      expect(category.level).toBe(0);
      expect(category.path).toBe('0');
      expect(category.isActive).toBe(true);
      expect(category.sortOrder).toBe(0);
    });

    it('should create a child category', async () => {
      const parentCategory = await Category.create({
        name: 'Parent Category',
        description: 'Parent category description'
      });

      const childData = {
        name: 'Child Category',
        description: 'Child category description',
        parentId: parentCategory.id
      };

      const childCategory = await Category.create(childData);

      expect(childCategory.parentId).toBe(parentCategory.id);
      expect(childCategory.level).toBe(1);
      expect(childCategory.path).toBe(`0.1`);
      expect(childCategory.slug).toBe('child-category');
    });

    it('should generate unique slug', async () => {
      const categoryData1 = {
        name: 'Test Category',
        description: 'Test description'
      };

      const categoryData2 = {
        name: 'Test Category',
        description: 'Another test description'
      };

      const category1 = await Category.create(categoryData1);
      const category2 = await Category.create(categoryData2);

      expect(category1.slug).toBe('test-category');
      expect(category2.slug).toBe('test-category-1');
    });
  });

  describe('findBySlug', () => {
    it('should find category by slug', async () => {
      const categoryData = {
        name: 'Findable Category',
        description: 'A category to find'
      };

      const createdCategory = await Category.create(categoryData);
      const foundCategory = await Category.findBySlug('findable-category');

      expect(foundCategory).toBeDefined();
      expect(foundCategory.id).toBe(createdCategory.id);
      expect(foundCategory.slug).toBe('findable-category');
    });

    it('should return null for non-existent slug', async () => {
      const category = await Category.findBySlug('non-existent-category');
      expect(category).toBeNull();
    });
  });

  describe('findByParent', () => {
    it('should find child categories', async () => {
      const parent = await Category.create({
        name: 'Parent Category',
        description: 'Parent description'
      });

      await Category.create({
        name: 'Child 1',
        description: 'First child',
        parentId: parent.id
      });

      await Category.create({
        name: 'Child 2',
        description: 'Second child',
        parentId: parent.id
      });

      const children = await Category.findByParent(parent.id);

      expect(children).toHaveLength(2);
      expect(children.every(child => child.parentId === parent.id)).toBe(true);
    });

    it('should find root categories when parentId is null', async () => {
      await Category.create({
        name: 'Root 1',
        description: 'First root'
      });

      await Category.create({
        name: 'Root 2',
        description: 'Second root'
      });

      const rootCategories = await Category.findByParent(null);

      expect(rootCategories.length).toBeGreaterThanOrEqual(2);
      expect(rootCategories.every(cat => cat.parentId === null)).toBe(true);
    });
  });

  describe('getTree', () => {
    it('should build category tree', async () => {
      // Créer une hiérarchie de catégories
      const root = await Category.create({
        name: 'Root',
        description: 'Root category'
      });

      const child1 = await Category.create({
        name: 'Child 1',
        description: 'First child',
        parentId: root.id
      });

      const child2 = await Category.create({
        name: 'Child 2',
        description: 'Second child',
        parentId: root.id
      });

      const grandchild = await Category.create({
        name: 'Grandchild',
        description: 'Grandchild of root',
        parentId: child1.id
      });

      const tree = await Category.getTree();

      expect(Array.isArray(tree)).toBe(true);
      expect(tree.length).toBeGreaterThan(0);
      
      // Trouver notre catégorie racine dans l'arbre
      const rootInTree = tree.find(cat => cat.id === root.id);
      expect(rootInTree).toBeDefined();
      expect(rootInTree.children).toHaveLength(2);
      
      // Vérifier que le premier enfant a un petit-enfant
      const child1InTree = rootInTree.children.find(child => child.id === child1.id);
      expect(child1InTree.children).toHaveLength(1);
      expect(child1InTree.children[0].id).toBe(grandchild.id);
    });
  });

  describe('getBreadcrumb', () => {
    it('should return breadcrumb path', async () => {
      const root = await Category.create({
        name: 'Root',
        description: 'Root category'
      });

      const child = await Category.create({
        name: 'Child',
        description: 'Child category',
        parentId: root.id
      });

      const grandchild = await Category.create({
        name: 'Grandchild',
        description: 'Grandchild category',
        parentId: child.id
      });

      const breadcrumb = await Category.getBreadcrumb(grandchild.id);

      expect(breadcrumb).toHaveLength(3);
      expect(breadcrumb[0].id).toBe(root.id);
      expect(breadcrumb[1].id).toBe(child.id);
      expect(breadcrumb[2].id).toBe(grandchild.id);
    });
  });

  describe('updateById', () => {
    it('should update category information', async () => {
      const category = await Category.create({
        name: 'Update Category',
        description: 'Category to update'
      });

      const updates = {
        description: 'Updated description',
        sortOrder: 10,
        featured: true
      };

      const updatedCategory = await Category.updateById(category.id, updates);

      expect(updatedCategory.description).toBe(updates.description);
      expect(updatedCategory.sortOrder).toBe(updates.sortOrder);
      expect(updatedCategory.featured).toBe(updates.featured);
      expect(updatedCategory.name).toBe('Update Category'); // Should remain unchanged
    });
  });

  describe('moveCategory', () => {
    it('should move category to new parent', async () => {
      const oldParent = await Category.create({
        name: 'Old Parent',
        description: 'Old parent category'
      });

      const newParent = await Category.create({
        name: 'New Parent',
        description: 'New parent category'
      });

      const category = await Category.create({
        name: 'Movable Category',
        description: 'Category to move',
        parentId: oldParent.id
      });

      expect(category.parentId).toBe(oldParent.id);
      expect(category.level).toBe(1);

      const movedCategory = await Category.moveCategory(category.id, newParent.id);

      expect(movedCategory.parentId).toBe(newParent.id);
      // Level should be recalculated
      expect(movedCategory.level).toBe(1);
    });

    it('should move category to root level', async () => {
      const parent = await Category.create({
        name: 'Parent',
        description: 'Parent category'
      });

      const category = await Category.create({
        name: 'Child to Root',
        description: 'Child that will become root',
        parentId: parent.id
      });

      expect(category.level).toBe(1);

      const movedCategory = await Category.moveCategory(category.id, null);

      expect(movedCategory.parentId).toBeNull();
      expect(movedCategory.level).toBe(0);
    });
  });

  describe('updateProductCount', () => {
    it('should update products count', async () => {
      const category = await Category.create({
        name: 'Count Category',
        description: 'Category for count test'
      });

      expect(category.productsCount).toBe(0);

      const updatedCategory = await Category.updateProductCount(category.id, 5);

      expect(updatedCategory.productsCount).toBe(5);
    });
  });

  describe('getFeatured', () => {
    it('should return featured categories', async () => {
      await Category.create({
        name: 'Featured 1',
        description: 'First featured category',
        featured: true
      });

      await Category.create({
        name: 'Featured 2',
        description: 'Second featured category',
        featured: true
      });

      await Category.create({
        name: 'Not Featured',
        description: 'Not featured category',
        featured: false
      });

      const featuredCategories = await Category.getFeatured();

      expect(featuredCategories).toHaveLength(2);
      expect(featuredCategories.every(cat => cat.featured === true)).toBe(true);
    });
  });

  describe('getStatistics', () => {
    it('should return category statistics', async () => {
      await Category.create({
        name: 'Stats Category 1',
        description: 'Stats category 1',
        isActive: true
      });

      await Category.create({
        name: 'Stats Category 2',
        description: 'Stats category 2',
        isActive: false
      });

      const stats = await Category.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalCategories).toBeGreaterThan(0);
      expect(stats.activeCategories).toBeGreaterThan(0);
      expect(stats.levelDistribution).toBeDefined();
    });
  });

  describe('deleteById', () => {
    it('should soft delete category', async () => {
      const category = await Category.create({
        name: 'Delete Category',
        description: 'Category to delete'
      });

      const result = await Category.deleteById(category.id);

      expect(result).toBe(true);

      const deletedCategory = await Category.findById(category.id);
      expect(deletedCategory).toBeNull();
    });

    it('should not delete category with children', async () => {
      const parent = await Category.create({
        name: 'Parent with Child',
        description: 'Parent category'
      });

      await Category.create({
        name: 'Child',
        description: 'Child category',
        parentId: parent.id
      });

      await expect(Category.deleteById(parent.id)).rejects.toThrow();
    });
  });
});