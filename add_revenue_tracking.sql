ALTER TABLE ecoflix_master_accounts ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(10,2) DEFAULT 0;
ALTER TABLE ecoflix_profiles ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(10,2) DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_ecoflix_revenue(p_profile_id UUID DEFAULT NULL, p_master_account_id UUID DEFAULT NULL, p_amount DECIMAL DEFAULT 0)
RETURNS void AS $$
DECLARE
    v_master_account_id UUID := p_master_account_id;
BEGIN
    -- Update profile if profile_id is provided
    IF p_profile_id IS NOT NULL THEN
        UPDATE ecoflix_profiles 
        SET total_revenue = total_revenue + p_amount 
        WHERE id = p_profile_id 
        RETURNING master_account_id INTO v_master_account_id;
    END IF;

    -- Update master account
    IF v_master_account_id IS NOT NULL THEN
        UPDATE ecoflix_master_accounts 
        SET total_revenue = total_revenue + p_amount 
        WHERE id = v_master_account_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
