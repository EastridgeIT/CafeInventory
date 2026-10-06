-- Email per user (admin-entered; used for scheduled-inventory emails, ADR-0006). Optional, unique when present.
-- Never exposed to the sign-in picker or to non-admins.
ALTER TABLE user ADD COLUMN email TEXT;
CREATE UNIQUE INDEX user_email_uq ON user (lower(email)) WHERE email IS NOT NULL;
