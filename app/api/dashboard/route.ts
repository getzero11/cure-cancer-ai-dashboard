import { NextRequest, NextResponse } from "next/server";
import { asNumber, parseDatasetBody } from "@/lib/dashboard-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_ORIGIN = "https://www.curecancerwithai.com/api/v1";
const CANCER_TYPES = [
  "all",
  "lung",
  "breast",
  "prostate",
  "colorectal",
  "melanoma",
  "leukemia",
  "lymphoma",
] as const;

type CancerType = (typeof CANCER_TYPES)[number];
type DatasetKey =
  | "research"
  | "news"
  | "blog"
  | "fdaApprovals"
  | "clinicalTrials";
type ApiRecord = Record<string, unknown>;

interface RateLimit {
  remaining: number | null;
  limit: number | null;
  reset: string | null;
}

interface DatasetResult {
  items: ApiRecord[];
  total: number;
  fetchedAt: string;
  rateLimit?: RateLimit;
}

interface DashboardPayload {
  mode: "live" | "partial" | "demo" | "error";
  cancerType: CancerType;
  query: string;
  lastUpdated: string;
  notice?: string;
  rateLimit: RateLimit;
  datasets: Record<DatasetKey, DatasetResult>;
  errors: Partial<Record<DatasetKey, string>>;
}

interface LiveCacheEntry {
  payload: DashboardPayload;
  expiresAt: number;
}

// A warm Vercel/Node instance can serve many dashboard viewers from one source
// snapshot instead of spending five API requests on every browser refresh.
const LIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const liveDashboardCache = new Map<string, LiveCacheEntry>();

const DATASET_CONFIG: Array<{
  key: DatasetKey;
  path: string;
  supportsCancerType: boolean;
}> = [
  { key: "research", path: "/research", supportsCancerType: true },
  { key: "news", path: "/news", supportsCancerType: true },
  { key: "blog", path: "/blog", supportsCancerType: true },
  {
    key: "fdaApprovals",
    path: "/fda-approvals",
    supportsCancerType: true,
  },
  {
    key: "clinicalTrials",
    path: "/clinical-trials",
    supportsCancerType: false,
  },
];

class DatasetFetchError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DatasetFetchError";
    this.status = status;
  }
}

function normalizeCancerType(value: string | null): CancerType {
  return CANCER_TYPES.includes(value as CancerType) ? (value as CancerType) : "all";
}

function safeQuery(value: string | null): string {
  return (value ?? "").trim().slice(0, 120);
}

function emptyDataset(): DatasetResult {
  return {
    items: [],
    total: 0,
    fetchedAt: new Date().toISOString(),
  };
}

function buildQuery(
  config: (typeof DATASET_CONFIG)[number],
  cancerType: CancerType,
  query: string,
): string {
  const params = new URLSearchParams({ limit: "20" });

  if (cancerType !== "all") {
    if (config.supportsCancerType) {
      params.set("cancerType", cancerType);
    } else {
      // Clinical trials use `condition` instead of `cancerType`.
      params.set("condition", cancerType);
    }
  }

  if (query) {
    params.set("search", query);
  }

  return `${API_ORIGIN}${config.path}?${params.toString()}`;
}

