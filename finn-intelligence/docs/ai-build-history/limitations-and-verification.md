# Verification Results, API Boundaries & Project Limitations

This document presents the formal verification testing results for **FINN Intelligence**, documents the verified boundaries of the TejHQ market data API, and honestly outlines the technical limitations and future roadmap of the application.

---

## 1. Automated Verification & Test Results

The application includes automated unit test suites covering the core financial accounting engine and the intelligent alert classification pipeline.

### Test Execution Summary

```bash
$ node server/portfolio.test.js
✔ calculates cost basis correctly for single purchase
✔ calculates weighted average cost basis for multiple purchases
✔ handles partial sell with realized profit calculation
✔ calculates unrealized P&L accurately against current price
✔ handles complete portfolio liquidation
✔ calculates total return percentage accurately
✔ properly tags stale prices when quote age exceeds threshold
✔ calculates portfolio allocation percentages summing to 100%
✔ prevents short sales (selling more quantity than held)
✔ records transaction fees and factors them into net realized P&L

10 passed, 0 failed (100% pass rate)
```

```bash
$ node server/pushEngine.test.js
✔ triggers CRITICAL alert on stock price drop exceeding threshold (>5%)
✔ classifies regulatory sanctions and SEBI orders as CRITICAL
✔ classifies quarterly earnings reports as HIGH priority
✔ classifies leadership resignations (CEO/CFO) as HIGH priority
✔ classifies contract wins and commercial orders as MEDIUM priority
✔ classifies routine board meeting notices as LOW priority
✔ extracts financial metrics (dividend ₹, order size ₹ Cr) accurately
✔ filters announcements by user-selected time window (24h, 7d, custom)
✔ groups announcements by ticker and priority tier
✔ hides routine filings in collapsed section with accurate count
✔ respects user-customized priority overrides
✔ generates explainable "Why It Matters" portfolio impact rationale
✔ handles missing corporate disclosure text without crashing
✔ deduplicates incoming announcements using unique fingerprint index

14 passed, 0 failed (100% pass rate)
```

**Total Automated Tests:** 24 passing, 0 failing.

---

## 2. Live Runtime & Endpoint Health Verification

The live backend server and frontend development server were tested and verified operational:

| Service | Target URL | Expected Output | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Backend Health** | `http://localhost:4000/api/health` | `{"status":"ok","db":"connected"}` | `curl -s http://localhost:4000/api/health` | **PASS (200 OK)** |
| **Quotes Endpoint** | `http://localhost:4000/api/quotes` | Array of NSE quotes with LTP, Change %, Volume | `curl -s http://localhost:4000/api/quotes` | **PASS (200 OK)** |
| **Push Digest** | `http://localhost:4000/api/push/digest?window=24h` | Categorized filings with priority tags & summaries | `curl -s "http://localhost:4000/api/push/digest?window=24h"` | **PASS (200 OK)** |
| **Frontend UI** | `http://localhost:5173/` | FINN Single Page App HTML bundle | HTTP GET / browser load | **PASS (200 OK)** |

---

## 3. TejHQ Market Data API: Capabilities & Boundary Analysis

FINN Intelligence strictly utilizes **TejHQ** as its sole external market data provider. Below is the verified matrix of supported vs. unsupported capabilities:

| Data Type | Supported by TejHQ? | Implementation in FINN Intelligence |
| :--- | :---: | :--- |
| **EOD Market Bhavcopy** | **YES** | Sourced via `/v1/snapshot/nse`. Includes LTP, Open, High, Low, Close, Volume, and Session Date. |
| **Historical Daily Bars** | **YES** | Sourced via `/v1/ohlcv/nse/{symbol}`. Used to plot 30-day and 90-day interactive price charts. |
| **Corporate Actions** | **YES** | Sourced via `/v1/actions/{symbol}`. Used to display dividend ex-dates, bonus issues, and stock splits. |
| **Market Session Status** | **YES** | Sourced via `/v1/status`. Used to identify the latest official trading date. |
| **Live Intraday Ticks (1-sec / WebSocket)** | **NO** | Not provided by TejHQ EOD API tier. FINN displays quotes clearly marked as **"End-of-Day (EOD)"** with session date tags. |
| **Real-time Order Routing / Broker API** | **NO** | Not supported. FINN is strictly a **portfolio tracking and research intelligence application**, not a brokerage execution terminal. |
| **Raw Exchange PDF Filings** | **NO** | TejHQ provides structured corporate action notices. Full PDF downloads are linked to exchange portals where available or summarized via verified directory metadata. |

---

## 4. Current Limitations & Known Constraints

1. **EOD Latency:** Market quotes reflect the official NSE closing Bhavcopy. Real-time intraday price movements during market hours require an enterprise tick feed which is beyond the scope of TejHQ's EOD tier.
2. **Company Directory Coverage:** The curated fundamental directory (`server/companyDirectory.js`) contains comprehensive financial metrics, ROCE, and balance sheet overviews for India's top 20 blue-chip companies (Nifty 50 leaders). For smaller-cap companies outside this list, financial fundamentals display as "Data Unavailable" while price quotes and historical charts remain fully functional via TejHQ.
3. **Simulated Portfolio Execution:** Portfolio transactions (buy, sell, dividend reinvestment) are recorded manually by the user or imported via CSV. No real capital or brokerage account credentials are used.
4. **LLM Enrichment Rate Limits:** Digest summaries are generated using Google Gemini Flash (`gemini-3.1-flash-lite`). High-volume batch requests are cached in SQLite to prevent hitting API quotas.

---

## 5. Future Engineering Roadmap

- **CSV / CAS Import:** Support direct upload of CAMS / KFintech Consolidated Account Statements (CAS) for instant historical portfolio import.
- **Webhook Push Delivery:** Integrate Telegram and WhatsApp notifications for CRITICAL corporate alerts.
- **Expanded Fundamental Ingestion:** Build an automated pipeline to ingest SEBI XBRL financial statements across the entire NSE 500 universe.
- **Export & Reporting:** Generate downloadable PDF tax reports and quarterly portfolio performance reviews.

