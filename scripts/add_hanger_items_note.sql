-- Free-text note the customer types at checkout when they check the
-- "Hangers" accessory option, specifying which items to place on hangers.
-- Separate from customer_instructions (the general special-instructions
-- box) so it renders distinctly, right next to the hanger count the
-- operator enters at folding (app/operator/order/[id]/folding-form.tsx).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS hanger_items_note text;
