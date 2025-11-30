-- Fix for ambiguous function error (PGRST203)
-- Drops both integer and bigint versions and recreates a single bigint version

DROP FUNCTION IF EXISTS public.increment_affiliate_click(integer);
DROP FUNCTION IF EXISTS public.increment_affiliate_click(bigint);

CREATE OR REPLACE FUNCTION public.increment_affiliate_click(link_id_to_inc bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE affiliate_links
  SET clicks = clicks + 1
  WHERE id = link_id_to_inc;
END;
$$;
