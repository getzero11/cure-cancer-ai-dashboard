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

type DatasetKey =
  | "research"
  | "news"
  | "blog"
  | "fdaApprovals"
  | "clinicalTrials";

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
  rateLimit: {
    remaining: number | null;
    limit: number | null;
    reset: string | null;
  };
  datasets: Record<DatasetKey, DatasetResult>;
  errors: Partial<Record<DatasetKey, string>>;
}

const CANCER_OPTIONS: Array<{ value: CancerType; label: string; short: string }> = [
  { value: "all", label: "All cancers", short: "All" },
  { value: "lung", label: "Lung cancer", short: "Lung" },
  { value: "breast", label: "Breast cancer", short: "Breast" },
  { value: "prostate", label: "Prostate cancer", short: "Prostate" },
  { value: "colorectal", label: "Colorectal cancer", short: "Colorectal" },
  { value: "melanoma", label: "Melanoma", short: "Melanoma" },
  { value: "leukemia", label: "Leukemia", short: "Leukemia" },
  { value: "lymphoma", label: "Lymphoma", short: "Lymphoma" },
];

const DATASET_LABELS: Record<DatasetKey, string> = {
  research: "Research",
  news: "News",
  blog: "Blog",
  fdaApprovals: "FDA approvals",
  clinicalTrials: "Clinical trials",
};

const DATASET_ACCENTS: Record<DatasetKey, string> = {
  research: "violet",
  news: "coral",
  blog: "gold",
  fdaApprovals: "mint",
  clinicalTrials: "blue",
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

function formatFullNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: unknown) {
  const raw = asString(value);
  if (!raw) return "Date not listed";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function relativeDate(value: unknown) {
  const raw = asString(value);
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (diff <= 0) return "today";
  if (diff === 1) return "1 day ago";
  if (diff < 30) return `${diff} days ago`;
  return formatDate(value);
}

function safeHref(value: unknown) {
  const raw = asString(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function recordDate(item: ApiRecord, key: DatasetKey) {
  if (key === "research") return asString(item.publicationDate);
  if (key === "fdaApprovals") return asString(item.approvalDate);
  return asString(item.publishedAt) || asString(item.startDate);
}

function datasetOrEmpty(payload: DashboardPayload | null, key: DatasetKey): DatasetResult {
  return (
    payload?.datasets[key] ?? {
      items: [],
      total: 0,
      fetchedAt: "",
    }
  );
}

function getDisplayTitle(item: ApiRecord, key: DatasetKey) {
  if (key === "fdaApprovals") {
    return asString(item.drugName) || asString(item.genericName) || "Unnamed approval";
  }
  return asString(item.title) || "Untitled record";
}

function getSourceHref(item: ApiRecord, key: DatasetKey) {
  const direct = key === "research" ? item.fullTextUrl : item.url;
  const directHref = safeHref(direct);
  if (directHref) return directHref;
  const labelHref = safeHref(item.labelPdfUrl);
  if (key === "fdaApprovals" && labelHref) return labelHref;
  if (key === "research" && asString(item.pubmedId)) {
    return `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(asString(item.pubmedId))}/`;
  }
  if (key === "clinicalTrials" && asString(item.nctId)) {
    return `https://clinicaltrials.gov/study/${encodeURIComponent(asString(item.nctId))}`;
  }
  if (key === "blog" && asString(item.slug)) {
    return `https://www.curecancerwithai.com/blog/${encodeURIComponent(asString(item.slug))}`;
  }
  return "https://www.curecancerwithai.com/";
}

function prettyStatus(value: unknown) {
  return asString(value, "STATUS NOT LISTED")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

  if (name === "arrow") {
    return (
      <svg {...common}>
        <path d="M5 12h13" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    );
  }
  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="10.8" cy="10.8" r="6.5" />
        <path d="m16 16 4.2 4.2" />
      </svg>
    );
  }
  if (name === "refresh") {
    return (
      <svg {...common}>
        <path d="M20 11a8 8 0 0 0-14.8-4L3 9" />
        <path d="M3 4v5h5" />
        <path d="M4 13a8 8 0 0 0 14.8 4L21 15" />
        <path d="M21 20v-5h-5" />
      </svg>
    );
  }
  if (name === "external") {
    return (
      <svg {...common}>
        <path d="M14 5h5v5" />
        <path d="M19 5 11 13" />
        <path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
      </svg>
    );
  }
  if (name === "database") {
    return (
      <svg {...common}>
        <ellipse cx="12" cy="5" rx="7" ry="3" />
        <path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
        <path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" />
      </svg>
    );
  }
  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 3 20 6v5c0 5-3.2 8.2-8 10-4.8-1.8-8-5-8-10V6l8-3Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </svg>
    );
  }
  if (name === "clock") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3.2 2" />
      </svg>
    );
  }
  if (name === "flask") {
    return (
      <svg {...common}>
        <path d="M9 3h6" />
        <path d="M10 3v5l-5.4 9.3A2 2 0 0 0 6.3 20h11.4a2 2 0 0 0 1.7-2.7L14 8V3" />
        <path d="M8 15h8" />
      </svg>
    );
  }
  if (name === "menu") {
    return (
      <svg {...common}>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2" />
    </svg>
  );
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span className="brand-mark-ring" />
      <span className="brand-mark-cross brand-mark-cross-horizontal" />
      <span className="brand-mark-cross brand-mark-cross-vertical" />
      <span className="brand-mark-core" />
    </span>
  );
}

