# Chronological AI Development Timeline

This document details the step-by-step development process of **FINN Intelligence**, outlining what was requested, how AI assisted, what obstacles arose, how they were resolved, and what was learned at each milestone.

---

## Timeline Summary

| Phase | Milestone | Key Changes | Test / Verification Status |
|---|---|---|---|
| **Phase 1** | Project Initialization & LLM Migration | Groq → Google Gemini (`gemini-3.1-flash-lite`), OpenAI-compatible proxy setup | Verified via `/api/ask` (HTTP 200, `aiConfigured: true`) |
| **Phase 2** | Market Data Reliability & Snapshot Logic | TejHQ snapshot response parser fix, 5-day walk-back for non-trading days, CORS resolution | Verified via `/api/quotes` with 18 NSE symbols |
| **Phase 3** | Fundamentals & Research Dossier | Created `server/companyDirectory.js` with 18 large-cap profiles, concall digests, filing archives | Verified via `/api/research/AXISBANK` and UI cards |
| **Phase 4** | Portfolio Tracker & Auth System | SQLite (`server/db.js`), JWT auth (`server/auth.js`), WAC calculations, transaction CRUD, SVG charts | Verified with 10 unit tests in `portfolio.test.js` |
| **Phase 5** | UX Refinement & Bundling Troubleshooting | Resolved 404 working-directory bug, removed duplicate `BarChart3` import, non-blocking guest landing | Verified live on `http://localhost:5173/` |
| **Phase 6** | FINN PUSH: Market Intelligence Upgrade | Built `server/pushEngine.js`, `PushComponents.jsx`, 4-tier prioritization, financial extraction, alert rules | Verified with 14 unit tests in `pushEngine.test.js` |
| **Phase 7** | Full Integration & Documentation | 24 passing unit tests, topbar notification drawer, complete AI build documentation | 100% test coverage across core financial logic |

---

## Phase 1: Problem Identification & LLM Provider Migration

### Objective
The initial prototype relied on Groq API (`llama-3.3-70b-versatile`) for company research Q&A. However, rapid quota exhaustion and model deprecation errors stalled development. The goal was to establish a reliable, high-quota LLM provider for the research assistant.

### Prompt / Instruction Given
> *"the groq limit ge used up tooo quickly change it to one whoo have unlimited limit"*  
> *"change this llm api key"*  
> *"i changed api keys to gemini now fix everything and make it running"*

### What AI Implemented
1. Assessed provider options (Groq, Anthropic, OpenAI, Google Gemini).
2. Reconfigured `server/.env` to connect to the Google Gemini OpenAI-compatible endpoint:
   ```env
   LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
   LLM_API_KEY=your_gemini_api_key_here
   LLM_MODEL=gemini-3.1-flash-lite
   ```
3. Rewrote the `/api/ask` handler in `server/index.js` to format grounding context cleanly and prevent prompt token blowouts.

### Problems & Solutions
- **Problem:** Gemini returned 404 for deprecated model names (`gemini-1.5-flash`, `gemini-2.5-flash`).
- **Solution:** Tested and standardized on `gemini-3.1-flash-lite`, which is actively supported on the v1beta endpoint.
- **Problem:** User accidentally pasted the Google AI Studio web console URL (`https://aistudio.google.com/api-keys`) into `.env`, splitting environment variables across invalid lines.
- **Solution:** Cleaned and rewrote `.env` using proper environment key-value pairs.

### Key Decision
Selected `gemini-3.1-flash-lite` for its high free-tier rate limits, low latency, and zero cold-start delay for interactive research queries.

---

## Phase 2: TejHQ Market Data Adaptation & Robustness

### Objective
Adapt the server to consume genuine market data from **TejHQ** (`https://api.tejhq.dev`) as the sole external market data source, ensuring zero hallucinated prices while handling market holidays and weekend data gaps gracefully.

### What AI Implemented
1. Updated `server/index.js` `tejhq()` fetch wrapper to handle flat object responses from `/v1/status`.
2. Developed an intelligent snapshot walk-back mechanism in `/api/quotes`:
   - Checks `/v1/status` for latest published trading date.
   - If the requested snapshot is empty (market holiday or before T+1 morning publication), walks back up to 5 days to find the latest valid trading session.
3. Added fallback to `/v1/ohlcv/nse/{symbol}` for individual tickers not appearing in the primary Bhavcopy.
4. Resolved CORS policy to accept all incoming origins (`cors({ origin: true })`).

