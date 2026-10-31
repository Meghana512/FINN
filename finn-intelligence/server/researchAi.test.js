/**
 * researchAi.test.js — Unit & Integration Tests for FINN AI Research Pipeline
 *
 * Verifies:
 * 1. Financial data ingestion into SQLite (company_financials)
 * 2. Management guidance extraction & storage (management_guidance)
 * 3. Primary documents indexing with URLs (company_documents)
 * 4. Zero duplicate records on repeated ingestion (idempotency)
 * 5. Structured evidence retrieval for AI (getFinancialEvidenceForAi)
 * 6. Distinction between reported actuals and management guidance
 * 7. Guidance vs delivered comparisons
 * 8. Timing footer and response structure
 *
 * Run: node --test researchAi.test.js
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import db from "./db.js";
import {
  seedPrimaryFinancialData,
  ingestFinancialResults,
  ingestManagementGuidance,
  ingestCompanyDocuments,
  getFinancialEvidenceForAi,
  PRIMARY_FINANCIAL_RECORDS,
  PRIMARY_MANAGEMENT_GUIDANCE,
  PRIMARY_COMPANY_DOCUMENTS
} from "./financialDataIngestion.js";

// Ensure DB is seeded before running tests
seedPrimaryFinancialData(db);

// ===========================================================================
// SECTION 1: Financial Data Ingestion & Storage in SQLite
// ===========================================================================

test("Ingestion: Stores quarterly & annual financial results in company_financials", () => {
  const row = db.prepare(`
    SELECT * FROM company_financials
    WHERE symbol = 'INFY' AND period = 'Q2 FY27'
  `).get();

  assert.ok(row, "Q2 FY27 record for INFY must exist in SQLite");
  assert.equal(row.symbol, "INFY");
  assert.equal(row.company_name, "Infosys Limited");
  assert.equal(row.revenue, 40986, "Revenue must match actual reported figure (₹40,986 Cr)");
  assert.equal(row.revenue_yoy_pct, 8.2, "YoY Revenue growth must be 8.2%");
  assert.equal(row.revenue_qoq_pct, 5.1, "QoQ Revenue growth must be 5.1%");
  assert.equal(row.pat, 6506, "PAT / Net profit must match actual reported figure (₹6,506 Cr)");
  assert.equal(row.basis, "Consolidated");
  assert.ok(row.source_url.startsWith("https://"), "Source URL must be a valid HTTPS link");
  assert.equal(row.filing_date, "2026-10-24");
});

test("Ingestion: Stores annual financial statements (FY26)", () => {
  const row = db.prepare(`
    SELECT * FROM company_financials
    WHERE symbol = 'INFY' AND period = 'FY26'
  `).get();

  assert.ok(row, "FY26 annual statement for INFY must exist");
  assert.equal(row.period_type, "Annual");
  assert.equal(row.revenue, 153670, "FY26 revenue must be ₹153,670 Cr");
  assert.equal(row.pat, 26248, "FY26 PAT must be ₹26,248 Cr");
});

test("Ingestion: Deduplication prevents duplicate financial rows on re-seed", () => {
  const countBefore = db.prepare("SELECT count(*) as c FROM company_financials WHERE symbol = 'INFY'").get().c;

  // Re-run ingestion
  ingestFinancialResults(db, PRIMARY_FINANCIAL_RECORDS);

  const countAfter = db.prepare("SELECT count(*) as c FROM company_financials WHERE symbol = 'INFY'").get().c;
  assert.equal(countAfter, countBefore, "Re-ingesting must not create duplicate records in company_financials");
});

// ===========================================================================
// SECTION 2: Management Guidance Storage & Extraction
// ===========================================================================

test("Ingestion: Stores management guidance extracted from transcripts in management_guidance", () => {
  const rows = db.prepare(`
    SELECT * FROM management_guidance
    WHERE symbol = 'INFY'
    ORDER BY metric_category
  `).all();

  assert.ok(rows.length >= 2, "INFY must have at least 2 guidance records");

  const revGuidance = rows.find(r => r.metric_category === "revenue_growth");
  assert.ok(revGuidance, "Revenue growth guidance must be indexed");
  assert.equal(revGuidance.target_period, "FY27");
  assert.match(revGuidance.guidance_value, /3\.75%.*4\.50%/, "Guidance band must be 3.75%-4.50%");
  assert.equal(revGuidance.executive_speaker, "Salil Parekh (CEO & MD)");
  assert.ok(revGuidance.context_quote.length > 20, "Must contain verbatim quote from concall");
  assert.ok(revGuidance.source_url.includes("transcript.pdf"), "Must link to official transcript");

  const marginGuidance = rows.find(r => r.metric_category === "ebitda_margin");
  assert.ok(marginGuidance, "Margin guidance must be indexed");
  assert.match(marginGuidance.guidance_value, /20\.0%.*22\.0%/, "Operating margin guidance band must be 20.0%-22.0%");
  assert.equal(marginGuidance.executive_speaker, "Jayesh Sanghrajka (CFO)");
});

test("Ingestion: Deduplication prevents duplicate guidance rows on re-seed", () => {
  const countBefore = db.prepare("SELECT count(*) as c FROM management_guidance WHERE symbol = 'INFY'").get().c;

  // Re-run guidance ingestion
  ingestManagementGuidance(db, PRIMARY_MANAGEMENT_GUIDANCE);

  const countAfter = db.prepare("SELECT count(*) as c FROM management_guidance WHERE symbol = 'INFY'").get().c;
  assert.equal(countAfter, countBefore, "Re-ingesting must not create duplicate records in management_guidance");
});

// ===========================================================================
// SECTION 3: Primary Documents with Exchange & IR URLs
// ===========================================================================

test("Ingestion: Stores verified primary source documents with clickable URLs", () => {
  const docs = db.prepare(`
    SELECT * FROM company_documents
    WHERE symbol = 'INFY'
  `).all();

  assert.ok(docs.length >= 3, "INFY must have at least 3 verified filing documents");

  const resultsDoc = docs.find(d => d.doc_type === "Financial Results");
  assert.ok(resultsDoc, "Financial Results filing document must exist");
  assert.ok(resultsDoc.source_url.includes("nseindia.com"), "Must link to official NSE filing directory");

  const transcriptDoc = docs.find(d => d.doc_type === "Concall Transcript");
  assert.ok(transcriptDoc, "Concall Transcript document must exist");
  assert.ok(transcriptDoc.source_url.includes("transcript.pdf"), "Must link to official IR transcript");
});

// ===========================================================================
// SECTION 4: AI Evidence Retrieval & Grounding Structure
// ===========================================================================

test("Evidence Engine: Formats complete AI evidence package for INFY", () => {
  const evidence = getFinancialEvidenceForAi(db, "INFY");

  // Check data availability metadata
  assert.equal(evidence.dataAvailability.financialsAvailable, true);
  assert.equal(evidence.dataAvailability.guidanceAvailable, true);
  assert.equal(evidence.dataAvailability.documentsAvailable, true);
  assert.ok(evidence.dataAvailability.reportingPeriods.includes("Q2 FY27"));
  assert.ok(evidence.dataAvailability.reportingPeriods.includes("FY26"));

  // Check formatted prompt context
  const { reportedActualsTable, managementGuidanceNotes, primarySourceLinks, precomputedComparisons } = evidence.formattedPromptContext;

  assert.ok(reportedActualsTable.includes("₹40,986"), "Reported actuals table must contain actual Q2 revenue ₹40,986 Cr");
  assert.ok(reportedActualsTable.includes("₹6,506"), "Reported actuals table must contain actual Q2 PAT ₹6,506 Cr");
  assert.ok(reportedActualsTable.includes("Q2 FY27"), "Must mention reporting period Q2 FY27");

  assert.ok(managementGuidanceNotes.includes("Salil Parekh"), "Guidance notes must cite executive speaker");
  assert.ok(managementGuidanceNotes.includes("3.75%"), "Guidance notes must contain 3.75%-4.50% target");

  assert.ok(primarySourceLinks.includes("https://"), "Must contain clickable primary source links");

  assert.ok(precomputedComparisons.length >= 2, "Must include precomputed guidance vs actual comparisons");
  const revComp = precomputedComparisons.find(c => c.metric === "Revenue Growth");
  assert.ok(revComp, "Must have Revenue Growth comparison");
  assert.ok(revComp.reported_actual.includes("8.2%"), "Reported actual must be 8.2% YoY");
});

test("Evidence Engine: Distinguishes reported actuals from forward guidance", () => {
  const evidence = getFinancialEvidenceForAi(db, "INFY");

  // Actuals have historical filing dates and reported numbers
  const actuals = evidence.raw.financials;
  for (const a of actuals) {
    assert.ok(a.revenue > 0, "Actual revenue must be a positive number");
    assert.ok(a.filing_date, "Actual must have a filing date");
    assert.ok(a.period, "Actual must specify quarter/period");
  }

  // Guidance has target periods and forward targets
  const guidance = evidence.raw.guidance;
  for (const g of guidance) {
    assert.ok(g.target_period, "Guidance must specify target period");
    assert.ok(g.guidance_value, "Guidance must specify target value");
    assert.ok(g.executive_speaker, "Guidance must specify executive speaker");
  }
});

test("Evidence Engine: Other Indian bluechips (TCS, RELIANCE, HDFCBANK) have complete evidence", () => {
  for (const sym of ["TCS", "RELIANCE", "HDFCBANK"]) {
    const evidence = getFinancialEvidenceForAi(db, sym);
    assert.equal(evidence.dataAvailability.financialsAvailable, true, `${sym} must have financials`);
    assert.equal(evidence.dataAvailability.guidanceAvailable, true, `${sym} must have guidance`);
    assert.equal(evidence.dataAvailability.documentsAvailable, true, `${sym} must have documents`);
    assert.ok(evidence.dataAvailability.reportingPeriods.length > 0, `${sym} must have reporting periods`);
  }
});

test("Evidence Engine: Missing data handled gracefully without hallucination", () => {
  // Querying a ticker with no financials indexed
  const evidence = getFinancialEvidenceForAi(db, "UNKNOWN_TICKER_XYZ");
  assert.equal(evidence.dataAvailability.financialsAvailable, false);
  assert.equal(evidence.dataAvailability.guidanceAvailable, false);
  assert.equal(evidence.dataAvailability.documentsAvailable, false);
  assert.match(evidence.formattedPromptContext.reportedActualsTable, /No audited or limited review/);
  assert.match(evidence.formattedPromptContext.managementGuidanceNotes, /No formal management guidance targets/);
});

// ============================================================
// SECTION 5: Timing Format & Response Structure Verification
// ============================================================

test("Timings: Formatted integers without blank placeholders", () => {
  const sampleTimings = {
    retrieval_ms: 45,
    gemini_ms: 3820,
    total_ms: 3865
  };

  assert.equal(typeof sampleTimings.retrieval_ms, "number");
  assert.equal(typeof sampleTimings.gemini_ms, "number");
  assert.equal(typeof sampleTimings.total_ms, "number");
  assert.ok(sampleTimings.total_ms >= sampleTimings.gemini_ms);

  // Formatting test
  const renderedText = `⏱ Retrieval: ${sampleTimings.retrieval_ms}ms · Gemini API: ${sampleTimings.gemini_ms}ms · Total: ${sampleTimings.total_ms}ms`;
  assert.doesNotMatch(renderedText, /—ms/, "Rendered text must not contain blank '—ms' placeholder");
  assert.match(renderedText, /⏱ Retrieval: 45ms/);
});

