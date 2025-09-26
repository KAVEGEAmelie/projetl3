const knex = require('knex');
require('dotenv').config();

// Database configuration for different environments
const config = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'afrikmode_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 600000
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './seeds'
    },
    debug: process.env.NODE_ENV === 'development'
  },
  
  test: {
    client: 'postgresql',
    connection: {
      host: process.env.TEST_DB_HOST || 'localhost',
      port: process.env.TEST_DB_PORT || 5432,
      database: process.env.TEST_DB_NAME || 'afrikmode_test_db',
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || '',
      ssl: false
    },
    pool: {
      min: 1,
      max: 5
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './seeds'
    }
  },
  
  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 5,
      max: 50,
      acquireTimeoutMillis: 60000,
      idleTimeoutMillis: 600000
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './seeds'
    }
  }
};

const environment = process.env.NODE_ENV || 'development';
const db = knex(config[environment]);

// Test database connection
db.raw('SELECT 1')
  .then(() => {
    console.log('✅ Database connection established successfully');
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
  });

// Helper functions for common database operations
const dbHelpers = {
  // Paginate results
  paginate: async (query, page = 1, limit = 10) => {
    const offset = (page - 1) * limit;
    
    const [results, total] = await Promise.all([
      query.clone().limit(limit).offset(offset),
      query.clone().count('* as count').first()
    ]);
    
    return {
      data: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.count),
        pages: Math.ceil(total.count / limit),
        hasNext: page * limit < total.count,
        hasPrev: page > 1
      }
    };
  },

  // Soft delete
  softDelete: async (table, id, userId = null) => {
    return db(table)
      .where('id', id)
      .update({
        deleted_at: db.fn.now(),
        deleted_by: userId
      });
  },

  // Restore soft deleted record
  restore: async (table, id) => {
    return db(table)
      .where('id', id)
      .update({
        deleted_at: null,
        deleted_by: null
      });
  },

  // Get active records (not soft deleted)
  getActive: (table) => {
    return db(table).whereNull('deleted_at');
  },

  // Create with timestamps
  create: async (table, data, userId = null) => {
    const timestamp = db.fn.now();
    return db(table)
      .insert({
        ...data,
        created_at: timestamp,
        updated_at: timestamp,
        created_by: userId
      })
      .returning('*');
  },

  // Update with timestamps
  update: async (table, id, data, userId = null) => {
    return db(table)
      .where('id', id)
      .update({
        ...data,
        updated_at: db.fn.now(),
        updated_by: userId
      })
      .returning('*');
  },

  // Multi-tenant query builder
  tenant: (table, tenantId) => {
    return db(table).where('tenant_id', tenantId);
  }
};

// Export database instance and helpers
module.exports = {
  ...db,
  helpers: dbHelpers,
  config: config[environment]
};