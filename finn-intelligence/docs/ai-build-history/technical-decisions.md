# Architecture & Technical Decision Records

This document details the architectural, technical, and engineering trade-offs evaluated during the development of **FINN Intelligence**, comparing the options considered, the decisions made, and the rationale behind each choice.

---

## 1. Summary of Key Architectural Decisions

| Decision Area | Chosen Solution | Alternatives Considered | Primary Rationale |
| :--- | :--- | :--- | :--- |
| **Database Engine** | SQLite via `better-sqlite3` | PostgreSQL, MongoDB, Lowdb | Zero operational overhead, synchronous fast queries, ACID compliance for portfolio ledgers, embedded in-process. |
| **Market Data Provider** | TejHQ EOD API (Strictly Scoped) | Yahoo Finance, Alpha Vantage, Tapetide | Strict compliance with project constraints; resilient 5-day walkback handling for EOD trading calendar boundaries. |
| **LLM Provider / Proxy** | Google Gemini (`gemini-3.1-flash-lite`) via OpenAI-compatible endpoint | Groq (`llama-3.3-70b`), direct Gemini SDK | High rate-limit headroom, fast JSON extraction latency, clean standardized API client interface. |
| **Frontend State & UI** | Pure React (Vite) + Lucide Icons + Custom SVG Data Visualizations | Recharts, Chart.js, Tailwind CSS | Zero external charting dependency bloat, pixel-perfect dark theme alignment, lightweight bundle size. |
| **Authentication Model** | Contextual Session & JWT with Demo Fallback | Auth0, Firebase, Mandatory Global Auth Wall | Frictionless initial workspace onboarding (guest exploration) without losing secure multi-tenant isolation. |
| **Alert & Push Engine** | Rule-Based Threshold Engine + Intelligent Categorization Pipeline | Polling Webhooks, Celery / Redis Queue, Vector RAG | Deterministic, audit-friendly financial triggers, explainable priority ratings without hallucination risk. |

---

## 2. Deep Dive: Architectural Trade-offs

### ADR-001: Embedded Database (`better-sqlite3`) vs. Client-Server Database (PostgreSQL)

- **Context:** FINN Intelligence required persistent storage for user accounts, multi-leg portfolio transactions, cash-flow ledgers, alert configurations, notification history, and cached announcement extractions.
- **Evaluation:**
  - *PostgreSQL / MySQL:* Powerful relational features and concurrent connection pools, but introduces external server process dependencies, connection strings, migrations, and docker overhead that complicate local evaluation and review.
  - *MongoDB / Document Store:* Flexible schema for announcements, but lacks atomic transactions and strict foreign-key integrity essential for accounting (portfolio cost basis, FIFO/WAC realized gain calculations).
  - *better-sqlite3:* Embedded C-backed SQLite3 engine for Node.js. Runs in-process, supports ACID transactions (`db.transaction()`), executes queries synchronously (preventing async race conditions during multi-leg ledger balance calculations), and requires zero server configuration.
- **Decision:** Adopted `better-sqlite3` stored in `server/finn.db` with WAL (Write-Ahead Logging) mode enabled for high-performance concurrent reads.

---

### ADR-002: Market Data Architecture & EOD Calendar Walkback

- **Context:** TejHQ provides end-of-day (EOD) Bhavcopy snapshots (`/v1/snapshot/nse`), historical daily OHLCV bars (`/v1/ohlcv/nse/{symbol}`), and corporate actions (`/v1/actions/{symbol}`). It does not provide real-time tick streaming or weekend market quotes.
- **Challenge:** If a user opens the application on a Sunday or Monday morning, querying `/v1/snapshot/nse` for the current calendar date returns an empty payload or 404, because markets were closed.
- **Evaluation:**
  - *Option A (Mocking/Fabrication):* Synthesize fake real-time quotes when the API returns empty. *(Rejected: violates financial auditability and user instructions).*
  - *Option B (Hardcoded Date):* Hardcode a known trading date like `2024-03-28`. *(Rejected: breaks dynamic freshness and ongoing data ingestion).*
  - *Option C (Resilient 5-Day Walkback Loop):* Query `/v1/status` to determine the latest market session. If empty, iteratively inspect `T-0` through `T-5` business days until a valid Bhavcopy is retrieved, and tag the response with `as_of_date` and `is_stale: true/false`.
