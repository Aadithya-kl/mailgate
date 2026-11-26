-- MailGate: Receive-Only Email & OTP Inbox Schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS allowed_inboxes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_address TEXT NOT NULL UNIQUE COLLATE NOCASE,
  label TEXT NOT NULL DEFAULT '',
  password_hash TEXT DEFAULT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  recipient_email TEXT NOT NULL COLLATE NOCASE,
  sender TEXT NOT NULL,
  sender_name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '(No Subject)',
  body_text TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  otp_code TEXT DEFAULT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_allowed_inboxes_email
  ON allowed_inboxes (email_address);

CREATE INDEX IF NOT EXISTS idx_messages_recipient_received
  ON messages (recipient_email, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_received_at
  ON messages (received_at DESC);
