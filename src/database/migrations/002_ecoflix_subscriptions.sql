-- Migration: 002_ecoflix_subscriptions
-- Description: Support for subscription renewals and order types.

-- 1. Add columns to Orders to track renewals
ALTER TABLE ecoflix_orders 
ADD COLUMN IF NOT EXISTS subscription_action TEXT DEFAULT 'NEW', -- 'NEW', 'RENEWAL'
ADD COLUMN IF NOT EXISTS target_subscription_id UUID;

-- 2. RPC to Extend Subscription (Atomic)
CREATE OR REPLACE FUNCTION extend_subscription(p_subscription_id UUID, p_days INT)
RETURNS JSONB AS $$
DECLARE
    v_sub RECORD;
    v_new_expiry TIMESTAMP;
BEGIN
    -- Lock subscription row
    SELECT * INTO v_sub FROM ecoflix_subscriptions WHERE id = p_subscription_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Subscrição não encontrada');
    END IF;

    -- Calculate new expiry
    -- If current expiry is in future, add to it. If past, add to NOW() (though Late Renewal should be NEW usually)
    IF v_sub.expires_at > NOW() THEN
        v_new_expiry := v_sub.expires_at + (p_days || ' days')::INTERVAL;
    ELSE
        v_new_expiry := NOW() + (p_days || ' days')::INTERVAL;
    END IF;

    -- Update
    UPDATE ecoflix_subscriptions
    SET expires_at = v_new_expiry,
        updated_at = NOW()
    WHERE id = p_subscription_id;

    RETURN jsonb_build_object(
        'success', true, 
        'new_expires_at', v_new_expiry,
        'message', 'Renovada com sucesso'
    );
END;
$$ LANGUAGE plpgsql;
