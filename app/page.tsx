"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type CancerType =
  | "all"
  | "lung"
  | "breast"
  | "prostate"
  | "colorectal"
  | "melanoma"
  | "leukemia"
  | "lymphoma";

type DatasetKey = "research" | "news" | "blog" | "fdaApprovals" | "clinicalTrials";
type ApiRecord = Record<string, unknown>;

interface DatasetResult {
  items: ApiRecord[];
  total: number;
  fetchedAt: string;
}

interface DashboardPayload {
  mode: "live" | "partial" | "demo" | "error";
  cancerType: CancerType;
  query: string;
  lastUpdated: string;
  notice?: string;
  rateLimit: { remaining: number | null; limit: number | null; reset: string | null };
  datasets: Record<DatasetKey, DatasetResult>;
  errors: Partial<Record<DatasetKey, string>>;
}

interface SelectedRecord {
  key: DatasetKey;
  item: ApiRecord;
}

const CANCERS: Array<{ value: CancerType; label: string; symbol: string }> = [
  { value: "all", label: "All cancers", symbol: "ALL" },
  { value: "lung", label: "Lung", symbol: "LU" },
  { value: "breast", label: "Breast", symbol: "BR" },
  { value: "prostate", label: "Prostate", symbol: "PR" },
  { value: "colorectal", label: "Colorectal", symbol: "CO" },
  { value: "melanoma", label: "Melanoma", symbol: "ME" },
  { value: "leukemia", label: "Leukemia", symbol: "LE" },
  { value: "lymphoma", label: "Lymphoma", symbol: "LY" },
];

const DATASETS: Array<{
  key: DatasetKey;
  label: string;
  short: string;
  color: string;
  endpoint: string;
  description: string;
}> = [
  {
    key: "research",
    label: "Research papers",
    short: "Research",
    color: "violet",
    endpoint: "GET /api/v1/research",
    description: "Peer-reviewed oncology papers from PubMed, including dates, journals, abstracts and source links.",
  },
  {
    key: "news",
    label: "Cancer news",
    short: "News",
    color: "coral",
    endpoint: "GET /api/v1/news",
    description: "Curated cancer news with publishers, summaries, tags and original article links.",
  },
  {
    key: "blog",
    label: "Editorials",
    short: "Blog",
    color: "amber",
    endpoint: "GET /api/v1/blog",
    description: "Cure Cancer With AI editorial posts, excerpts, categories and cancer-type tags.",
  },
  {
    key: "fdaApprovals",
    label: "FDA approvals",
    short: "FDA",
    color: "mint",
    endpoint: "GET /api/v1/fda-approvals",
    description: "Oncology approvals with drug names, companies, indications, dates and label links.",
  },
  {
    key: "clinicalTrials",
    label: "Clinical trials",
    short: "Trials",
    color: "blue",
    endpoint: "GET /api/v1/clinical-trials",
    description: "Registry records with status, NCT IDs, interventions, conditions and study dates.",
  },
];

function valueOf(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberFormat(value: number, compact = true) {
  return new Intl.NumberFormat("en-US", compact ? { notation: "compact", maximumFractionDigits: 1 } : {}).format(value);
}

function dateValue(value: unknown) {
  const raw = valueOf(value);
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function formatDate(value: unknown, includeYear = true) {
  const raw = dateValue(value);
  if (!raw) return "Date not listed";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
  }).format(new Date(raw));
}

