PRAGMA foreign_keys = ON;

CREATE TABLE units (
  id TEXT PRIMARY KEY,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);
INSERT INTO units (id) VALUES
('PB L1'),('PB L2'),('PB L3'),
('101'),('102'),('103'),('104'),('201'),('202'),('203'),('204'),
('301'),('302'),('303'),('304'),('305'),
('4A'),('4B'),('4C'),('4D'),('4E'),('4F'),('4G'),
('5A'),('5B'),('5C'),('5D'),('5E'),('5F'),('5G'),
('6A'),('6B'),('6C'),('6D'),('6E'),('6F'),('6G'),
('7A'),('7B'),('7C'),('7D'),('7E'),('7F'),('7G'),
('8A'),('8B'),('8C'),('8D'),('8E'),('9A'),('9B'),('9C');

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  dni TEXT,
  unit TEXT REFERENCES units(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (role = 'admin' OR unit IS NOT NULL)
);
-- Unit-based login must resolve to exactly one active resident account.
CREATE UNIQUE INDEX one_owner_per_unit ON users(unit) WHERE role = 'owner' AND status <> 'rejected';

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TRIGGER revoke_disabled_sessions AFTER UPDATE OF status ON users
WHEN NEW.status <> 'approved'
BEGIN
  DELETE FROM sessions WHERE user_id = NEW.id;
END;

CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  rules TEXT NOT NULL DEFAULT '',
  opening_balance_cents INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO settings(id) VALUES (1);

CREATE TABLE blocked_dates (
  date TEXT PRIMARY KEY CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  reason TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id)
);

CREATE TABLE reservations (
  id TEXT PRIMARY KEY,
  unit TEXT NOT NULL REFERENCES units(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  start_minute INTEGER NOT NULL,
  end_minute INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  accepted_rules TEXT NOT NULL CHECK (length(trim(accepted_rules)) > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  cancelled_at TEXT,
  CHECK (end_minute > start_minute),
  CHECK (start_minute % 30 = 0 AND end_minute % 30 = 0)
);
CREATE INDEX reservations_range ON reservations(start_minute, end_minute) WHERE status = 'confirmed';

-- D1 serializes writes; the trigger checks and inserts atomically, unlike a SELECT followed by INSERT.
CREATE TRIGGER prevent_reservation_overlap_insert BEFORE INSERT ON reservations
WHEN NEW.status = 'confirmed'
BEGIN
  SELECT RAISE(ABORT, 'RESERVATION_CONFLICT') WHERE EXISTS (
    SELECT 1 FROM reservations
    WHERE status = 'confirmed' AND start_minute < NEW.end_minute AND end_minute > NEW.start_minute
  );
  SELECT RAISE(ABORT, 'DATE_BLOCKED') WHERE EXISTS (
    SELECT 1 FROM blocked_dates WHERE date BETWEEN NEW.date AND NEW.end_date
  );
END;
CREATE TRIGGER prevent_reservation_overlap_update BEFORE UPDATE ON reservations
WHEN NEW.status = 'confirmed'
BEGIN
  SELECT RAISE(ABORT, 'RESERVATION_CONFLICT') WHERE EXISTS (
    SELECT 1 FROM reservations
    WHERE id <> NEW.id AND status = 'confirmed' AND start_minute < NEW.end_minute AND end_minute > NEW.start_minute
  );
  SELECT RAISE(ABORT, 'DATE_BLOCKED') WHERE EXISTS (
    SELECT 1 FROM blocked_dates WHERE date BETWEEN NEW.date AND NEW.end_date
  );
END;
CREATE TRIGGER prevent_blocking_booked_date BEFORE INSERT ON blocked_dates
BEGIN
  SELECT RAISE(ABORT, 'DATE_HAS_RESERVATIONS') WHERE EXISTS (
    SELECT 1 FROM reservations WHERE status = 'confirmed' AND NEW.date BETWEEN date AND end_date
  );
END;

CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL CHECK (collection IN ('notices','movements','expenses','budgets','documents','meetings','topics','polls','issues','works','listings','lost','contacts','faqs','statuses')),
  unit TEXT REFERENCES units(id),
  data TEXT NOT NULL CHECK (json_valid(data)),
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX entities_collection ON entities(collection, unit);
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  unit TEXT NOT NULL REFERENCES units(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  issue_id TEXT REFERENCES entities(id),
  text TEXT NOT NULL,
  attachment_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX messages_thread ON messages(unit, issue_id, created_at);
CREATE TABLE votes (
  poll_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  unit TEXT NOT NULL REFERENCES units(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  option_index INTEGER NOT NULL CHECK (option_index >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (poll_id, unit)
);
CREATE TABLE interests (
  topic_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  unit TEXT NOT NULL REFERENCES units(id),
  PRIMARY KEY (topic_id, unit)
);
CREATE TABLE notice_reads (
  notice_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  unit TEXT NOT NULL REFERENCES units(id),
  read_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (notice_id, unit)
);
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  unit TEXT REFERENCES units(id),
  visibility TEXT NOT NULL CHECK (visibility IN ('building', 'unit')),
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0),
  object_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
