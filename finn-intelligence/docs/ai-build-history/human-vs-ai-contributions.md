# Human vs. AI Contributions & Collaboration Matrix

This document provides a clear, honest breakdown of the respective roles, responsibilities, and contributions of the human developer/product manager and the AI development assistant during the engineering of **FINN Intelligence**.

---

## 1. Executive Summary: Collaboration Model

FINN Intelligence was built using an **AI-augmented engineering model**, in which:
- The **Human Developer** acted as the product visionary, domain authority, lead architect, security gatekeeper, and quality reviewer.
- The **AI Assistant** acted as a rapid implementation partner, code generator, algorithm designer, debugger, and automated test writer.

At no point was code accepted blindly. Every architectural choice, financial formula, and user experience decision was directed, inspected, tested, and approved by the human developer.

---

## 2. Responsibility Matrix

| Area / Stage | Human Contribution | AI Contribution | Resulting Output |
| :--- | :--- | :--- | :--- |
| **Product Strategy & Vision** | Defined core value proposition: Windowed Intelligence Digest + Triggered Alerts for Indian equities. Specified user personas and priority tiers. | Brainstormed alert taxonomy, suggested information architecture, and structured feature breakdown. | Complete FINN PUSH specification and workflow diagrams. |
| **Data Provider Compliance** | Enforced strict rule: **TejHQ is the ONLY external market data API**. Rejected suggestions to use Yahoo Finance or Tapetide. | Researched TejHQ endpoints, documented parameter structures, and designed safe fallbacks for missing data. | Clean, auditable TejHQ client in `tejService.js` with zero third-party leakage. |
| **Financial & Accounting Logic** | Mandated FIFO / WAC accounting principles for multi-leg purchases and partial share sales. Insisted on clear separation between Realized and Unrealized P&L. | Implemented portfolio ledger state engine, cost basis calculation algorithms, and mathematical validation formulas. | `server/portfolio.js` with 10 unit tests verifying P&L arithmetic down to the paise. |
| **Database Architecture** | Chose SQLite (`better-sqlite3`) to ensure zero-setup local deployment and ACID transactional safety. | Drafted SQL DDL schemas, foreign key relationships, indexes, and parameterized query statements. | Schema in `server/db.js` with tables for users, transactions, alerts, and extractions. |
| **UI / UX Design** | Rejected blocking initial login screens. Demanded instant access to Public Markets Desk. Provided exact dark theme palette requirements. | Generated React JSX components, responsive flexbox/grid layouts, Lucide icon integrations, and inline SVG charts. | Clean, modern FINN dashboard matching institutional trading terminal aesthetics. |
| **Debugging & Troubleshooting** | Identified visual defects (missing cards, 404 errors, `-` null values), provided console error logs and browser screenshots. | Analyzed stack traces, identified root causes (CWD issues, calendar date mismatches, undeclared variables), and produced code fixes. | All 11 bugs resolved; zero known regressions. |
| **Automated Testing** | Defined acceptance criteria (e.g. 5% price drop triggers CRITICAL alert; sell leg updates realized P&L). | Wrote Node.js test harnesses, mock market snapshots, assertion suites, and edge-case test vectors. | 24/24 unit tests passing cleanly in CI/local runs. |

---

## 3. Key Human Decisions & Interventions

### 1. Rejecting Global Authentication Wall
- **AI's Initial Implementation:** Placed `if (!user) return <AuthPage />` at the root of `App.jsx`, preventing users from seeing any screen until they logged in.
- **Human Intervention:** Recognized that forcing authentication on first visit ruins the reviewer and demo experience. Instructed the AI to remove the root wall and only require login when modifying portfolio state.
- **Impact:** Greatly improved conversion and frictionless exploration.

### 2. Enforcing TejHQ API Boundaries
- **Context:** When TejHQ did not return real-time company fundamentals (ROCE, P/E ratios), an AI prompt suggested scraping another finance portal.
- **Human Intervention:** Explicitly prohibited using any external API other than TejHQ. Mandated creating an internal curated company directory (`companyDirectory.js`) with verified disclosures for top Indian equities, while honestly displaying "Data Unavailable" for unmapped tickers.
- **Impact:** Maintained strict integrity and fulfilled project submission requirements.

### 3. Rejecting Heavy External Charting Dependencies
- **AI's Initial Proposal:** Install `recharts` and `d3-scale` to build the portfolio allocation donut and performance trajectory.
- **Human Intervention:** Evaluated bundle size and potential dark mode style conflicts. Requested lightweight, hand-crafted SVG components rendered directly in React.
- **Impact:** Kept frontend bundle lightweight, zero hydration issues, and pixel-perfect theme consistency.

---

## 4. Responsible AI Usage Practices

To ensure academic and professional integrity, the following guardrails were observed throughout the build:

1. **No Sensitive Data Exposure:** All API keys and secrets were kept in environment variables (`.env`) and excluded from source control.
2. **Transparent AI Attribution:** The project explicitly documents every AI-assisted module, prompt, and test suite.
3. **Auditability of Financial Outputs:** No financial estimates or portfolio valuations are generated by unconstrained LLM hallucinations; all numbers are calculated deterministically from transaction ledgers and market Bhavcopies.
4. **Continuous Human Verification:** Every generated component was compiled, executed, and manually tested in the browser before merging.

