const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "digital_card_db",
  password: process.env.DB_PASS || "root",
  port: process.env.DB_PORT || 5432,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Database connection error:", err.stack);
    return;
  }
  console.log("✅ PostgreSQL Connected");
  release();
});

module.exports = pool;