function relativeDate(value: unknown) {
  const raw = dateValue(value);
  if (!raw) return "—";
  const days = Math.max(0, Math.round((Date.now() - new Date(raw).getTime()) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return formatDate(raw, false);
}

function recordDate(item: ApiRecord, key: DatasetKey) {
  if (key === "research") return valueOf(item.publicationDate);
  if (key === "fdaApprovals") return valueOf(item.approvalDate);
  return valueOf(item.publishedAt) || valueOf(item.startDate);
}

function displayTitle(item: ApiRecord, key: DatasetKey) {
  if (key === "fdaApprovals") return valueOf(item.drugName) || valueOf(item.genericName) || "Unnamed approval";
  return valueOf(item.title) || "Untitled record";
}

function sourceHref(item: ApiRecord, key: DatasetKey) {
  const direct = key === "research" ? valueOf(item.fullTextUrl) : valueOf(item.url);
  if (direct.startsWith("http")) return direct;
  const label = valueOf(item.labelPdfUrl);
  if (key === "fdaApprovals" && label.startsWith("http")) return label;
  if (key === "research" && valueOf(item.pubmedId)) return `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(valueOf(item.pubmedId))}/`;
  if (key === "clinicalTrials" && valueOf(item.nctId)) return `https://clinicaltrials.gov/study/${encodeURIComponent(valueOf(item.nctId))}`;
  if (key === "blog" && valueOf(item.slug)) return `https://www.curecancerwithai.com/blog/${encodeURIComponent(valueOf(item.slug))}`;
  return "https://www.curecancerwithai.com/";
}

function statusText(value: unknown) {
  return valueOf(value, "Unknown status").toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function itemsFor(payload: DashboardPayload | null, key: DatasetKey) {
  return payload?.datasets[key]?.items ?? [];
}

function totalFor(payload: DashboardPayload | null, key: DatasetKey) {
  return payload?.datasets[key]?.total ?? 0;
}

function sourceMeta(key: DatasetKey) {
  return DATASETS.find((dataset) => dataset.key === key) ?? DATASETS[0];
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "search") return <svg {...common}><circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 4.2 4.2" /></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>;
  if (name === "external") return <svg {...common}><path d="M14 5h5v5" /><path d="M19 5 11 13" /><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>;
  if (name === "refresh") return <svg {...common}><path d="M20 11a8 8 0 0 0-14.8-4L3 9" /><path d="M3 4v5h5" /><path d="M4 13a8 8 0 0 0 14.8 4L21 15" /><path d="M21 20v-5h-5" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === "flask") return <svg {...common}><path d="M9 3h6" /><path d="M10 3v5l-5.4 9.3A2 2 0 0 0 6.3 20h11.4a2 2 0 0 0 1.7-2.7L14 8V3" /><path d="M8 15h8" /></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 20 6v5c0 5-3.2 8.2-8 10-4.8-1.8-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg>;
  if (name === "dna") return <svg {...common}><path d="M7 3c5 3 5 6 0 9s-5 6 0 9" /><path d="M17 3c-5 3-5 6 0 9s5 6 0 9" /><path d="M7 6h10M6 12h12M7 18h10" /></svg>;
  if (name === "pin") return <svg {...common}><path d="M12 21s7-5.2 7-11A7 7 0 0 0 5 10c0 5.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.2" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg>;
}

function BrandMark() {
  return <span className="new-brand-mark" aria-hidden="true"><span /><i /><b /></span>;
}

function emptyDataset(): DatasetResult {
  return { items: [], total: 0, fetchedAt: "" };
}

function pulsePoints(payload: DashboardPayload | null, focusKey: DatasetKey | "all") {
  const today = new Date();
  const buckets = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    return { date: day, count: 0 };
  });
  const keys = focusKey === "all" ? DATASETS.map((dataset) => dataset.key) : [focusKey];
  keys.forEach((key) => {
    itemsFor(payload, key).forEach((item) => {
      const raw = recordDate(item, key);
      if (!raw) return;
      const date = new Date(raw);
      const bucket = buckets.findIndex((entry) => date >= entry.date && date < new Date(entry.date.getTime() + 86_400_000));
      if (bucket >= 0) buckets[bucket].count += 1;
    });
  });
  return buckets;
}