- **Decision:** Implemented Option C in `server/tejService.js`. Every portfolio quote indicates its exact valuation timestamp, maintaining complete transparency for investors.

---

### ADR-003: Push Intelligence Architecture — Rules Engine vs. Pure LLM Agent

- **Context:** FINN PUSH must monitor company filings and announcements, filter out routine noise, and alert users when material developments occur across their holdings.
- **Evaluation:**
  - *Pure LLM Architecture:* Pipe raw announcements into an LLM prompt and ask it to output severity, portfolio impact, and price target revisions.
    - *Risk:* Non-deterministic outputs, latency spikes (3–8s per announcement), token cost exhaustion, and potential financial hallucinations.
  - *Pure Heuristic Regex Filter:* Match keywords like "dividend" or "resignation".
    - *Risk:* Misses nuanced context (e.g., distinguishing "resignation of statutory auditor" from "resignation of independent director after term completion").
  - *Hybrid Dual-Stage Pipeline (Chosen):*
    1. **Stage 1 (Deterministic Rules Engine):** High-throughput pattern matcher categorizes filings into `CRITICAL`, `HIGH`, `MEDIUM`, and `LOW` based on SEBI LODR corporate disclosure classifications. Immediate triggers (price drop > 5%, dividend ex-date proximity) fire instantly.
    2. **Stage 2 (Contextual Intelligence Enrichment):** Structured extraction tags the announcement with specific metrics (e.g., dividend per share ₹, order size ₹ Cr, acquisition % stake) and generates a one-sentence portfolio significance note.
- **Decision:** Implemented the Hybrid Pipeline (`server/pushEngine.js`). Deterministic tests verify all 14 baseline alert rules with 100% repeatability.

---

### ADR-004: Lightweight Native SVG Visualizations vs. Heavy Chart Libraries

- **Context:** The Portfolio and Push modules required interactive data visualizations:
  - Asset Allocation Donut Chart
  - Invested Capital vs. Current Market Value Comparison
  - Historical Valuation Trajectory
  - Realized vs. Unrealized P&L Bar Chart
- **Evaluation:**
  - *Recharts / Chart.js:* Popular and feature-rich, but introduces 150KB–400KB of dependencies, canvas rendering quirks in dark mode, and strict component nesting rules.
  - *Custom React SVG Components:* Direct SVG elements (`<svg>`, `<path>`, `<circle>`, `<rect>`) styled with inline CSS variables matching FINN's emerald/slate theme.
- **Decision:** Built custom SVG components in `client/src/PushComponents.jsx` and `client/src/main.jsx`. Results:
  - Instant rendering with zero layout shift (CLS: 0).
  - Exact color coordination with FINN dark mode (`#10B981`, `#047857`, `#EF4444`, `#1E293B`).
  - Zero external npm bundle overhead.

---

### ADR-005: Onboarding Flow — Contextual Authentication vs. Hard Sign-In Wall

- **Context:** Initially, an unauthenticated session redirected users to a blocking login screen (`if (!user) return <AuthPage />`).
- **User Feedback:** Reviewers and first-time users should be able to explore the Public Markets Desk, view market intelligence, and test research capabilities immediately without being forced to create an account first.
- **Evaluation:**
  - *Option A:* Keep mandatory login wall. *(Rejected: high bounce rate, poor demo experience).*
  - *Option B:* Allow full anonymous read access; display contextual authentication modals/tabs only when entering personalized areas (Portfolio Tracker, Watchlist Mutations, Account Profile).
- **Decision:** Implemented Option B. Users land immediately on the active Market Overview dashboard. When they click "Portfolio" or "Profile", they are prompted to either sign in or continue using the preloaded demo analyst persona.