async function fetchDataset(
  config: (typeof DATASET_CONFIG)[number],
  cancerType: CancerType,
  query: string,
  apiKey: string,
): Promise<DatasetResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(buildQuery(config, cancerType, query), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const remaining = asNumber(response.headers.get("x-ratelimit-remaining")
      ? Number(response.headers.get("x-ratelimit-remaining"))
      : null);
    const limit = asNumber(response.headers.get("x-ratelimit-limit")
      ? Number(response.headers.get("x-ratelimit-limit"))
      : null);
    const reset = response.headers.get("x-ratelimit-reset");
    const rateLimit: RateLimit = { remaining, limit, reset };

    if (!response.ok) {
      if (response.status === 401) {
        throw new DatasetFetchError("The API key was rejected.", response.status);
      }
      if (response.status === 429) {
        throw new DatasetFetchError(
          "Rate limit reached; wait for the reset window.",
          response.status,
        );
      }
      throw new DatasetFetchError(
        `The source returned HTTP ${response.status}.`,
        response.status,
      );
    }

    const body: unknown = await response.json();
    const { items, total } = parseDatasetBody(body, config.key);

    return {
      items,
      total,
      fetchedAt: new Date().toISOString(),
      rateLimit,
    };
  } catch (error) {
    if (error instanceof DatasetFetchError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new DatasetFetchError("The source timed out after 20 seconds.", 504);
    }
    throw new DatasetFetchError("The source could not be reached.", 503);
  } finally {
    clearTimeout(timeout);
  }
}

function demoDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

function labelForCancerType(cancerType: CancerType): string {
  if (cancerType === "all") return "all cancers";
  return `${cancerType[0].toUpperCase()}${cancerType.slice(1)} cancer`;
}

