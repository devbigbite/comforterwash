-- Track how many pickups have been completed for a weekly/biweekly subscription.
-- Used to enforce the 3-pickup minimum commitment before allowing cancel/pause.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pickups_completed integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.subscriptions.pickups_completed IS
  'Number of pickups completed for this subscription. Cancel/pause is blocked until >= 3.';
