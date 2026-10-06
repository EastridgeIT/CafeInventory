-- Replace the single user.role with stackable roles (ADR-0005). Abilities are the union of a user's roles.
CREATE TABLE user_role (
  user_id TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  role    TEXT NOT NULL CHECK (role IN ('general', 'shopper', 'admin')),
  PRIMARY KEY (user_id, role)
);

-- Keep everyone's existing abilities: volunteer -> general; manager -> general + shopper; admin -> all three.
INSERT INTO user_role (user_id, role) SELECT id, 'general' FROM user;
INSERT INTO user_role (user_id, role) SELECT id, 'shopper' FROM user WHERE role IN ('manager', 'admin');
INSERT INTO user_role (user_id, role) SELECT id, 'admin' FROM user WHERE role = 'admin';

ALTER TABLE user DROP COLUMN role;
