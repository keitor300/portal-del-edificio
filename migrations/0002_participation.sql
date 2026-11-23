CREATE UNIQUE INDEX expense_unit_period ON entities(unit, json_extract(data, '$.period')) WHERE collection = 'expenses';

CREATE TABLE topic_comments (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TRIGGER validate_ballot BEFORE INSERT ON votes
BEGIN
  SELECT RAISE(ABORT, 'POLL_CLOSED_OR_INVALID') WHERE NOT EXISTS (
    SELECT 1 FROM entities WHERE id=NEW.poll_id AND collection='polls'
    AND coalesce(json_extract(data, '$.closed'), 0)=0
    AND (coalesce(json_extract(data, '$.dueDate'), '')='' OR json_extract(data, '$.dueDate') >= date('now','-3 hours'))
    AND NEW.option_index < json_array_length(data, '$.options')
    AND coalesce(json_extract(data, '$.status'), '')<>'Borrador'
  );
END;
CREATE TRIGGER preserve_ballot_options BEFORE UPDATE OF data ON entities
WHEN OLD.collection='polls' AND EXISTS (SELECT 1 FROM votes WHERE poll_id=OLD.id)
AND json_extract(OLD.data, '$.options') IS NOT json_extract(NEW.data, '$.options')
BEGIN
  SELECT RAISE(ABORT, 'POLL_OPTIONS_LOCKED');
END;
CREATE TRIGGER messages_require_open_issue BEFORE INSERT ON messages
WHEN NEW.issue_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'ISSUE_CLOSED_OR_INVALID') WHERE NOT EXISTS (
    SELECT 1 FROM entities WHERE id=NEW.issue_id AND collection='issues' AND unit=NEW.unit
    AND json_extract(data, '$.status')<>'Resuelto'
  );
END;
