ALTER TABLE users ADD COLUMN firebase_uid TEXT;
CREATE UNIQUE INDEX users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;
ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sessions ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sessions ADD COLUMN firebase_version TEXT;

CREATE TRIGGER account_changes_revoke_sessions AFTER UPDATE OF status,email,firebase_uid ON users
WHEN NEW.status<>OLD.status OR NEW.email<>OLD.email OR NEW.firebase_uid IS NOT OLD.firebase_uid
BEGIN
  UPDATE users SET auth_version=auth_version+1 WHERE id=NEW.id;
  DELETE FROM sessions WHERE user_id=NEW.id;
  UPDATE password_resets SET used_at=CAST(strftime('%s','now') AS INTEGER)*1000 WHERE user_id=NEW.id AND used_at IS NULL;
END;
