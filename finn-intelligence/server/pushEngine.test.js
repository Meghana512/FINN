/**
 * pushEngine.test.js — Unit tests for FINN PUSH Engine
 * Run with: node --test pushEngine.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyAnnouncement,
  extractFinancialResults,
  extractManagementChange,
  scorePortfolioRelevance,
  evaluateMarketMovements,
  isQuietHours,
  PRIORITY_LEVELS
} from "./pushEngine.js";

// ---------------------------------------------------------------------------
// 1. Classification Tests
// ---------------------------------------------------------------------------

test("Classification: Major fraud / SEBI ban is CRITICAL", () => {
  const result = classifyAnnouncement("SEBI ban order and forensic audit initiated into subsidiary accounts");
  assert.equal(result.priority, PRIORITY_LEVELS.CRITICAL);
  assert.equal(result.category, "regulatory");
  assert.equal(result.is_routine, 0);
});

test("Classification: Quarterly financial results are HIGH priority", () => {
  const result = classifyAnnouncement("Financial Results for the quarter ended September 30, 2026");
  assert.equal(result.priority, PRIORITY_LEVELS.HIGH);
  assert.equal(result.category, "results");
  assert.equal(result.is_routine, 0);
});

test("Classification: Appointment of CEO / CFO is HIGH priority", () => {
  const result = classifyAnnouncement("Appointment of Chief Financial Officer and Key Managerial Personnel");
  assert.equal(result.priority, PRIORITY_LEVELS.HIGH);
  assert.equal(result.category, "management_change");
  assert.equal(result.is_routine, 0);
});

test("Classification: Order win or Mega contract is MEDIUM priority", () => {
  const result = classifyAnnouncement("L&T Construction awarded order win of ₹7,000 Cr for metro rail corridor");
  assert.equal(result.priority, PRIORITY_LEVELS.MEDIUM);
  assert.equal(result.category, "contracts");
  assert.equal(result.is_routine, 0);
});

test("Classification: Compliance certificate / trading window closure is LOW / ROUTINE", () => {
  const result = classifyAnnouncement("Compliance certificate under Regulation 7(3) and trading window closure");
  assert.equal(result.priority, PRIORITY_LEVELS.LOW);
  assert.equal(result.is_routine, 1);
});

// ---------------------------------------------------------------------------
// 2. Financial Extraction Tests
// ---------------------------------------------------------------------------

test("Financial Extraction: Computes QoQ% and YoY% accurately for 4 key metrics", () => {
  const extraction = extractFinancialResults({
    symbol: "INFY",
    company_name: "Infosys",
    period: "Q2 FY27",
    basis: "Consolidated",
    metrics: {
      revenue: { current: 40000, previous_quarter: 38000, same_quarter_last_year: 35000 },
      ebitda:  { current: 9000,  previous_quarter: 8500,  same_quarter_last_year: 8000 },
      pbt:     { current: 8000,  previous_quarter: 7500,  same_quarter_last_year: 7000 },
      pat:     { current: 6000,  previous_quarter: 5800,  same_quarter_last_year: 5400 }
    }
  });

  assert.equal(extraction.type, "FINANCIAL_RESULTS");
  assert.equal(extraction.period, "Q2 FY27");
  assert.equal(extraction.basis, "Consolidated");
  assert.equal(extraction.rows.length, 4);

  const rev = extraction.rows.find(r => r.metric_key === "revenue");
  assert.equal(rev.current_quarter, 40000);
  // QoQ: (40000 - 38000) / 38000 * 100 = 5.26%
  assert.equal(rev.qoq_change_pct, 5.26);
  // YoY: (40000 - 35000) / 35000 * 100 = 14.29%
  assert.equal(rev.yoy_change_pct, 14.29);

  const pat = extraction.rows.find(r => r.metric_key === "pat");
  // YoY: (6000 - 5400) / 5400 * 100 = 11.11%
  assert.equal(pat.yoy_change_pct, 11.11);

  assert.ok(extraction.interpretation.includes("Revenue grew 14.29% YoY"));
});

// ---------------------------------------------------------------------------
// 3. Management Change Extraction Tests
// ---------------------------------------------------------------------------

test("Management Change Extraction: Extracts roles, dates and provides verified background", () => {
  const mgmt = extractManagementChange({
    person_name: "Mr. Arvind Sharma",
    previous_role: "Global Head of Treasury",
    new_role: "Chief Financial Officer",
    effective_date: "2026-11-01",
    background: "24 years with Tata Group leading international treasury.",
    why_it_matters: "Maintains financial reporting and dividend policy continuity."
  });

  assert.equal(mgmt.type, "MANAGEMENT_CHANGE");
  assert.equal(mgmt.person_name, "Mr. Arvind Sharma");
  assert.equal(mgmt.new_role, "Chief Financial Officer");
  assert.equal(mgmt.effective_date, "2026-11-01");
  assert.ok(mgmt.why_it_matters.length > 10);
});

test("Management Change Extraction: Labels unverified background explicitly", () => {
  const mgmt = extractManagementChange({
    person_name: "Mr. Jane Doe",
    new_role: "Director"
  });

  assert.equal(mgmt.background, "Background information unavailable.");
});

// ---------------------------------------------------------------------------
// 4. Portfolio-Aware Relevance Scoring Tests
// ---------------------------------------------------------------------------

test("Portfolio Relevance: Accurately computes allocation % and exposure for held stock", () => {
  const holdingsMap = new Map();
  holdingsMap.set("RELIANCE", {
    qty: 50,
    market_value: 150000,
    total_cost: 140000
  });

  const totalPortfolioValue = 1000000; // 10 Lakhs
  const score = scorePortfolioRelevance("RELIANCE", holdingsMap, totalPortfolioValue);

  assert.equal(score.is_held, true);
  assert.equal(score.quantity_held, 50);
  assert.equal(score.approx_exposure_inr, 150000);
  assert.equal(score.portfolio_allocation_pct, 15.0); // 150k / 1M = 15%
  assert.equal(score.relevance_weight, 3.0); // >10% allocation gives highest weight
  assert.ok(score.badge.includes("Portfolio"));
});

test("Portfolio Relevance: Labels non-held stocks as Watchlist", () => {
  const holdingsMap = new Map();
  const score = scorePortfolioRelevance("INFY", holdingsMap, 500000);

  assert.equal(score.is_held, false);
  assert.equal(score.quantity_held, 0);
  assert.equal(score.approx_exposure_inr, 0);
  assert.equal(score.portfolio_allocation_pct, 0);
  assert.equal(score.badge, "Watchlist");
});

// ---------------------------------------------------------------------------
// 5. Market Movement Evaluator Tests
// ---------------------------------------------------------------------------

test("Market Movement: Triggers Price Up alert when crossing threshold", () => {
  const quote = {
    symbol: "TCS",
    price: 3600,
    change_pct: 3.8, // > 3.0%
    volume: 1000000,
    trading_date: "2026-10-30"
  };

  const alerts = evaluateMarketMovements({
    quote,
    historicalOhlcv: [],
    rule: { price_up_pct: 3.0 }
  });

  assert.ok(alerts.length >= 1);
  const priceAlert = alerts.find(a => a.kind === "PRICE_UP");
  assert.ok(priceAlert);
  assert.equal(priceAlert.symbol, "TCS");
  assert.ok(priceAlert.message.includes("+3.80%"));
});

test("Market Movement: Computes volume baseline strictly from historical rows EXCLUDING current date", () => {
  const currentDate = "2026-10-30";
  const quote = {
    symbol: "INFY",
    price: 1800,
    change_pct: 0.5,
    volume: 5000000, // Today's volume
    trading_date: currentDate
  };

  // Generate 20 historical trading days with average volume = 2,000,000
  const historical = [];
  for (let i = 25; i >= 1; i--) {
    const d = new Date(2026, 9, i).toISOString().split("T")[0];
    historical.push({
      date: d,
      close: 1800,
      volume: 2000000
    });
  }
  // Include current date in the array as well to test that it is excluded
  historical.push({ date: currentDate, close: 1800, volume: 5000000 });

  const alerts = evaluateMarketMovements({
    quote,
    historicalOhlcv: historical,
    rule: { volume_multiplier: 2.0, volume_avg_days: 20 }
  });

  const volAlert = alerts.find(a => a.kind === "VOLUME_SPIKE");
  assert.ok(volAlert, "Should trigger a volume spike alert");
  assert.equal(volAlert.symbol, "INFY");
  // 5,000,000 / 2,000,000 = 2.5x
  assert.equal(volAlert.metadata.ratio, 2.5);
  assert.ok(volAlert.message.includes("2.5×"));
  assert.ok(volAlert.message.includes("excluding current session"));
});

test("Market Movement: Enforces cooldown period to prevent duplicate triggers", () => {
  const quote = {
    symbol: "RELIANCE",
    price: 2900,
    change_pct: 4.5,
    volume: 1000000,
    trading_date: "2026-10-30"
  };

  // Previous alert triggered 30 minutes ago
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const lastTriggered = {
    created_at: thirtyMinutesAgo
  };

  const alerts = evaluateMarketMovements({
    quote,
    historicalOhlcv: [],
    rule: { price_up_pct: 3.0, cooldown_minutes: 240 }, // 4 hour cooldown
    lastTriggeredAlert: lastTriggered
  });

  assert.equal(alerts, null, "Should be suppressed under cooldown");
});

// ---------------------------------------------------------------------------
// 6. Quiet Hours Check Tests
// ---------------------------------------------------------------------------

test("Quiet Hours: Correctly identifies quiet period across midnight", () => {
  const prefs = {
    quiet_hours_enabled: 1,
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00"
  };

  // 23:30 (Quiet)
  const night = new Date(2026, 9, 30, 23, 30);
  assert.equal(isQuietHours(prefs, night), true);

  // 05:00 (Quiet)
  const earlyMorning = new Date(2026, 9, 30, 5, 0);
  assert.equal(isQuietHours(prefs, earlyMorning), true);

  // 14:00 (Active)
  const afternoon = new Date(2026, 9, 30, 14, 0);
  assert.equal(isQuietHours(prefs, afternoon), false);
});

console.log("All pushEngine unit tests passed ✓");

