-- Migration: 003_ecoflix_core_schema
-- Description: Implement core tables updates, Indices, and Atomic Assignment RPC (SKIP LOCKED).

-- 1. MOTHER ACCOUNTS (ecoflix_master_accounts)
ALTER TABLE ecoflix_master_accounts
ADD COLUMN IF NOT EXISTS recovery_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS recovery_password VARCHAR(255),
ADD COLUMN IF NOT EXISTS renewal_date DATE,
ADD COLUMN IF NOT EXISTS tags TEXT[]; 

-- 2. SLOTS (ecoflix_profiles)
ALTER TABLE ecoflix_profiles
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'SOLD', 'SUSPENDED'
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'MOBILE'; -- 'TV', 'MOBILE' (mapped from plan)

-- INDICES (Critical for Performance)
CREATE INDEX IF NOT EXISTS idx_slots_status ON ecoflix_profiles(status);
CREATE INDEX IF NOT EXISTS idx_slots_type ON ecoflix_profiles(type);

-- 3. SUBSCRIPTIONS (ecoflix_subscriptions)
ALTER TABLE ecoflix_subscriptions
ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_subs_coupon ON ecoflix_subscriptions(coupon_code);
CREATE INDEX IF NOT EXISTS idx_subs_status ON ecoflix_subscriptions(status);

-- 4. ATOMIC PURCHASE RPC (The "Magic" Function)
-- Adapting user's 'purchase_slot' logic to ecoflix tables.
-- Now includes p_order_id to update the order status atomically as well.

CREATE OR REPLACE FUNCTION purchase_slot(
  p_user_id uuid,
  p_plan_type text, -- 'ECONOMICO', 'ULTRA', etc. -> Mapped to 'MOBILE', 'TV' inside
  p_coupon_code text,
  p_amount numeric,
  p_order_id uuid DEFAULT NULL -- Optional: to link/update order
)
returns jsonb
language plpgsql
as $$
declare
  v_slot_id uuid;
  v_master_account_id uuid;
  v_sub_id uuid;
  v_profile_name text;
  v_profile_pin text;
  v_netflix_email text;
  v_netflix_password text;
  v_result jsonb;
  v_target_type text;
begin
  -- Map Plan Type to Slot Type
  -- ECONOMICO -> MOBILE (assuming)
  -- ULTRA -> TV (assuming, or GLOBAL)
  -- This mapping should match your business rules
  IF p_plan_type = 'ECONOMICO' THEN
      v_target_type := 'MOBILE';
  ELSE 
      -- ULTRA, etc.
      v_target_type := 'TV'; -- Or whatever default type
  END IF;

  -- 1. TENTA ENCONTRAR E BLOQUEAR UM SLOT LIVRE
  -- FOR UPDATE SKIP LOCKED is the key.
  
  SELECT p.id, p.master_account_id, p.name, p.pin, m.netflix_email, m.netflix_password
  INTO v_slot_id, v_master_account_id, v_profile_name, v_profile_pin, v_netflix_email, v_netflix_password
  FROM ecoflix_profiles p
  JOIN ecoflix_master_accounts m ON p.master_account_id = m.id
  WHERE p.status = 'AVAILABLE' 
    AND p.type = v_target_type
    AND m.status = 'ACTIVE' -- Account must be active
  LIMIT 1
  FOR UPDATE SKIP LOCKED; 

  -- 2. SE NÃO HOUVER SLOT, RETORNA ERRO
  IF v_slot_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'STOCK_ESGOTADO');
  END IF;

  -- 3. MARCA O SLOT COMO VENDIDO
  UPDATE ecoflix_profiles 
  SET status = 'SOLD', updated_at = NOW()
  WHERE id = v_slot_id;

  -- 4. CRIA A ASSINATURA
  INSERT INTO ecoflix_subscriptions (
    user_id, 
    profile_id, 
    plan_type,
    start_date, 
    expires_at, 
    coupon_code, 
    amount_paid, 
    status
  )
  VALUES (
    p_user_id, 
    v_slot_id, 
    p_plan_type,
    NOW(), 
    NOW() + INTERVAL '30 days', 
    p_coupon_code, 
    p_amount, 
    'ACTIVE'
  )
  RETURNING id INTO v_sub_id;

  -- 4.1 UPDATE ORDER (If order_id provided)
  IF p_order_id IS NOT NULL THEN
      UPDATE ecoflix_orders
      SET status = 'COMPLETED',
          subscription_id = v_sub_id,
          updated_at = NOW()
      WHERE id = p_order_id;
  END IF;

  -- 5. RETORNA SUCESSO E DADOS
  v_result := jsonb_build_object(
    'success', true,
    'subscription_id', v_sub_id,
    'credentials', jsonb_build_object(
        'email', v_netflix_email,
        'password', v_netflix_password,
        'profile', v_profile_name,
        'pin', v_profile_pin,
        'expires_at', (NOW() + INTERVAL '30 days')
    )
  );

  RETURN v_result;

END;
$$;

-- 5. PG_CRON SETUP (Example Script - Must be run in Dashboard/SQL Editor usually, but keeping here for documentation)
/*
select cron.schedule(
  'ecoflix-cleanup',
  '0 0 * * *', -- Midnight
  $$
    -- 1. Expire Subscriptions
    update ecoflix_subscriptions 
    set status = 'EXPIRED' 
    where expires_at < now() and status = 'ACTIVE';

    -- 2. Release Slots (Only those EXPIRED and not currently active in another sub)
    update ecoflix_profiles
    set status = 'AVAILABLE'
    where id in (
      select profile_id from ecoflix_subscriptions where status = 'EXPIRED'
    )
    and id not in (
       select profile_id from ecoflix_subscriptions where status = 'ACTIVE'
    );
  $$
);
*/
