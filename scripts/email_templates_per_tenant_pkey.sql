-- email_templates was created with PRIMARY KEY (key), so the whole platform
-- could only ever hold one row per template key — the first tenant to get
-- seeded took the key and every other tenant's insert failed with a duplicate
-- key error. In practice only WashFold Orlando had rows, and every other
-- tenant's /admin/templates page was empty with no way to fix it.
--
-- Every query in app/actions/email-templates.ts already scopes by location_id,
-- so the key was always meant to be unique per location.
ALTER TABLE email_templates DROP CONSTRAINT email_templates_pkey;
ALTER TABLE email_templates ADD CONSTRAINT email_templates_pkey PRIMARY KEY (location_id, key);
