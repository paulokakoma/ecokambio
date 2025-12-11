-- Script para adicionar/atualizar as taxas bancárias (fee_margin e fee_final)
-- Execute este script no Supabase SQL Editor

-- 1. Primeiro, verificar se as colunas existem (adicionar se necessário)
ALTER TABLE rate_providers 
ADD COLUMN IF NOT EXISTS fee_margin NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fee_final NUMERIC(5,2) DEFAULT 0;

-- 2. Atualizar os bancos com as taxas corretas
-- BAI: 2% margin + 0.8% final = 2.8% total
UPDATE rate_providers 
SET fee_margin = 2.0, fee_final = 0.8 
WHERE code = 'BAI' AND type = 'FORMAL';

-- BFA: 1.5% margin + 0.5% final = 2% total  
UPDATE rate_providers 
SET fee_margin = 1.5, fee_final = 0.5 
WHERE code = 'BFA' AND type = 'FORMAL';

-- BIC: 1.8% margin + 0.7% final = 2.5% total
UPDATE rate_providers 
SET fee_margin = 1.8, fee_final = 0.7 
WHERE code = 'BIC' AND type = 'FORMAL';

-- BPC: 2.2% margin + 0.6% final = 2.8% total
UPDATE rate_providers 
SET fee_margin = 2.2, fee_final = 0.6 
WHERE code = 'BPC' AND type = 'FORMAL';

-- BCI: 1.6% margin + 0.6% final = 2.2% total
UPDATE rate_providers 
SET fee_margin = 1.6, fee_final = 0.6 
WHERE code = 'BCI' AND type = 'FORMAL';

-- YETU: 1.9% margin + 0.9% final = 2.8% total
UPDATE rate_providers 
SET fee_margin = 1.9, fee_final = 0.9 
WHERE code = 'YETU' AND type = 'FORMAL';

-- BNA: 0% (banco central, sem taxas adicionais)
UPDATE rate_providers 
SET fee_margin = 0.0, fee_final = 0.0 
WHERE code = 'BNA' AND type = 'FORMAL';

-- 3. Verificar os resultados
SELECT 
    code,
    name,
    type,
    fee_margin,
    fee_final,
    (fee_margin + fee_final) as total_fee,
    is_active
FROM rate_providers 
WHERE type = 'FORMAL'
ORDER BY code;