function buildDemoPayload(cancerType: CancerType, query: string): DashboardPayload {
  const label = labelForCancerType(cancerType);
  const now = new Date().toISOString();
  const datasets: Record<DatasetKey, DatasetResult> = {
    research: {
      total: 248,
      fetchedAt: now,
      items: [
        {
          id: "demo-research-1",
          pubmedId: "38123456",
          title: `${label} treatment signals entering the next evidence cycle`,
          journal: "Journal of Translational Oncology",
          publicationDate: demoDate(2),
          summaryPlain:
            "Demo record shown until a server-side CCWAI_API_KEY is configured.",
          cancerTypes: cancerType === "all" ? ["lung", "breast"] : [cancerType],
          fullTextUrl: "https://pubmed.ncbi.nlm.nih.gov/38123456/",
        },
        {
          id: "demo-research-2",
          pubmedId: "38122741",
          title: "A multi-omic view of resistance and response in solid tumors",
          journal: "Cancer Discovery",
          publicationDate: demoDate(8),
          summaryPlain:
            "A second illustrative research item for the dashboard preview.",
          cancerTypes: cancerType === "all" ? ["colorectal"] : [cancerType],
          fullTextUrl: "https://pubmed.ncbi.nlm.nih.gov/38122741/",
        },
      ],
    },
    news: {
      total: 74,
      fetchedAt: now,
      items: [
        {
          id: "demo-news-1",
          title: `What changed this week in ${label} research`,
          summary: "Demo newsroom item — connect the API to replace this preview.",
          source: "CCWAI newsroom",
          publishedAt: demoDate(1),
          url: "https://www.curecancerwithai.com/",
          cancerTypes: cancerType === "all" ? ["lung"] : [cancerType],
        },
        {
          id: "demo-news-2",
          title: "Regulatory and trial signals worth watching",
          summary: "The live dashboard will cite the source URL for each item.",
          source: "CCWAI newsroom",
          publishedAt: demoDate(5),
          url: "https://www.curecancerwithai.com/",
          cancerTypes: cancerType === "all" ? ["breast"] : [cancerType],
        },
      ],
    },
    blog: {
      total: 31,
      fetchedAt: now,
      items: [
        {
          id: "demo-blog-1",
          slug: "reading-the-oncology-signal-board",
          title: "How to read an oncology signal board",
          excerpt: "A short editorial guide to evidence, approvals and trials.",
          primaryCategory: "Oncology intelligence",
          publishedAt: demoDate(9),
          cancerTypeTags: cancerType === "all" ? ["all"] : [cancerType],
        },
      ],
    },
    fdaApprovals: {
      total: 16,
      fetchedAt: now,
      items: [
        {
          id: "demo-fda-1",
          applicationNumber: "NDA-DEMO-01",
          drugName: "Illustrative therapy",
          genericName: "preview compound",
          company: "Example Therapeutics",
          approvalDate: demoDate(14),
          indication: `${label} indication (preview data)`,
          url: "https://www.fda.gov/drugs/resources-information-approved-drugs",
          cancerTypes: cancerType === "all" ? ["lung"] : [cancerType],
        },
      ],
    },
    clinicalTrials: {
      total: 129,
      fetchedAt: now,
      items: [
        {
          id: "demo-trial-1",
          nctId: "NCT00000001",
          title: `Phase II study of a combination strategy in ${label}`,
          description: "Illustrative trial record for the unconfigured preview.",
          conditions: cancerType === "all" ? ["solid tumors"] : [label],
          status: "RECRUITING",
          startDate: demoDate(80),
          completionDate: demoDate(-240),
          interventionType: "Drug",
        },
        {
          id: "demo-trial-2",
          nctId: "NCT00000002",
          title: "Biomarker-guided trial watch",
          description: "A second illustrative trial row.",
          conditions: [label],
          status: "ACTIVE_NOT_RECRUITING",
          startDate: demoDate(240),
          completionDate: demoDate(-160),
          interventionType: "Biological",
        },
      ],
    },
  };

  return {
    mode: "demo",
    cancerType,
    query,
    lastUpdated: now,
    notice:
      "Preview data is shown. Add CCWAI_API_KEY to the deployment environment to enable live records.",
    rateLimit: { remaining: null, limit: 100, reset: null },
    datasets,
    errors: {},
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cancerType = normalizeCancerType(searchParams.get("cancerType"));
  const query = safeQuery(searchParams.get("query"));
  const apiKey = process.env.CCWAI_API_KEY?.trim();

  if (!apiKey || apiKey === "ccw_live_replace_me") {
    return NextResponse.json(buildDemoPayload(cancerType, query), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const cacheKey = `${cancerType}:${query}`;
  const cached = liveDashboardCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: {
        "Cache-Control": "no-store",
        "X-Dashboard-Cache": "HIT",
      },
    });
  }

  const datasets = {} as Record<DatasetKey, DatasetResult>;
  const errors: Partial<Record<DatasetKey, string>> = {};
  const rateLimits: RateLimit[] = [];

  const responses = await Promise.allSettled(
    DATASET_CONFIG.map((config) => fetchDataset(config, cancerType, query, apiKey)),
  );

  responses.forEach((response, index) => {
    const key = DATASET_CONFIG[index].key;
    if (response.status === "fulfilled") {
      datasets[key] = response.value;
      if (response.value.rateLimit) rateLimits.push(response.value.rateLimit);
    } else {
      const error = response.reason;
      errors[key] =
        error instanceof DatasetFetchError
          ? error.message
          : "This dataset could not be loaded.";
      datasets[key] = emptyDataset();
    }
  });

  const remainingValues = rateLimits
    .map((value) => value.remaining)
    .filter((value): value is number => value !== null);
  const reset = rateLimits.find((value) => value.reset)?.reset ?? null;
  const limit = rateLimits.find((value) => value.limit)?.limit ?? 100;
  const successfulCount = DATASET_CONFIG.length - Object.keys(errors).length;
  const mode: DashboardPayload["mode"] =
    successfulCount === 0 ? "error" : successfulCount < DATASET_CONFIG.length ? "partial" : "live";

  const payload: DashboardPayload = {
    mode,
    cancerType,
    query,
    lastUpdated: new Date().toISOString(),
    rateLimit: {
      remaining: remainingValues.length ? Math.min(...remainingValues) : null,
      limit,
      reset,
    },
    datasets,
    errors,
  };

  // Never keep a partial/error snapshot for five minutes. A transient failure
  // should be retried on the next request instead of looking like empty data.
  if (mode === "live") {
    liveDashboardCache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + LIVE_CACHE_TTL_MS,
    });
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
      "X-Dashboard-Cache": "MISS",
    },
  });
}
