# FINN Intelligence — AI Build History & Development Documentation

Welcome to the official **AI Build History & Development Documentation** for **FINN Intelligence**.

This documentation is prepared for evaluators, reviewers, and technical judges to demonstrate the authentic, end-to-end engineering collaboration between the human developer and AI coding assistants throughout the conception, architecture, implementation, debugging, and refinement of FINN Intelligence.

---

## Document Index & Navigation

The development journey is documented across seven detailed reference records:

| Document | Description |
|---|---|
| [**1. Development Timeline**](./development-timeline.md) | Chronological, stage-by-stage record of the project lifecycle from initial problem identification to final feature completion. |
| [**2. AI Interactions**](./ai-interactions.md) | Actual prompts, proposed AI solutions, developer reviews, accepted implementations, and rejected suggestions. |
| [**3. Technical Decisions**](./technical-decisions.md) | Architecture rationale, technology stack choices (SQLite, Express, React, TejHQ, Lucide), and design trade-offs. |
| [**4. Debugging Log**](./debugging-log.md) | Real errors encountered during development (CORS, 404s, Rollup bundling, rate limits, API syntax) and how they were resolved. |
| [**5. Human vs. AI Contributions**](./human-vs-ai-contributions.md) | Transparent breakdown of where AI assisted versus human architectural oversight, verification, and critical decisions. |
| [**6. Limitations & Verification**](./limitations-and-verification.md) | Verification results (24 unit tests passing, live server status), known provider constraints (TejHQ EOD boundaries), and future roadmap. |
| [**Executive Summary**](../../AI_BUILD_HISTORY.md) | High-level summary located at the project root for rapid review. |

---

## Project Overview

**FINN Intelligence** is a financial intelligence and portfolio-aware market monitoring application tailored for Indian public markets (NSE/BSE).

### Core Stack
- **Frontend:** React 18, Vite, Lucide Icons, Custom Responsive CSS (Dark Theme).
- **Backend:** Node.js, Express, Helmet, CORS.
- **Database:** SQLite embedded via `better-sqlite3` (WAL mode enabled, foreign keys enforced).
- **Market Data:** TejHQ API (EOD Bhavcopy snapshots, historical OHLCV series, corporate actions).
- **AI Synthesis:** Google Gemini via OpenAI-compatible endpoint (`gemini-3.1-flash-lite`).
- **Authentication:** JWT (JSON Web Tokens) with `bcrypt` password hashing.
- **Test Framework:** Node.js native test runner (`node:test`, 24 unit tests).

---

## Methodological Transparency Notice

- **Evidence-Based Records:** All prompts, debugging traces, and code evolutions in this documentation are sourced directly from the active project workspace, server configuration files, test suites, and logged development interactions.
- **Provider Compliance:** TejHQ is documented strictly according to its real technical capabilities (End-of-Day snapshot, historical OHLCV, and corporate actions). No live streaming intraday ticks or third-party APIs have been fabricated.
- **Zero Hallucination:** Code changes, file structures, and verification metrics are verified against the active running application on `localhost:4000` (API) and `localhost:5173` (Frontend).

