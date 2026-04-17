-- Run this to fix the missing avatar_url column
-- psql -U postgres -d digital_card_db -f fix_db.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE digital_cards ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50);
ALTER TABLE digital_cards ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE digital_cards ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE digital_cards ADD COLUMN IF NOT EXISTS background_image_url TEXT;
ALTER TABLE digital_cards ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE digital_cards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS order_id VARCHAR(255);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS start_date TIMESTAMP DEFAULT NOW();

SELECT 'Database columns fixed ✅' as status;
