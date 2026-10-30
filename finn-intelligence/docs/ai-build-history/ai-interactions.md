# Representative AI Interactions & Collaboration Examples

This document details actual, representative interactions between the developer and the AI assistant during the engineering of FINN Intelligence.

---

## Interaction 1 — Feature Planning: Portfolio Tracker & User Profile

### Developer's Prompt (Verbatim Excerpt)
> *"# Add Portfolio Tracker and User Profile to FINN Intelligence*  
> *Modify my existing FINN Intelligence project. Do not rebuild it from scratch or change the existing design unnecessarily.*  
> *My current stack is React, Node.js/Express, and TejHQ for market data. Continue using TejHQ as the only external market-data API.*  
> *1. User profile: Create a dedicated Profile page accessible from the dashboard navigation and user avatar. Display user name, email, profile photo/avatar, total invested, current portfolio value, P&L...*  
> *2. Portfolio tracker: Allow users to add a holding, enter quantity, purchase price, purchase date, brokerage... Record partial sales and full sales. Calculate weighted-average cost basis...*  
> *Write unit tests for purchases, average cost, partial sales, realized P&L, unrealized P&L, and portfolio return calculations."*

### AI's Proposed Approach
1. Install an external PostgreSQL or MongoDB container for persistent storage.
2. Introduce an external charting library like Chart.js or Recharts for visual charts.
3. Scaffold multiple nested frontend routes with `react-router-dom`.
4. Implement weighted-average cost basis accounting and write unit tests using Node's test runner.

### What the Developer Accepted
- Adopted the database approach, but simplified it to **SQLite** (`better-sqlite3`) to ensure a zero-config, single-file embedded database (`finn.db`) without external server dependencies.
- Accepted the mathematical implementation of the **Weighted-Average Cost (WAC)** calculation engine.
- Accepted the Node native test runner (`node:test`) for unit testing without extra testing dependencies.

### What the Developer Changed / Rejected
- **Rejected External Charting Libraries:** Kept bundle sizes lightweight and fast by implementing visual charts as **inline SVG components** (`DonutChart`, `MiniLineChart`, and horizontal allocation bars) matching FINN's dark aesthetic.
- **Rejected Multi-file Routing Scaffolding:** Preserved FINN's established single-page tab navigation (`page` state) to maintain cohesive state and avoid unnecessary router refactoring.

### Final Implementation
- Created `server/db.js` with SQLite tables for `users`, `transactions`, and `user_preferences`.
- Created `server/auth.js` for JWT signing and `bcrypt` password verification.
- Added 10 portfolio unit tests in `server/portfolio.test.js` covering single purchases, WAC updates across multiple BUYs, partial sales, position close-outs, and brokerage fees.
- Verified all 10 tests passed with zero failures.

---

## Interaction 2 — Debugging: Resolving 404 & Bundling Failures

### Problem
After developing the portfolio components, the developer ran the application and encountered an **HTTP 404: No webpage was found for http://localhost:5173/** in the browser, followed by a Vite bundler build error.

### Developer's Prompt
> *"run it"*  
> *(User provided screenshot showing Brave browser displaying: `HTTP ERROR 404 - This localhost page can't be found`)*  
> *"do it"*

### AI's Investigation & Solution
1. **Root Cause Analysis (404):**
   - The command `npx --prefix ... vite --host 0.0.0.0` was executed from the parent workspace root `finn-intelligence-starter`.
   - Because Vite determines the project root by current working directory unless explicitly specified, Vite was looking for `index.html` in `finn-intelligence-starter/index.html` rather than `finn-intelligence-starter/finn-intelligence/client/index.html`.
2. **Root Cause Analysis (Bundler Error):**
   - Running `npm run build` in `client` revealed:
     ```
     [PARSE_ERROR] Identifier 'BarChart3' has already been declared
     - It can not be redeclared here in src/main.jsx at line 7
     ```
   - An earlier automated replacement had replaced `PieChart` with `BarChart3`, creating a duplicate import in `client/src/main.jsx`.
3. **Applied Fixes:**
   - Removed the duplicate `BarChart3` import from `client/src/main.jsx`.
   - Changed startup script to execute `cd finn-intelligence/client; npm run dev`.
   - Tested build with `npm run build` (compiled clean in 492ms).

### How the Issue Was Verified
Ran `curl.exe -I http://localhost:5173/` and confirmed `HTTP/1.1 200 OK` with Content-Type `text/html`. The user refreshed the browser and confirmed the page loaded.

---

## Interaction 3 — User Experience Iteration: Removing the First-Time Auth Block

### Problem
On first opening the application, the user was immediately greeted by a full-screen login / sign-in screen, preventing them from exploring the core FINN dashboard, watchlist, and company research.

