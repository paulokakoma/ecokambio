-- Migration: 001_ecoflix_coupons
-- Description: Add coupons table, link to partners, and support for inventory tags.

-- 1. Create Coupons Table
CREATE TABLE IF NOT EXISTS ecoflix_coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE, -- e.g., 'PANDORA', 'CHELCIA'
    partner_name TEXT NOT NULL, -- e.g., 'Chelcia'
    discount_amount DECIMAL(10,2) DEFAULT 0, -- Optional discount
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, EXPIRED
    inventory_tag TEXT, -- Optional: links to specific inventory batch (e.g., 'lote_chelcia')
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add 'coupon_used' to Orders
ALTER TABLE ecoflix_orders 
ADD COLUMN IF NOT EXISTS coupon_used TEXT;

-- 3. Add 'tags' to Master Accounts (Inventory)
-- This allows us to tag accounts like 'lote_chelcia'
ALTER TABLE ecoflix_master_accounts
ADD COLUMN IF NOT EXISTS tags TEXT[]; 

-- 4. Index for performance
CREATE INDEX IF NOT EXISTS idx_coupons_code ON ecoflix_coupons(code);
CREATE INDEX IF NOT EXISTS idx_accounts_tags ON ecoflix_master_accounts USING GIN (tags);

-- 5. RPC to check inventory availability by tag
-- Usage: SELECT check_tagged_stock('lote_chelcia');
CREATE OR REPLACE FUNCTION check_tagged_stock(tag_name TEXT)
RETURNS INTEGER AS $$
DECLARE
    available_count INTEGER;
BEGIN
    SELECT COUNT(p.id) INTO available_count
    FROM ecoflix_profiles p
    JOIN ecoflix_master_accounts a ON p.master_account_id = a.id
    WHERE p.status = 'AVAILABLE'
    AND a.status = 'ACTIVE'
    AND tag_name = ANY(a.tags);
    
    RETURN available_count;
END;
$$ LANGUAGE plpgsql;
