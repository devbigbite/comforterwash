-- Driver mileage recorded on the time punch itself, so a shift's miles stay
-- attached to the shift they happened on. NULL = no mileage entered (distinct
-- from a driver who genuinely drove 0 miles).
ALTER TABLE staff_time_punches
  ADD COLUMN IF NOT EXISTS miles NUMERIC(6,1);
