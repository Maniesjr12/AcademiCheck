export interface SearchResult {
  url: string;
  title: string;
  abstract: string;
  sourceType: "journal" | "web";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
}

function truncateQuery(query: string, maxWords = 100): string {
  const words = query.trim().split(/\s+/);
  return words.slice(0, maxWords).join(" ");
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "AcademiCheck/1.0 (academic-integrity-tool; mailto:admin@university.edu)",
      Accept: "application/json",
      ...headers,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }

  return res.json();
}

/** Pause execution for ms milliseconds — used to respect API rate limits. */
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ─── CrossRef ────────────────────────────────────────────────────────────────

interface CrossRefItem {
  DOI?: string;
  URL?: string;
  title?: string[];
  abstract?: string;
}

interface CrossRefResponse {
  message?: {
    items?: CrossRefItem[];
  };
}

export async function searchCrossRef(query: string): Promise<SearchResult[]> {
  await delay(300);

  const encoded = encodeURIComponent(truncateQuery(query));
  const url = `https://api.crossref.org/works?query=${encoded}&rows=5&select=DOI,URL,title,abstract`;

  let data: CrossRefResponse;
  try {
    data = (await fetchJson(url)) as CrossRefResponse;
  } catch {
    return [];
  }

  const items = data?.message?.items ?? [];

  return items.flatMap((item): SearchResult[] => {
    const sourceUrl = item.URL ?? (item.DOI ? `https://doi.org/${item.DOI}` : null);
    const title = item.title?.[0];
    if (!sourceUrl || !title) return [];

    const rawAbstract = item.abstract ?? "";
    const abstract = stripHtml(rawAbstract);
    if (!abstract && !title) return [];

    return [
      {
        url: sourceUrl,
        title: stripHtml(title),
        abstract: abstract || title,
        sourceType: "journal",
      },
    ];
  });
}

// ─── Semantic Scholar ────────────────────────────────────────────────────────

interface SemanticScholarPaper {
  paperId?: string;
  title?: string;
  abstract?: string;
  url?: string;
}

interface SemanticScholarResponse {
  data?: SemanticScholarPaper[];
}

export async function searchSemanticScholar(query: string): Promise<SearchResult[]> {
  await delay(300);

  const encoded = encodeURIComponent(truncateQuery(query));
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encoded}&fields=title,abstract,url&limit=5`;

  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  const headers: Record<string, string> = apiKey ? { "x-api-key": apiKey } : {};

  let data: SemanticScholarResponse;
  try {
    data = (await fetchJson(url, headers)) as SemanticScholarResponse;
  } catch {
    return [];
  }

  const papers = data?.data ?? [];

  return papers.flatMap((paper): SearchResult[] => {
    const sourceUrl =
      paper.url ??
      (paper.paperId
        ? `https://www.semanticscholar.org/paper/${paper.paperId}`
        : null);
    const title = paper.title;
    if (!sourceUrl || !title) return [];

    const abstract = stripHtml(paper.abstract ?? "");

    return [
      {
        url: sourceUrl,
        title: stripHtml(title),
        abstract: abstract || title,
        sourceType: "journal",
      },
    ];
  });
}

// ─── OpenAlex ────────────────────────────────────────────────────────────────

interface OpenAlexWork {
  doi?: string;
  title?: string;
  abstract_inverted_index?: Record<string, number[]>;
  primary_location?: { landing_page_url?: string };
}

interface OpenAlexResponse {
  results?: OpenAlexWork[];
}

function reconstructAbstract(invertedIndex: Record<string, number[]> | undefined): string {
  if (!invertedIndex) return "";
  const positions: [number, string][] = [];
  for (const [word, indices] of Object.entries(invertedIndex)) {
    for (const pos of indices) {
      positions.push([pos, word]);
    }
  }
  positions.sort((a, b) => a[0] - b[0]);
  return positions.map(([, word]) => word).join(" ");
}

export async function searchOpenAlex(query: string): Promise<SearchResult[]> {
  await delay(300);

  const encoded = encodeURIComponent(truncateQuery(query));
  const url = `https://api.openalex.org/works?search=${encoded}&per-page=5&select=doi,title,abstract_inverted_index,primary_location`;

  let data: OpenAlexResponse;
  try {
    data = (await fetchJson(url)) as OpenAlexResponse;
  } catch {
    return [];
  }

  const works = data?.results ?? [];

  return works.flatMap((work): SearchResult[] => {
    const sourceUrl =
      work.doi ?? work.primary_location?.landing_page_url ?? null;
    const title = work.title;
    if (!sourceUrl || !title) return [];

    const abstract = reconstructAbstract(work.abstract_inverted_index);
    if (!abstract) return [];

    return [
      {
        url: sourceUrl,
        title: stripHtml(title),
        abstract,
        sourceType: "journal",
      },
    ];
  });
}

// ─── Google Custom Search debug test ─────────────────────────────────────────

interface GoogleDebugItem {
  title?: string;
  link?: string;
  snippet?: string;
}

interface GoogleDebugResponse {
  items?: GoogleDebugItem[];
  error?: { code: number; message: string; status: string };
  searchInformation?: { totalResults: string };
}

async function testGoogleSearch() {
  const query = "World War II surrender Germany Allies Berlin 1945";
  console.log("Testing Google Custom Search with query:", query);

  const key = process.env.GOOGLE_CUSTOM_SEARCH_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  console.log("API Key present:", !!key);
  console.log("Search Engine ID:", cx);

  if (!key || !cx) {
    console.error("ERROR: GOOGLE_CUSTOM_SEARCH_KEY or GOOGLE_SEARCH_ENGINE_ID not set in env");
    return;
  }

  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&num=5`;
  console.log("Request URL (key redacted):", url.replace(key, "REDACTED"));

  const response = await fetch(url);
  console.log("Response status:", response.status);

  const data = (await response.json()) as GoogleDebugResponse;
  console.log("Full response:", JSON.stringify(data, null, 2));

  console.log("[DEBUG] Google items found:", data?.items?.length ?? 0);
  if (data?.items) {
    data.items.forEach((item, i) => {
      console.log(`[DEBUG] Result ${i + 1}:`, item.title, "|", item.link);
    });
  }
  if (data?.error) {
    console.error("[DEBUG] API error:", data.error.code, data.error.message, data.error.status);
  }
}

// ESM equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
  testGoogleSearch().catch(console.error);
}