function PulseChart({ payload, focusKey, onFocus }: { payload: DashboardPayload | null; focusKey: DatasetKey | "all"; onFocus: (key: DatasetKey | "all") => void }) {
  const points = pulsePoints(payload, focusKey);
  const max = Math.max(...points.map((point) => point.count), 1);
  const coords = points.map((point, index) => ({
    x: 14 + (index * 172) / 6,
    y: 122 - (point.count / max) * 94,
    ...point,
  }));
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `14,126 ${line} 186,126`;
  return (
    <div className="pulse-chart-wrap">
      <div className="chart-switcher" role="tablist" aria-label="Chart source">
        <button aria-selected={focusKey === "all"} className={focusKey === "all" ? "active" : ""} onClick={() => onFocus("all")} role="tab" type="button">All signal lanes</button>
        {DATASETS.slice(0, 3).map((dataset) => <button aria-selected={focusKey === dataset.key} className={focusKey === dataset.key ? `active ${dataset.color}` : ""} onClick={() => onFocus(dataset.key)} key={dataset.key} role="tab" type="button">{dataset.short}</button>)}
      </div>
      <svg className="pulse-chart" viewBox="0 0 200 140" role="img" aria-label="Seven day visible sample activity chart">
        <defs><linearGradient id="pulse-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8b7cff" stopOpacity=".36" /><stop offset="1" stopColor="#8b7cff" stopOpacity="0" /></linearGradient></defs>
        {[31, 62, 93, 124].map((y) => <line key={y} x1="14" x2="186" y1={y} y2={y} className="chart-gridline" />)}
        <polygon points={area} fill="url(#pulse-fill)" />
        <polyline points={line} fill="none" className="pulse-line" />
        {coords.map((point) => <g key={point.date.toISOString()}><circle cx={point.x} cy={point.y} r="3.4" className="pulse-point"><title>{point.count} visible records on {formatDate(point.date)}</title></circle></g>)}
        {coords.map((point) => <text key={`label-${point.date.toISOString()}`} x={point.x} y="138" textAnchor="middle" className="chart-date">{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(point.date).slice(0, 2)}</text>)}
      </svg>
      <div className="chart-values" aria-label="Visible activity counts by day">
        {points.map((point) => <span key={`value-${point.date.toISOString()}`}><strong>{point.count}</strong><small>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(point.date)}</small></span>)}
      </div>
      <div className="chart-foot"><span><i className="legend-spark" /> visible sample activity</span><span>7 days · hover points</span></div>
    </div>
  );
}

function NetworkDiagram({ payload, onSelect }: { payload: DashboardPayload | null; onSelect: (key: DatasetKey) => void }) {
  const nodes = [
    { key: "research" as const, x: 105, y: 46, label: "Research", value: totalFor(payload, "research") },
    { key: "news" as const, x: 236, y: 22, label: "News", value: totalFor(payload, "news") },
    { key: "blog" as const, x: 286, y: 112, label: "Blog", value: totalFor(payload, "blog") },
    { key: "fdaApprovals" as const, x: 106, y: 142, label: "FDA", value: totalFor(payload, "fdaApprovals") },
    { key: "clinicalTrials" as const, x: 34, y: 85, label: "Trials", value: totalFor(payload, "clinicalTrials") },
  ];
  return (
    <div className="network-diagram">
      <svg viewBox="0 0 330 180" role="img" aria-label="Connected oncology source diagram">
        <defs><radialGradient id="core-glow"><stop stopColor="#67e7c0" stopOpacity=".45" /><stop offset="1" stopColor="#67e7c0" stopOpacity="0" /></radialGradient></defs>
        <circle cx="164" cy="91" r="58" fill="url(#core-glow)" className="network-glow" />
        <g className="network-links">{nodes.map((node) => <line key={node.key} x1="164" y1="91" x2={node.x} y2={node.y} />)}</g>
        <circle cx="164" cy="91" r="28" className="network-core" />
        <text x="164" y="88" textAnchor="middle" className="network-core-text">CCWAI</text><text x="164" y="102" textAnchor="middle" className="network-core-sub">LIVE GRAPH</text>
        {nodes.map((node) => <g key={node.key} className="network-node" onClick={() => onSelect(node.key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(node.key); } }} tabIndex={0} role="button" aria-label={`Open ${node.label} details`}><circle cx={node.x} cy={node.y} r="17" className={`network-node-${sourceMeta(node.key).color}`} /><text x={node.x} y={node.y + 3} textAnchor="middle" className="network-node-label">{node.label.slice(0, 2).toUpperCase()}</text><text x={node.x} y={node.y + 31} textAnchor="middle" className="network-node-count">{numberFormat(node.value)}</text></g>)}
      </svg>
      <p>Every node is clickable. Explore the source lane behind each count.</p>
    </div>
  );
}

