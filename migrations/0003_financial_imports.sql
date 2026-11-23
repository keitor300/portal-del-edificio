CREATE UNIQUE INDEX movement_identity ON entities(json_extract(data, '$.movementKey')) WHERE collection='movements';

CREATE TABLE financial_imports (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  fingerprint TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  result TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER immutable_import_request BEFORE UPDATE ON financial_imports
WHEN OLD.fingerprint<>NEW.fingerprint OR OLD.actor_id<>NEW.actor_id
BEGIN
  SELECT RAISE(ABORT,'IMPORT_REQUEST_CHANGED');
END;
