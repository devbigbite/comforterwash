-- 1. Add "accessory" as a valid type for service_options
ALTER TABLE public.service_options
  DROP CONSTRAINT IF EXISTS service_options_type_check;

ALTER TABLE public.service_options
  ADD CONSTRAINT service_options_type_check
    CHECK (type IN ('detergent', 'extra', 'accessory'));

-- 2. Add OxyClean and Borax Color Brightener as free treatment extras
INSERT INTO public.service_options (type, name, description, price_cents, enabled, sort_order)
VALUES
  ('extra', 'OxyClean', 'Oxygen-powered stain and odor booster — safe for all fabrics', 0, true, 10),
  ('extra', 'Borax Color Brightener', 'Brightens and refreshes colors without harsh bleach', 0, true, 11)
ON CONFLICT DO NOTHING;

-- 3. Move "Premium Laundry Bag" from type "extra" to type "accessory"
UPDATE public.service_options
SET type = 'accessory'
WHERE name ILIKE '%premium%bag%' OR name ILIKE '%laundry bag%';