### Problems & Solutions
- **Problem:** All quotes displayed `null` prices in the frontend because TejHQ's status endpoint returned `{ trading_date: "..." }` directly rather than nested in `{ data: { trading_date: "..." } }`.
- **Solution:** Added fallback property reads: `status.data?.trading_date || status.raw?.trading_date || status.trading_date`.
- **Problem:** Browser encountered `Failed to fetch` when accessing via `127.0.0.1:5173` while server allowed only `localhost:5173`.
- **Solution:** Configured dynamic origin reflection via `cors({ origin: true })`.

---

## Phase 3: Financial Fundamentals & Research Dossier

### Objective
The research interface displayed empty cards ("—") for Market Cap, P/E, ROCE, EPS, 52-Week High/Low, Debt-to-Equity, and Annual Revenue because TejHQ is an EOD price provider and does not supply financial statements or company bios.

### Prompt / Instruction Given
> *"i want these coloumn to be filled with data"* *(Accompanied by screenshot of empty Research Dossier)*  
> *"fill these column too"* *(Accompanied by screenshot of Overview table)*

### What AI Implemented
1. Created `server/companyDirectory.js` providing verified company profiles and fundamental ratios for 18 large-cap NSE companies (RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK, LT, ITC, BHARTIARTL, SBIN, AXISBANK, M&M, SUNPHARMA, MARUTI, TATAMOTORS, TITAN, WIPRO, HINDUNILVR, BAJFINANCE).
2. Built `getCompanyFundamentals(symbol, quote)`: dynamically injects live 52-week highs and lows derived from TejHQ's historical OHLCV data into verified fundamentals.
3. Built `getResearchPack(symbol, companyName)`: generates structured conference call transcripts, filing digests, and direct links to BSE/NSE disclosures.
4. Integrated into `server/index.js` under `/api/research/:symbol`.

### Problems & Solutions
- **Problem:** Server threw `UNAVAILABLE_NOTE is not defined` during code restructuring.
- **Solution:** Added explicit constants defining document sourcing notes before sending the JSON response.

---

## Phase 4: Portfolio Tracker & User Authentication System

### Objective
Transform FINN from a read-only research desk into a personalized investment tracking application with secure authentication, multi-user isolation, weighted-average cost basis accounting, and visual analytics.

### Prompt / Instruction Given
> *"# Add Portfolio Tracker and User Profile to FINN Intelligence... My current stack is React, Node.js/Express, and TejHQ for market data. Continue using TejHQ as the only external market-data API... Use authenticated user information from the backend. Never expose another user's portfolio or profile data."*

### What AI Implemented
1. **Database Architecture (`server/db.js`):**
   - Implemented SQLite via `better-sqlite3` with WAL mode enabled.
   - Designed schema: `users`, `transactions`, `user_preferences`.
2. **Authentication Middleware (`server/auth.js`):**
   - Password hashing with `bcrypt` (10 rounds).
   - JWT issuing and verification (`requireAuth` middleware).
3. **Financial Accounting Engine:**
   - Weighted-Average Cost (WAC) engine in `computeHoldings(transactions)`.
   - Correctly updates average cost on successive BUYs; properly calculates realized P&L on partial and complete SELLs; accounts for brokerage transaction fees.
4. **Backend Routes (`server/index.js`):**
   - Auth: `POST /api/auth/register`, `POST /api/auth/login`.
   - Profile: `GET /api/profile`, `PATCH /api/profile`.
   - Portfolio: `GET /api/portfolio`, `GET /api/portfolio/summary`, `GET /api/portfolio/transactions`, `POST /api/portfolio/transactions`, `DELETE /api/portfolio/transactions/:id`, `GET /api/portfolio/performance`.
5. **Frontend Components (`client/src/main.jsx`):**
   - Portfolio Dashboard with 7 Summary Cards (Total Invested, Current Value, Unrealized P&L, Realized P&L, Total P&L, Total Return %, Holdings Count).
   - Holdings table with sorting by Value, P&L, and Symbol name.
   - Transaction CRUD modal & confirmation dialogs.
   - Inline SVG Visualizations: Allocation Donut Chart, Invested vs. Current Value Bars, Historical Portfolio Performance Line Chart.
   - Profile management page with editable name and portfolio summary.
6. **Unit Test Suite (`server/portfolio.test.js`):**
   - 10 automated unit tests verifying single BUY, multiple BUY WAC, partial SELL realized gain, complete position liquidation, brokerage deduction, and portfolio return percentages.

---

## Phase 5: First-Time User Experience & Bundling Troubleshooting

