-- Users, sessions and login throttling. Design: knowledge/architecture/auth-and-users.md, ADR-0004.
-- IDs are ULIDs (opaque text). Timestamps are ISO-8601 UTC text.

CREATE TABLE user (
  id                 TEXT PRIMARY KEY,
  display_name       TEXT NOT NULL,
  role               TEXT NOT NULL CHECK (role IN ('volunteer', 'manager', 'admin')),
  pin_hash           TEXT NOT NULL,   -- base64 PBKDF2-SHA256 over HMAC(pepper, id:pin); never the PIN
  pin_salt           TEXT NOT NULL,   -- base64, per user
  pin_iterations     INTEGER NOT NULL,
  toast_employee_ref TEXT,            -- identifier only, NEVER a Toast PIN
  active             INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  failed_attempts    INTEGER NOT NULL DEFAULT 0,
  locked_until       TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE UNIQUE INDEX user_display_name_uq ON user (lower(display_name));

CREATE TABLE session (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,  -- SHA-256 hex of the cookie token
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX session_user_idx ON session (user_id);

-- Per-IP login attempt counter in 10-minute windows (window_start = ISO of the window).
CREATE TABLE login_throttle (
  ip           TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count        INTEGER NOT NULL,
  PRIMARY KEY (ip, window_start)
);
