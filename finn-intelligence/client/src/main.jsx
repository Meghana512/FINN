import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, BookOpen, ChevronDown, CircleAlert, Clock3,
  Command, ExternalLink, FileText, Filter, LayoutDashboard, LoaderCircle, Menu, MessageSquareText,
  RefreshCw, Search, Settings2, ShieldCheck, Sparkles, TrendingUp, X, Building2, BarChart3,
  Globe, Users, FileCheck2, FileCode, WalletCards, User, LogOut, Plus, Trash2, Pencil, Check, ChevronUp
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import "./styles.css";
import { PushInboxPage, AlertsAndRulesPage, NotificationDrawer } from "./PushComponents.jsx";

import { api, API, askFinnStream } from "./api.js";
const DEFAULT_SYMBOLS = ["RELIANCE","TCS","INFY","HDFCBANK","ICICIBANK","LT","ITC","BHARTIARTL","SBIN","AXISBANK","M&M","SUNPHARMA","MARUTI","TATAMOTORS","TITAN","WIPRO","HINDUNILVR","BAJFINANCE"];
const money = n => n == null || !Number.isFinite(Number(n)) ? "—" : `₹${Number(n).toLocaleString("en-IN",{maximumFractionDigits:2})}`;
const pct = n => n == null || !Number.isFinite(Number(n)) ? "—" : `${Number(n)>0?"+":""}${Number(n).toFixed(2)}%`;
const dateFmt = d => { if(!d) return "Date unavailable"; const x=new Date(d); return Number.isNaN(x.getTime())?"Date unavailable":x.toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}); };

