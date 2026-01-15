-- Migration: 004_ecoflix_views
-- Description: Create views for simplified data access and reporting.

-- 0. FIX SCHEMA: Ensure ecoflix_subscriptions has required columns
ALTER TABLE ecoflix_subscriptions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES ecoflix_users(id),
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) DEFAULT 0;

-- 1. VIEW: Relatório Influenciadores (Sales Report)
-- Used by: Google Sheets Import (IMPORTDATA)
-- Security: Does not expose sensitive user PII like IDs or Credentials.

CREATE OR REPLACE VIEW view_relatorio_influenciadores AS
SELECT 
    s.start_date as "data_venda", -- Lowercase for easier CSV mapping if needed, or stick to user request headers
    u.phone as "cliente_telefone", -- Using phone makes sense as 'name' might not be in our explicit user table yet
    p.type as "plano",
    s.amount_paid as "valor",
    s.coupon_code as "cupom",
    s.status as "status"
FROM ecoflix_subscriptions s
JOIN ecoflix_users u 
    ON s.user_id = u.id
JOIN ecoflix_profiles p 
    ON s.profile_id = p.id
ORDER BY s.start_date DESC;

-- Grant access (if using dedicated roles, usually authenticated or service_role has access)
-- GRANT SELECT ON view_relatorio_influenciadores TO service_role;