function StatusPill({ mode }: { mode: DashboardPayload["mode"] }) {
  const labels = {
    live: "Live source",
    partial: "Partial source",
    demo: "Preview mode",
    error: "Source issue",
  };
  return (
    <span className={`status-pill status-${mode}`}>
      <span className="status-dot" />
      {labels[mode]}
    </span>
  );
}

export default function Home() {
  const [cancerType, setCancerType] = useState<CancerType>("all");
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientError, setClientError] = useState("");
  const [lastClientRefresh, setLastClientRefresh] = useState<Date | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setClientError("");
    const params = new URLSearchParams({ cancerType });
    if (query) params.set("query", query);

    try {
      const response = await fetch(`/api/dashboard?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Dashboard request failed (${response.status}).`);
      const nextPayload = (await response.json()) as DashboardPayload;
      setPayload(nextPayload);
      setLastClientRefresh(new Date());
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Dashboard request failed.");
    } finally {
      setLoading(false);
    }
  }, [cancerType, query]);

  useEffect(() => {
    void loadDashboard();
    const interval = window.setInterval(() => void loadDashboard(), 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  const selectedLabel =
    CANCER_OPTIONS.find((option) => option.value === cancerType)?.label ?? "All cancers";
  const research = datasetOrEmpty(payload, "research");
  const news = datasetOrEmpty(payload, "news");
  const blog = datasetOrEmpty(payload, "blog");
  const fdaApprovals = datasetOrEmpty(payload, "fdaApprovals");
  const clinicalTrials = datasetOrEmpty(payload, "clinicalTrials");

  const latestSignals = useMemo(() => {
    const sources: Array<{ key: DatasetKey; item: ApiRecord }> = [
      ...news.items.slice(0, 5).map((item) => ({ key: "news" as const, item })),
      ...research.items.slice(0, 5).map((item) => ({ key: "research" as const, item })),
      ...blog.items.slice(0, 3).map((item) => ({ key: "blog" as const, item })),
    ];
    return sources
      .sort((a, b) => recordDate(b.item, b.key).localeCompare(recordDate(a.item, a.key)))
      .slice(0, 6);
  }, [blog.items, news.items, research.items]);

  const activityRows = useMemo(() => {
    const values = (Object.keys(DATASET_LABELS) as DatasetKey[]).map((key) => ({
      key,
      label: DATASET_LABELS[key],
      total: datasetOrEmpty(payload, key).total,
    }));
    const max = Math.max(...values.map((item) => item.total), 1);
    return values.map((item) => ({ ...item, width: Math.max((item.total / max) * 100, 4) }));
  }, [payload]);

  const currentStatus = payload?.mode ?? (loading ? "demo" : "error");
  const totalSources = research.total + news.total + blog.total + fdaApprovals.total + clinicalTrials.total;
  const rateRemaining = payload?.rateLimit.remaining;
  const rateLimit = payload?.rateLimit.limit ?? 100;
  const ratePercent = rateRemaining === null || rateRemaining === undefined
    ? 0
    : Math.max(0, Math.min(100, (rateRemaining / Math.max(rateLimit, 1)) * 100));

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draftQuery.trim().slice(0, 120));
  }

  function handleCancerChange(next: CancerType) {
    setCancerType(next);
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Cure Cancer With AI observatory home">
          <BrandMark />
          <span className="brand-copy">
            <strong>Cure Cancer</strong>
            <span>with AI / observatory</span>
          </span>
        </a>
        <nav className="topnav" aria-label="Primary navigation">
          <a className="topnav-link active" href="#overview">Overview</a>
          <a className="topnav-link" href="#signals">Signals</a>
          <a className="topnav-link" href="#trials">Trial watch</a>
          <a className="topnav-link" href="#sources">Sources</a>
        </nav>
        <div className="topbar-meta">
          <span className="secure-label"><Icon name="shield" size={15} /> server-side key</span>
          <span className="menu-button" aria-hidden="true"><Icon name="menu" size={18} /></span>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> Oncology signal board · {new Date().getFullYear()}</p>
          <h1>See the field<br /><em>move.</em></h1>
          <p className="hero-lede">
            A calm, continuously refreshed view of research, approvals, newsroom signals and trials — organized around the cancer type you are following.
          </p>
          <div className="hero-actions">
            <a className="text-action" href="#signals">Explore the signal board <Icon name="arrow" size={16} /></a>
            <span className="hero-note"><span className="tiny-pulse" /> updates every 5 min in browser</span>
          </div>
        </div>
        <div className="hero-orbit" aria-label="Dashboard status visualization">
          <div className="orbit-glow" />
          <div className="orbit-ring orbit-ring-one" />
          <div className="orbit-ring orbit-ring-two" />
          <div className="orbit-ring orbit-ring-three" />
          <div className="orbit-center">
            <span className="orbit-center-label">tracking</span>
            <strong>{formatNumber(totalSources)}</strong>
            <span className="orbit-center-foot">records in view</span>
          </div>
          <span className="orbit-tag orbit-tag-a">research</span>
          <span className="orbit-tag orbit-tag-b">trials</span>
          <span className="orbit-tag orbit-tag-c">approvals</span>
          <span className="orbit-tick orbit-tick-a" />
          <span className="orbit-tick orbit-tick-b" />
          <span className="orbit-tick orbit-tick-c" />
        </div>
      </section>

      <section className="control-deck" aria-label="Dashboard controls">
        <div className="control-heading">
          <span className="control-kicker">Focus</span>
          <strong>{selectedLabel}</strong>
        </div>
        <div className="cancer-tabs" role="tablist" aria-label="Cancer type">
          {CANCER_OPTIONS.map((option) => (
            <button
              className={`cancer-tab ${cancerType === option.value ? "selected" : ""}`}
              key={option.value}
              onClick={() => handleCancerChange(option.value)}
              role="tab"
              aria-selected={cancerType === option.value}
              type="button"
            >
              {option.short}
            </button>
          ))}
        </div>
        <form className="search-box" onSubmit={handleSearch}>
          <Icon name="search" size={17} />
          <input
            aria-label="Search oncology records"
            placeholder="Search across this view"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
          />
          {draftQuery ? (
            <button className="clear-search" type="button" onClick={() => { setDraftQuery(""); setQuery(""); }} aria-label="Clear search">×</button>
          ) : null}
          <button className="search-submit" type="submit">Search</button>
        </form>
      </section>

      {payload?.notice ? (
        <div className="notice-banner" role="status">
          <span className="notice-icon"><Icon name="flask" size={16} /></span>
          <span>{payload.notice}</span>
          <a href="#setup">Configure live mode <Icon name="arrow" size={14} /></a>
        </div>
      ) : null}

      {clientError ? (
        <div className="error-banner" role="alert">
          <strong>Dashboard request failed.</strong> {clientError} Try refresh again when the server is available.
          <button type="button" onClick={() => void loadDashboard()}>Retry</button>
        </div>
      ) : null}

      <section className="overview-section" id="overview">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span className="eyebrow-line" /> Field notes</p>
            <h2>The current readout</h2>
          </div>
          <div className="section-heading-right">
            <StatusPill mode={currentStatus} />
            <button className={`refresh-button ${loading ? "spinning" : ""}`} type="button" onClick={() => void loadDashboard()} disabled={loading}>
              <Icon name="refresh" size={16} /> {loading ? "Refreshing" : "Refresh now"}
            </button>
          </div>
        </div>

        <div className="metric-grid">
          <MetricCard label="Research papers" value={research.total} detail="peer-reviewed signals" accent="violet" icon="flask" loading={loading && !payload} />
          <MetricCard label="Clinical trials" value={clinicalTrials.total} detail="registry records" accent="blue" icon="database" loading={loading && !payload} />
          <MetricCard label="FDA approvals" value={fdaApprovals.total} detail="oncology medicines" accent="mint" icon="shield" loading={loading && !payload} />
          <MetricCard label="News + editorials" value={news.total + blog.total} detail="briefing signals" accent="coral" icon="clock" loading={loading && !payload} />
        </div>

        <div className="health-strip">
          <div className="health-copy">
            <span className="health-dot" />
            <span><strong>{payload?.mode === "live" ? "Source connection healthy" : payload?.mode === "partial" ? "Some source lanes need attention" : payload?.mode === "demo" ? "Preview connection" : "Source connection pending"}</strong> <small>Last checked {lastClientRefresh ? lastClientRefresh.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}</small></span>
          </div>
          <div className="health-meter-wrap">
            <span className="health-meter-label">API budget</span>
            <div className="health-meter"><span style={{ width: `${rateRemaining === null || rateRemaining === undefined ? 38 : ratePercent}%` }} /></div>
            <span className="health-meter-value">{rateRemaining === null || rateRemaining === undefined ? "—" : `${rateRemaining}/${rateLimit}`}</span>
          </div>
          <div className="health-update"><Icon name="clock" size={15} /><span>Data snapshot {payload ? relativeDate(payload.lastUpdated) : "loading"}</span></div>
        </div>
      </section>

      <section className="signal-layout" id="signals">
        <div className="panel activity-panel">
          <div className="panel-heading">
            <div><span className="panel-index">01 / source mix</span><h3>Where the signal comes from</h3></div>
            <span className="panel-caption">{formatFullNumber(totalSources)} records</span>
          </div>
          <div className="activity-list">
            {activityRows.map((row) => (
              <div className="activity-row" key={row.key}>
                <div className="activity-label"><span className={`activity-dot dot-${DATASET_ACCENTS[row.key]}`} />{row.label}</div>
                <div className="activity-bar"><span className={`bar-${DATASET_ACCENTS[row.key]}`} style={{ width: `${row.width}%` }} /></div>
                <strong>{formatNumber(row.total)}</strong>
              </div>
            ))}
          </div>
          <div className="panel-footnote"><span className="footnote-mark">↳</span> Counts use the source API’s pagination totals; visible rows are a current sample.</div>
        </div>

        <div className="panel lens-panel">
          <div className="panel-heading">
            <div><span className="panel-index">02 / reading lens</span><h3>Today’s focus</h3></div>
            <span className="lens-date">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date())}</span>
          </div>
          <div className="lens-body">
            <div className="lens-number">{formatNumber(research.total + fdaApprovals.total)}<span>evidence + regulatory records</span></div>
            <div className="lens-rule"><span style={{ width: `${Math.min(92, Math.max(18, ((research.total || 1) / Math.max(fdaApprovals.total || 1, 1)) * 11))}%` }} /></div>
            <p>Use the source lanes together: research shows the evidence conversation, approvals show regulatory milestones, and trials show where investigation is moving next.</p>
          </div>
          <div className="lens-tags"><span>informational only</span><span>source links included</span></div>
        </div>
      </section>

      <section className="content-grid">
        <div className="panel signals-panel">
          <div className="panel-heading">
            <div><span className="panel-index">03 / latest signals</span><h3>What just entered the room</h3></div>
            <span className="panel-caption">{query ? `matching “${query}”` : selectedLabel}</span>
          </div>
          <div className="signal-list" aria-live="polite">
            {latestSignals.length ? latestSignals.map(({ key, item }) => (
              <SignalRow item={item} key={`${key}-${asString(item.id, getDisplayTitle(item, key))}`} dataset={key} />
            )) : <EmptyState label="No records in the current sample" />}
          </div>
          <div className="panel-bottom-link"><a href="#sources">View source notes <Icon name="arrow" size={15} /></a></div>
        </div>

        <div className="panel trials-panel" id="trials">
          <div className="panel-heading">
            <div><span className="panel-index">04 / trial watch</span><h3>Where studies are moving</h3></div>
            <span className="panel-caption">{formatNumber(clinicalTrials.total)} total</span>
          </div>
          <div className="trial-list" aria-live="polite">
            {clinicalTrials.items.slice(0, 4).map((item) => (
              <TrialRow item={item} key={asString(item.nctId, asString(item.id, getDisplayTitle(item, "clinicalTrials")))} />
            ))}
            {!clinicalTrials.items.length ? <EmptyState label="No trial records in the current sample" /> : null}
          </div>
          <div className="trials-foot"><span><span className="legend-dot recruiting" /> Recruiting</span><span><span className="legend-dot active" /> Active / other</span></div>
        </div>
      </section>

      <section className="approvals-section" id="sources">
        <div className="section-heading compact-heading">
          <div><p className="eyebrow"><span className="eyebrow-line" /> Regulatory shelf</p><h2>Approvals to keep in view</h2></div>
          <span className="section-side-note">Source links open in a new tab</span>
        </div>
        <div className="approval-table-wrap">
          <table className="approval-table">
            <thead><tr><th>Medicine</th><th>Company</th><th>Indication</th><th>Approval date</th><th /></tr></thead>
            <tbody>
              {fdaApprovals.items.slice(0, 5).map((item) => {
                const href = getSourceHref(item, "fdaApprovals");
                return <tr key={asString(item.id, asString(item.applicationNumber, getDisplayTitle(item, "fdaApprovals")))}>
                  <td><strong>{getDisplayTitle(item, "fdaApprovals")}</strong><small>{asString(item.genericName, "Generic name not listed")}</small></td>
                  <td>{asString(item.company, "Not listed")}</td>
                  <td className="indication-cell">{asString(item.indication, "Indication not listed")}</td>
                  <td>{formatDate(item.approvalDate)}</td>
                  <td><a className="table-link" href={href} target="_blank" rel="noreferrer">Open <Icon name="external" size={14} /></a></td>
                </tr>;
              })}
            </tbody>
          </table>
          {!fdaApprovals.items.length ? <EmptyState label="No approval records in the current sample" /> : null}
        </div>
      </section>

      <section className="setup-section" id="setup">
        <div className="setup-badge"><Icon name="shield" size={20} /></div>
        <div><span className="panel-index">Live mode / deployment note</span><h3>Designed to stay private by default.</h3><p>The browser talks only to this app’s server route. Add <code>CCWAI_API_KEY</code> as a Vercel environment variable; the key is never bundled into client JavaScript.</p></div>
        <a className="setup-link" href="https://www.curecancerwithai.com/api-keys" target="_blank" rel="noreferrer">Get an API key <Icon name="external" size={15} /></a>
      </section>

      <footer className="footer">
        <div className="footer-brand"><BrandMark /><span>Cure Cancer with AI / observatory</span></div>
        <p>Informational dataset explorer — not medical advice. Records are attributed to their source pages.</p>
        <div className="footer-meta"><span>REST API proxy</span><span>·</span><span>5 min browser refresh</span><span>·</span><a href="https://www.curecancerwithai.com/" target="_blank" rel="noreferrer">curecancerwithai.com <Icon name="external" size={13} /></a></div>
      </footer>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
  accent,
  icon,
  loading,
}: {
  label: string;
  value: number;
  detail: string;
  accent: string;
  icon: string;
  loading: boolean;
}) {
  return (
    <article className={`metric-card metric-${accent}`}>
      <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon name={icon} size={16} /></span></div>
      {loading ? <div className="metric-skeleton" /> : <strong>{formatNumber(value)}</strong>}
      <div className="metric-bottom"><span>{detail}</span><span className="metric-arrow">↗</span></div>
    </article>
  );
}

