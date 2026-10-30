import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity, Bell, Check, ChevronDown, ChevronRight, ChevronUp, CircleAlert, Clock3,
  ExternalLink, Eye, EyeOff, FileText, Filter, Flame, LoaderCircle, Plus, RefreshCw,
  Search, Settings2, ShieldCheck, Sparkles, Star, Trash2, TrendingDown, TrendingUp,
  User, Volume2, WalletCards, X, Zap, Building2, BarChart3
} from "lucide-react";

import { api, API } from "./api.js";

const fmt = n => n == null || !Number.isFinite(Number(n)) ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtCr = cr => {
  if (cr == null || !Number.isFinite(Number(cr))) return "—";
  const num = Number(cr);
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L Cr`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}k Cr`;
  return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr`;
};

// ---------------------------------------------------------------------------
// 1. FINANCIAL RESULTS COMPARISON TABLE (QoQ & YoY)
// ---------------------------------------------------------------------------
export function FinancialResultsComparisonTable({ extraction }) {
  if (!extraction || extraction.type !== "FINANCIAL_RESULTS") return null;

  const rows = extraction.rows || [];

  return (
    <div className="results-box">
      <div className="results-header-tag">
        <span style={{ fontWeight: 700, color: "#67e0a3", display: "flex", alignItems: "center", gap: 6 }}>
          <BarChart3 size={14} /> QUARTERLY FINANCIAL METRICS ({extraction.period})
        </span>
        <span>
          Basis: <b>{extraction.basis}</b> · Unit: <b>{extraction.unit}</b>
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="results-table">
          <thead>
            <tr>
              <th>METRIC</th>
              <th>CURRENT Q</th>
              <th>PREVIOUS Q</th>
              <th>QoQ CHANGE</th>
              <th>SAME Q LAST YR</th>
              <th>YoY CHANGE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.metric_key}>
                <td style={{ fontWeight: 600, color: "#e2ecf7", fontFamily: "sans-serif" }}>
                  {r.metric_name}
                  {r.is_calculated && <small style={{ color: "#748498", display: "block" }}>(Calculated)</small>}
                </td>
                <td>{r.current_quarter != null ? Number(r.current_quarter).toLocaleString("en-IN") : "Not available"}</td>
                <td>{r.previous_quarter != null ? Number(r.previous_quarter).toLocaleString("en-IN") : "—"}</td>
                <td>
                  {r.qoq_change_pct != null ? (
                    <span className={`delta-pill ${r.qoq_change_pct >= 0 ? "pos" : "neg"}`}>
                      {r.qoq_change_pct >= 0 ? "+" : ""}{r.qoq_change_pct.toFixed(2)}%
                    </span>
                  ) : "—"}
                </td>
                <td>{r.same_quarter_last_year != null ? Number(r.same_quarter_last_year).toLocaleString("en-IN") : "—"}</td>
                <td>
                  {r.yoy_change_pct != null ? (
                    <span className={`delta-pill ${r.yoy_change_pct >= 0 ? "pos" : "neg"}`}>
                      {r.yoy_change_pct >= 0 ? "+" : ""}{r.yoy_change_pct.toFixed(2)}%
                    </span>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {extraction.interpretation && (
        <div style={{ marginTop: 10, fontSize: 11, color: "#9db4cc", lineHeight: 1.6, background: "#111822", padding: "8px 12px", borderRadius: 6, border: "1px solid #1e2938" }}>
          <b style={{ color: "#c8d9ea" }}>Analysis & Drivers: </b>{extraction.interpretation}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. MANAGEMENT CHANGE CARD
// ---------------------------------------------------------------------------
export function ManagementChangeCard({ extraction }) {
  if (!extraction || extraction.type !== "MANAGEMENT_CHANGE") return null;

  return (
    <div className="mgmt-box">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <b style={{ color: "#f7c948", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <User size={15} /> KEY MANAGEMENT TRANSITION ({extraction.change_type})
        </b>
        <span style={{ fontSize: 10, color: "#77879b" }}>
          Effective: <b style={{ color: "#d2dde9" }}>{extraction.effective_date}</b>
        </span>
      </div>

      <div className="mgmt-flow">
        <div>
          <small style={{ color: "#748498", display: "block", fontSize: 9 }}>PERSON</small>
          <b style={{ color: "#edf3fb", fontSize: 13 }}>{extraction.person_name}</b>
        </div>
        <ChevronRight size={14} color="#748498" />
        <div className="mgmt-role-tag">
          <small style={{ color: "#748498", display: "block", fontSize: 9 }}>PREVIOUS ROLE</small>
          <span>{extraction.previous_role}</span>
        </div>
        <ChevronRight size={14} color="#748498" />
        <div className="mgmt-role-tag" style={{ borderColor: "#2ea86f", background: "#13231c" }}>
          <small style={{ color: "#67e0a3", display: "block", fontSize: 9 }}>NEW DESIGNATION</small>
          <span style={{ color: "#cbf5df", fontWeight: 700 }}>{extraction.new_role}</span>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "#a5b8cc", lineHeight: 1.6 }}>
        <p style={{ margin: "4px 0" }}>
          <b style={{ color: "#c6d6e6" }}>Verified Professional Background: </b>
          {extraction.background}
        </p>
        <p style={{ margin: "4px 0", color: "#8ab8ff" }}>
          <b style={{ color: "#c6d6e6" }}>Why it matters: </b>
          {extraction.why_it_matters}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. ANNOUNCEMENT CARD COMPONENT
// ---------------------------------------------------------------------------
export function PushAnnouncementCard({ item, onToggleRead, onToggleImportant, onOpenResearch }) {
  const p = item.portfolio_context || {};
  const isHeld = p.is_held;

  return (
    <div className={`push-card ${item.priority.toLowerCase()} ${!item.is_read ? "unread" : ""}`}>
      <div className="push-card-top">
        <div className="push-meta-left">
          <span className={`badge-priority ${item.priority.toLowerCase()}`}>
            {item.priority}
          </span>

          {isHeld ? (
            <span className="portfolio-held-pill" title="Stock currently held in your portfolio">
              <WalletCards size={12} />
              Held: {p.quantity_held} sh ({p.portfolio_allocation_pct}% alloc · ₹{p.approx_exposure_inr.toLocaleString("en-IN")})
            </span>
          ) : (
            <span className="portfolio-watchlist-pill">
              Watchlist
            </span>
          )}

          <span className="pill neutral" style={{ textTransform: "capitalize" }}>
            {item.category.replaceAll("_", " ")}
          </span>

          <span style={{ fontSize: 10, color: "#78879b" }}>
            {item.filing_date} {item.filing_time ? `· ${item.filing_time}` : ""}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="icon-btn"
            onClick={() => onToggleImportant(item.id, !item.is_important)}
            title={item.is_important ? "Remove from Important" : "Mark as Important"}
            style={{ color: item.is_important ? "#f7c948" : "#687687" }}
          >
            <Star size={15} fill={item.is_important ? "#f7c948" : "none"} />
          </button>
          <button
            className="icon-btn"
            onClick={() => onToggleRead(item.id, !item.is_read)}
            title={item.is_read ? "Mark as unread" : "Mark as read"}
            style={{ color: item.is_read ? "#596879" : "#67e0a3" }}
          >
            {item.is_read ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <b style={{ color: "#dbe4ef", fontSize: 12 }}>{item.company_name}</b>
        <span style={{ color: "#67e0a3", fontSize: 11, fontFamily: "DM Mono" }}>{item.symbol}</span>
      </div>

      <h3 className="push-card-title">{item.title}</h3>
      <p className="push-card-summary">{item.summary}</p>

      {item.why_it_matters && (
        <div className="push-why-it-matters">
          <strong>Why it matters: </strong>
          {item.why_it_matters}
        </div>
      )}

      {/* Structured extractions */}
      {item.extraction?.type === "FINANCIAL_RESULTS" && (
        <FinancialResultsComparisonTable extraction={item.extraction} />
      )}

      {item.extraction?.type === "MANAGEMENT_CHANGE" && (
        <ManagementChangeCard extraction={item.extraction} />
      )}

      {item.extraction?.type === "MATERIAL_UPDATE" && item.extraction.important_facts && (
        <div style={{ background: "#0d1219", border: "1px solid #1e2835", borderRadius: 8, padding: "10px 14px", margin: "10px 0" }}>
          <small style={{ color: "#748498", fontSize: 9, display: "block", marginBottom: 4, letterSpacing: 0.8 }}>KEY EVENT DISCLOSURES</small>
          <ul style={{ margin: "4px 0", paddingLeft: 18, fontSize: 11, color: "#bad0e4", lineHeight: 1.6 }}>
            {item.extraction.important_facts.map((fact, idx) => (
              <li key={idx}>{fact}</li>
            ))}
          </ul>
          {item.extraction.potential_implications && (
            <p style={{ margin: "6px 0 0", fontSize: 10, color: "#8ab8ff" }}>
              <b>Implications: </b>{item.extraction.potential_implications}
            </p>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: "1px solid #1a222d", flexWrap: "wrap", gap: 10 }}>
        <span style={{ fontSize: 9, color: "#687689" }}>
          Source: <b>{item.source}</b>
        </span>
        <div style={{ display: "flex", gap: 12 }}>
          {item.source_url && (
            <a href={item.source_url} target="_blank" rel="noreferrer" className="source-link" style={{ margin: 0 }}>
              Filing link <ExternalLink size={11} />
            </a>
          )}
          {onOpenResearch && (
            <button
              onClick={() => onOpenResearch(item.symbol)}
              style={{ background: "transparent", border: 0, color: "#67e0a3", fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              Research {item.symbol} ↗
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. PUSH INBOX MAIN VIEW (Windowed Intelligence Digest)
// ---------------------------------------------------------------------------
export function PushInboxPage({ user, onOpenResearch }) {
  const [window, setWindow] = useState("24h");
  const [scope, setScope] = useState("all"); // 'all' | 'portfolio' | 'important' | 'unread'
  const [category, setCategory] = useState("All");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
  const [routineExpanded, setRoutineExpanded] = useState(false);
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qParams = new URLSearchParams();
      qParams.set("window", window);
      if (category && category !== "All") qParams.set("category", category);
      if (priority && priority !== "All") qParams.set("priority", priority);
      if (search.trim()) qParams.set("q", search.trim());
      if (scope === "portfolio") qParams.set("portfolio_only", "true");
      if (scope === "unread") qParams.set("unread_only", "true");
      if (scope === "important") qParams.set("important_only", "true");

      const r = await api(`/api/push/digest?${qParams.toString()}`);
      setDigest(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [window, scope, category, priority, search]);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  const handleToggleRead = async (id, isRead) => {
    try {
      await api(`/api/push/announcements/${id}/state`, {
        method: "POST",
        body: JSON.stringify({ is_read: isRead })
      });
      fetchDigest();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleToggleImportant = async (id, isImp) => {
    try {
      await api(`/api/push/announcements/${id}/state`, {
        method: "POST",
        body: JSON.stringify({ is_important: isImp })
      });
      fetchDigest();
    } catch (e) {
      setError(e.message);
    }
  };

  const stats = digest?.stats || {};
  const data = digest?.data || {};

  const criticalItems = data.critical || [];
  const highItems = data.high || [];
  const mediumItems = data.medium || [];
  const routineItems = data.routine || [];
  const totalShown = (data.all || []).length;

  return (
    <div>
      <section className="page-title">
        <div className="eyebrow">
          <span className="eyebrow-line"></span> PORTFOLIO-AWARE INTELLIGENCE
        </div>
        <h1>Push Inbox</h1>
        <p>Proactive market disclosures and material filings filtered and prioritized for your portfolio.</p>
      </section>

      {error && (
        <div className="error-banner">
          <CircleAlert size={17} />
          <span>{error}</span>
          <button onClick={() => setError("")}><X size={15} /></button>
        </div>
      )}

      {/* Stats Ribbon */}
      <div className="push-header-strip">
        <div className="push-stat-box">
          <div className="push-stat-label">
            <span>CRITICAL DEVELOPMENTS</span>
            <CircleAlert size={15} color="#ff7f87" />
          </div>
          <div className="push-stat-value" style={{ color: stats.critical_count > 0 ? "#ff7f87" : "#edf3fc" }}>
            {stats.critical_count ?? 0}
          </div>
          <div className="push-stat-sub">Fraud, regulatory bans & disruption</div>
        </div>

        <div className="push-stat-box">
          <div className="push-stat-label">
            <span>HIGH IMPACT</span>
            <Flame size={15} color="#f7c948" />
          </div>
          <div className="push-stat-value" style={{ color: stats.high_count > 0 ? "#f7c948" : "#edf3fc" }}>
            {stats.high_count ?? 0}
          </div>
          <div className="push-stat-sub">Results, M&A & leadership changes</div>
        </div>

        <div className="push-stat-box">
          <div className="push-stat-label">
            <span>PORTFOLIO IMPACTED</span>
            <WalletCards size={15} color="#67e0a3" />
          </div>
          <div className="push-stat-value" style={{ color: "#67e0a3" }}>
            {stats.portfolio_impacted_count ?? 0} <small style={{ fontSize: 13, color: "#7ea38f" }}>stocks</small>
          </div>
          <div className="push-stat-sub">
            {stats.total_exposure_impacted ? `₹${(stats.total_exposure_impacted).toLocaleString("en-IN")} held exposure` : "No direct exposure in window"}
          </div>
        </div>

        <div className="push-stat-box">
          <div className="push-stat-label">
            <span>UNREAD UPDATES</span>
            <Bell size={15} color="#8ab8ff" />
          </div>
          <div className="push-stat-value" style={{ color: "#8ab8ff" }}>
            {stats.unread_count ?? 0}
          </div>
          <div className="push-stat-sub">Requires review across tracked universe</div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="push-controls-bar">
        <div className="push-tabs">
          {[
            { id: "all", label: "All Stream" },
            { id: "portfolio", label: "💼 My Portfolio" },
            { id: "important", label: "★ Important" },
            { id: "unread", label: "Unread" }
          ].map(t => (
            <button
              key={t.id}
              className={`push-tab-btn ${scope === t.id ? "active" : ""}`}
              onClick={() => setScope(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="push-filter-group">
          {/* Time Window */}
          <div style={{ display: "flex", gap: 3, background: "#131a23", padding: 3, borderRadius: 7, border: "1px solid #232d3b" }}>
            {[
              { id: "12h", label: "12H" },
              { id: "24h", label: "24H" },
              { id: "48h", label: "48H" },
              { id: "7d", label: "7D" },
              { id: "all", label: "ALL" }
            ].map(w => (
              <button
                key={w.id}
                onClick={() => setWindow(w.id)}
                style={{
                  background: window === w.id ? "#1d2b24" : "transparent",
                  color: window === w.id ? "#67e0a3" : "#748498",
                  border: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: 5,
                  cursor: "pointer"
                }}
              >
                {w.label}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <select className="push-select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="All">All Categories</option>
            <option value="results">Quarterly Results</option>
            <option value="management_change">Management Change</option>
            <option value="M&A">Mergers & Acquisitions</option>
            <option value="regulatory">Regulatory & Legal</option>
            <option value="capex">Capex & Expansions</option>
            <option value="contracts">Contracts & Orders</option>
            <option value="corporate_action">Corporate Actions / Dividends</option>
            <option value="routine_compliance">Routine Compliance</option>
          </select>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Search announcements..."
              className="push-search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button className="icon-btn" title="Refresh digest" onClick={fetchDigest}>
            <RefreshCw size={15} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "#748498" }}>
          <LoaderCircle size={24} className="spin" style={{ margin: "0 auto 12px" }} />
          <span>Synthesizing portfolio intelligence across window...</span>
        </div>
      ) : totalShown === 0 ? (
        <div className="panel" style={{ padding: 48, textAlign: "center" }}>
          <ShieldCheck size={36} color="#2ea86f" style={{ margin: "0 auto 12px", opacity: 0.6 }} />
          <h3 style={{ color: "#dbe4ef", marginBottom: 6 }}>No announcements in selected window</h3>
          <p style={{ color: "#748498", fontSize: 12, maxWidth: 420, margin: "0 auto" }}>
            There were no matching filings or corporate developments within the selected timeframe. Try expanding the time window to 48 hours or 7 days.
          </p>
        </div>
      ) : (
        <div>
          {/* Section 1: Critical Developments */}
          {criticalItems.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div className="section-heading">
                <div>
                  <h2 style={{ color: "#ff8b8f", display: "flex", alignItems: "center", gap: 8 }}>
                    <CircleAlert size={17} /> Critical Developments ({criticalItems.length})
                  </h2>
                  <p>Immediate action required — major regulatory, disruption, or governance alerts.</p>
                </div>
              </div>
              {criticalItems.map(item => (
                <PushAnnouncementCard
                  key={item.id}
                  item={item}
                  onToggleRead={handleToggleRead}
                  onToggleImportant={handleToggleImportant}
                  onOpenResearch={onOpenResearch}
                />
              ))}
            </div>
          )}

          {/* Section 2: High-Priority Announcements */}
          {highItems.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div className="section-heading">
                <div>
                  <h2 style={{ color: "#f7d277", display: "flex", alignItems: "center", gap: 8 }}>
                    <Flame size={17} /> High-Priority Announcements ({highItems.length})
                  </h2>
                  <p>Financial earnings releases, executive leadership appointments, and major capital allocations.</p>
                </div>
              </div>
              {highItems.map(item => (
                <PushAnnouncementCard
                  key={item.id}
                  item={item}
                  onToggleRead={handleToggleRead}
                  onToggleImportant={handleToggleImportant}
                  onOpenResearch={onOpenResearch}
                />
              ))}
            </div>
          )}

          {/* Section 3: Medium-Priority Updates */}
          {mediumItems.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div className="section-heading">
                <div>
                  <h2 style={{ color: "#93bcf5", display: "flex", alignItems: "center", gap: 8 }}>
                    <Zap size={17} /> Material Corporate Updates ({mediumItems.length})
                  </h2>
                  <p>Order wins, dividend declarations, capex progress, and commercial agreements.</p>
                </div>
              </div>
              {mediumItems.map(item => (
                <PushAnnouncementCard
                  key={item.id}
                  item={item}
                  onToggleRead={handleToggleRead}
                  onToggleImportant={handleToggleImportant}
                  onOpenResearch={onOpenResearch}
                />
              ))}
            </div>
          )}

          {/* Section 4: Routine Updates (Collapsed) */}
          {routineItems.length > 0 && (
            <div className="routine-box">
              <button
                className="routine-trigger"
                onClick={() => setRoutineExpanded(v => !v)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FileText size={16} color="#748498" />
                  <span>
                    <b>Routine Updates</b> ({routineItems.length} procedural filings collapsed)
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#8ab8ff" }}>
                  <span>{routineExpanded ? "Hide routine announcements" : "Show all routine filings"}</span>
                  {routineExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </div>
              </button>

              {routineExpanded && (
                <div style={{ padding: "12px 16px", background: "#0b1016" }}>
                  <p style={{ fontSize: 10, color: "#6e7f93", margin: "0 0 12px" }}>
                    Standard compliance certificates, share transfer intimations, and routine calendar notices. Kept collapsed to avoid notification fatigue.
                  </p>
                  {routineItems.map(item => (
                    <PushAnnouncementCard
                      key={item.id}
                      item={item}
                      onToggleRead={handleToggleRead}
                      onToggleImportant={handleToggleImportant}
                      onOpenResearch={onOpenResearch}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. TRIGGERED ALERTS & RULES ENGINE VIEW
// ---------------------------------------------------------------------------
export function AlertsAndRulesPage({ user }) {
  const [activeTab, setActiveTab] = useState("rules"); // 'rules' | 'triggered' | 'preferences'
  const [rules, setRules] = useState([]);
  const [triggered, setTriggered] = useState([]);
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // New rule form state
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleType, setNewRuleType] = useState("PRICE_MOVE");
  const [newRuleSymbol, setNewRuleSymbol] = useState("");
  const [newPricePct, setNewPricePct] = useState(3.0);
  const [newVolMult, setNewVolMult] = useState(2.0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rR, tR, pR] = await Promise.all([
        api("/api/push/alerts/rules"),
        api("/api/push/alerts/triggered"),
        api("/api/push/preferences")
      ]);
      setRules(rR.data || []);
      setTriggered(tR.data || []);
      setPrefs(pR.data || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleRule = async (ruleId, currentActive) => {
    try {
      await api(`/api/push/alerts/rules/${ruleId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !currentActive })
      });
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteRule = async ruleId => {
    try {
      await api(`/api/push/alerts/rules/${ruleId}`, { method: "DELETE" });
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleCreateRule = async e => {
    e.preventDefault();
    try {
      await api("/api/push/alerts/rules", {
        method: "POST",
        body: JSON.stringify({
          name: newRuleName,
          rule_type: newRuleType,
          symbol: newRuleSymbol ? newRuleSymbol.trim().toUpperCase() : null,
          price_up_pct: Number(newPricePct),
          price_down_pct: -Number(newPricePct),
          volume_multiplier: Number(newVolMult)
        })
      });
      setShowCreate(false);
      setNewRuleName("");
      setNewRuleSymbol("");
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    setError("");
    try {
      const res = await api("/api/push/alerts/evaluate", { method: "POST" });
      await loadData();
      alert(`Evaluation complete! Evaluated ${res.meta?.evaluated_symbols || 0} candidate tickers against TejHQ EOD prices. Generated ${res.data?.length || 0} new triggers.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setEvaluating(false);
    }
  };

  const handleSavePrefs = async updatedFields => {
    try {
      const r = await api("/api/push/preferences", {
        method: "PATCH",
        body: JSON.stringify(updatedFields)
      });
      setPrefs(r.data);
    } catch (e) {
      setError(e.message);
    }
  };

  const requestBrowserPush = async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notifications.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      new Notification("FINN Intelligence Push", {
        body: "Browser alerts are now activated for material market movements and portfolio filings."
      });
      handleSavePrefs({ notify_browser: true });
    } else {
      handleSavePrefs({ notify_browser: false });
    }
  };

  return (
    <div>
      <section className="page-title">
        <div className="eyebrow">
          <span className="eyebrow-line"></span> CONFIGURABLE TRIGGER ENGINE
        </div>
        <h1>Alert Rules & Push Triggers</h1>
        <p>Set custom price moves, historical volume breakouts, and material filing criteria across your portfolio.</p>
      </section>

      {error && (
        <div className="error-banner">
          <CircleAlert size={17} />
          <span>{error}</span>
          <button onClick={() => setError("")}><X size={15} /></button>
        </div>
      )}

      {/* Top action row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div className="push-tabs">
          {[
            { id: "rules", label: "Active Rules & Thresholds" },
            { id: "triggered", label: `Triggered Alerts (${triggered.length})` },
            { id: "preferences", label: "Push Preferences & Quiet Hours" }
          ].map(t => (
            <button
              key={t.id}
              className={`push-tab-btn ${activeTab === t.id ? "active" : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          className="primary-btn"
          onClick={handleEvaluate}
          disabled={evaluating}
          title="Evaluate rules against the latest TejHQ EOD dataset"
        >
          {evaluating ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />}
          Evaluate Against TejHQ EOD
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#748498" }}>
          <LoaderCircle size={22} className="spin" style={{ margin: "0 auto 10px" }} />
          <span>Loading alert engine status...</span>
        </div>
      ) : activeTab === "rules" ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ color: "#dbe4ef", fontSize: 14, margin: 0 }}>Active Alert Rules ({rules.length})</h3>
            <button
              className="secondary-btn"
              onClick={() => setShowCreate(v => !v)}
              style={{ fontSize: 11 }}
            >
              <Plus size={14} /> New Rule
            </button>
          </div>

          {showCreate && (
            <form onSubmit={handleCreateRule} className="panel" style={{ padding: 20, marginBottom: 20, background: "#131a24" }}>
              <b style={{ color: "#67e0a3", fontSize: 12, display: "block", marginBottom: 14 }}>Create New Alert Trigger</b>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 9, color: "#748498", display: "block", marginBottom: 4 }}>RULE NAME *</label>
                  <input
                    value={newRuleName}
                    onChange={e => setNewRuleName(e.target.value)}
                    placeholder="e.g. Reliance 4% Price Alert"
                    required
                    style={{ width: "100%", background: "#0c1117", border: "1px solid #233140", borderRadius: 6, padding: "8px 10px", color: "#e0eaf6", fontSize: 11 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 9, color: "#748498", display: "block", marginBottom: 4 }}>TYPE</label>
                  <select
                    value={newRuleType}
                    onChange={e => setNewRuleType(e.target.value)}
                    style={{ width: "100%", background: "#0c1117", border: "1px solid #233140", borderRadius: 6, padding: "8px 10px", color: "#e0eaf6", fontSize: 11 }}
                  >
                    <option value="PRICE_MOVE">Daily Price Movement (±%)</option>
                    <option value="VOLUME_SPIKE">Volume Spike vs 20D Baseline</option>
                    <option value="ANNOUNCEMENT">Material Announcement Event</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 9, color: "#748498", display: "block", marginBottom: 4 }}>TARGET TICKER (Blank for All Portfolio)</label>
                  <input
                    value={newRuleSymbol}
                    onChange={e => setNewRuleSymbol(e.target.value)}
                    placeholder="e.g. TCS or blank"
                    style={{ width: "100%", background: "#0c1117", border: "1px solid #233140", borderRadius: 6, padding: "8px 10px", color: "#e0eaf6", fontSize: 11 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 9, color: "#748498", display: "block", marginBottom: 4 }}>THRESHOLD</label>
                  {newRuleType === "VOLUME_SPIKE" ? (
                    <input
                      type="number"
                      step="0.5"
                      min="1.5"
                      max="10"
                      value={newVolMult}
                      onChange={e => setNewVolMult(e.target.value)}
                      style={{ width: "100%", background: "#0c1117", border: "1px solid #233140", borderRadius: 6, padding: "8px 10px", color: "#e0eaf6", fontSize: 11 }}
                    />
                  ) : (
                    <input
                      type="number"
                      step="0.5"
                      min="1.0"
                      max="20"
                      value={newPricePct}
                      onChange={e => setNewPricePct(e.target.value)}
                      style={{ width: "100%", background: "#0c1117", border: "1px solid #233140", borderRadius: 6, padding: "8px 10px", color: "#e0eaf6", fontSize: 11 }}
                    />
                  )}
                </div>
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                <button type="submit" className="primary-btn" style={{ fontSize: 11 }}>Save Rule</button>
                <button type="button" className="secondary-btn" onClick={() => setShowCreate(false)} style={{ fontSize: 11 }}>Cancel</button>
              </div>
            </form>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            {rules.map(rule => (
              <div key={rule.id} className="panel" style={{ padding: 18, background: rule.is_active ? "#111822" : "#0d1117", border: rule.is_active ? "1px solid #283747" : "1px dashed #1e2835" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <b style={{ color: rule.is_active ? "#e4ecf7" : "#748498", fontSize: 13 }}>{rule.name}</b>
                    <small style={{ color: "#67e0a3", display: "block", fontSize: 10, marginTop: 2 }}>
                      {rule.symbol ? `Target: ${rule.symbol}` : "Target: All Portfolio Holdings"}
                    </small>
                  </div>
                  <button
                    onClick={() => handleToggleRule(rule.id, rule.is_active)}
                    style={{
                      background: rule.is_active ? "#1b2c23" : "#1e2632",
                      color: rule.is_active ? "#67e0a3" : "#728394",
                      border: `1px solid ${rule.is_active ? "#2b5641" : "#2e3b4a"}`,
                      borderRadius: 14,
                      padding: "3px 10px",
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    {rule.is_active ? "Active" : "Paused"}
                  </button>
                </div>

                <div style={{ fontSize: 11, color: "#8ca0b6", margin: "10px 0 14px", lineHeight: 1.5 }}>
                  {rule.rule_type === "PRICE_MOVE" && (
                    <span>Triggers on daily closing price move ≥ <b>±{rule.price_up_pct}%</b>.</span>
                  )}
                  {rule.rule_type === "VOLUME_SPIKE" && (
                    <span>Triggers when volume ≥ <b>{rule.volume_multiplier}×</b> the {rule.volume_avg_days || 20}-day historical baseline (excl. current date).</span>
                  )}
                  {rule.rule_type === "ANNOUNCEMENT" && (
                    <span>Monitors material exchange filings with priority ≥ <b>{rule.min_priority}</b>.</span>
                  )}
                  <div style={{ fontSize: 10, color: "#69788a", marginTop: 4 }}>
                    Cooldown: {rule.cooldown_minutes || 240}m between duplicate triggers.
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid #1c2633", paddingTop: 8 }}>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    style={{ background: "transparent", border: 0, color: "#748498", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10 }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === "triggered" ? (
        <div className="panel" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ color: "#dbe4ef", fontSize: 14, margin: 0 }}>Triggered Alerts History</h3>
              <p style={{ color: "#748498", fontSize: 11, margin: "3px 0 0" }}>
                Verified market events detected from genuine TejHQ EOD data. Deduplicated using your cooldown periods.
              </p>
            </div>
            <span style={{ fontSize: 10, color: "#748498" }}>{triggered.length} events logged</span>
          </div>

          {triggered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#748498" }}>
              <ShieldCheck size={32} color="#67e0a3" style={{ margin: "0 auto 10px", opacity: 0.5 }} />
              <b style={{ color: "#dbe4ef" }}>No triggered alerts logged yet</b>
              <p style={{ fontSize: 11, maxWidth: 360, margin: "6px auto 0" }}>
                Click "Evaluate Against TejHQ EOD" above or wait for market close when new verified EOD prices are published.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {triggered.map(t => (
                <div key={t.id} style={{ background: "#0e141c", border: "1px solid #202b37", borderRadius: 8, padding: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0,
                    background: t.kind === "PRICE_UP" ? "#16281e" : t.kind === "PRICE_DOWN" ? "#331a1e" : "#242014",
                    color: t.kind === "PRICE_UP" ? "#67e0a3" : t.kind === "PRICE_DOWN" ? "#ff7f87" : "#f7c948"
                  }}>
                    {t.kind === "PRICE_UP" ? <TrendingUp size={16} /> : t.kind === "PRICE_DOWN" ? <TrendingDown size={16} /> : <Volume2 size={16} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span className={`badge-priority ${t.severity.toLowerCase()}`}>{t.severity}</span>
                      <b style={{ color: "#67e0a3", fontSize: 11, fontFamily: "DM Mono" }}>{t.symbol}</b>
                      <span style={{ fontSize: 10, color: "#748498", marginLeft: "auto" }}>
                        {t.data_date ? `Data date: ${t.data_date} · ` : ""}{new Date(t.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <b style={{ color: "#e0e9f4", fontSize: 12, display: "block" }}>{t.title}</b>
                    <p style={{ color: "#8da0b4", fontSize: 11, margin: "4px 0 0", lineHeight: 1.5 }}>{t.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Push Preferences Tab */
        <div className="panel" style={{ padding: 24, maxWidth: 650 }}>
          <h3 style={{ color: "#dbe4ef", fontSize: 14, marginBottom: 16 }}>Notification & Push Engine Preferences</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e2835", paddingBottom: 14 }}>
              <div>
                <b style={{ color: "#e0e9f4", fontSize: 12 }}>Default Digest Window</b>
                <p style={{ color: "#748498", fontSize: 10, margin: "2px 0 0" }}>Timeframe loaded automatically when opening Push Inbox</p>
              </div>
              <select
                className="push-select"
                value={prefs?.default_window || "24h"}
                onChange={e => handleSavePrefs({ default_window: e.target.value })}
              >
                <option value="12h">Last 12 hours</option>
                <option value="24h">Last 24 hours (Default)</option>
                <option value="48h">Last 48 hours</option>
                <option value="7d">Last 7 days</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e2835", paddingBottom: 14 }}>
              <div>
                <b style={{ color: "#e0e9f4", fontSize: 12 }}>Portfolio-Only Monitoring</b>
                <p style={{ color: "#748498", fontSize: 10, margin: "2px 0 0" }}>Filter digest to strictly owned stocks by default</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(prefs?.portfolio_only)}
                onChange={e => handleSavePrefs({ portfolio_only: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: "#2ea86f" }}
              />
            </div>

            <div style={{ borderBottom: "1px solid #1e2835", paddingBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <b style={{ color: "#e0e9f4", fontSize: 12 }}>Quiet Hours (Do Not Disturb)</b>
                  <p style={{ color: "#748498", fontSize: 10, margin: "2px 0 0" }}>Suppress browser popups and sound during off-market/sleep periods</p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(prefs?.quiet_hours_enabled)}
                  onChange={e => handleSavePrefs({ quiet_hours_enabled: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: "#2ea86f" }}
                />
              </div>
              {prefs?.quiet_hours_enabled && (
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 8 }}>
                  <label style={{ fontSize: 10, color: "#748498" }}>Start: </label>
                  <input
                    type="time"
                    value={prefs?.quiet_hours_start || "22:00"}
                    onChange={e => handleSavePrefs({ quiet_hours_start: e.target.value })}
                    style={{ background: "#0c1117", border: "1px solid #233140", borderRadius: 6, padding: "4px 8px", color: "#e0eaf6", fontSize: 11 }}
                  />
                  <label style={{ fontSize: 10, color: "#748498" }}>End: </label>
                  <input
                    type="time"
                    value={prefs?.quiet_hours_end || "08:00"}
                    onChange={e => handleSavePrefs({ quiet_hours_end: e.target.value })}
                    style={{ background: "#0c1117", border: "1px solid #233140", borderRadius: 6, padding: "4px 8px", color: "#e0eaf6", fontSize: 11 }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e2835", paddingBottom: 14 }}>
              <div>
                <b style={{ color: "#e0e9f4", fontSize: 12 }}>Browser Web Push Notifications</b>
                <p style={{ color: "#748498", fontSize: 10, margin: "2px 0 0" }}>Receive high-priority desktop notifications when material events trigger</p>
              </div>
              <button
                className="secondary-btn"
                onClick={requestBrowserPush}
                style={{ fontSize: 10, padding: "6px 12px" }}
              >
                {prefs?.notify_browser ? "Enabled ✓" : "Enable Browser Push"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. NOTIFICATION CENTER DRAWER COMPONENT
// ---------------------------------------------------------------------------
export function NotificationDrawer({ isOpen, onClose, onNavigate }) {
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await api("/api/push/notifications");
      setNotifs(res.data || []);
      setUnreadCount(res.unread_count || 0);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 45000); // 45s poll
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  const handleMarkAllRead = async () => {
    try {
      await api("/api/push/notifications/clear", { method: "POST" });
      fetchNotifs();
    } catch (_) {}
  };

  const handleItemClick = async item => {
    try {
      await api(`/api/push/notifications/${item.id}/read`, { method: "PATCH" });
      fetchNotifs();
      if (item.source_type === "ALERT") {
        onNavigate("Alerts & Rules");
      } else {
        onNavigate("Push Inbox");
      }
      onClose();
    } catch (_) {}
  };

  if (!isOpen) return null;

  return (
    <div className="notif-drawer">
      <div className="notif-drawer-head">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bell size={14} color="#67e0a3" />
          <b style={{ fontSize: 12, color: "#e1e9f4" }}>Push Notifications</b>
          {unreadCount > 0 && (
            <span style={{ background: "#331a1e", color: "#ff7f87", padding: "1px 6px", borderRadius: 10, fontSize: 9, fontWeight: 700 }}>
              {unreadCount} new
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} style={{ background: "transparent", border: 0, color: "#67e0a3", fontSize: 10, cursor: "pointer" }}>
              Mark all read
            </button>
          )}
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: "#748498", cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>
      </div>

      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        {notifs.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#748498", fontSize: 11 }}>
            No recent alerts or notifications.
          </div>
        ) : (
          notifs.map(n => (
            <div
              key={n.id}
              className={`notif-item ${!n.is_read ? "unread" : ""}`}
              onClick={() => handleItemClick(n)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <b style={{ fontSize: 11, color: "#e0eaf6" }}>{n.title}</b>
                <span style={{ fontSize: 9, color: "#687688" }}>
                  {new Date(n.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p style={{ fontSize: 10, color: "#8798ab", margin: 0, lineHeight: 1.5 }}>
                {n.message}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

