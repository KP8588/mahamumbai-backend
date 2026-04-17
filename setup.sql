-- =========================================
-- MAHA MUMBAI CONNECT - DATABASE SETUP
-- Run this in your PostgreSQL database
-- =========================================

-- Create database (run separately if needed)
-- CREATE DATABASE digital_card_db;

-- ─── USERS TABLE ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── DIGITAL CARDS TABLE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digital_cards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  slug VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  designation VARCHAR(255),
  company_name VARCHAR(255),
  phone VARCHAR(50),
  whatsapp VARCHAR(50),
  email VARCHAR(255),
  website TEXT,
  address TEXT,
  about TEXT,
  selected_theme VARCHAR(100) DEFAULT 'minimal-elegant',
  profile_photo_url TEXT,
  logo_url TEXT,
  background_image_url TEXT,
  social_links JSONB DEFAULT '{}',
  is_locked BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── SUBSCRIPTIONS TABLE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  plan_type VARCHAR(50) NOT NULL,
  payment_id VARCHAR(255),
  order_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  start_date TIMESTAMP DEFAULT NOW(),
  expiry_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── APPOINTMENTS TABLE ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  service VARCHAR(255) NOT NULL,
  preferred_date DATE,
  preferred_time VARCHAR(50),
  message TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON digital_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_slug ON digital_cards(slug);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Done!
SELECT 'Database setup complete ✅' as status;