function SignalRow({ item, dataset }: { item: ApiRecord; dataset: DatasetKey }) {
  const href = getSourceHref(item, dataset);
  const title = getDisplayTitle(item, dataset);
  const detail = dataset === "research"
    ? asString(item.journal, "Research paper")
    : dataset === "news"
      ? asString(item.source, "News source")
      : asString(item.primaryCategory, "Editorial");
  const date = recordDate(item, dataset);
  return (
    <article className="signal-row">
      <span className={`signal-type type-${DATASET_ACCENTS[dataset]}`}>{DATASET_LABELS[dataset]}</span>
      <div className="signal-main"><a href={href} target="_blank" rel="noreferrer">{title}</a><span>{detail}</span></div>
      <time dateTime={date}>{relativeDate(date)}</time>
      <a className="row-arrow" href={href} target="_blank" rel="noreferrer" aria-label={`Open ${title}`}><Icon name="arrow" size={15} /></a>
    </article>
  );
}

function TrialRow({ item }: { item: ApiRecord }) {
  const href = getSourceHref(item, "clinicalTrials");
  const status = asString(item.status, "UNKNOWN");
  const recruiting = status.toUpperCase() === "RECRUITING";
  return (
    <article className="trial-row">
      <div className="trial-id"><span className={`legend-dot ${recruiting ? "recruiting" : "active"}`} />{asString(item.nctId, "NCT ID pending")}</div>
      <a className="trial-title" href={href} target="_blank" rel="noreferrer">{getDisplayTitle(item, "clinicalTrials")}</a>
      <div className="trial-detail"><span>{prettyStatus(status)}</span><span>{asString(item.interventionType, "Intervention not listed")}</span></div>
      <a className="row-arrow" href={href} target="_blank" rel="noreferrer" aria-label="Open trial"><Icon name="arrow" size={15} /></a>
    </article>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="empty-state"><span className="empty-ring" />{label}</div>;
}
