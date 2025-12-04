-- Migration: Add buy_rate and simplify informal market
-- Author: EcoKambio Dev Team
-- Date: 2025-12-04

-- Step 1: Add buy_rate column to exchange_rates
ALTER TABLE exchange_rates 
ADD COLUMN IF NOT EXISTS buy_rate DECIMAL(10,5);

-- Step 2: Clean old informal providers and their rates
DELETE FROM exchange_rates 
WHERE provider_id IN (
  SELECT id FROM rate_providers WHERE type = 'INFORMAL'
);

DELETE FROM rate_providers WHERE type = 'INFORMAL';

-- Step 3: Create new simplified informal providers
INSERT INTO rate_providers (code, name, type, is_active) VALUES
  ('CASA_CAMBIO', 'Casa de Câmbio', 'INFORMAL', true),
  ('KINGUILA', 'Kinguila', 'INFORMAL', true)
ON CONFLICT (code) DO NOTHING;

-- Step 4: Initialize exchange rates for new providers
-- Get provider IDs
DO $$
DECLARE
  casa_id INTEGER;
  kinguila_id INTEGER;
BEGIN
  SELECT id INTO casa_id FROM rate_providers WHERE code = 'CASA_CAMBIO';
  SELECT id INTO kinguila_id FROM rate_providers WHERE code = 'KINGUILA';
  
  -- Casa de Câmbio rates (placeholder values)
  INSERT INTO exchange_rates (provider_id, currency_pair, buy_rate, sell_rate, updated_at) VALUES
    (casa_id, 'USD/AOA', 1100.00, 1150.00, NOW()),
    (casa_id, 'EUR/AOA', 1300.00, 1350.00, NOW())
  ON CONFLICT (provider_id, currency_pair) DO NOTHING;
  
  -- Kinguila rates (placeholder values)
  INSERT INTO exchange_rates (provider_id, currency_pair, buy_rate, sell_rate, updated_at) VALUES
    (kinguila_id, 'USD/AOA', 1200.00, 1204.00, NOW()),
    (kinguila_id, 'EUR/AOA', 1400.00, 1401.00, NOW())
  ON CONFLICT (provider_id, currency_pair) DO NOTHING;
END $$;

-- Verification
SELECT 'Migration completed successfully!' AS status;
SELECT rp.code, rp.name, er.currency_pair, er.buy_rate, er.sell_rate 
FROM rate_providers rp
JOIN exchange_rates er ON rp.id = er.provider_id
WHERE rp.type = 'INFORMAL'
ORDER BY rp.code, er.currency_pair;
