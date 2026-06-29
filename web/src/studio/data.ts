import type { LexicalAuditItem, LexicalCandidateReport, StrongLedger, StrongVerse } from "./types";

const verseCache = new Map<string, Promise<StrongVerse[]>>();

export async function loadLedger(path: string): Promise<StrongLedger> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Impossible de charger ${path}`);
  }
  const ledger = (await response.json()) as StrongLedger;
  return ledger;
}

export async function loadBookVerses(
  ledger: StrongLedger,
  bookId: string
): Promise<StrongVerse[]> {
  if (!ledger.split) {
    return ledger.verses.filter((verse) => verse.bookId === bookId);
  }

  const file = ledger.verseFiles?.find((candidate) => candidate.bookId === bookId);
  if (!file) return [];

  const cacheKey = `${ledger.generatedAt}:${file.path}`;
  const cached = verseCache.get(cacheKey);
  if (cached) return cached;

  const promise = fetch(`/${file.path}`).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Impossible de charger ${file.path}`);
    }
    return (await response.json()) as StrongVerse[];
  });
  verseCache.set(cacheKey, promise);
  return promise;
}

export async function loadLexicalItemsByRef(
  ledger: StrongLedger
): Promise<Map<string, LexicalAuditItem[]>> {
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
  return params.get("view") ?? "viewer";
}

export function defaultLedgerPath() {
  const params = new URLSearchParams(window.location.search);
  return params.get("file") ?? "/outputs/strong/nbs/bible-nbs-strong-ledger.json";
}
