CREATE TABLE issue_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  previous_status TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER issue_status_history AFTER UPDATE OF data ON entities
WHEN NEW.collection='issues' AND json_extract(OLD.data,'$.status') IS NOT json_extract(NEW.data,'$.status')
BEGIN
  INSERT INTO issue_events(issue_id,actor_id,previous_status,status)
  VALUES (NEW.id,NEW.updated_by,json_extract(OLD.data,'$.status'),json_extract(NEW.data,'$.status'));
END;
