import type {
  LexicalAuditItem,
  LexicalCandidateReport,
  JsonlBibleCatalog,
  JsonlBibleChapter,
  JsonlBibleId,
  StrongLedger,
  StrongReviewBucket,
  StrongReviewItemsPage,
  StrongReviewSummary,
  StrongVerse
} from "./types";

const verseCache = new Map<string, Promise<StrongVerse[]>>();

export async function loadLedger(path: string): Promise<StrongLedger> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Impossible de charger ${path}`);
  }
  const ledger = (await response.json()) as StrongLedger;
  if (path.startsWith("/api/strong/metadata")) {
    return { ...ledger, apiBacked: true, verses: ledger.verses ?? [] };
  }
  return ledger;
}

export async function loadJsonlBibleCatalog(): Promise<JsonlBibleCatalog> {
  return fetchJson<JsonlBibleCatalog>("/api/jsonl-bibles/catalog");
}

export async function loadJsonlBibleChapter(options: {
  versions: JsonlBibleId[];
  bookId: string;
  chapter: number;
}): Promise<JsonlBibleChapter> {
  const params = new URLSearchParams({
    versions: options.versions.join(","),
    book: options.bookId,
    chapter: String(options.chapter)
  });
  return fetchJson<JsonlBibleChapter>(
    `/api/jsonl-bibles/chapter?${params.toString()}`
  );
}

export async function loadBookVerses(
  ledger: StrongLedger,
  bookId: string,
  chapter?: number
): Promise<StrongVerse[]> {
  if (ledger.apiBacked) {
    if (!Number.isInteger(chapter) || (chapter ?? 0) <= 0) return [];
    const cacheKey = `${ledger.generatedAt}:api:${bookId}:${chapter}`;
    const cached = verseCache.get(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      bible: ledger.bible,
      book: bookId,
      chapter: String(chapter)
    });
    const promise = fetch(`/api/strong/verses?${params}`).then(
      async (response) => {
        if (!response.ok) {
          throw new Error(`Impossible de charger ${bookId}.${chapter}`);
        }
        const payload = (await response.json()) as { verses?: StrongVerse[] };
        return payload.verses ?? [];
      }
    );
    verseCache.set(cacheKey, promise);
    return promise;
  }

  if (!ledger.split) {
    return ledger.verses.filter(
      (verse) =>
        verse.bookId === bookId &&
        (chapter === undefined || verse.chapter === chapter)
    );
  }

  const file = ledger.verseFiles?.find(
    (candidate) => candidate.bookId === bookId
  );
  if (!file) return [];

  const cacheKey = `${ledger.generatedAt}:${file.path}`;
  const cached = verseCache.get(cacheKey);
  if (cached) {
    const verses = await cached;
    return chapter === undefined
      ? verses
      : verses.filter((verse) => verse.chapter === chapter);
  }

  const promise = fetch(`/${file.path}`).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Impossible de charger ${file.path}`);
    }
    return (await response.json()) as StrongVerse[];
  });
  verseCache.set(cacheKey, promise);
  const verses = await promise;
  return chapter === undefined
    ? verses
    : verses.filter((verse) => verse.chapter === chapter);
}

export async function loadLexicalItemsByRef(
  ledger: StrongLedger
): Promise<Map<string, LexicalAuditItem[]>> {
  // The canonical viewer is SQLite-backed. Do not pull the 185 MB full-bible
  // lexical report into the browser; its actionable subset is exposed in the
  // quality cockpit instead.
  if (ledger.apiBacked) return new Map();
  const reportPath = inferLexicalReportPath(ledger);
  if (!reportPath) return new Map();

  const response = await fetch(reportPath);
  if (!response.ok) return new Map();

  const report = (await response.json()) as LexicalCandidateReport;
  const byRef = new Map<string, LexicalAuditItem[]>();
  for (const item of report.items ?? []) {
    const items = byRef.get(item.ref) ?? [];
    items.push(item);
    byRef.set(item.ref, items);
  }
  return byRef;
}

function inferLexicalReportPath(ledger: StrongLedger) {
  if (!ledger.bible || !ledger.scope) return null;
  const scopeSlug = String(ledger.scope).replace(/[^\p{L}\p{N}.-]+/gu, "_");
  return `/outputs/lexical-candidates/${ledger.bible}/bible-${ledger.bible}-lexical-candidates-${scopeSlug}.json`;
}

export function currentViewFromLocation(): string {
  const params = new URLSearchParams(window.location.search);
  if (params.has("review") || params.has("manifest")) return "review";
  const explicitView = params.get("view");
  if (explicitView) return explicitView;
  if (window.location.pathname.endsWith("/workflow.html")) return "workflow";
  if (window.location.pathname.endsWith("/jsonl.html")) return "jsonl";
  if (window.location.pathname.endsWith("/lexicon.html")) return "lexicon";
  if (window.location.pathname.endsWith("/review.html")) return "review";
  return (
    window.localStorage.getItem("bible-strong:last-view") ??
    "viewer"
  );
}

export function defaultLedgerPath() {
  const params = new URLSearchParams(window.location.search);
  return params.get("file") ?? "/api/strong/metadata?bible=nbs";
}

export async function loadStrongReviewSummary(
  bible = "nbs"
): Promise<StrongReviewSummary> {
  return fetchJson<StrongReviewSummary>(
    `/api/strong/review/summary?bible=${encodeURIComponent(bible)}`
  );
}

export async function loadStrongReviewItems(options: {
  bible?: string;
  bucket: StrongReviewBucket;
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<StrongReviewItemsPage> {
  const params = new URLSearchParams({
    bible: options.bible ?? "nbs",
    bucket: options.bucket,
    q: options.query ?? "",
    limit: String(options.limit ?? 40),
    offset: String(options.offset ?? 0)
  });
  return fetchJson<StrongReviewItemsPage>(`/api/strong/review/items?${params}`);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? `Impossible de charger ${url}`);
  }
  return (await response.json()) as T;
}
