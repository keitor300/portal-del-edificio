ALTER TABLE users ADD COLUMN username TEXT COLLATE NOCASE;
CREATE UNIQUE INDEX users_username ON users(username) WHERE username IS NOT NULL;
CREATE TABLE admin_invitations (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  invited_by TEXT REFERENCES users(id),
  initial_version TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  email_sent_at INTEGER,
  accepted_at INTEGER
);
CREATE TABLE notification_reads (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  read_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,event_key)
);
CREATE TRIGGER protect_last_admin BEFORE UPDATE OF status,role ON users
WHEN OLD.role='admin' AND OLD.status='approved' AND (NEW.role<>'admin' OR NEW.status<>'approved')
AND (SELECT count(*) FROM users WHERE role='admin' AND status='approved')<=1
BEGIN
  SELECT RAISE(ABORT,'LAST_ADMIN');
END;
