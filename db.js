const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // required for Render PostgreSQL
  },
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Database connection error:", err.stack);
    return;
  }
  console.log("✅ PostgreSQL Connected");
  release();
});

module.exports = pool;