# FINN — Financial Investment Intelligence

Mobile-first prototype for the ENAM AI Engineer Build Challenge.

---

## What's implemented

- React dashboard with market watch, corporate actions feed, research workspace, alert rules, and source/freshness labels.
- Express API that keeps provider credentials on the server.
- **TejHQ** integration for EOD quotes (last-session close from the daily snapshot), historical OHLCV charts, back-adjusted prices (free key), and corporate actions (dividends, splits, bonuses, mergers, rights).
- Server-side caching to stay within API call budgets.
- Deterministic corporate-action classification and priority scoring, plus configurable price/volume alert rules.
- Optional OpenAI-compatible LLM endpoint for source-grounded research Q&A.
- No fabricated market data. If the API returns nothing, the UI says so.

---

## Migration from Tapetide → TejHQ

All Tapetide API calls, environment variables (`TAPETIDE_TOKEN`, `TAPETIDE_BASE_URL`), and Tapetide-specific response parsers have been removed and replaced with TejHQ equivalents.

### What changed

| Area | Before (Tapetide) | After (TejHQ) |
|---|---|---|
| Quotes | `/quotes/live` — session-live prices | `/v1/snapshot/{exchange}` — EOD close from latest published bhavcopy |
| Historical chart | `/stocks/{symbol}/prices/daily` | `/v1/ohlcv/nse/{symbol}` (keyless) or `/v1/adjusted/nse/{symbol}` (free key) |
| Corporate actions | `/stocks/{symbol}/events` with `type=filings` | `/v1/actions/{symbol}` — verified corporate actions only |
| Market status | `/market/status` | `/v1/status` — pipeline freshness (last trading date published) |
| Company profile | `/stocks/{symbol}` | ❌ Not available via TejHQ (see Limitations) |
| Filings / news | `/stocks/{symbol}/events` | ❌ Not available via TejHQ (see Limitations) |
| Documents / earnings calls | `/stocks/{symbol}/documents`, `/earnings-calls` | ❌ Not available via TejHQ (see Limitations) |
| Env vars | `TAPETIDE_TOKEN`, `TAPETIDE_BASE_URL` | `TEJHQ_API_KEY`, `TEJHQ_BASE_URL`, `TEJHQ_EXCHANGE` |

---

## TejHQ API details

**Base URL:** `https://api.tejhq.dev`

### Authentication

TejHQ uses Bearer-token authentication (`Authorization: Bearer tej_live_...`).

