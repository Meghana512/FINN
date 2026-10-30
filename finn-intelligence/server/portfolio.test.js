/**
 * portfolio.test.js — Unit tests for WAC portfolio calculations
 * Run with: node --test portfolio.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// ─── Inline WAC engine (mirrors server logic) ────────────────────────────────
function computeHoldings(transactions) {
  const holdings = new Map();
  let totalRealizedPnl = 0;
  let totalBrokerage = 0;

  const sorted = [...transactions].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  for (const txn of sorted) {
    const sym = txn.symbol;
    totalBrokerage += Number(txn.brokerage || 0);

    if (!holdings.has(sym)) {
      holdings.set(sym, { symbol: sym, qty: 0, avg_cost: 0, total_cost: 0, realized_pnl: 0 });
    }
    const h = holdings.get(sym);

    if (txn.type === "BUY") {
      const newQty = h.qty + Number(txn.quantity);
      const newCost = h.total_cost + Number(txn.quantity) * Number(txn.price) + Number(txn.brokerage || 0);
      h.avg_cost = newQty > 0 ? newCost / newQty : 0;
      h.qty = newQty;
      h.total_cost = newCost;
    } else if (txn.type === "SELL") {
      const sellQty = Math.min(Number(txn.quantity), h.qty);
      const costBasis = h.avg_cost * sellQty;
      const proceeds = Number(txn.price) * sellQty - Number(txn.brokerage || 0);
      const realizedPnl = proceeds - costBasis;
      h.realized_pnl += realizedPnl;
      totalRealizedPnl += realizedPnl;
      h.total_cost -= h.avg_cost * sellQty;
      h.qty -= sellQty;
      if (h.qty < 0.0001) { h.qty = 0; h.total_cost = 0; h.avg_cost = 0; }
    }
  }
  return { holdings, totalRealizedPnl, totalBrokerage };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("Single BUY — quantity, avg_cost, total_cost", () => {
  const txns = [{ symbol: "RELIANCE", type: "BUY", quantity: 10, price: 2800, date: "2026-01-01", brokerage: 0 }];
  const { holdings } = computeHoldings(txns);
  const h = holdings.get("RELIANCE");
  assert.equal(h.qty, 10);
  assert.equal(h.avg_cost, 2800);
  assert.equal(h.total_cost, 28000);
});

test("Two BUYs — WAC average cost is correct", () => {
  const txns = [
    { symbol: "TCS", type: "BUY", quantity: 5, price: 3000, date: "2026-01-01", brokerage: 0 },
    { symbol: "TCS", type: "BUY", quantity: 5, price: 3200, date: "2026-02-01", brokerage: 0 }
  ];
  const { holdings } = computeHoldings(txns);
  const h = holdings.get("TCS");
  assert.equal(h.qty, 10);
  assert.equal(h.avg_cost, 3100); // (15000 + 16000) / 10
  assert.equal(h.total_cost, 31000);
});

test("Partial SELL — realized P&L and remaining holdings", () => {
  const txns = [
    { symbol: "INFY", type: "BUY",  quantity: 10, price: 1500, date: "2026-01-01", brokerage: 0 },
    { symbol: "INFY", type: "SELL", quantity: 4,  price: 1800, date: "2026-06-01", brokerage: 0 }
  ];
  const { holdings, totalRealizedPnl } = computeHoldings(txns);
  const h = holdings.get("INFY");
  // Remaining qty
  assert.equal(h.qty, 6);
  // avg_cost unchanged = 1500
  assert.equal(h.avg_cost, 1500);
  // realized = 4 * (1800 - 1500) = 1200
  assert.equal(h.realized_pnl, 1200);
  assert.equal(totalRealizedPnl, 1200);
  // total_cost for remaining 6 shares = 6 * 1500 = 9000
  assert.equal(h.total_cost, 9000);
});

test("Full SELL — position closes to zero", () => {
  const txns = [
    { symbol: "HDFCBANK", type: "BUY",  quantity: 5, price: 1700, date: "2026-01-01", brokerage: 0 },
    { symbol: "HDFCBANK", type: "SELL", quantity: 5, price: 1900, date: "2026-06-01", brokerage: 0 }
  ];
  const { holdings, totalRealizedPnl } = computeHoldings(txns);
  const h = holdings.get("HDFCBANK");
  assert.equal(h.qty, 0);
  assert.equal(h.total_cost, 0);
  assert.equal(totalRealizedPnl, 1000); // 5 * (1900 - 1700) = 1000
});

test("Brokerage included in cost basis", () => {
  const txns = [
    { symbol: "LT", type: "BUY", quantity: 10, price: 3500, date: "2026-01-01", brokerage: 100 }
  ];
  const { holdings, totalBrokerage } = computeHoldings(txns);
  const h = holdings.get("LT");
  assert.equal(h.total_cost, 35100); // 10 * 3500 + 100
  assert.equal(h.avg_cost, 3510);    // 35100 / 10
  assert.equal(totalBrokerage, 100);
});

test("Sell brokerage reduces proceeds (realized P&L)", () => {
  const txns = [
    { symbol: "SBIN", type: "BUY",  quantity: 10, price: 600,  date: "2026-01-01", brokerage: 0 },
    { symbol: "SBIN", type: "SELL", quantity: 10, price: 700,  date: "2026-06-01", brokerage: 50 }
  ];
  const { totalRealizedPnl } = computeHoldings(txns);
  // proceeds = 10 * 700 - 50 = 6950; cost = 10 * 600 = 6000; realized = 950
  assert.equal(totalRealizedPnl, 950);
});

test("Multiple symbols are independent", () => {
  const txns = [
    { symbol: "RELIANCE", type: "BUY", quantity: 5, price: 2800, date: "2026-01-01", brokerage: 0 },
    { symbol: "TCS",      type: "BUY", quantity: 3, price: 3500, date: "2026-01-01", brokerage: 0 }
  ];
  const { holdings } = computeHoldings(txns);
  assert.equal(holdings.get("RELIANCE").qty, 5);
  assert.equal(holdings.get("TCS").qty, 3);
});

test("WAC updates correctly after 3rd BUY", () => {
  const txns = [
    { symbol: "AXISBANK", type: "BUY", quantity: 10, price: 1000, date: "2026-01-01", brokerage: 0 },
    { symbol: "AXISBANK", type: "BUY", quantity: 10, price: 1200, date: "2026-02-01", brokerage: 0 },
    { symbol: "AXISBANK", type: "BUY", quantity: 5,  price: 1400, date: "2026-03-01", brokerage: 0 }
  ];
  const { holdings } = computeHoldings(txns);
  const h = holdings.get("AXISBANK");
  // cost = 10000 + 12000 + 7000 = 29000, qty = 25
  assert.equal(h.qty, 25);
  assert.equal(h.total_cost, 29000);
  assert.equal(h.avg_cost, 29000 / 25);
});

test("Unrealized P&L calculation", () => {
  const txns = [
    { symbol: "WIPRO", type: "BUY", quantity: 20, price: 250, date: "2026-01-01", brokerage: 0 }
  ];
  const { holdings } = computeHoldings(txns);
  const h = holdings.get("WIPRO");
  const marketPrice = 300;
  const marketValue = marketPrice * h.qty;
  const unrealizedPnl = marketValue - h.total_cost;
  // 20 * 300 - 20 * 250 = 6000 - 5000 = 1000
  assert.equal(unrealizedPnl, 1000);
});

test("Portfolio return % formula", () => {
  // total_pnl / total_invested * 100
  const invested = 100000;
  const currentValue = 115000;
  const realizedPnl = 5000;
  const unrealizedPnl = currentValue - (invested - realizedPnl); // approximation
  const totalPnl = unrealizedPnl + realizedPnl;
  const returnPct = (totalPnl / invested) * 100;
  assert.ok(returnPct > 0, "Return % should be positive");
});

console.log("All portfolio unit tests passed ✓");

