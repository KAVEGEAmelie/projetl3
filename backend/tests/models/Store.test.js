const Store = require('../../src/models/Store');
const User = require('../../src/models/User');

describe('Store Model', () => {
  let owner;
  
  beforeEach(async () => {
    // Créer un propriétaire de boutique
    owner = await User.create({
      email: 'owner@test.com',
      password: 'Password123!',
      firstName: 'Store',
      lastName: 'Owner',
      role: 'vendor'
    });
  });

  describe('create', () => {
    it('should create a new store', async () => {
      const storeData = {
        name: 'AfrikMode Boutique',
        description: 'Une belle boutique de mode africaine',
        ownerId: owner.id,
        city: 'Lomé',
        country: 'TG',
        address: '123 Rue de la Mode, Lomé'
      };

      const store = await Store.create(storeData);

      expect(store).toBeDefined();
      expect(store.id).toBeDefined();
      expect(store.name).toBe(storeData.name);
      expect(store.slug).toBe('afrikmode-boutique');
      expect(store.description).toBe(storeData.description);
      expect(store.ownerId).toBe(owner.id);
      expect(store.isActive).toBe(true);
      expect(store.isVerified).toBe(false);
    });

    it('should generate unique slug', async () => {
      const storeData1 = {
        name: 'Test Store',
        description: 'Test description',
        ownerId: owner.id,
        city: 'Lomé',
        country: 'TG',
        address: '123 Test Street'
      };

      const storeData2 = {
        name: 'Test Store',
        description: 'Another test description',
        ownerId: owner.id,
        city: 'Lomé',
        country: 'TG',
        address: '456 Test Avenue'
      };

      const store1 = await Store.create(storeData1);
      const store2 = await Store.create(storeData2);

      expect(store1.slug).toBe('test-store');
      expect(store2.slug).toBe('test-store-1');
    });

    it('should set default values', async () => {
      const minimalData = {
        name: 'Minimal Store',
        description: 'Minimal description',
        ownerId: owner.id,
        city: 'Lomé',
        address: '123 Minimal Street'
      };

      const store = await Store.create(minimalData);

      expect(store.country).toBe('TG');
      expect(store.businessType).toBe('fashion');
      expect(store.deliveryFee).toBe(0);
      expect(store.minOrderAmount).toBe(0);
      expect(store.currency).toBe('FCFA');
    });
  });

  describe('findBySlug', () => {
    it('should find store by slug', async () => {
      const storeData = {
        name: 'Findable Store',
        description: 'A store to find',
        ownerId: owner.id,
        city: 'Lomé',
        address: '123 Find Street'
      };

      const createdStore = await Store.create(storeData);
      const foundStore = await Store.findBySlug('findable-store');

      expect(foundStore).toBeDefined();
      expect(foundStore.id).toBe(createdStore.id);
      expect(foundStore.slug).toBe('findable-store');
    });

    it('should return null for non-existent slug', async () => {
      const store = await Store.findBySlug('non-existent-store');
      expect(store).toBeNull();
    });
  });

  describe('findByOwner', () => {
    it('should find stores by owner', async () => {
      await Store.create({
        name: 'Store 1',
        description: 'First store',
        ownerId: owner.id,
        city: 'Lomé',
        address: '123 Store Street'
      });

      await Store.create({
        name: 'Store 2',
        description: 'Second store',
        ownerId: owner.id,
        city: 'Lomé',
        address: '456 Store Avenue'
      });

      const stores = await Store.findByOwner(owner.id);

      expect(stores).toHaveLength(2);
      expect(stores.every(store => store.ownerId === owner.id)).toBe(true);
    });
  });

  describe('findByLocation', () => {
    it('should find stores by city', async () => {
      await Store.create({
        name: 'Lomé Store',
        description: 'Store in Lomé',
        ownerId: owner.id,
        city: 'Lomé',
        address: '123 Lomé Street'
      });

      await Store.create({
        name: 'Kara Store',
        description: 'Store in Kara',
        ownerId: owner.id,
        city: 'Kara',
        address: '456 Kara Street'
      });

      const lomeStores = await Store.findByLocation('Lomé');
      
      expect(lomeStores).toHaveLength(1);
      expect(lomeStores[0].city).toBe('Lomé');
    });
  });

  describe('updateById', () => {
    it('should update store information', async () => {
      const store = await Store.create({
        name: 'Update Store',
        description: 'Store to update',
        ownerId: owner.id,
        city: 'Lomé',
        address: '123 Update Street'
      });

      const updates = {
        description: 'Updated description',
        phone: '+22870123456',
        email: 'updated@store.com'
      };

      const updatedStore = await Store.updateById(store.id, updates);

      expect(updatedStore.description).toBe(updates.description);
      expect(updatedStore.phone).toBe(updates.phone);
      expect(updatedStore.email).toBe(updates.email);
      expect(updatedStore.name).toBe('Update Store'); // Should remain unchanged
    });

    it('should not allow updating owner through regular update', async () => {
      const store = await Store.create({
        name: 'Secure Store',
        description: 'Secure store',
        ownerId: owner.id,
        city: 'Lomé',
        address: '123 Secure Street'
      });

      const anotherOwner = await User.create({
        email: 'another@test.com',
        password: 'Password123!',
        firstName: 'Another',
        lastName: 'Owner',
        role: 'vendor'
      });

      const maliciousUpdate = {
        ownerId: anotherOwner.id
      };

      const updatedStore = await Store.updateById(store.id, maliciousUpdate);

      expect(updatedStore.ownerId).toBe(owner.id); // Should remain unchanged
    });
  });

  describe('verify', () => {
    it('should verify a store', async () => {
      const store = await Store.create({
        name: 'Verify Store',
        description: 'Store to verify',
        ownerId: owner.id,
        city: 'Lomé',
        address: '123 Verify Street'
      });

      expect(store.isVerified).toBe(false);

      const verifiedStore = await Store.verify(store.id);

      expect(verifiedStore.isVerified).toBe(true);
      expect(verifiedStore.verifiedAt).toBeDefined();
    });
  });

  describe('suspend', () => {
    it('should suspend a store', async () => {
      const store = await Store.create({
        name: 'Suspend Store',
        description: 'Store to suspend',
        ownerId: owner.id,
        city: 'Lomé',
        address: '123 Suspend Street'
      });

      expect(store.isActive).toBe(true);

      const suspendedStore = await Store.suspend(store.id, 'Violation of terms');

      expect(suspendedStore.isActive).toBe(false);
      expect(suspendedStore.suspendedAt).toBeDefined();
      expect(suspendedStore.suspensionReason).toBe('Violation of terms');
    });
  });

  describe('getStatistics', () => {
    it('should return store statistics', async () => {
      await Store.create({
        name: 'Stats Store 1',
        description: 'Stats store 1',
        ownerId: owner.id,
        city: 'Lomé',
        address: '123 Stats Street'
      });

      await Store.create({
        name: 'Stats Store 2',
        description: 'Stats store 2',
        ownerId: owner.id,
        city: 'Kara',
        address: '456 Stats Avenue'
      });

      const stats = await Store.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalStores).toBeGreaterThan(0);
      expect(stats.activeStores).toBeGreaterThan(0);
      expect(stats.verifiedStores).toBeDefined();
      expect(stats.locationDistribution).toBeDefined();
    });
  });

  describe('findNearby', () => {
    it('should find stores near coordinates', async () => {
      await Store.create({
        name: 'Nearby Store',
        description: 'Store nearby',
        ownerId: owner.id,
        city: 'Lomé',
        address: '123 Nearby Street',
        latitude: 6.1319,
        longitude: 1.2228
      });

      // Coordonnées proches de Lomé
      const nearbyStores = await Store.findNearby(6.1300, 1.2200, 10);

      expect(nearbyStores).toHaveLength(1);
      expect(nearbyStores[0].name).toBe('Nearby Store');
    });
  });

  describe('addSpecialty', () => {
    it('should add specialty to store', async () => {
      const store = await Store.create({
        name: 'Specialty Store',
        description: 'Store with specialties',
        ownerId: owner.id,
        city: 'Lomé',
        address: '123 Specialty Street'
      });

      const updatedStore = await Store.addSpecialty(store.id, 'Kente Cloth');

      expect(updatedStore.specialties).toContain('Kente Cloth');
    });
  });

  describe('deleteById', () => {
    it('should soft delete store', async () => {
      const store = await Store.create({
        name: 'Delete Store',
        description: 'Store to delete',
        ownerId: owner.id,
        city: 'Lomé',
        address: '123 Delete Street'
      });

      const result = await Store.deleteById(store.id);

      expect(result).toBe(true);

      const deletedStore = await Store.findById(store.id);
      expect(deletedStore).toBeNull();
    });
  });
});