### Developer's Prompt (Verbatim)
> *"it all look good just remove signin page open at first time"*

### AI's Analysis & Solution
1. **Identified the Guard:**
   - In `client/src/main.jsx`:
     ```javascript
     // Auth guard
     if (!user) return React.createElement(AuthPage, {onAuth: handleAuth});
     ```
   - This top-level guard blocked the entire component tree whenever `user` was `null` in `localStorage`.
2. **Proposed Solution:**
   - Remove the blanket root guard so first-time users land directly on the `Overview` dashboard.
   - Retain full functionality for Overview, Push Feed, Research, and Alerts for unauthenticated visitors.
   - Contextually embed `AuthPage` inside the `Portfolio` and `Profile` tabs if unauthenticated:
     ```jsx
     {page === "Portfolio" && (user ? <PortfolioPage user={user}/> : <AuthPage onAuth={handleAuth} embedded subtitle="Sign in to track your personal holdings..."/>)}
     {page === "Profile" && (user ? <ProfilePage user={user} onLogout={handleLogout}/> : <AuthPage onAuth={handleAuth} embedded/>)}
     ```
   - Added an `embedded` prop to `AuthPage` so it renders seamlessly inside the workspace content panel rather than forcing a full-screen takeover.

### Developer's Decision & Outcome
Accepted without alteration. The user was able to immediately access and demo the entire market intelligence application, signing in only when ready to manage personal portfolio holdings.

---

## Interaction 4 — Domain Engineering: FINN PUSH Upgrade & Financial Extractions

### Developer's Prompt (Verbatim Excerpt)
> *"# FINN PUSH — Upgrade Existing Market Intelligence & Alert System*  
> *Transform the existing Push feature into a professional portfolio-aware market intelligence and alert system.*  
> *1. Windowed Intelligence Digest — What happened across my portfolio during a selected time period?*  
> *2. Triggered Alerts — Notify me when something crosses my personal importance threshold.*  
> *3. Intelligent Announcement Explanations — This is the most important part of FINN PUSH. Extract useful information from actual filings:*  
> *- Management change: Person name, previous role, new role, effective date, verified background, why it matters.*  
> *- Quarterly financial results: Revenue, EBITDA, PBT, PAT; Current Q, Previous Q, QoQ%, YoY% comparison table.*  
> *4. Routine announcements: Create a separate collapsed section called 'Routine updates'.*  
> *5. Unusual volume alerts: 20-day historical average strictly excluding the current date."*

### AI's Implementation Strategy
1. **Domain Engine (`server/pushEngine.js`):**
   - Built pure function extractors for `extractFinancialResults()` and `extractManagementChange()`.
   - Designed a 4-tier content-aware classifier (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW/ROUTINE`).
   - Implemented `evaluateMarketMovements()` to calculate 20-day historical volume averages excluding the current trading date, preventing baseline pollution.
   - Added deduplication and cooldown checks against `triggered_alerts` in SQLite.
2. **Database Integration:**
   - Extended SQLite schema in `server/db.js` with `announcements`, `announcement_extractions`, `alert_rules`, `triggered_alerts`, and `notifications`.
3. **Frontend Upgrade (`client/src/PushComponents.jsx`):**
   - Created `PushInboxPage` with time windows (`12h`, `24h`, `48h`, `7d`, `all`), scope filters, and the requested collapsed "Routine Updates" accordion.
   - Created `FinancialResultsComparisonTable` rendering the exact 4-metric comparison table with QoQ and YoY deltas.
   - Created `AlertsAndRulesPage` supporting alert rule CRUD, pause/resume, and quiet hours settings.
   - Created `NotificationDrawer` with an unread badge counter in the topbar.
4. **Test-Driven Verification:**
   - Wrote 14 comprehensive unit tests in `server/pushEngine.test.js`.
   - Initial test run revealed an assertion mismatch on signed percentages (`+3.80%` vs `3.80%`). AI promptly updated `pushEngine.js` to format positive deltas with an explicit `+` sign.
   - Reran tests: all 14 unit tests passed. Total project tests: 24 passing.

---

## Summary of Interaction Patterns

Across these key interactions, the collaboration followed a consistent engineering pattern:
1. **Developer drives intent & domain requirements:** Defines financial accounting rules, UX expectations, and strict API constraints.
2. **AI analyzes constraints & proposes architecture:** Explores implementation paths, writes modular backend and frontend code, and designs database schemas.
3. **Developer audits & refines:** Rejects heavy dependencies, demands clean UX (e.g. non-blocking guest access), and tests output against real user scenarios.
4. **AI fixes edge cases & writes verification tests:** Diagnoses runtime errors, rectifies bundler issues, and writes automated tests to prove correctness.