| Tier | Cost | Endpoints unlocked |
|---|---|---|
| **Open / keyless** | Free, no registration | `/v1/ohlcv`, `/v1/snapshot`, `/v1/actions`, `/v1/status`, `/health` |
| **Free key** | Free — email sign-in at [tejhq.dev/keys](https://tejhq.dev/keys) | + `/v1/adjusted` (back-adjusted prices), `/v1/symbols` |
| **Retail** | ₹599/month | + `/v1/metrics`, `/v1/batch`, `/v1/resolve`, `/v1/screener`, `/v1/universe` |
| **Pro** | ₹4,999/month | Same as Retail, 500,000 calls/day |

**Rate limits (free key):** 1,000 calls/day, 300/minute.

FINN uses only the keyless and free-key endpoints.

### Credentials — where to obtain

1. Visit [https://tejhq.dev/keys](https://tejhq.dev/keys)
2. Enter your email address — a one-time sign-in link is sent.
3. Click the link to receive your key in the format `tej_live_<32 hex characters>`.
4. Set `TEJHQ_API_KEY=tej_live_...` in `server/.env`.

If `TEJHQ_API_KEY` is not set or left as `replace_with_your_free_key`, the server
uses only the keyless endpoints (OHLCV + snapshot + corporate actions). Back-adjusted
charts are disabled but raw EOD charts still work.

---

## Known limitations compared to Tapetide

The following features that were previously backed by Tapetide are **not available** through TejHQ.
The relevant UI sections are preserved and show a clear unavailability message.

| Feature | Status |
|---|---|
| Live intraday prices | ❌ TejHQ is **EOD only**. Prices shown are the previous session's close. |
| Company profile (CEO, sector, employees, website) | ❌ Not provided by TejHQ |
| Financial fundamentals (P/E, EPS, ROCE, ROE, debt ratios, market cap) | ❌ Not provided by TejHQ |
| NSE regulatory filings and filing PDFs | ❌ Not provided by TejHQ |
| Earnings-call transcripts and summaries | ❌ Not provided by TejHQ |
| Parsed document digests | ❌ Not provided by TejHQ |
| Volume alerts (20-day average volume) | ⚠️ Requires Retail/Pro key (`/v1/metrics`). Not available on free tier. |
| Fuzzy stock search | ⚠️ Requires Retail/Pro key (`/v1/resolve`). Not available on free tier. |

**FINN does not fabricate any of the above values.** The research dossier and intelligence feed
show corporate-actions data (dividends, splits, bonuses, mergers) which TejHQ genuinely provides.

---

## Requirements

- Node.js 20+
- TejHQ keyless endpoints work with no registration.
- Free TejHQ API key (recommended): [https://tejhq.dev/keys](https://tejhq.dev/keys)
- Optional OpenAI-compatible API key for AI Q&A

---

## Windows PowerShell — installation and startup

### 1. Configure the backend

```powershell
cd finn-intelligence\server
npm install
Copy-Item .env.example .env
# Then edit .env — set TEJHQ_API_KEY to your free key (or leave as placeholder for keyless mode)
notepad .env
```

### 2. Start the backend

```powershell
npm run dev
```

Backend runs at: `http://localhost:4000`

### 3. Start the frontend (second terminal)

```powershell
cd finn-intelligence\client
npm install
npm run dev
```

Open the Vite URL shown in the terminal (usually `http://localhost:5173`).

---

## Deploy

- Deploy `server` to Render, Railway, or another Node host.
- Set `TEJHQ_BASE_URL`, `TEJHQ_API_KEY`, `TEJHQ_EXCHANGE`, `CLIENT_ORIGIN`, and optional LLM variables in the host's secret settings.
- Deploy `client` to Vercel or Netlify and set `VITE_API_BASE` to the deployed server URL (without trailing slash).
- Never commit `.env` or expose API keys in frontend environment variables.

---

## Main backend endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | Health check; reports provider and AI configuration |
| `GET /api/market/status` | TejHQ pipeline freshness (last trading date published) |
| `GET /api/quotes?symbols=RELIANCE,TCS,...` | EOD quotes from TejHQ snapshot |
| `GET /api/stocks/:symbol/chart?range=1M` | OHLCV chart (1W/1M/3M/6M/1Y); back-adjusted if free key present |
| `GET /api/events/:symbol` | Corporate actions for a symbol |
| `GET /api/feed?symbols=RELIANCE,...` | Corporate actions for up to 5 symbols |
| `GET /api/research/:symbol` | EOD price + corporate actions; profile/fundamentals marked unavailable |
| `POST /api/ask` | AI Q&A grounded in TejHQ data |
| `POST /api/alerts/evaluate` | Evaluate price-move alerts against supplied quotes |

---

## How to verify genuine TejHQ data is being returned

1. Start the backend and open `http://localhost:4000/api/health` — confirm `"provider": "TejHQ"`.
2. Open `http://localhost:4000/api/market/status` — confirm `trading_date` is a recent weekday.
3. Open `http://localhost:4000/api/quotes?symbols=RELIANCE` — check `meta.source` is `"TejHQ EOD Snapshot"` and `meta.trading_date` matches the most recent trading day.
4. Open `http://localhost:4000/api/stocks/RELIANCE/chart?range=1M` — check `source` is `"tejhq_ohlcv"` or `"tejhq_adjusted"` (not `"historical_series"`).
5. Open `http://localhost:4000/api/events/RELIANCE` — check `meta.source` is `"TejHQ"`.

---

## How caching works

| Cache key | TTL (default) | Env override |
|---|---|---|
| TejHQ snapshot (quotes) | 60 min | `QUOTE_CACHE_MS` |
| OHLCV / adjusted (charts) | 30 min | `CHART_CACHE_MS` |
| Corporate actions (events/feed) | 60 min | `EVENT_CACHE_MS` |
| Pipeline status | 5 min | `STATUS_CACHE_MS` |
| Research (OHLCV + actions combo) | 15 min | `RESEARCH_CACHE_MS` |

Snapshots for past dates are immutable and cached at the Cloudflare edge by TejHQ indefinitely.
Server-side cache keeps repeated frontend refreshes from consuming daily call budgets.

---

## Environment variables reference

### `server/.env`

```
PORT=4000
CLIENT_ORIGIN=http://localhost:5173

TEJHQ_BASE_URL=https://api.tejhq.dev    # Do not change
TEJHQ_API_KEY=tej_live_...              # Free key from https://tejhq.dev/keys (optional but recommended)
TEJHQ_EXCHANGE=nse                      # nse or bse

LLM_BASE_URL=https://api.openai.com/v1  # OpenAI-compatible base URL
LLM_API_KEY=                            # Optional
LLM_MODEL=gpt-4o-mini

QUOTE_CACHE_MS=3600000
EVENT_CACHE_MS=3600000
RESEARCH_CACHE_MS=900000
CHART_CACHE_MS=1800000
STATUS_CACHE_MS=300000
```

### `client/.env`

```
VITE_API_BASE=http://localhost:4000
```

---

## Challenge requirements mapping

- **Push / windowed digest:** corporate-actions feed with priority scoring, date-window filter, and action categories (dividend, split, bonus, merger, rights).
- **Triggered alerts:** configurable daily price-change rules evaluated against TejHQ EOD data.
- **Results analysis:** research panel shows available TejHQ data (EOD prices, derived 52w high/low, corporate actions) and clearly marks unavailable fundamentals.
- **Pull / ad-hoc research:** any NSE ticker can be researched; TejHQ OHLCV history and actions are used as context.
- **Primary sources:** research responses are constrained to TejHQ data and cited by trading date; AI is not given fabricated information.
- **Mobile-first UI, repository, README, and deployment guidance.**

---

## Known limitations / honest scope

- TejHQ is **EOD only**. Prices displayed are end-of-day closes, not live intraday quotes.
- Company profiles, financial fundamentals, filing documents, and earnings-call transcripts are **not available through TejHQ**.
- Volume-based alerts require the `/v1/metrics` endpoint (Retail/Pro key). On the free tier, average volume is unavailable and volume alerts will not fire.
- Data coverage: NSE from 2010-01-04, BSE from 2024-07-08.
- AI output quality depends on the configured model. TejHQ data provides price/actions context only; AI cannot produce fundamental analysis without that data.
- This is an informational prototype, not investment advice or an order-execution system.


---

## FINN PUSH: Market Intelligence & Alert System

FINN PUSH is a portfolio-aware market intelligence and alert system designed to proactively monitor material market disclosures and notify users of critical portfolio events.

### Key Capabilities

1. **Windowed Intelligence Digest (Push Inbox)**:
   - Selectable time windows: Last 12h, 24h (default), 48h, 7d, all available.
   - Intelligent prioritization: **CRITICAL** (red), **HIGH** (amber), **MEDIUM** (blue), and **ROUTINE** (collapsed accordion).
   - Routine updates (compliance certificates, trading window closures, loss of share scrips) are collapsed by default to avoid alert fatigue.
   - Multi-dimensional filters: Portfolio Only vs Watchlist, Announcement Category, Priority, Read/Unread, Starred (Important).

2. **Intelligent Announcement Explanations**:
   - **Quarterly Financial Results**: Extracts Revenue from Operations, Operating EBITDA, PBT, and PAT across quarters; automatically calculates QoQ% and YoY% deltas, preserves accounting basis (Consolidated vs Standalone), and summarizes drivers.
   - **Management Transitions**: Extracts executive name, previous role, new designation, effective date, verified professional background, and why the leadership change matters to investors.
   - **Material Updates**: Summarizes key event disclosures and analyzes positive/negative margin and cash flow implications.

3. **Portfolio-Aware Relevance Scoring**:
   - Directly links to user's recorded stock transactions (weighted-average cost basis).
   - Annotates each announcement with held share quantity, portfolio allocation %, and approximate rupee exposure.
   - Stocks with higher portfolio allocation receive a higher relevance weighting.

4. **Triggered Alert Engine**:
   - **Corporate Announcement Alerts**: Configurable event categories and minimum priority thresholds.
   - **Unusual Market Movements**:
     - Daily price change thresholds (e.g. ±3.0%).
     - Volume breakouts calculated against a 20-day historical average **strictly excluding the current trading date** from TejHQ OHLCV data.
     - Enforces customizable cooldown windows (e.g. 240 mins) to prevent duplicate alert spam.
   - Labeled with verified TejHQ EOD data dates.

5. **Notification Experience**:
   - Topbar Notification Bell with unread badge counter and real-time dropdown drawer.
   - Browser push notification support using Web Notification API.
   - Quiet Hours (Do Not Disturb) suppression spanning overnight periods (e.g. 22:00 to 08:00).

### API Endpoints

- `GET /api/push/digest`: Returns windowed announcements grouped by Critical, High, Medium, and Routine, enriched with portfolio context and stats.
- `POST /api/push/announcements/:id/state`: Toggle read, important, or archived state.
- `GET /api/push/alerts/rules`: List user's active and paused alert rules.
- `POST /api/push/alerts/rules`: Create a new price, volume, or announcement alert rule.
- `PATCH /api/push/alerts/rules/:id`: Update or pause/resume an alert rule.
- `DELETE /api/push/alerts/rules/:id`: Delete an alert rule.
- `GET /api/push/alerts/triggered`: Retrieve chronological log of triggered market events.
- `POST /api/push/alerts/evaluate`: Evaluate rules against latest TejHQ EOD data.
- `GET /api/push/preferences` & `PATCH /api/push/preferences`: User notification and quiet hour settings.
- `GET /api/push/notifications` & `POST /api/push/notifications/clear`: In-app notification center.

### Running Test Suites

```bash
# Portfolio weighted-average cost & return calculations (10 tests)
node --test server/portfolio.test.js

# FINN PUSH Engine calculations, extractions & alerts (14 tests)
node --test server/pushEngine.test.js
```
Total: 24/24 unit tests passing.