function MetricTile({ keyName, payload, onSelect }: { keyName: DatasetKey; payload: DashboardPayload | null; onSelect: (key: DatasetKey) => void }) {
  const meta = sourceMeta(keyName);
  return (
    <button className={`new-metric-tile ${meta.color}`} onClick={() => onSelect(keyName)} type="button">
      <span className="metric-tile-head"><span className="metric-pip" />{meta.short}<Icon name="arrow" size={15} /></span>
      <strong>{numberFormat(totalFor(payload, keyName))}</strong>
      <span className="metric-tile-foot">{meta.label}<span>inspect lane</span></span>
    </button>
  );
}

function SignalCard({ item, keyName, onOpen }: { item: ApiRecord; keyName: DatasetKey; onOpen: (record: SelectedRecord) => void }) {
  const meta = sourceMeta(keyName);
  const title = displayTitle(item, keyName);
  return (
    <button className="signal-card" onClick={() => onOpen({ key: keyName, item })} type="button">
      <span className={`signal-card-label ${meta.color}`}>{meta.short}</span>
      <span className="signal-card-date">{relativeDate(recordDate(item, keyName))}</span>
      <strong>{title}</strong>
      <span className="signal-card-source">{valueOf(item.source) || valueOf(item.journal) || valueOf(item.company) || valueOf(item.primaryCategory) || "Source details available"}</span>
      <span className="signal-card-arrow"><Icon name="arrow" size={16} /></span>
    </button>
  );
}

function DetailDrawer({ selected, onClose }: { selected: SelectedRecord | null; onClose: () => void }) {
  if (!selected) return null;
  const meta = sourceMeta(selected.key);
  const item = selected.item;
  const href = sourceHref(item, selected.key);
  const tags = Array.isArray(item.cancerTypes) ? item.cancerTypes : Array.isArray(item.conditions) ? item.conditions : Array.isArray(item.tags) ? item.tags : [];
  const summary = valueOf(item.summaryPlain) || valueOf(item.summary) || valueOf(item.excerpt) || valueOf(item.description) || valueOf(item.indication) || meta.description;
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-label={`${meta.label} details`}>
        <div className="drawer-top"><span className={`drawer-kicker ${meta.color}`}>{meta.short} / record detail</span><button className="drawer-close" onClick={onClose} type="button" aria-label="Close details"><Icon name="close" size={19} /></button></div>
        <div className="drawer-icon"><Icon name={selected.key === "clinicalTrials" ? "pin" : selected.key === "research" ? "flask" : "dna"} size={23} /></div>
        <h2>{displayTitle(item, selected.key)}</h2>
        <p className="drawer-summary">{summary}</p>
        <div className="drawer-facts">
          <div><span>Date</span><strong>{formatDate(recordDate(item, selected.key))}</strong></div>
          <div><span>Identifier</span><strong>{valueOf(item.pubmedId) || valueOf(item.nctId) || valueOf(item.applicationNumber) || valueOf(item.slug) || "Source ID not listed"}</strong></div>
          <div><span>Source lane</span><strong>{meta.label}</strong></div>
          <div><span>Status</span><strong>{selected.key === "clinicalTrials" ? statusText(item.status) : valueOf(item.company) || valueOf(item.journal) || valueOf(item.source) || "Published record"}</strong></div>
        </div>
        {tags.length ? <div className="drawer-tags">{tags.slice(0, 5).map((tag) => <span key={String(tag)}>{String(tag)}</span>)}</div> : null}
        <div className="drawer-actions"><a href={href} target="_blank" rel="noreferrer">Open source <Icon name="external" size={15} /></a><button type="button" onClick={onClose}>Back to board</button></div>
        <p className="drawer-disclaimer">Informational source record. The observatory does not provide medical advice.</p>
      </aside>
    </div>
  );
}

