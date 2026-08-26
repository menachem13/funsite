const { Pool } = require('pg');
const config = require('../config');

// Managed Postgres providers (Supabase, Neon, Render, etc.) terminate with
// certs Node's default trust store doesn't always chain — rejectUnauthorized:
// false is the standard pragmatic setting for these in production. Local dev
// Postgres has no SSL listener at all, so SSL must stay off there.
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