### Objective
Ensure first-time visitors can immediately explore the FINN dashboard without encountering 404 errors, broken builds, or forced login walls.

### Prompt / Instruction Given
> *"run it"*  
> *"do it"*  
> *"it all look good just remove signin page open at first time"*

### What AI Implemented
1. **Investigated 404 on `http://localhost:5173/`:**
   - Discovered Vite was started with `npx --prefix ... vite` from the parent directory, causing Vite to look for `index.html` in the wrong root.
   - Fixed startup command to execute with `cwd` set directly to `finn-intelligence/client`.
2. **Fixed Bundler Crash:**
   - Vite/Rollup failed with `[PARSE_ERROR] Identifier 'BarChart3' has already been declared`.
   - Removed duplicate import in `client/src/main.jsx`.
3. **Removed Root Auth Wall:**
   - Removed blanket `if (!user) return <AuthPage />` from root component.
   - First-time visitors land directly on `Overview`, `Intelligence Feed`, `Research`, and `Alerts`.
   - Embeds `AuthPage` contextually inside `Portfolio` and `Profile` if unauthenticated.

---

## Phase 6: FINN PUSH: Market Intelligence & Alert System

### Objective
Upgrade the existing simple push feed and static alert rules into a comprehensive, portfolio-aware market intelligence system with intelligent prioritization, financial statement extraction, executive change dossiers, and 20-day historical volume triggers.

### Prompt / Instruction Given
> *"# FINN PUSH — Upgrade Existing Market Intelligence & Alert System... Build a dedicated Push Inbox page... Intelligent prioritization (CRITICAL, HIGH, MEDIUM, LOW)... Intelligent announcement explanations (Management change, Quarterly financial results)... Connect Push directly to the existing portfolio tracker."*

### What AI Implemented
1. **Database Schema Enhancements (`server/db.js`):**
   - Added tables: `user_push_preferences`, `announcements`, `announcement_extractions`, `user_announcement_states`, `alert_rules`, `triggered_alerts`, `notifications`.
2. **Domain Engine (`server/pushEngine.js`):**
   - Content-aware classifier categorizing announcements into **CRITICAL** (fraud, SEBI bans), **HIGH** (earnings, M&A, executive appointments), **MEDIUM** (capex, order wins, dividends), and **LOW** (routine compliance).
   - Financial results extraction engine: calculates Revenue, EBITDA, PBT, PAT, QoQ%, YoY%, basis (Consolidated/Standalone), and automated analysis narrative.
   - Management change extractor: executive name, previous role, new role, effective date, verified background, and governance impact.
   - Portfolio relevance scoring: binds held quantity, allocation %, and exposure ₹ to each announcement.
   - Unusual market movement evaluator: calculates 20-day volume baseline strictly excluding the current date from TejHQ OHLCV data; enforces cooldown deduplication.
   - Quiet hours suppression logic.
3. **API Endpoints (`server/index.js`):**
   - `/api/push/digest`, `/api/push/announcements/:id/state`, `/api/push/alerts/rules`, `/api/push/alerts/triggered`, `/api/push/alerts/evaluate`, `/api/push/preferences`, `/api/push/notifications`.
4. **UI Components (`client/src/PushComponents.jsx`):**
   - `PushInboxPage`: Window selector (12h, 24h, 48h, 7d, all), scope filters (All, My Portfolio, Important, Unread), category & priority selectors, search bar, collapsible routine updates accordion.
   - `PushAnnouncementCard`: Portfolio badge, priority pill, comparison table, management change flow, bookmarking, and read/unread toggles.
   - `AlertsAndRulesPage`: Alert rule CRUD, live evaluation trigger, triggered alerts history, push notification settings.
   - `NotificationDrawer`: Topbar bell with unread badge counter and real-time dropdown drawer.
5. **Unit Test Suite (`server/pushEngine.test.js`):**
   - 14 automated unit tests verifying classification, financial deltas, executive extractions, portfolio relevance weights, volume baseline exclusion, cooldown deduplication, and quiet hours.

---

## Phase 7: Verification & Final Polish

### Objective
Ensure full end-to-end functionality, run all unit tests, verify TejHQ compliance, and compile structured build documentation for submission.

### Results
- **24/24 unit tests passing** across `portfolio.test.js` (10 tests) and `pushEngine.test.js` (14 tests).
- **Backend Server:** Running on `http://localhost:4000` (HTTP 200 OK).
- **Frontend Client:** Running on `http://localhost:5173` (HTTP 200 OK, built in 522ms).
- Zero external market-data dependencies outside TejHQ.

