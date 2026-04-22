-- Schema for EcoPay (Isolated within EcoKambio Infrastructure)

-- 1. Profiles Table (KYC and Wallet Info)
CREATE TABLE IF NOT EXISTS ecopay_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    bi_front_url TEXT, -- Supabase Storage URL
    bi_back_url TEXT,  -- Supabase Storage URL
    wallet_address TEXT NOT NULL,
    wallet_chain TEXT NOT NULL, -- e.g., 'BSC', 'TRC20'
    status TEXT DEFAULT 'pending_approval', -- 'pending_approval', 'approved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Transactions Table (USDT Purchases)
CREATE TABLE IF NOT EXISTS ecopay_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES ecopay_profiles(id),
    amount_usdt DECIMAL(18, 8) NOT NULL,
    amount_aoa DECIMAL(18, 2) NOT NULL,
    exchange_rate DECIMAL(18, 2) NOT NULL, -- AOA per USDT
    network_fee DECIMAL(18, 8) DEFAULT 0,
    payment_ref TEXT UNIQUE, -- PayPay Africa Reference
    payment_status TEXT DEFAULT 'awaiting_payment', -- 'awaiting_payment', 'paid_fiat', 'liquidated', 'failed'
    bybit_withdraw_id TEXT, -- Status from Bybit API
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Storage Bucket (Manual Step via Supabase Dashboard)
-- Remember to create a bucket named 'ecopay_kyc' and set policies to allow authenticated uploads.
