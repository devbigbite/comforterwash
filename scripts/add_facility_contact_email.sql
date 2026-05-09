-- Add contact_email to facilities for arrival notifications
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS contact_email text;
