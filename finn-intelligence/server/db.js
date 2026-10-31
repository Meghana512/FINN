/**
 * db.js — SQLite database for FINN Intelligence
 * Tables: users, transactions, user_preferences
 * Uses better-sqlite3 (synchronous API, zero-config, embedded).
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Support Render persistent disk or custom storage location
const defaultDbPath = path.join(__dirname, "finn.db");
const configuredDbPath =
  process.env.DATABASE_PATH ||
  process.env.DB_PATH ||
  (process.env.RENDER_DISK_PATH ? path.join(process.env.RENDER_DISK_PATH, "finn.db") : null) ||
  defaultDbPath;

const targetDbPath = path.resolve(configuredDbPath);

// Ensure the directory exists
const dbDir = path.dirname(targetDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Preserve existing data/schemas: if persistent storage target does not exist yet,
// seed it from bundled initial database if available.
if (targetDbPath !== defaultDbPath && !fs.existsSync(targetDbPath) && fs.existsSync(defaultDbPath)) {
  try {
    console.log(`[Database] Initializing persistent storage at ${targetDbPath} from bundled ${defaultDbPath}...`);
    fs.copyFileSync(defaultDbPath, targetDbPath);
    console.log(`[Database] Persistent storage initialized successfully.`);
  } catch (err) {
    console.warn(`[Database] Notice: could not copy initial database: ${err.message}`);
  }
}

const db = new Database(targetDbPath);

// Enable WAL mode for high performance concurrent reads and enforce foreign keys
try {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
} catch (err) {
  console.warn("[Database] Pragma configuration notice:", err.message);
}

// Safe WAL checkpoint and cleanup on application shutdown
const gracefulShutdown = () => {
  try {
    if (db && db.open) {
      db.pragma("wal_checkpoint(TRUNCATE)");
      db.close();
      console.log("[Database] SQLite connection closed cleanly with WAL checkpoint.");
    }
  } catch (err) {
    console.error("[Database] Error closing SQLite connection cleanly:", err.message);
  }
};

process.once("SIGTERM", gracefulShutdown);
process.once("SIGINT", gracefulShutdown);

// ---------------------------------------------------------------------------
// Schema creation
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password    TEXT    NOT NULL,
    avatar_url  TEXT,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email COLLATE NOCASE);

  CREATE TABLE IF NOT EXISTS transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol          TEXT    NOT NULL,
    exchange        TEXT    NOT NULL DEFAULT 'NSE',
    company_name    TEXT,
    type            TEXT    NOT NULL CHECK(type IN ('BUY','SELL')),
    quantity        REAL    NOT NULL CHECK(quantity > 0),
    price           REAL    NOT NULL CHECK(price > 0),
    date            TEXT    NOT NULL,
    brokerage       REAL    NOT NULL DEFAULT 0 CHECK(brokerage >= 0),
    notes           TEXT,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_txn_user_id   ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_txn_symbol     ON transactions(user_id, symbol);
  CREATE INDEX IF NOT EXISTS idx_txn_date       ON transactions(user_id, date DESC);

  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme       TEXT    DEFAULT 'dark',
    currency    TEXT    DEFAULT 'INR',
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  -- -------------------------------------------------------------------------
  -- FINN PUSH: Market Intelligence & Alert System Tables
  -- -------------------------------------------------------------------------

  CREATE TABLE IF NOT EXISTS user_push_preferences (
    user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_window      TEXT    DEFAULT '24h' CHECK(default_window IN ('12h','24h','48h','7d','custom')),
    quiet_hours_enabled INTEGER DEFAULT 0,
    quiet_hours_start   TEXT    DEFAULT '22:00',
    quiet_hours_end     TEXT    DEFAULT '08:00',
    timezone            TEXT    DEFAULT 'Asia/Kolkata',
    alert_frequency     TEXT    DEFAULT 'instant',
    cooldown_minutes    INTEGER DEFAULT 240,
    min_priority        TEXT    DEFAULT 'MEDIUM' CHECK(min_priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    notify_browser      INTEGER DEFAULT 0,
    notify_inapp        INTEGER DEFAULT 1,
    portfolio_only      INTEGER DEFAULT 0,
    price_threshold_pct REAL    DEFAULT 3.0,
    volume_multiplier   REAL    DEFAULT 2.0,
    volume_avg_days     INTEGER DEFAULT 20,
    enabled_categories  TEXT    DEFAULT '["results","M&A","management_change","litigation","fund_raise","regulatory","contracts","dividend","capex"]',
    updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id                  TEXT    PRIMARY KEY,
    symbol              TEXT    NOT NULL,
    exchange            TEXT    NOT NULL DEFAULT 'NSE',
    company_name        TEXT    NOT NULL,
    title               TEXT    NOT NULL,
    category            TEXT    NOT NULL,
    priority            TEXT    NOT NULL CHECK(priority IN ('CRITICAL','HIGH','MEDIUM','LOW')),
    filing_date         TEXT    NOT NULL,
    filing_time         TEXT,
    summary             TEXT,
    why_it_matters      TEXT,
    is_routine          INTEGER DEFAULT 0,
    source              TEXT    DEFAULT 'Exchange Filing',
    source_url          TEXT,
    raw_payload         TEXT,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_announcements_symbol ON announcements(symbol);
  CREATE INDEX IF NOT EXISTS idx_announcements_date   ON announcements(filing_date DESC);
  CREATE INDEX IF NOT EXISTS idx_announcements_prio   ON announcements(priority);

  CREATE TABLE IF NOT EXISTS announcement_extractions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    announcement_id     TEXT    NOT NULL UNIQUE REFERENCES announcements(id) ON DELETE CASCADE,
    extraction_type     TEXT    NOT NULL CHECK(extraction_type IN ('FINANCIAL_RESULTS','MANAGEMENT_CHANGE','MATERIAL_UPDATE')),
    payload             TEXT    NOT NULL, -- JSON formatted extraction details
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_extractions_ann ON announcement_extractions(announcement_id);

  CREATE TABLE IF NOT EXISTS user_announcement_states (
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    announcement_id     TEXT    NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    is_read             INTEGER DEFAULT 0,
    is_important        INTEGER DEFAULT 0,
    is_archived         INTEGER DEFAULT 0,
    updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    PRIMARY KEY (user_id, announcement_id)
  );

  CREATE TABLE IF NOT EXISTS alert_rules (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                TEXT    NOT NULL,
    rule_type           TEXT    NOT NULL CHECK(rule_type IN ('ANNOUNCEMENT','PRICE_MOVE','VOLUME_SPIKE','COMBINED')),
    symbol              TEXT,   -- NULL means all portfolio holdings
    min_priority        TEXT    DEFAULT 'HIGH' CHECK(min_priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    categories          TEXT,   -- JSON array of categories
    price_up_pct        REAL    DEFAULT 3.0,
    price_down_pct      REAL    DEFAULT -3.0,
    volume_multiplier   REAL    DEFAULT 2.0,
    volume_avg_days     INTEGER DEFAULT 20,
    is_active           INTEGER DEFAULT 1,
    cooldown_minutes    INTEGER DEFAULT 240,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_alert_rules_user ON alert_rules(user_id);

  CREATE TABLE IF NOT EXISTS triggered_alerts (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rule_id             INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL,
    symbol              TEXT    NOT NULL,
    kind                TEXT    NOT NULL, -- 'PRICE_UP', 'PRICE_DOWN', 'VOLUME_SPIKE', 'ANNOUNCEMENT'
    severity            TEXT    NOT NULL CHECK(severity IN ('CRITICAL','HIGH','MEDIUM','LOW')),
    title               TEXT    NOT NULL,
    message             TEXT    NOT NULL,
    data_date           TEXT,
    metadata            TEXT,   -- JSON
    is_read             INTEGER DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_triggered_user ON triggered_alerts(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_triggered_sym  ON triggered_alerts(symbol, kind, created_at DESC);

  CREATE TABLE IF NOT EXISTS notifications (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type         TEXT    NOT NULL CHECK(source_type IN ('ALERT','DIGEST','ANNOUNCEMENT')),
    source_id           TEXT,
    title               TEXT    NOT NULL,
    message             TEXT    NOT NULL,
    priority            TEXT    DEFAULT 'MEDIUM',
    is_read             INTEGER DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

  -- -------------------------------------------------------------------------
  -- FINN RESEARCH: Primary Financial Results, Management Guidance & Filings
  -- -------------------------------------------------------------------------

  CREATE TABLE IF NOT EXISTS company_financials (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol              TEXT    NOT NULL,
    company_name        TEXT    NOT NULL,
    period              TEXT    NOT NULL, -- e.g. 'Q2 FY27', 'Q1 FY27', 'FY26'
    period_type         TEXT    DEFAULT 'Quarterly' CHECK(period_type IN ('Quarterly', 'Annual')),
    fiscal_year         TEXT,             -- e.g. 'FY27'
    quarter             TEXT,             -- e.g. 'Q2'
    basis               TEXT    DEFAULT 'Consolidated' CHECK(basis IN ('Consolidated', 'Standalone')),
    currency            TEXT    DEFAULT 'INR',
    unit                TEXT    DEFAULT 'Cr',
    revenue             REAL,             -- In Cr
    revenue_qoq_pct     REAL,
    revenue_yoy_pct     REAL,
    ebitda              REAL,             -- In Cr
    ebitda_margin_pct   REAL,
    ebitda_qoq_pct      REAL,
    ebitda_yoy_pct      REAL,
    pbt                 REAL,             -- In Cr
    pbt_qoq_pct         REAL,
    pbt_yoy_pct         REAL,
    pat                 REAL,             -- In Cr (Net Profit)
    pat_margin_pct      REAL,
    pat_qoq_pct         REAL,
    pat_yoy_pct         REAL,
    eps                 REAL,             -- ₹ per share
    filing_date         TEXT    NOT NULL,
    source_type         TEXT    DEFAULT 'Exchange Filing',
    source_name         TEXT    NOT NULL, -- e.g. 'NSE Quarterly Financial Results'
    source_url          TEXT    NOT NULL,
    raw_highlights      TEXT,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    UNIQUE(symbol, period, basis)
  );

  CREATE INDEX IF NOT EXISTS idx_fin_sym_period ON company_financials(symbol, period);
  CREATE INDEX IF NOT EXISTS idx_fin_filing_date ON company_financials(filing_date DESC);

  CREATE TABLE IF NOT EXISTS management_guidance (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol              TEXT    NOT NULL,
    company_name        TEXT    NOT NULL,
    target_period       TEXT    NOT NULL, -- e.g. 'FY27', 'Q3 FY27', 'FY27-FY28'
    guidance_date       TEXT    NOT NULL, -- Date given, e.g. '2026-10-24'
    source_type         TEXT    NOT NULL CHECK(source_type IN ('Earnings Call Transcript', 'Investor Presentation', 'Annual Report', 'Exchange Filing')),
    source_name         TEXT    NOT NULL, -- e.g. 'Q2 FY27 Earnings Conference Call Transcript'
    source_url          TEXT    NOT NULL,
    metric_category     TEXT    NOT NULL, -- 'revenue_growth', 'ebitda_margin', 'capex', 'roce', 'order_book', 'strategic'
    metric_label        TEXT    NOT NULL, -- 'FY27 CC Revenue Growth Guidance'
    guidance_value      TEXT    NOT NULL, -- '3.75% - 4.50% CC'
    min_value           REAL,
    max_value           REAL,
    executive_speaker   TEXT,             -- 'Salil Parekh (CEO)'
    context_quote       TEXT    NOT NULL, -- Verbatim statement / quote
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    UNIQUE(symbol, target_period, metric_category, source_type)
  );

  CREATE INDEX IF NOT EXISTS idx_guidance_sym ON management_guidance(symbol, target_period);

  CREATE TABLE IF NOT EXISTS company_documents (
    id                  TEXT    PRIMARY KEY, -- e.g. 'DOC-INFY-Q2FY27-RESULTS'
    symbol              TEXT    NOT NULL,
    company_name        TEXT    NOT NULL,
    title               TEXT    NOT NULL,
    doc_type            TEXT    NOT NULL, -- 'Financial Results', 'Investor Presentation', 'Concall Transcript', 'Annual Report', 'Credit Rating'
    period              TEXT,             -- e.g. 'Q2 FY27'
    doc_date            TEXT    NOT NULL,
    source_url          TEXT    NOT NULL,
    source_name         TEXT    NOT NULL, -- e.g. 'NSE India', 'BSE India', 'Company IR'
    num_pages           INTEGER,
    key_highlights      TEXT,             -- Summary
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    UNIQUE(symbol, doc_type, period)
  );

  CREATE INDEX IF NOT EXISTS idx_docs_sym_period ON company_documents(symbol, period);
`);

export default db;

