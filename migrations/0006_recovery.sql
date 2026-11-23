CREATE TABLE recovery_requests (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  requested_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX password_resets_user ON password_resets(user_id);
CREATE TRIGGER password_change_revokes_access AFTER UPDATE OF password_hash ON users
WHEN NEW.password_hash<>OLD.password_hash
BEGIN
  DELETE FROM sessions WHERE user_id=NEW.id;
  UPDATE password_resets SET used_at=CAST(strftime('%s','now') AS INTEGER)*1000 WHERE user_id=NEW.id AND used_at IS NULL;
  UPDATE recovery_requests SET resolved_at=CAST(strftime('%s','now') AS INTEGER)*1000 WHERE user_id=NEW.id;
END;
