require('dotenv').config({ path: '.env.test' });

const knex = require('knex');
const knexConfig = require('../knexfile');

// Configuration de test pour la base de données
const db = knex(knexConfig.test);

// Setup global avant tous les tests
beforeAll(async () => {
  console.log('🔧 Initialisation des tests...');
  
  // Migrer la base de données de test
  try {
    await db.migrate.latest();
    console.log('✅ Migrations appliquées');
  } catch (error) {
    console.error('❌ Erreur lors des migrations:', error);
    process.exit(1);
  }
});

// Nettoyage après tous les tests
afterAll(async () => {
  console.log('🧹 Nettoyage des tests...');
  
  try {
    // Rollback de toutes les migrations pour nettoyer
    await db.migrate.rollback({ all: true });
    await db.destroy();
    console.log('✅ Base de données nettoyée');
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  }
});

// Nettoyage avant chaque test
beforeEach(async () => {
  // Vider les tables dans l'ordre pour respecter les contraintes de clés étrangères
  const tables = [
    'order_items',
    'payments', 
    'reviews',
    'orders',
    'products',
    'stores',
    'categories',
    'users'
  ];
  
  for (const table of tables) {
    try {
      await db(table).del();
    } catch (error) {
      // Ignorer les erreurs de tables qui n'existent pas encore
      if (!error.message.includes('does not exist')) {
        console.error(`Erreur lors du nettoyage de la table ${table}:`, error);
      }
    }
  }
});

// Configuration globale des timeouts
jest.setTimeout(30000);

// Export pour utilisation dans les tests
module.exports = {
  db,
  testDb: db
};