function formatCr(cr) {
  if (cr == null || !Number.isFinite(Number(cr))) return "—";
  const num = Number(cr);
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L Cr`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}k Cr`;
  return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr`;
}

function SafeMarkdown({ content, fallback = "No content available." }) {
  if (!content) return <p style={{ color: "#748498", fontStyle: "italic" }}>{fallback}</p>;
  return (
    <div className="markdown-prose">
      <ReactMarkdown
        components={{
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#5eead4", textDecoration: "underline", fontWeight: 500 }}
            />
          )
        }}
      >
        {String(content)}
      </ReactMarkdown>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="panel" style={{ padding: "24px", margin: "16px 0", border: "1px solid #64262b", background: "#1b1114" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#ff9ea2", marginBottom: "8px" }}>
            <CircleAlert size={18} />
            <b style={{ fontSize: "13px" }}>Research View Encountered an Error</b>
          </div>
          <p style={{ color: "#b8c5d6", fontSize: "11px", margin: "0 0 14px", lineHeight: 1.6 }}>{this.state.error?.message || "An unexpected rendering error occurred."}</p>
          <button className="secondary-btn" onClick={() => this.setState({ hasError: false, error: null })}>Reset View</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// api and API imported from ./api.js

function StockChart({ symbol, currentPrice, changePct, companyName, embedded = false }) {
  const [range, setRange] = useState("1D");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const ltpParam = currentPrice ? `&ltp=${encodeURIComponent(currentPrice)}` : "";
    api(`/api/stocks/${encodeURIComponent(symbol)}/chart?range=${range}${ltpParam}`)
      .then(res => {
        if (active && Array.isArray(res.data)) {
          setData(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [symbol, range, currentPrice]);

  const stats = useMemo(() => {
    if (!data.length) return null;
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high || d.close);
    const lows = data.map(d => d.low || d.close);
    const volumes = data.map(d => d.volume || 0);

    const first = closes[0];
    const last = closes[closes.length - 1];
    const change = last - first;
    const changeP = first ? (change / first) * 100 : 0;
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const maxVol = Math.max(...volumes, 1);
    const avgVol = Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length);

    return {
      first, last, change, changeP, maxHigh, minLow, maxVol, avgVol, isUp: change >= 0
    };
  }, [data]);

  const svgWidth = 620;
  const svgHeight = 220;
  const padLeft = 12;
  const padRight = 12;
  const chartTop = 15;
  const chartBottom = 160;
  const chartHeight = chartBottom - chartTop;
  const volTop = 175;
  const volBottom = 215;
  const volHeight = volBottom - volTop;

  const points = useMemo(() => {
    if (!data.length || !stats) return [];
    const n = data.length;
    const priceRange = Math.max(stats.maxHigh - stats.minLow, stats.first * 0.01 || 1);
    
    return data.map((d, i) => {
      const x = padLeft + (i / Math.max(n - 1, 1)) * (svgWidth - padLeft - padRight);
      const y = chartBottom - ((d.close - stats.minLow) / priceRange) * chartHeight;
      const volH = ( (d.volume || 0) / stats.maxVol ) * volHeight;
      const volY = volBottom - volH;
      return { ...d, x, y, volY, volH };
    });
  }, [data, stats]);

  const pathD = useMemo(() => {
    if (!points.length) return "";
    return points.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`, "");
  }, [points]);

  const areaD = useMemo(() => {
    if (!points.length) return "";
    const firstX = points[0].x.toFixed(1);
    const lastX = points[points.length - 1].x.toFixed(1);
    return `${pathD} L ${lastX},${chartBottom} L ${firstX},${chartBottom} Z`;
  }, [pathD, points]);

  const activePoint = hoverIdx !== null && points[hoverIdx] ? points[hoverIdx] : points[points.length - 1];

  const handleMouseMove = (e) => {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < points.length; i++) {
      const diff = Math.abs(points[i].x - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    setHoverIdx(closestIdx);
  };

  const isPositive = stats ? stats.isUp : (Number(changePct) >= 0);
  const strokeColor = isPositive ? "#67e0a3" : "#ff7f87";
  const gradId = `grad-${symbol}-${embedded ? "emb" : "mod"}`;

  return (
    <div className="stock-chart-panel">
      <div className="chart-top-bar">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "10px", color: "#8a9aac", fontWeight: 700, letterSpacing: "1px" }}>
              {symbol} · {range === "1D" ? "DAY TRADING SESSION (09:15 - 15:30 IST)" : "PRICE & VOLUME TREND"}
            </span>
            {stats && (
              <span className={`pill ${stats.isUp ? "" : "down"}`} style={{ borderColor: isPositive ? "#294d3b" : "#5a2729", color: isPositive ? "#8ee8bb" : "#ff969b" }}>
                {stats.isUp ? "+" : ""}{stats.changeP.toFixed(2)}% ({range})
              </span>
            )}
          </div>
          <div className="chart-price-readout" style={{ marginTop: "4px" }}>
            <span className="big-price">
              {activePoint ? money(activePoint.close) : money(currentPrice)}
            </span>
            <span className={`change ${isPositive ? "up" : "down"}`}>
              {isPositive ? <ArrowUpRight size={15}/> : <ArrowDownRight size={15}/>}
              {activePoint && stats ? (
                `${activePoint.close >= stats.first ? "+" : ""}${(activePoint.close - stats.first).toFixed(2)}`
              ) : pct(changePct)}
            </span>
          </div>
        </div>

        {/* Range selectors */}
        <div className="chart-range-selector">
          {["1D", "1W", "1M", "3M", "6M", "1Y"].map(r => (
            <button
              key={r}
              className={`range-btn ${range === r ? "active" : ""}`}
              onClick={() => { setRange(r); setHoverIdx(null); }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Stats summary strip */}
      {stats && (
        <div className="chart-stats-strip">
          <span>{range === "1D" ? "DAY HIGH" : "PERIOD HIGH"}: <b>{money(stats.maxHigh)}</b></span>
          <span>{range === "1D" ? "DAY LOW" : "PERIOD LOW"}: <b>{money(stats.minLow)}</b></span>
          <span>{range === "1D" ? "DAY VOLUME" : "AVG VOLUME"}: <b>{Number(stats.avgVol).toLocaleString("en-IN")}</b></span>
          <span>{range === "1D" ? "SESSION TICKS" : "SESSIONS"}: <b>{points.length}</b></span>
        </div>
      )}

      {/* SVG Interactive Chart */}
      <div className="chart-svg-wrap">
        {loading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(8,12,16,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
            <LoaderCircle size={20} className="spin" style={{ color: "#67e0a3" }} />
          </div>
        )}
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.32" />
              <stop offset="90%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padLeft} y1={chartTop} x2={svgWidth - padRight} y2={chartTop} stroke="#1b2533" strokeDasharray="3 3" />
          <line x1={padLeft} y1={(chartTop + chartBottom) / 2} x2={svgWidth - padRight} y2={(chartTop + chartBottom) / 2} stroke="#1b2533" strokeDasharray="3 3" />
          <line x1={padLeft} y1={chartBottom} x2={svgWidth - padRight} y2={chartBottom} stroke="#222f3e" />

          {/* Volume separator */}
          <line x1={padLeft} y1={volTop - 5} x2={svgWidth - padRight} y2={volTop - 5} stroke="#151e2a" />

          {/* Volume Bars */}
          {points.map((p, i) => {
            const barW = Math.max(1, (svgWidth - padLeft - padRight) / points.length - 2);
            const isBarUp = (p.close >= p.open);
            return (
              <rect
                key={i}
                x={p.x - barW / 2}
                y={p.volY}
                width={barW}
                height={Math.max(1, p.volH)}
                fill={isBarUp ? "#355b4a" : "#5d3135"}
                opacity={hoverIdx === i ? 1 : 0.65}
              />
            );
          })}

          {/* Area fill */}
          {areaD && <path d={areaD} fill={`url(#${gradId})`} />}

          {/* Price Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hover Crosshair & Dot */}
          {activePoint && hoverIdx !== null && (
            <g>
              <line
                x1={activePoint.x}
                y1={chartTop}
                x2={activePoint.x}
                y2={volBottom}
                stroke="#475c74"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="4.5"
                fill={strokeColor}
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {/* Hover info readout */}
        <div className="chart-cursor-info">
          <span>
            {activePoint?.date ? activePoint.date : (range === "1D" ? "Trading Session: 09:15 - 15:30 IST" : "Move cursor across chart to inspect daily sessions")}
          </span>
          {activePoint && (
            <span>
              O: <b>{money(activePoint.open)}</b> · H: <b>{money(activePoint.high)}</b> · L: <b>{money(activePoint.low)}</b> · C: <b>{money(activePoint.close)}</b> · Vol: <b>{Number(activePoint.volume || 0).toLocaleString("en-IN")}</b>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StockChartModal({ stock, onClose, onOpenResearch }) {
  if (!stock) return null;
  const sym = stock.symbol;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="chart-modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="ticker-logo large">{String(sym).slice(0, 2)}</div>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: "18px", color: "#f0f5fc" }}>
                {stock.name || stock.company_name || sym}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="pill">NSE: {sym}</span>
                <span className="pill neutral">Day Trading & Trends</span>
                {stock.market_status && <span className="pill neutral">Status: {stock.market_status}</span>}
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <StockChart
            symbol={sym}
            currentPrice={stock.ltp ?? stock.price}
            changePct={stock.change_pct}
            companyName={stock.name || sym}
            embedded={false}
          />
        </div>

        <div className="modal-footer">
          <span style={{ fontSize: "10px", color: "#748498" }}>
            Day trading session & volume analysis
          </span>
          <button
            className="primary-btn"
            onClick={() => onOpenResearch(sym)}
          >
            Open Full Research Dossier <span>↗</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [page,setPage] = useState("Overview");
  const [health,setHealth] = useState(null);
  const [marketStatus,setMarketStatus] = useState(null);
  const [quotes,setQuotes] = useState([]);
  const [quoteMeta,setQuoteMeta] = useState(null);
  const [events,setEvents] = useState([]);
  const [feedMeta,setFeedMeta] = useState(null);
  const [loading,setLoading] = useState(false);
  const [feedLoading,setFeedLoading] = useState(false);
  const [error,setError] = useState("");
  const [symbol,setSymbol] = useState("RELIANCE");
  const [searchInput,setSearchInput] = useState("");
  const [research,setResearch] = useState(null);
  const [researchLoading,setResearchLoading] = useState(false);
  const [question,setQuestion] = useState("Compare management's guidance with actual financial performance. What is supported by the primary sources?");
  const [answer,setAnswer] = useState(null);
  const [asking,setAsking] = useState(false);
  const [filter,setFilter] = useState("All");
  const [windowHours,setWindowHours] = useState("24");
  const [priceThreshold,setPriceThreshold] = useState(3);
  const [volumeThreshold,setVolumeThreshold] = useState(2);
  const [alerts,setAlerts] = useState([]);
  const [menuOpen,setMenuOpen] = useState(false);
  const [lastRefresh,setLastRefresh] = useState(null);
  const [selectedStockForChart, setSelectedStockForChart] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  // Auth state
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("finn_user") || "null"); } catch { return null; }
  });

  const handleLogout = () => {
    localStorage.removeItem("finn_token");
    localStorage.removeItem("finn_user");
    setUser(null);
    setPage("Overview");
  };

  const handleAuth = (u) => setUser(u);
  const handleUpdateUser = (u) => { setUser(u); };

  const fetchHealth = useCallback(async()=>{ try { setHealth(await api("/api/health")); } catch(e){setHealth({ok:false,error:e.message});}},[]);
  const refreshQuotes = useCallback(async()=>{
    setLoading(true); setError("");
    try {
      const r=await api(`/api/quotes?symbols=${encodeURIComponent(DEFAULT_SYMBOLS.join(","))}`);
      setQuotes(Array.isArray(r.data)?r.data:[]); setQuoteMeta(r.meta||null); setLastRefresh(new Date().toISOString());
      const evald=await api("/api/alerts/evaluate",{method:"POST",body:JSON.stringify({quotes:r.data||[],rules:{priceMovePct:Number(priceThreshold),volumeMultiple:Number(volumeThreshold)}})});
      setAlerts(evald.data||[]);
    } catch(e){setError(e.message);} finally{setLoading(false);}
  },[priceThreshold,volumeThreshold]);
  const refreshFeed=useCallback(async()=>{
    setFeedLoading(true);
    try { const r=await api(`/api/feed?symbols=${encodeURIComponent(DEFAULT_SYMBOLS.slice(0,5).join(","))}&limit=30`); setEvents(r.data||[]); setFeedMeta(r.meta||null); }
    catch(e){setError(e.message);} finally{setFeedLoading(false);}
  },[]);
  useEffect(()=>{fetchHealth(); api("/api/market/status").then(setMarketStatus).catch(()=>{});},[fetchHealth]);
  useEffect(()=>{refreshQuotes(); refreshFeed();},[refreshQuotes,refreshFeed]);
  const visibleEvents=useMemo(()=>{
    const now=Date.now(), hours=Number(windowHours);
    return events.filter(e=>{
      if(filter!=="All" && e.category!==filter) return false;
      if(e.date && now-new Date(e.date).getTime()>hours*3600000) return false;
      return true;
    });
  },[events,filter,windowHours]);
  const marketOpen=JSON.stringify(marketStatus||{}).toLowerCase().includes("open") && !JSON.stringify(marketStatus||{}).toLowerCase().includes("closed");
  const statusLabel=marketStatus?.data?.status || marketStatus?.data?.market_status || marketStatus?.status || "Status unavailable";
  const highCount=events.filter(e=>e.priority==="HIGH").length;

  const openResearch=async(sym=symbol)=>{
    const s=String(sym).trim().toUpperCase().replace(/\.NS$|\.BO$/,"");
    if(!/^[A-Z0-9&._-]{1,24}$/.test(s)){setError("Enter a valid NSE/BSE ticker.");return;}
    setSymbol(s); setPage("Research"); setResearchLoading(true); setResearch(null); setAnswer(null); setError("");
    try{setResearch(await api(`/api/research/${encodeURIComponent(s)}`));}
    catch(e){setError(e.message);}
    finally{setResearchLoading(false);}
  };
  const askFinn = async (q = question) => {
    const promptToUse = q || question;
    if (!promptToUse.trim()) return;
    setAsking(true);
    setAnswer(null);

    // Trim context: only pass compact digest, not full documents JSON
    const context = research ? JSON.stringify({
      digest: research.digest
    }).slice(0, 1000) : "";

    // Accumulate streamed text
    let accumulated = "";

    try {
      await askFinnStream(
        { symbol, question: promptToUse, context },
        // onDelta: show progressive output token-by-token
        (delta) => {
          accumulated += delta;
          setAnswer(prev => ({
            ...(prev || {}),
            answer: accumulated,
            aiConfigured: true,
            isStreaming: true
          }));
        },
        // onDone: replace with final result (includes sources, timings)
        (finalResult) => {
          setAnswer({
            ...finalResult,
            isStreaming: false
          });
        }
      );
    } catch (e) {
      const isTimeout = /timeout|aborted|timed out/i.test(e.message);
      setAnswer({
        answer: isTimeout
          ? "The research synthesis took longer than expected to complete (120s timeout limit reached).\n\nYour research question is saved above — click **Retry Analysis** or rephrase to try again."
          : e.message,
        aiConfigured: false,
        isError: true,
        isTimeout
      });
    } finally {
      setAsking(false);
    }
  };




  const nav=[["Overview",LayoutDashboard],["Portfolio",WalletCards],["Push Inbox",Activity],["Research",Search],["Alerts & Rules",Bell]];
  const researchPrompts=[
    { label: "Revenue & Mix", prompt: "Provide a comprehensive breakdown of the company's business model, revenue streams, and segment performance based on primary filings." },
    { label: "Guidance vs Delivered", prompt: "Compare management's prior quarterly guidance with actual financial results delivered. Cite specific transcripts." },
    { label: "Margin & Trajectory", prompt: "Analyze multi-year growth and margin trends (EBITDA, PBT, PAT) and highlight any margin pressures." },
    { label: "Balance Sheet & Debt", prompt: "Evaluate balance sheet health, leverage, debt maturities, and working-capital risks from primary documents." },
    { label: "Cash Flow Quality", prompt: "Examine cash quality: compare operating cash flow against reported accounting net profit." },
    { label: "Narrative vs Reality", prompt: "Highlight discrepancies between management's public statements/calls and the audited financial disclosures." },
    { label: "Capex & Capital Allocation", prompt: "Summarize major capital expenditure plans, project timelines, and return expectations." },
    { label: "Bull vs Bear Case", prompt: "Construct an objective Bull vs Bear case strictly using the retrieved company disclosures and transcripts." }
  ];

  return <div className="app-shell">
    {selectedStockForChart && (
      <StockChartModal
        stock={selectedStockForChart}
        onClose={() => setSelectedStockForChart(null)}
        onOpenResearch={(sym) => {
          setSelectedStockForChart(null);
          openResearch(sym);
        }}
      />
    )}

    <aside className={`sidebar ${menuOpen?"show":""}`}>
      <div className="brand"><div className="brand-icon"><Command size={19}/></div><div><b>FINN<span>.</span></b><small>INVESTMENT INTELLIGENCE</small></div><button className="icon-btn mobile-close" onClick={()=>setMenuOpen(false)}><X size={18}/></button></div>
      <div className="workspace"><span className="workspace-dot"></span><span>Public Markets Desk</span><ChevronDown size={14}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{nav.map(([name,Icon])=><button key={name} className={`nav-item ${page===name?"active":""}`} onClick={()=>{setPage(name);setMenuOpen(false);}}><Icon size={17}/><span>{name}</span>{name==="Intelligence Feed"&&highCount>0&&<i>{highCount}</i>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="source-status"><span className={`pulse ${health?.providerConfigured?"":"off"}`}></span><div><b>{health?.providerConfigured?"Data provider configured":"Connect data provider"}</b><small>{health?.providerConfigured?"TejHQ EOD API":"Keyless"}</small></div></div><div className="user-row" onClick={()=>setPage("Profile")} style={{cursor:"pointer"}}><div className="avatar">{(user?.name||"F").charAt(0).toUpperCase()}</div><div><b>{user?.name||"FINN Workspace"}</b><small>{user?.email||"Research mode"}</small></div><User size={16}/></div></div>
    </aside>
    {menuOpen&&<div className="scrim" onClick={()=>setMenuOpen(false)}></div>}
    <main className="main">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMenuOpen(true)}><Menu size={20}/></button><div className="breadcrumb">Workspace <span>/</span> <b>{page}</b></div><div className="top-actions"><div className="market-chip"><span className={`pulse ${marketOpen?"":"off"}`}></span><span>{statusLabel}</span></div><button className="icon-btn" title="Refresh market data" onClick={refreshQuotes}><RefreshCw size={16} className={loading?"spin":""}/></button><div style={{position:"relative"}}><button className="icon-btn" title="Push Notifications" onClick={()=>setNotifOpen(v=>!v)}><Bell size={16}/></button><NotificationDrawer isOpen={notifOpen} onClose={()=>setNotifOpen(false)} onNavigate={setPage}/></div><div className="top-avatar" onClick={()=>setPage("Profile")} style={{cursor:"pointer"}} title="View profile">{(user?.name||"F").charAt(0).toUpperCase()}</div></div></header>
      <div className="content">
        {error&&<div className="error-banner"><CircleAlert size={17}/><span>{error}</span><button onClick={()=>setError("")}><X size={15}/></button></div>}
        {page==="Overview"&&<>
          <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"></span> MARKET INTELLIGENCE</div><h1>See what matters.<br/><span>Ignore the noise.</span></h1><p className="subhead">A focused view of your portfolio, material filings, and company fundamentals.</p></div><button className="primary-btn" onClick={()=>setPage("Push Inbox")}><Activity size={16}/> Open Push Inbox <span>?</span></button></section>
          <section className="stat-grid">
            <Stat label="WATCHLIST" value={quotes.length?String(quotes.length).padStart(2,"0"):"—"} note="Tracked NSE symbols" icon={TrendingUp}/>
            <Stat label="HIGH-PRIORITY FILINGS" value={String(highCount).padStart(2,"0")} note="Across monitored companies" icon={FileText}/>
            <Stat label="ACTIVE ALERTS" value={String(alerts.length).padStart(2,"0")} note="Based on your thresholds" icon={Bell}/>
            <Stat label="DATA AS OF" value={quoteMeta?.as_of?new Date(quoteMeta.as_of).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):"—"} note={quoteMeta?.as_of?dateFmt(quoteMeta.as_of):"Awaiting provider"} icon={Clock3}/>
          </section>
          <div className="section-heading"><div><h2>Portfolio pulse</h2><p>Click any stock row to view its interactive price chart.</p></div><button className="text-btn" onClick={refreshQuotes}>{loading?<LoaderCircle size={15} className="spin"/>:<RefreshCw size={15}/>} Refresh quotes</button></div>
          <section className="panel"><div className="table-wrap"><table><thead><tr><th>COMPANY / SYMBOL</th><th>LAST TRADED PRICE</th><th>DAY CHANGE</th><th>VOLUME</th><th>PRICE CHART</th><th></th></tr></thead><tbody>{quotes.slice(0,12).map((q,i)=>(
            <tr key={q.symbol||i} className="clickable-row" onClick={()=>setSelectedStockForChart(q)} title="Click to open stock chart">
              <td>
                <div className="company-cell">
                  <div className="ticker-logo">{String(q.symbol||"?").slice(0,2)}</div>
                  <div><b>{q.name||q.company_name||q.symbol}</b><small>{q.symbol}</small></div>
                </div>
              </td>
              <td className="price">{money(q.ltp??q.price)}</td>
              <td><span className={`change ${Number(q.change_pct)>=0?"up":"down"}`}>{Number(q.change_pct)>=0?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>} {pct(q.change_pct)}</span></td>
              <td>{q.volume==null?"—":Number(q.volume).toLocaleString("en-IN")}</td>
              <td>
                <span className="stock-chart-badge">
                  <BarChart3 size={12}/> View Chart
                </span>
              </td>
              <td>
                <button
                  className="row-arrow"
                  onClick={(e)=>{ e.stopPropagation(); openResearch(q.symbol); }}
                  aria-label={`Research ${q.symbol}`}
                  title="Open research dossier"
                >
                  ↗
                </button>
              </td>
            </tr>
          ))}
          {!quotes.length&&<tr><td colSpan="6"><Empty title="No quote data yet" text="TejHQ EOD snapshot is loading. Data is published by TejHQ nightly (T+1 by morning IST)." /></td></tr>}</tbody></table></div><div className="panel-foot"><span>Click any row to open the interactive price chart.</span><span>Last UI refresh: {lastRefresh?dateFmt(lastRefresh):"—"}</span></div></section>
          <div className="two-col"><section><div className="section-heading"><div><h2>Needs your attention</h2><p>Prioritized company announcements.</p></div><button className="text-btn" onClick={()=>setPage("Push Inbox")}>View all ?</button></div><div className="panel feed-preview">{events.slice(0,4).map(e=><EventRow key={e.id} event={e}/>)}{!events.length&&<Empty title="Filing feed not loaded" text="Load filings when the provider is configured."/>}</div></section><section><div className="section-heading"><div><h2>Ask FINN</h2><p>Start a source-grounded company review.</p></div><Sparkles size={17} className="muted-icon"/></div><div className="ask-card"><div className="ask-card-icon"><MessageSquareText size={20}/></div><h3>Go beyond the headline.</h3><p>Compare what management said with what the company actually reported.</p><div className="quick-symbols">{["RELIANCE","TCS","INFY"].map(s=><button key={s} onClick={()=>openResearch(s)}>{s}</button>)}</div><button className="primary-btn full" onClick={()=>{setPage("Research");openResearch(symbol);}}>Open research workspace <span>?</span></button></div></section></div>
        </>}
        {(page==="Push Inbox" || page==="Intelligence Feed") && <PushInboxPage user={user} onOpenResearch={openResearch}/>}
        {page==="Research"&&<><section className="page-title"><div className="eyebrow"><span className="eyebrow-line"></span> PULL INTELLIGENCE</div><h1>Company research</h1><p>Grounded in verified company filings, parsed financial tables, and concall summaries.</p></section><div className="research-search"><Search size={18}/><input value={searchInput} onChange={e=>setSearchInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&openResearch(searchInput)} placeholder="Search any supported NSE ticker, e.g. TCS, RELIANCE, INFY"/><button className="primary-btn" onClick={()=>openResearch(searchInput||symbol)}>Research company <span>↗</span></button></div>
          <div className="research-layout">
            <section className="panel research-main">
              {researchLoading?<Loading text={`Retrieving and parsing source material for ${symbol}…`}/>:research?(
                <ErrorBoundary>
                  <ResearchDetails
                    symbol={symbol}
                    research={research}
                    onRefresh={()=>openResearch(symbol)}
                    onSelectPrompt={(p)=>{ setQuestion(p); }}
                    researchPrompts={researchPrompts}
                  />
                </ErrorBoundary>
              ):<Empty title="Search a company to begin" text="FINN retrieves available company profile, parsed documents and earnings-call summaries."/>}
            </section>
            <section className="panel ask-panel">
              <div className="ask-panel-head"><div className="ask-card-icon"><Sparkles size={19}/></div><div><h3>Ask FINN</h3><p>Source-grounded research synthesis.</p></div></div>
              <label className="field-label">RESEARCH ANGLE QUICK SELECT</label>
              <div className="quick-symbols" style={{ flexWrap: "wrap", marginBottom: "12px" }}>
                {researchPrompts.slice(0, 4).map(p=>(
                  <button key={p.label} onClick={()=>{ setQuestion(p.prompt); }}>{p.label}</button>
                ))}
              </div>
              <label className="field-label">YOUR RESEARCH QUESTION</label>
              <textarea value={question} onChange={e=>setQuestion(e.target.value)} rows="5" placeholder="Compare guidance with reported results. Cite primary sources."/>
              <button className="primary-btn full" onClick={()=>askFinn(question)} disabled={asking||!question.trim()}>{asking?<LoaderCircle size={16} className="spin"/>:<Sparkles size={16}/>} {asking ? "Synthesizing research..." : "Analyse with sources"}</button>
              {asking && !answer?.answer && (
                <div className="answer-block" style={{ borderStyle: "dashed", borderColor: "#2a523d", background: "#0e1814" }}>
                  <div className="answer-label" style={{ color: "#67e0a3" }}>
                    <LoaderCircle size={14} className="spin" />
                    <span>FINN RESEARCH IN PROGRESS...</span>
                  </div>
                  <div style={{ marginTop: "10px", color: "#c1cddb", fontSize: "11px", lineHeight: 1.7 }}>
                    <p style={{ margin: "0 0 6px" }}>
                      Analyzing verified market data and generating primary source synthesis for <b>{symbol}</b>.
                    </p>
                    <small style={{ color: "#748498" }}>
                      Deep research with Google Gemini typically takes 15–45 seconds. Please keep this tab open.
                    </small>
                  </div>
                </div>
              )}
              {/* Progressive streaming output: show partial answer while still synthesizing */}
              {asking && answer?.answer && (
                <div className="answer-block" style={{ borderStyle: "dashed", borderColor: "#2a523d", background: "#0e1814" }}>
                  <div className="answer-label" style={{ color: "#67e0a3" }}>
                    <LoaderCircle size={14} className="spin" />
                    <span>STREAMING SYNTHESIS...</span>
                  </div>
                  <div style={{ marginTop: "10px" }}>
                    <SafeMarkdown content={answer.answer} />
                  </div>
                </div>
              )}
              {answer && !asking && (
                <div className={`answer-block ${answer.isError ? "error" : ""}`} style={answer.isError ? { borderColor: "#64262b", background: "#1b1114" } : {}}>
                  <div className="answer-label" style={{ color: answer.isError ? "#ff9ea2" : "#9ce6bc" }}>
                    {answer.isError ? <CircleAlert size={15} /> : <ShieldCheck size={15} />}
                    <span>{answer.isError ? (answer.isTimeout ? "RESEARCH QUERY TIMED OUT" : "RESEARCH ERROR") : (answer.aiConfigured ? "AI SYNTHESIS" : "RETRIEVAL NOTICE")}</span>
                  </div>

                  {/* Grounded Evidence Metadata & Reporting Periods */}
                  {answer.sources?.dataAvailability && !answer.isError && (
                    <div style={{ marginTop: "10px", padding: "8px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "11px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                        <span style={{ color: "#748498", fontWeight: 600 }}>EVIDENCE GROUNDING:</span>
                        {answer.sources.dataAvailability.financialsAvailable && (
                          <span className="pill" style={{ fontSize: "10px", padding: "2px 6px", background: "#1a3b2b", color: "#67e0a3", border: "1px solid #2ea86f" }}>
                            ✓ Actuals ({answer.sources.dataAvailability.reportingPeriods?.join(", ") || "Filed"})
                          </span>
                        )}
                        {answer.sources.dataAvailability.guidanceAvailable ? (
                          <span className="pill" style={{ fontSize: "10px", padding: "2px 6px", background: "#1a2c3b", color: "#60a5fa", border: "1px solid #3b82f6" }}>
                            ✓ Management Guidance Indexed
                          </span>
                        ) : (
                          <span className="pill neutral" style={{ fontSize: "10px", padding: "2px 6px" }}>
                            — Guidance: Not Disclosed
                          </span>
                        )}
                        {answer.sources.dataAvailability.documentsAvailable && (
                          <span className="pill" style={{ fontSize: "10px", padding: "2px 6px", background: "#332211", color: "#fbbf24", border: "1px solid #d97706" }}>
                            ✓ {answer.sources.dataAvailability.documentCount || answer.sources.documents?.length || "Official"} Filings Verified
                          </span>
                        )}
                      </div>
                      {Array.isArray(answer.sources.documents) && answer.sources.documents.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", color: "#8b9bb4" }}>
                          <span style={{ fontSize: "10px" }}>Verified Sources:</span>
                          {answer.sources.documents.slice(0, 3).map((d, idx) => (
                            <a
                              key={d.id || idx}
                              href={d.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "#5eead4", fontSize: "10px", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "3px" }}
                            >
                              {d.title?.split("—")[1]?.trim() || d.title || d.doc_type} ↗
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: "10px" }}>
                    <SafeMarkdown content={answer.answer} />
                  </div>
                  {answer.isError && (
                    <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                      <button
                        className="secondary-btn"
                        style={{ fontSize: "11px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                        onClick={() => askFinn(question)}
                      >
                        <RefreshCw size={12} /> Retry Analysis
                      </button>
                    </div>
                  )}
                  {answer.sources && !answer.isError && (
                    <details style={{ marginTop: "12px" }}>
                      <summary>Inspect retrieved evidence payload</summary>
                      <pre className="data-digest" style={{ marginTop: "8px" }}>{JSON.stringify(answer.sources, null, 2)}</pre>
                    </details>
                  )}
                  {answer._timings && !answer.isError && (
                    <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: "11px", color: "#8b9bb4", fontFamily: "monospace", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span>⏱ Retrieval: <b style={{ color: "#c1cddb" }}>{Number(answer._timings.retrieval_ms ?? 0)}ms</b></span>
                      <span>·</span>
                      <span>Gemini API: <b style={{ color: "#c1cddb" }}>{Number(answer._timings.gemini_ms ?? 0).toLocaleString()}ms</b></span>
                      <span>·</span>
                      <span>Total: <b style={{ color: "#c1cddb" }}>{Number(answer._timings.total_ms ?? 0).toLocaleString()}ms</b></span>
                      {answer.cached && <span style={{ color: "#67e0a3", fontWeight: 600 }}>· ✓ Cached</span>}
                    </div>
                  )}
                </div>
              )}
              <div className="disclaimer"><ShieldCheck size={15}/> FINN is an informational research prototype, not investment advice.</div>
            </section>
          </div>
        </>}
        {page==="Portfolio"&&(user ? <PortfolioPage user={user}/> : <AuthPage onAuth={handleAuth} embedded subtitle="Sign in to track your personal holdings, calculate P&L, and view portfolio performance."/>)}
        {page==="Profile"&&(user ? <ProfilePage user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser}/> : <AuthPage onAuth={handleAuth} embedded subtitle="Sign in to access your account settings and profile."/>)}
        {(page==="Alerts & Rules" || page==="Alerts") && <AlertsAndRulesPage user={user}/>}
        <footer className="footer"><span>FINN <i>•</i> Built for signal, not noise.</span><span>Market data by TejHQ (EOD · NSE/BSE) <i>•</i> Not investment advice</span></footer>
      </div>
    </main>
  </div>;
}

function ResearchDetails({ symbol, research, onRefresh, onSelectPrompt, researchPrompts }) {
  const [activeTab, setActiveTab] = useState("earnings");
  const [activeCallIdx, setActiveCallIdx] = useState(0);
  const [docFilter, setDocFilter] = useState("");

  const comp = research?.profile?.data?.company || {};
  const funds = research?.profile?.data?.fundamentals || {};
  const quote = research?.profile?.data?.quote || {};
  const summaries = research?.earningsCalls?.data?.summaries || [];
  const digest = research?.digest?.data || null;
  const docs = research?.documents?.data?.documents || [];

  const filteredDocs = useMemo(() => {
    if (!docFilter.trim()) return docs;
    const q = docFilter.toLowerCase();
    return docs.filter(d =>
      (d.title || "").toLowerCase().includes(q) ||
      (d.doc_type || "").toLowerCase().includes(q) ||
      (d.period || "").toLowerCase().includes(q)
    );
  }, [docs, docFilter]);

  const activeCall = summaries[activeCallIdx] || summaries[0];

  return <div>
    {/* Company Header */}
    <div className="company-header-card">
      <div className="company-header-left">
        <div className="ticker-logo large">{symbol.slice(0, 2)}</div>
        <div>
          <h2>{comp.name || symbol}</h2>
          <div className="company-meta-pills">
            <span className="pill">NSE: {symbol}</span>
            {comp.sector && <span className="pill neutral">{comp.sector}</span>}
            {funds.company_classification && <span className="pill neutral">{funds.company_classification}</span>}
            {comp.is_fno && <span className="pill neutral">F&O</span>}
          </div>
          <div className="company-meta-row">
            {comp.ceo && <span><b>CEO:</b> {comp.ceo}</span>}
            {comp.employees && <span><b>Headcount:</b> {Number(comp.employees).toLocaleString("en-IN")}</span>}
            {comp.website && <a href={`https://${comp.website}`} target="_blank" rel="noreferrer"><Globe size={11}/> {comp.website} <ExternalLink size={10}/></a>}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {quote.price != null && (
          <div className="company-price-card">
            <span className="price-val">{money(quote.price)}</span>
            <span className={`change ${Number(quote.change_pct) >= 0 ? "up" : "down"}`}>
              {Number(quote.change_pct) >= 0 ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>} {pct(quote.change_pct)}
            </span>
          </div>
        )}
        <button className="icon-btn" onClick={onRefresh} title="Refresh company data"><RefreshCw size={16}/></button>
      </div>
    </div>

    {/* Interactive Price & Volume Chart */}
    <StockChart
      symbol={symbol}
      currentPrice={quote.price}
      changePct={quote.change_pct}
      companyName={comp.name || symbol}
      embedded={true}
    />

    {/* Key Executive Fundamentals */}
    <div className="fundamentals-grid">
      <FundItem label="MARKET CAP" value={funds.market_cap ? formatCr(funds.market_cap) : "—"} note={funds.company_classification || "Equity"} />
      <FundItem label="P/E (TTM)" value={funds.stock_pe != null ? Number(funds.stock_pe).toFixed(2) : "—"} note={funds.price_to_book != null ? `P/B: ${Number(funds.price_to_book).toFixed(2)}` : "TTM Multiple"} />
      <FundItem label="ROCE / ROE" value={`${funds.roce != null ? Number(funds.roce).toFixed(1) + "%" : "—"} / ${funds.roe != null ? Number(funds.roe).toFixed(1) + "%" : "—"}`} note="Capital Efficiency" />
      <FundItem label="EPS (TTM)" value={funds.eps != null ? `₹${Number(funds.eps).toFixed(2)}` : "—"} note={funds.book_value != null ? `Book Val: ₹${Number(funds.book_value).toFixed(1)}` : "Per Share"} />
      <FundItem label="52W HIGH / LOW" value={funds.high_52w != null ? `₹${funds.high_52w} / ₹${funds.low_52w}` : "—"} note="Range" />
      <FundItem label="DEBT TO EQUITY" value={funds.debt_to_equity != null ? Number(funds.debt_to_equity).toFixed(2) : "—"} note={funds.debt_to_equity != null && Number(funds.debt_to_equity) < 0.6 ? "Conservative leverage" : "Leverage Ratio"} />
      <FundItem label="ANNUAL REVENUE" value={funds.yearly_revenue ? formatCr(funds.yearly_revenue) : "—"} note={funds.revenue_growth_1y != null ? `${Number(funds.revenue_growth_1y) >= 0 ? "+" : ""}${Number(funds.revenue_growth_1y).toFixed(1)}% YoY` : "Reported"} />
      <FundItem label="NET PROFIT" value={funds.net_income ? formatCr(funds.net_income) : "—"} note={funds.ebitda ? `EBITDA: ${formatCr(funds.ebitda)}` : "Profitability"} />
    </div>

    {/* Research Sub Navigation */}
    <div className="research-subnav">
      <button className={`tab-btn ${activeTab === "earnings" ? "active" : ""}`} onClick={() => setActiveTab("earnings")}>
        <Sparkles size={15}/> <span>Earnings Calls & Presentations</span>
        {summaries.length > 0 && <span className="tab-badge">{summaries.length}</span>}
      </button>
      <button className={`tab-btn ${activeTab === "digest" ? "active" : ""}`} onClick={() => setActiveTab("digest")}>
        <ShieldCheck size={15}/> <span>Filing & Credit Digest</span>
        {digest?.available && <span className="tab-badge">Verified</span>}
      </button>
      <button className={`tab-btn ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
        <Building2 size={15}/> <span>Business Overview & Growth</span>
      </button>
      <button className={`tab-btn ${activeTab === "documents" ? "active" : ""}`} onClick={() => setActiveTab("documents")}>
        <FileText size={15}/> <span>Filing Archive & PDFs</span>
        {docs.length > 0 && <span className="tab-badge">{docs.length}</span>}
      </button>
    </div>

    {/* Tab 1: Earnings Calls */}
    {activeTab === "earnings" && (
      <div>
        {summaries.length > 0 ? (
          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: "#7f8ea1", fontWeight: 700 }}>SELECT CALL / PERIOD:</span>
              {summaries.map((s, idx) => (
                <button
                  key={idx}
                  className={`pill ${activeCallIdx === idx ? "" : "neutral"}`}
                  onClick={() => setActiveCallIdx(idx)}
                >
                  {s.period || "Period"} · {String(s.doc_type || "concall").toUpperCase()}
                </button>
              ))}
            </div>
            <div className="doc-reader-card">
              <div className="doc-reader-head">
                <b><Sparkles size={16}/> {activeCall?.period || "Earnings Call"} — {String(activeCall?.doc_type || "Presentation").toUpperCase()}</b>
                <div className="doc-meta-tags">
                  <span className="pill">Verified Source</span>
                </div>
              </div>
              <div className="doc-reader-content">
                <SafeMarkdown content={activeCall?.summary} fallback="No transcript summary available." />
              </div>
            </div>
          </div>
        ) : (
          <Empty title="No parsed earnings calls found" text="Concall summaries are updated after quarterly results. You can inspect filing PDFs in the archive tab." />
        )}
      </div>
    )}

    {/* Tab 2: Filing Digest */}
    {activeTab === "digest" && (
      <div>
        {digest && digest.summary ? (
          <div className="doc-reader-card">
            <div className="doc-reader-head">
              <b><ShieldCheck size={16}/> {String(digest.doc_type || "Filing").replaceAll("_", " ").toUpperCase()} DIGEST</b>
              <div className="doc-meta-tags">
                {digest.doc_date && <span className="pill neutral">{digest.doc_date}</span>}
                {digest.num_pages && <span className="pill neutral">{digest.num_pages} Pages</span>}
                <span className="pill">Parse Quality: {digest.parse_quality || "OK"}</span>
              </div>
            </div>
            <div className="doc-reader-content">
              <SafeMarkdown content={digest.summary} fallback="No digest summary available." />
            </div>
          </div>
        ) : (
          <Empty title="No parsed filing digest available" text="Primary document digest has not been published for this period. Check the documents archive." />
        )}
      </div>
    )}

    {/* Tab 3: Company Overview */}
    {activeTab === "overview" && (
      <div>
        <div className="overview-card">
          <h4>About {comp.name || symbol}</h4>
          <p>{comp.about || "Company description unavailable in directory."}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", borderTop: "1px solid #202b37", paddingTop: "14px" }}>
            <div><small style={{ color: "#748498", fontSize: "9px", display: "block" }}>MACRO SECTOR</small><b style={{ fontSize: "11px", color: "#dbe4ef" }}>{comp.macro_sector || "—"}</b></div>
            <div><small style={{ color: "#748498", fontSize: "9px", display: "block" }}>INDUSTRY</small><b style={{ fontSize: "11px", color: "#dbe4ef" }}>{comp.industry || "—"}</b></div>
            <div><small style={{ color: "#748498", fontSize: "9px", display: "block" }}>LISTING DATE</small><b style={{ fontSize: "11px", color: "#dbe4ef" }}>{comp.listing_date || "—"}</b></div>
            <div><small style={{ color: "#748498", fontSize: "9px", display: "block" }}>EXCHANGE CODE</small><b style={{ fontSize: "11px", color: "#dbe4ef" }}>BSE: {comp.bse_code || "—"} · NSE: {comp.nse_symbol || symbol}</b></div>
          </div>
        </div>
      </div>
    )}

    {/* Tab 4: Filing Archive */}
    {activeTab === "documents" && (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
          <div className="research-search" style={{ margin: 0, padding: "7px 10px", maxWidth: "340px", flex: 1 }}>
            <Search size={15}/>
            <input placeholder="Filter filings by title or type..." value={docFilter} onChange={e=>setDocFilter(e.target.value)} />
          </div>
          <span style={{ fontSize: "10px", color: "#748498" }}>Showing {filteredDocs.length} of {docs.length} filings</span>
        </div>
        <div className="doc-archive-grid">
          {filteredDocs.map((d, idx) => (
            <div className="doc-item-row" key={d.doc_id || idx}>
              <div className="doc-item-left">
                <div className="doc-type-icon"><FileText size={16}/></div>
                <div className="doc-info">
                  <b>{d.title || d.doc_type || "Company Filing"}</b>
                  <small>{d.doc_date || d.period || "Recent"} {d.num_pages ? `· ${d.num_pages} pages` : ""} · Type: {d.doc_type || "Filing"}</small>
                </div>
              </div>
              {d.source_url && (
                <a href={d.source_url} target="_blank" rel="noreferrer" className="doc-action-btn">
                  Open PDF <ExternalLink size={11}/>
                </a>
              )}
            </div>
          ))}
          {!filteredDocs.length && <Empty title="No matching documents" text="No filings match your filter criteria." />}
        </div>
      </div>
    )}

    {/* Suggested Research Angles */}
    <h3 className="subsection-title" style={{ marginTop: "25px" }}>Suggested Research Angles</h3>
    <div className="prompt-grid">
      {researchPrompts.map(p => (
        <button key={p.label} onClick={() => onSelectPrompt(p.prompt)}>
          <span>{p.label}</span>
          <span style={{ color: "#67e0a3" }}>↗</span>
        </button>
      ))}
    </div>

    {/* Collapsible raw JSON audit */}
    <details className="raw-json-details">
      <summary>Inspect raw provider payload (Debug & API Audit)</summary>
      <pre className="data-digest" style={{ marginTop: "10px" }}>{JSON.stringify(research, null, 2)}</pre>
    </details>
  </div>;
}

function FundItem({ label, value, note }) {
  return <div className="fund-card">
    <div className="fund-label"><span>{label}</span></div>
    <div className="fund-value">{value}</div>
    <div className="fund-note">{note}</div>
  </div>;
}

function Stat({label,value,note,icon:Icon}){return <div className="stat-card"><div className="stat-top"><span>{label}</span><Icon size={16}/></div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>}

// ===========================================================================
// AUTH PAGE
// ===========================================================================
function AuthPage({ onAuth, embedded = false, subtitle = null }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async e => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email, password } : { name, email, password };
      const r = await api(endpoint, { method: "POST", body: JSON.stringify(body) });
      localStorage.setItem("finn_token", r.token);
      localStorage.setItem("finn_user", JSON.stringify(r.user));
      onAuth(r.user);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={embedded ? { display: "flex", justifyContent: "center", padding: "20px 0" } : { minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "#131c27", border: "1px solid #1e2d3d", borderRadius: "14px", padding: "40px", width: "100%", maxWidth: "400px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px" }}>
          <div style={{ width: 36, height: 36, background: "#2ea86f20", border: "1px solid #2ea86f40", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><Command size={18} color="#2ea86f"/></div>
          <div><b style={{ color: "#dbe4ef", fontSize: 16 }}>FINN<span style={{ color: "#2ea86f" }}>.</span></b><br/><small style={{ color: "#748498", fontSize: 10 }}>INVESTMENT INTELLIGENCE</small></div>
        </div>
        <h2 style={{ color: "#dbe4ef", fontSize: 20, marginBottom: 6 }}>{mode === "login" ? "Welcome back" : "Create account"}</h2>
        <p style={{ color: "#748498", fontSize: 12, marginBottom: 24 }}>{subtitle || (mode === "login" ? "Sign in to your portfolio workspace" : "Set up your FINN portfolio tracker")}</p>
        {error && <div style={{ background: "#1b1114", border: "1px solid #64262b", borderRadius: 8, padding: "10px 14px", color: "#ff9ea2", fontSize: 12, marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}><CircleAlert size={14}/>{error}</div>}
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "register" && (
            <div><label style={{ color: "#748498", fontSize: 10, display: "block", marginBottom: 6 }}>FULL NAME</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required style={{ width: "100%", background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 8, padding: "10px 14px", color: "#dbe4ef", fontSize: 13, boxSizing: "border-box" }}/></div>
          )}
          <div><label style={{ color: "#748498", fontSize: 10, display: "block", marginBottom: 6 }}>EMAIL</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={{ width: "100%", background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 8, padding: "10px 14px", color: "#dbe4ef", fontSize: 13, boxSizing: "border-box" }}/></div>
          <div><label style={{ color: "#748498", fontSize: 10, display: "block", marginBottom: 6 }}>PASSWORD</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required style={{ width: "100%", background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 8, padding: "10px 14px", color: "#dbe4ef", fontSize: 13, boxSizing: "border-box" }}/></div>
          <button type="submit" disabled={loading} style={{ background: "#2ea86f", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <><LoaderCircle size={15} className="spin"/> Processing…</> : mode === "login" ? "Sign in →" : "Create account →"}
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} style={{ background: "none", border: "none", color: "#748498", fontSize: 12, cursor: "pointer" }}>
            {mode === "login" ? "No account? Register →" : "Already have an account? Sign in →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// MINI SVG CHARTS (inline, no external library)
// ===========================================================================
function MiniLineChart({ data, color = "#2ea86f", height = 40, width = "100%" }) {
  if (!data || data.length < 2) return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#748498", fontSize: 10 }}>No data</div>;
  const vals = data.map(d => d.value ?? d);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width, height, display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
    </svg>
  );
}

function DonutChart({ data, size = 120 }) {
  // data: [{ label, value, color }]
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <div style={{ width: size, height: size, borderRadius: "50%", background: "#1e2d3d", display: "flex", alignItems: "center", justifyContent: "center", color: "#748498", fontSize: 10 }}>No data</div>;
  const r = 40, cx = 50, cy = 50, stroke = 18;
  let offset = 0;
  const slices = data.map((d, i) => {
    const pct = d.value / total;
    const dash = pct * 2 * Math.PI * r;
    const gap = (1 - pct) * 2 * Math.PI * r;
    const slice = { ...d, dash, gap, offset };
    offset += dash;
    return slice;
  });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2d3d" strokeWidth={stroke}/>
      {slices.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color || "#2ea86f"} strokeWidth={stroke}
          strokeDasharray={`${s.dash} ${s.gap}`} strokeDashoffset={-s.offset}
          style={{ transform: "rotate(-90deg)", transformOrigin: "50px 50px" }}/>
      ))}
      <text x="50" y="46" textAnchor="middle" fill="#dbe4ef" fontSize="10" fontWeight="600">{data.length}</text>
      <text x="50" y="58" textAnchor="middle" fill="#748498" fontSize="6">STOCKS</text>
    </svg>
  );
}

const CHART_COLORS = ["#2ea86f","#4c9fff","#f7c948","#ff6b6b","#a78bfa","#34d399","#fb923c","#60a5fa","#f472b6","#a3e635"];

// ===========================================================================
// ADD TRANSACTION FORM
// ===========================================================================
function AddTransactionForm({ onAdd, onCancel, existingSymbols }) {
  const [symbol, setSymbol] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [type, setType] = useState("BUY");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [brokerage, setBrokerage] = useState("0");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async e => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const r = await api("/api/portfolio/transactions", {
        method: "POST",
        body: JSON.stringify({ symbol: symbol.trim().toUpperCase(), company_name: companyName, type, quantity: Number(qty), price: Number(price), date, brokerage: Number(brokerage || 0), notes })
      });
      onAdd(r.data);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: "#131c27", border: "1px solid #1e2d3d", borderRadius: 12, padding: "24px", marginBottom: 24 }}>
      <h3 style={{ color: "#dbe4ef", fontSize: 14, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}><Plus size={16} color="#2ea86f"/> Add Transaction</h3>
      {error && <div style={{ background: "#1b1114", border: "1px solid #64262b", borderRadius: 8, padding: "10px 14px", color: "#ff9ea2", fontSize: 12, marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}><CircleAlert size={14}/>{error}</div>}
      <form onSubmit={submit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
          <div><label style={{ color: "#748498", fontSize: 10, display: "block", marginBottom: 5 }}>NSE SYMBOL *</label>
          <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="e.g. RELIANCE" required style={iStyle}/></div>
          <div><label style={{ color: "#748498", fontSize: 10, display: "block", marginBottom: 5 }}>COMPANY NAME</label>
          <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Optional" style={iStyle}/></div>
          <div><label style={{ color: "#748498", fontSize: 10, display: "block", marginBottom: 5 }}>TYPE *</label>
          <select value={type} onChange={e => setType(e.target.value)} style={iStyle}>
            <option value="BUY">BUY</option><option value="SELL">SELL</option>
          </select></div>
          <div><label style={{ color: "#748498", fontSize: 10, display: "block", marginBottom: 5 }}>QUANTITY *</label>
          <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 10" min="0.001" step="any" required style={iStyle}/></div>
          <div><label style={{ color: "#748498", fontSize: 10, display: "block", marginBottom: 5 }}>PRICE PER SHARE ₹ *</label>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 2800" min="0.01" step="any" required style={iStyle}/></div>
          <div><label style={{ color: "#748498", fontSize: 10, display: "block", marginBottom: 5 }}>DATE *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={iStyle}/></div>
          <div><label style={{ color: "#748498", fontSize: 10, display: "block", marginBottom: 5 }}>BROKERAGE ₹</label>
          <input type="number" value={brokerage} onChange={e => setBrokerage(e.target.value)} min="0" step="any" style={iStyle}/></div>
          <div><label style={{ color: "#748498", fontSize: 10, display: "block", marginBottom: 5 }}>NOTES</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" style={iStyle}/></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button type="submit" disabled={loading} style={{ background: "#2ea86f", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {loading ? <LoaderCircle size={14} className="spin"/> : <Plus size={14}/>} Add Transaction
          </button>
          <button type="button" onClick={onCancel} style={{ background: "transparent", color: "#748498", border: "1px solid #1e2d3d", borderRadius: 8, padding: "10px 20px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
const iStyle = { width: "100%", background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 8, padding: "9px 12px", color: "#dbe4ef", fontSize: 12, boxSizing: "border-box" };

// ===========================================================================
// PORTFOLIO PAGE
// ===========================================================================
function PortfolioPage({ user }) {
  const [summary, setSummary] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sortBy, setSortBy] = useState("value");
  const [activeTab, setActiveTab] = useState("holdings");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [sumR, holdR, txnR, perfR] = await Promise.all([
        api("/api/portfolio/summary"),
        api("/api/portfolio"),
        api("/api/portfolio/transactions?limit=50"),
        api("/api/portfolio/performance").catch(() => ({ data: [] }))
      ]);
      setSummary(sumR.data);
      const held = (holdR.data || []).filter(h => h.qty > 0.0001);
      setHoldings(held);
      setTransactions(txnR.data || []);
      setPerformance(perfR.data || []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (txn) => {
    setShowAddForm(false);
    await load();
  };

  const handleDelete = async (id) => {
    try {
      await api(`/api/portfolio/transactions/${id}`, { method: "DELETE" });
      setConfirmDelete(null);
      await load();
    } catch(e) { setError(e.message); }
  };

  const sortedHoldings = useMemo(() => {
    const h = [...holdings];
    if (sortBy === "value") return h.sort((a, b) => (b.market_value ?? b.total_cost) - (a.market_value ?? a.total_cost));
    if (sortBy === "pnl") return h.sort((a, b) => (b.unrealized_pnl ?? 0) - (a.unrealized_pnl ?? 0));
    if (sortBy === "name") return h.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return h;
  }, [holdings, sortBy]);

  const totalValue = summary?.current_value ?? 0;

  const donutData = sortedHoldings.map((h, i) => ({
    label: h.symbol,
    value: h.market_value ?? h.total_cost,
    color: CHART_COLORS[i % CHART_COLORS.length]
  }));

  const s = summary || {};
  const fmt = n => n == null || !Number.isFinite(Number(n)) ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const fmtPct = n => n == null || !Number.isFinite(Number(n)) ? "—" : `${Number(n) >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`;
  const pnlColor = n => Number(n) >= 0 ? "#2ea86f" : "#ff6b6b";

  if (loading) return <div style={{ padding: 40, display: "flex", alignItems: "center", gap: 10, color: "#748498" }}><LoaderCircle className="spin" size={20}/> Loading portfolio…</div>;

  return (
    <div>
      <section className="page-title">
        <div className="eyebrow"><span className="eyebrow-line"></span> PORTFOLIO TRACKER</div>
        <h1>My Portfolio</h1>
        <p>Track your NSE/BSE holdings. Values are estimates based on your recorded transactions and TejHQ EOD prices.</p>
      </section>

      {error && <div className="error-banner"><CircleAlert size={17}/><span>{error}</span><button onClick={() => setError("")}><X size={15}/></button></div>}

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "TOTAL INVESTED", value: fmt(s.total_invested), note: "Cost basis of current holdings", color: "#dbe4ef" },
          { label: "CURRENT VALUE", value: fmt(s.current_value), note: `TejHQ EOD · ${s.price_date || "—"}`, color: "#4c9fff" },
          { label: "UNREALIZED P&L", value: fmt(s.unrealized_pnl), note: fmtPct(s.unrealized_pnl && s.total_invested ? (s.unrealized_pnl / s.total_invested) * 100 : null), color: pnlColor(s.unrealized_pnl) },
          { label: "REALIZED P&L", value: fmt(s.realized_pnl), note: "From completed sales", color: pnlColor(s.realized_pnl) },
          { label: "TOTAL P&L", value: fmt(s.total_pnl), note: fmtPct(s.total_return_pct), color: pnlColor(s.total_pnl) },
          { label: "HOLDINGS", value: String(s.holdings_count ?? 0), note: "Distinct stocks held", color: "#a78bfa" },
          { label: "TOTAL BROKERAGE", value: fmt(s.total_brokerage), note: "All transaction charges", color: "#f7c948" },
        ].map(c => (
          <div key={c.label} style={{ background: "#131c27", border: "1px solid #1e2d3d", borderRadius: 10, padding: "16px" }}>
            <div style={{ color: "#748498", fontSize: 9, marginBottom: 6, letterSpacing: 1 }}>{c.label}</div>
            <div style={{ color: c.color, fontSize: 18, fontWeight: 700 }}>{c.value}</div>
            <div style={{ color: "#748498", fontSize: 10, marginTop: 4 }}>{c.note}</div>
          </div>
        ))}
      </div>

      {/* Add Transaction Button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["holdings","transactions","charts"].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ background: activeTab === t ? "#2ea86f20" : "transparent", border: `1px solid ${activeTab === t ? "#2ea86f" : "#1e2d3d"}`, color: activeTab === t ? "#2ea86f" : "#748498", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", textTransform: "capitalize" }}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAddForm(v => !v)} style={{ background: "#2ea86f", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14}/> Add Transaction
        </button>
      </div>

      {showAddForm && <AddTransactionForm onAdd={handleAdd} onCancel={() => setShowAddForm(false)}/>}

      {/* Holdings Tab */}
      {activeTab === "holdings" && (
        <div>
          {holdings.length === 0 ? (
            <div className="panel" style={{ padding: 40, textAlign: "center" }}>
              <WalletCards size={40} color="#2ea86f" style={{ opacity: 0.5, margin: "0 auto 16px" }}/>
              <h3 style={{ color: "#dbe4ef", marginBottom: 8 }}>Add your first holding</h3>
              <p style={{ color: "#748498", fontSize: 13, marginBottom: 20 }}>Record a BUY transaction to start tracking your portfolio.</p>
              <button onClick={() => setShowAddForm(true)} style={{ background: "#2ea86f", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>+ Add Transaction</button>
            </div>
          ) : (
            <div className="panel">
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px 0", gap: 8 }}>
                <span style={{ color: "#748498", fontSize: 11, alignSelf: "center" }}>Sort:</span>
                {[["value","Value"],["pnl","P&L"],["name","Name"]].map(([k,l]) => (
                  <button key={k} onClick={() => setSortBy(k)} style={{ background: sortBy === k ? "#2ea86f20" : "transparent", border: `1px solid ${sortBy === k ? "#2ea86f" : "#1e2d3d"}`, color: sortBy === k ? "#2ea86f" : "#748498", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>{l}</button>
                ))}
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>STOCK</th><th>QTY</th><th>AVG COST</th><th>COST BASIS</th>
                    <th>MARKET PRICE</th><th>MARKET VALUE</th><th>UNREALIZED P&L</th><th>ALLOCATION</th><th>PRICE DATE</th>
                  </tr></thead>
                  <tbody>
                    {sortedHoldings.map(h => (
                      <tr key={h.symbol}>
                        <td><div className="company-cell">
                          <div className="ticker-logo">{h.symbol.slice(0,2)}</div>
                          <div><b>{h.company_name || h.symbol}</b><small>{h.symbol} · {h.exchange}</small></div>
                        </div></td>
                        <td>{Number(h.qty).toLocaleString("en-IN", { maximumFractionDigits: 4 })}</td>
                        <td>{fmt(h.avg_cost)}</td>
                        <td>{fmt(h.total_cost)}</td>
                        <td>{h.market_price != null ? fmt(h.market_price) : <span style={{ color: "#f7c948", fontSize: 11 }}>Unavailable</span>}</td>
                        <td>{h.market_value != null ? fmt(h.market_value) : "—"}</td>
                        <td>
                          {h.unrealized_pnl != null ? (
                            <span style={{ color: pnlColor(h.unrealized_pnl) }}>
                              {fmt(h.unrealized_pnl)}<br/>
                              <small>{fmtPct(h.unrealized_pct)}</small>
                            </span>
                          ) : "—"}
                        </td>
                        <td>
                          {totalValue > 0 && h.market_value != null ? (
                            <div>
                              <div style={{ background: "#1e2d3d", borderRadius: 4, height: 4, marginBottom: 4 }}>
                                <div style={{ background: CHART_COLORS[sortedHoldings.indexOf(h) % CHART_COLORS.length], borderRadius: 4, height: "100%", width: `${Math.min(100, (h.market_value / totalValue) * 100)}%` }}/>
                              </div>
                              <small style={{ color: "#748498" }}>{((h.market_value / totalValue) * 100).toFixed(1)}%</small>
                            </div>
                          ) : "—"}
                        </td>
                        <td><small style={{ color: "#748498" }}>{h.market_price_date || "—"}<br/>{h.market_price_source}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="panel-foot"><span style={{ color: "#748498", fontSize: 11 }}>Values are estimates. TejHQ provides EOD prices, not live intraday prices. Prices labeled "Unavailable" are not available in TejHQ snapshot.</span></div>
            </div>
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === "transactions" && (
        <div className="panel">
          {transactions.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <FileText size={32} color="#748498" style={{ margin: "0 auto 12px" }}/>
              <p style={{ color: "#748498" }}>No transactions recorded yet.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>DATE</th><th>SYMBOL</th><th>TYPE</th><th>QTY</th><th>PRICE</th><th>VALUE</th><th>BROKERAGE</th><th>NOTES</th><th></th></tr></thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td><small style={{ color: "#748498" }}>{t.date}</small></td>
                      <td><div className="company-cell">
                        <div className="ticker-logo">{t.symbol.slice(0,2)}</div>
                        <div><b>{t.symbol}</b><small>{t.company_name || t.exchange}</small></div>
                      </div></td>
                      <td><span style={{ background: t.type === "BUY" ? "#2ea86f20" : "#ff6b6b20", color: t.type === "BUY" ? "#2ea86f" : "#ff6b6b", border: `1px solid ${t.type === "BUY" ? "#2ea86f40" : "#ff6b6b40"}`, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>{t.type}</span></td>
                      <td>{Number(t.quantity).toLocaleString("en-IN", { maximumFractionDigits: 4 })}</td>
                      <td>{fmt(t.price)}</td>
                      <td>{fmt(t.quantity * t.price)}</td>
                      <td>{t.brokerage > 0 ? fmt(t.brokerage) : "—"}</td>
                      <td><small style={{ color: "#748498" }}>{t.notes || "—"}</small></td>
                      <td>
                        {confirmDelete === t.id ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => handleDelete(t.id)} style={{ background: "#ff6b6b", color: "#fff", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>Confirm</button>
                            <button onClick={() => setConfirmDelete(null)} style={{ background: "transparent", color: "#748498", border: "1px solid #1e2d3d", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(t.id)} style={{ background: "transparent", border: "none", color: "#748498", cursor: "pointer", padding: 4 }} title="Delete transaction"><Trash2 size={14}/></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Charts Tab */}
      {activeTab === "charts" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {/* Allocation Donut */}
          <div style={{ background: "#131c27", border: "1px solid #1e2d3d", borderRadius: 12, padding: 20 }}>
            <h4 style={{ color: "#dbe4ef", fontSize: 13, marginBottom: 16 }}>Portfolio Allocation</h4>
            {holdings.length === 0 ? <div style={{ color: "#748498", fontSize: 12 }}>No holdings</div> : (
              <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                <DonutChart data={donutData} size={130}/>
                <div style={{ flex: 1, minWidth: 120 }}>
                  {sortedHoldings.slice(0, 8).map((h, i) => (
                    <div key={h.symbol} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }}/>
                      <span style={{ color: "#dbe4ef", fontSize: 11, flex: 1 }}>{h.symbol}</span>
                      <span style={{ color: "#748498", fontSize: 11 }}>{totalValue > 0 && h.market_value ? ((h.market_value / totalValue) * 100).toFixed(1) : "0"}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Invested vs Value Bar Chart */}
          <div style={{ background: "#131c27", border: "1px solid #1e2d3d", borderRadius: 12, padding: 20 }}>
            <h4 style={{ color: "#dbe4ef", fontSize: 13, marginBottom: 16 }}>Invested vs Current Value</h4>
            {sortedHoldings.length === 0 ? <div style={{ color: "#748498", fontSize: 12 }}>No holdings</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sortedHoldings.slice(0, 6).map((h, i) => {
                  const maxV = Math.max(...sortedHoldings.map(x => Math.max(x.total_cost, x.market_value ?? x.total_cost)));
                  const invested = (h.total_cost / maxV) * 100;
                  const current = ((h.market_value ?? h.total_cost) / maxV) * 100;
                  const positive = (h.market_value ?? h.total_cost) >= h.total_cost;
                  return (
                    <div key={h.symbol}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ color: "#dbe4ef", fontSize: 11 }}>{h.symbol}</span>
                        <span style={{ color: positive ? "#2ea86f" : "#ff6b6b", fontSize: 11 }}>{fmtPct(h.unrealized_pct)}</span>
                      </div>
                      <div style={{ position: "relative", height: 6, background: "#1e2d3d", borderRadius: 3 }}>
                        <div style={{ position: "absolute", left: 0, height: "100%", width: `${invested}%`, background: "#1e2d3d", borderRadius: 3, border: "1px solid #748498" }}/>
                        <div style={{ position: "absolute", left: 0, height: "100%", width: `${current}%`, background: positive ? "#2ea86f" : "#ff6b6b", borderRadius: 3, opacity: 0.8 }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Performance Chart */}
          <div style={{ background: "#131c27", border: "1px solid #1e2d3d", borderRadius: 12, padding: 20, gridColumn: "1 / -1" }}>
            <h4 style={{ color: "#dbe4ef", fontSize: 13, marginBottom: 4 }}>Historical Portfolio Value</h4>
            <p style={{ color: "#748498", fontSize: 11, marginBottom: 16 }}>Based on actual transaction dates and TejHQ EOD prices. Not calculated by applying today's holdings to old prices.</p>
            {performance.length < 2 ? (
              <div style={{ color: "#748498", fontSize: 12, padding: "20px 0" }}>Not enough historical data. Add transactions to see your portfolio timeline.</div>
            ) : (
              <div>
                <div style={{ height: 120 }}>
                  <MiniLineChart data={performance.map(p => ({ value: p.value }))} color="#2ea86f" height={120}/>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  <small style={{ color: "#748498" }}>{performance[0]?.date}</small>
                  <small style={{ color: "#748498" }}>{performance[performance.length - 1]?.date}</small>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// PROFILE PAGE
// ===========================================================================
function ProfilePage({ user, onLogout, onUpdateUser }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/portfolio/summary").then(r => setSummary(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    setSaving(true); setError("");
    try {
      const r = await api("/api/profile", { method: "PATCH", body: JSON.stringify({ name }) });
      onUpdateUser(r.data);
      localStorage.setItem("finn_user", JSON.stringify(r.data));
      setEditing(false);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const fmt = n => n == null || !Number.isFinite(Number(n)) ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const fmtPct = n => n == null || !Number.isFinite(Number(n)) ? "—" : `${Number(n) >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`;
  const s = summary || {};

  return (
    <div>
      <section className="page-title">
        <div className="eyebrow"><span className="eyebrow-line"></span> ACCOUNT</div>
        <h1>User Profile</h1>
      </section>
      {error && <div className="error-banner"><CircleAlert size={17}/><span>{error}</span><button onClick={() => setError("")}><X size={15}/></button></div>}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
        {/* Profile Card */}
        <div style={{ background: "#131c27", border: "1px solid #1e2d3d", borderRadius: 14, padding: 28 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, background: "#2ea86f20", border: "2px solid #2ea86f40", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 24, color: "#2ea86f", fontWeight: 700 }}>
              {(user?.name || "F").charAt(0).toUpperCase()}
            </div>
            {editing ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={name} onChange={e => setName(e.target.value)} style={{ flex: 1, background: "#0d1117", border: "1px solid #2ea86f", borderRadius: 8, padding: "8px 12px", color: "#dbe4ef", fontSize: 13, textAlign: "center" }}/>
                <button onClick={saveProfile} disabled={saving} style={{ background: "#2ea86f", color: "#fff", border: "none", borderRadius: 8, padding: "8px", cursor: "pointer" }}><Check size={14}/></button>
                <button onClick={() => { setEditing(false); setName(user?.name || ""); }} style={{ background: "transparent", color: "#748498", border: "1px solid #1e2d3d", borderRadius: 8, padding: "8px", cursor: "pointer" }}><X size={14}/></button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <h3 style={{ color: "#dbe4ef", fontSize: 16, margin: 0 }}>{user?.name}</h3>
                <button onClick={() => setEditing(true)} style={{ background: "transparent", border: "none", color: "#748498", cursor: "pointer", padding: 2 }}><Pencil size={13}/></button>
              </div>
            )}
            <p style={{ color: "#748498", fontSize: 12, margin: "6px 0 0" }}>{user?.email}</p>
          </div>
          <div style={{ borderTop: "1px solid #1e2d3d", paddingTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: "#748498", fontSize: 12 }}>Member since</span>
              <span style={{ color: "#dbe4ef", fontSize: 12 }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: "#748498", fontSize: 12 }}>Data provider</span>
              <span style={{ color: "#2ea86f", fontSize: 12 }}>TejHQ EOD</span>
            </div>
          </div>
          <button onClick={onLogout} style={{ width: "100%", background: "transparent", color: "#ff6b6b", border: "1px solid #ff6b6b40", borderRadius: 8, padding: "10px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20 }}>
            <LogOut size={14}/> Sign out
          </button>
        </div>

        {/* Portfolio Summary on Profile */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {loading ? <div style={{ color: "#748498", display: "flex", gap: 8 }}><LoaderCircle className="spin" size={16}/> Loading portfolio summary…</div> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                {[
                  { label: "TOTAL INVESTED", value: fmt(s.total_invested) },
                  { label: "PORTFOLIO VALUE", value: fmt(s.current_value) },
                  { label: "TOTAL P&L", value: fmt(s.total_pnl), color: Number(s.total_pnl) >= 0 ? "#2ea86f" : "#ff6b6b" },
                  { label: "TOTAL RETURN", value: fmtPct(s.total_return_pct), color: Number(s.total_return_pct) >= 0 ? "#2ea86f" : "#ff6b6b" },
                  { label: "HOLDINGS", value: String(s.holdings_count ?? 0) },
                  { label: "REALIZED P&L", value: fmt(s.realized_pnl) },
                ].map(c => (
                  <div key={c.label} style={{ background: "#131c27", border: "1px solid #1e2d3d", borderRadius: 10, padding: "14px" }}>
                    <div style={{ color: "#748498", fontSize: 9, marginBottom: 6, letterSpacing: 1 }}>{c.label}</div>
                    <div style={{ color: c.color || "#dbe4ef", fontSize: 18, fontWeight: 700 }}>{c.value}</div>
                  </div>
                ))}
              </div>
              {s.price_date && (
                <p style={{ color: "#748498", fontSize: 11 }}>Portfolio value as of TejHQ EOD {s.price_date}. Values are estimates based on recorded transactions. Not financial advice.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function EventRow({event:e,expanded=false}){return <article className={`event-row ${expanded?"expanded":""}`}><div className={`event-icon ${e.priority?.toLowerCase()||"low"}`}>{e.priority==="HIGH"?<CircleAlert size={17}/>:<FileText size={17}/>}</div><div className="event-body"><div className="event-meta"><span className={`priority ${String(e.priority||"low").toLowerCase()}`}>{e.priority||"LOW"} PRIORITY</span><span className="category">{String(e.category||"announcement").replaceAll("_"," ")}</span><span className="event-date">{dateFmt(e.date)}</span></div><h3>{e.subject}</h3><p>{e.companyName||e.symbol} · {e.symbol}{e.summary?` — ${String(e.summary).slice(0,expanded?500:170)}`:""}</p>{e.url&&<a href={e.url} target="_blank" rel="noreferrer" className="source-link">Open original source <ExternalLink size={13}/></a>}</div></article>}
function Empty({title,text}){return <div className="empty-state"><div className="empty-icon"><FileText size={19}/></div><b>{title}</b><p>{text}</p></div>}
function Loading({text}){return <div className="loading-state"><LoaderCircle className="spin" size={22}/><span>{text}</span></div>}
createRoot(document.getElementById("root")).render(<App/>);
