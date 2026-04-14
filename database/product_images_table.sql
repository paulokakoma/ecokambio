-- Tabela separada para imagens de produto (múltiplas imagens por produto)
-- Execute este SQL no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.product_images (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    url         text NOT NULL,
    is_primary  boolean DEFAULT false,
    sort_order  int DEFAULT 0,
    created_at  timestamptz DEFAULT now()
);

-- Índice para pesquisas por produto
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);

-- RLS
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.product_images FOR ALL USING (true);
