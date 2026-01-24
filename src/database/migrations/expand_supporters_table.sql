-- Migration: Expand supporters table for partner/advertiser management
-- Date: 2026-01-19

-- Add new columns to supporters table
ALTER TABLE supporters 
ADD COLUMN IF NOT EXISTS partner_type TEXT DEFAULT 'affiliate' CHECK (partner_type IN ('affiliate', 'advertiser')),
ADD COLUMN IF NOT EXISTS affiliate_link TEXT,
ADD COLUMN IF NOT EXISTS monthly_fee INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_code TEXT,
ADD COLUMN IF NOT EXISTS referral_url TEXT;

-- Add index for partner_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_supporters_partner_type ON supporters(partner_type);

-- Add comment to describe the columns
COMMENT ON COLUMN supporters.partner_type IS 'Type of partner: affiliate (earns commission) or advertiser (pays monthly fee)';
COMMENT ON COLUMN supporters.affiliate_link IS 'Tracking link for affiliate partners';
COMMENT ON COLUMN supporters.monthly_fee IS 'Monthly fee in Kwanzas for advertisers';
COMMENT ON COLUMN supporters.start_date IS 'Contract start date';
COMMENT ON COLUMN supporters.end_date IS 'Contract end date';
COMMENT ON COLUMN supporters.clicks IS 'Number of clicks on the banner';
COMMENT ON COLUMN supporters.referral_code IS 'Short referral code (e.g., B9RRL4K, PANDORA)';
COMMENT ON COLUMN supporters.referral_url IS 'Full referral URL with tracking code';