export default function Home() {
  const [cancerType, setCancerType] = useState<CancerType>("all");
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selected, setSelected] = useState<SelectedRecord | null>(null);
  const [focusKey, setFocusKey] = useState<DatasetKey | "all">("all");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ cancerType });
    if (query) params.set("query", query);
    try {
      const response = await fetch(`/api/dashboard?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Dashboard request failed (${response.status}).`);
      setPayload((await response.json()) as DashboardPayload);
      setLastRefresh(new Date());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Dashboard request failed.");
    } finally {
      setLoading(false);
    }
  }, [cancerType, query]);

  useEffect(() => {
    void loadDashboard();
    const interval = window.setInterval(() => void loadDashboard(), 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [selected]);

  const totals = useMemo(() => DATASETS.reduce((sum, dataset) => sum + totalFor(payload, dataset.key), 0), [payload]);
  const selectedCancer = CANCERS.find((item) => item.value === cancerType) ?? CANCERS[0];
  const recentSignals = useMemo(() => {
    const records = DATASETS.flatMap((dataset) => itemsFor(payload, dataset.key).slice(0, 5).map((item) => ({ key: dataset.key, item })));
    return records.sort((a, b) => dateValue(recordDate(b.item, b.key)).localeCompare(dateValue(recordDate(a.item, a.key)))).slice(0, 6);
  }, [payload]);
  const trials = itemsFor(payload, "clinicalTrials").slice(0, 4);
  const trialError = payload?.errors.clinicalTrials;
  const approvals = itemsFor(payload, "fdaApprovals").slice(0, 5);
  const remaining = payload?.rateLimit.remaining;
  const rateLimit = payload?.rateLimit.limit ?? 100;
  const health = payload?.mode === "live" ? "All source lanes online" : payload?.mode === "partial" ? "Partial source coverage" : payload?.mode === "demo" ? "Preview mode" : "Waiting for source";

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draftQuery.trim().slice(0, 120));
  }

  return (
    <main className="dark-board">
      <header className="new-topbar">
        <a href="#top" className="new-brand"><BrandMark /><span><strong>CURE CANCER <em>with AI</em></strong><small>oncology intelligence / live board</small></span></a>
        <nav className="new-nav" aria-label="Primary navigation"><a className="active" href="#overview">Board</a><a href="#pulse">Pulse</a><a href="#signals">Signals</a><a href="#trial-watch">Trial watch</a></nav>
        <div className="top-actions"><span className="live-chip"><i />{health}</span><button className="icon-button" type="button" onClick={() => void loadDashboard()} aria-label="Refresh dashboard"><Icon name="refresh" size={17} /></button></div>
      </header>

      <section className="new-hero" id="top">
        <div className="hero-grid-glow" />
        <div className="new-hero-copy"><span className="new-kicker"><i /> Cancer intelligence, without the noise</span><h1>The signal is<br /><span>already moving.</span></h1><p>One live view of the oncology field — research, regulatory milestones, news and the trials opening next.</p><div className="hero-stat-row"><span><strong>{numberFormat(totals)}</strong><small>records indexed</small></span><span><strong>{DATASETS.length}</strong><small>source lanes</small></span><span><strong>05 min</strong><small>browser refresh</small></span></div></div>
        <div className="hero-visual"><div className="hero-visual-label"><span>FIELD MAP</span><b>{selectedCancer.label.toUpperCase()}</b></div><NetworkDiagram payload={payload} onSelect={(key) => setSelected({ key, item: itemsFor(payload, key)[0] ?? {} })} /><div className="scan-line" /></div>
      </section>

      <section className="new-filter-bar" aria-label="Dashboard filters"><div className="filter-title"><span>TRACKING</span><strong>{selectedCancer.label}</strong></div><div className="cancer-pills" role="tablist" aria-label="Cancer type">{CANCERS.map((cancer) => <button key={cancer.value} type="button" role="tab" aria-selected={cancer.value === cancerType} className={cancer.value === cancerType ? "selected" : ""} onClick={() => setCancerType(cancer.value)}><b>{cancer.symbol}</b>{cancer.label}</button>)}</div><form className="new-search" onSubmit={submitSearch}><Icon name="search" size={16} /><input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Search the live board" aria-label="Search the live board" /><button type="submit">Find</button></form></section>

      {payload?.notice ? <div className="new-notice"><span className="notice-mark">◌</span><span>{payload.notice}</span><a href="https://www.curecancerwithai.com/api-keys" target="_blank" rel="noreferrer">Enable live source <Icon name="external" size={14} /></a></div> : null}
      {error ? <div className="new-error" role="alert"><strong>Source request failed.</strong> {error}<button onClick={() => void loadDashboard()} type="button">Try again</button></div> : null}

      <section className="board-section" id="overview"><div className="section-topline"><div><span className="new-kicker"><i /> At a glance</span><h2>Read the room.</h2></div><div className="section-top-actions"><span className={`source-status ${payload?.mode ?? "loading"}`}><i />{health}</span><span className="last-updated">{lastRefresh ? `checked ${lastRefresh.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : loading ? "connecting…" : "not checked"}</span></div></div><div className="new-metric-grid">{DATASETS.map((dataset) => <MetricTile key={dataset.key} keyName={dataset.key} payload={payload} onSelect={(key) => setSelected({ key, item: itemsFor(payload, key)[0] ?? {} })} />)}</div></section>

      <section className="chart-grid" id="pulse"><article className="chart-panel pulse-panel"><div className="panel-title-row"><div><span className="panel-kicker">01 / activity pulse</span><h3>What entered the field</h3></div><span className="chart-note">sample-derived / 7 days</span></div><PulseChart payload={payload} focusKey={focusKey} onFocus={setFocusKey} /><p className="chart-disclaimer">The pulse plots dates from the visible source sample. Click a lane above to isolate it; totals below remain the source API&apos;s authoritative count.</p></article><article className="chart-panel coverage-panel"><div className="panel-title-row"><div><span className="panel-kicker">02 / coverage map</span><h3>Five lanes. One view.</h3></div><span className="chart-note">click nodes</span></div><div className="coverage-rings"><span className="ring ring-a" /><span className="ring ring-b" /><span className="ring ring-c" /><span className="coverage-core"><Icon name="dna" size={24} /><b>{numberFormat(totals)}</b><small>records</small></span></div><div className="coverage-legend">{DATASETS.map((dataset) => <button type="button" key={dataset.key} onClick={() => setSelected({ key: dataset.key, item: itemsFor(payload, dataset.key)[0] ?? {} })}><i className={`legend-dot ${dataset.color}`} />{dataset.short}<strong>{numberFormat(totalFor(payload, dataset.key))}</strong></button>)}</div></article></section>

      <section className="board-section" id="signals"><div className="section-topline"><div><span className="new-kicker"><i /> Fresh signals</span><h2>New to the board.</h2></div><span className="result-note">{query ? `Results for “${query}”` : `${selectedCancer.label} / latest six`}</span></div><div className="signal-card-grid">{recentSignals.map(({ key, item }) => <SignalCard key={`${key}-${valueOf(item.id, displayTitle(item, key))}`} item={item} keyName={key} onOpen={setSelected} />)}{!recentSignals.length ? <div className="empty-board">No records in this view yet. Try another cancer type or search term.</div> : null}</div></section>

      <section className="lower-grid" id="trial-watch"><article className="table-panel"><div className="panel-title-row"><div><span className="panel-kicker">03 / registry watch</span><h3>Trials in motion</h3></div><button className="text-button" type="button" onClick={() => setSelected({ key: "clinicalTrials", item: trials[0] ?? {} })}>Open lane <Icon name="arrow" size={14} /></button></div>{trialError ? <div className="table-inline-error" role="alert">Clinical trials source unavailable: {trialError}</div> : null}<div className="trial-table"><div className="trial-table-head"><span>Study</span><span>Status</span><span>Timeline</span><span /></div>{trials.map((trial) => <button className="trial-table-row" type="button" key={valueOf(trial.nctId, valueOf(trial.id, displayTitle(trial, "clinicalTrials")))} onClick={() => setSelected({ key: "clinicalTrials", item: trial })}><span><b>{valueOf(trial.nctId, "NCT pending")}</b><strong>{displayTitle(trial, "clinicalTrials")}</strong></span><span className="table-status"><i className={valueOf(trial.status).toUpperCase() === "RECRUITING" ? "recruiting" : "active"} />{statusText(trial.status)}</span><span className="table-timeline">{formatDate(trial.startDate, false)} <em>→</em> {formatDate(trial.completionDate, false)}</span><Icon name="arrow" size={15} /></button>)}{!trials.length ? <div className="empty-board">{trialError ? "Retry the dashboard request to load trial records." : "No trial records returned for this view."}</div> : null}</div><div className="table-foot"><span><i className="recruiting" /> Recruiting</span><span><i className="active" /> Active / other</span><span>Click a row for details</span></div></article><article className="table-panel approvals-panel"><div className="panel-title-row"><div><span className="panel-kicker">04 / regulatory shelf</span><h3>Recent approvals</h3></div><button className="text-button" type="button" onClick={() => setSelected({ key: "fdaApprovals", item: approvals[0] ?? {} })}>Open lane <Icon name="arrow" size={14} /></button></div><div className="approval-list">{approvals.map((approval) => <button className="approval-row" type="button" key={valueOf(approval.id, valueOf(approval.applicationNumber, displayTitle(approval, "fdaApprovals")))} onClick={() => setSelected({ key: "fdaApprovals", item: approval })}><span className="approval-orb"><Icon name="shield" size={15} /></span><span><strong>{displayTitle(approval, "fdaApprovals")}</strong><small>{valueOf(approval.company, "Company not listed")}</small></span><time>{formatDate(approval.approvalDate, false)}</time><Icon name="arrow" size={15} /></button>)}{!approvals.length ? <div className="empty-board">No approval records returned for this view.</div> : null}</div></article></section>

      <section className="footer-band"><div className="footer-band-copy"><span className="new-kicker"><i /> Source health</span><h2>The board keeps listening.</h2><p>Live reads come through a protected server route. The API key never enters the browser. Source links stay attached to every record.</p></div><div className="quota-card"><div><span>API budget</span><strong>{remaining === null || remaining === undefined ? "—" : `${remaining}/${rateLimit}`}</strong></div><div className="quota-bar"><span style={{ width: `${remaining === null || remaining === undefined ? 30 : Math.max(4, Math.min(100, (remaining / Math.max(rateLimit, 1)) * 100))}%` }} /></div><small>{payload?.rateLimit.reset ? `resets ${formatDate(payload.rateLimit.reset, false)}` : "rate headers appear in live mode"}</small></div><a className="source-link-card" href="https://www.curecancerwithai.com/" target="_blank" rel="noreferrer"><span>Powered by</span><strong>curecancerwithai.com</strong><small>Open source site <Icon name="external" size={14} /></small></a></section>

      <footer className="new-footer"><span><BrandMark /> Cure Cancer with AI / observatory</span><span>Educational information only · not medical advice</span><span>REST API · 5 min refresh · <a href="https://www.curecancerwithai.com/developers" target="_blank" rel="noreferrer">API docs <Icon name="external" size={12} /></a></span></footer>
      <DetailDrawer selected={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
