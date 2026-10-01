import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { ACQUISITION_ROOT, sha256, stableStringify } from "./shared.js";

export const ACQUISITION_VERSION = "concordance-public-pages-v1";
export const CONCORDANCE_ORIGIN = "https://concordance.bible";
/** Identifies the tool without any personal contact data. */
export const USER_AGENT =
  "BibleStrong-quality-research/1.0 (bounded private evaluation)";
/** Never go faster than this, whatever the caller asks. */
export const MIN_DELAY_MS = 4000;

export interface AcquisitionReceipt {
  version: typeof ACQUISITION_VERSION;
  edition: string;
  chapter: string;
  url: string;
  finalUrl: string;
  requestedAt: string;
  receivedAt: string;
  status: number;
  contentType: string | null;
  lastModified: string | null;
  etag: string | null;
  bytes: number;
  sha256: string;
  userAgent: string;
  rawPath: string;
  annotationCounts: AnnotationCounts;
}

export interface AnnotationCounts {
  verses: number;
  words: number;
  wordsWithStrong: number;
  wordsWithSourcePosition: number;
  untranslatedMarkers: number;
  notes: number;
}

/** Page-level evidence that Strong annotations were actually delivered. */
export function countAnnotations(html: string): AnnotationCounts {
  const chapter = chapterMarkup(html);
  const words = [...chapter.matchAll(/<w\b([^>]*)>/gu)].map(
    (match) => match[1] ?? ""
  );
  return {
    verses: (chapter.match(/<span class="verse">/gu) ?? []).length,
    words: words.length,
    wordsWithStrong: words.filter((attributes) =>
      /data-ns="[^"]*\d/u.test(attributes)
    ).length,
    wordsWithSourcePosition: words.filter((attributes) =>
      /data-pa="\d+\//u.test(attributes)
    ).length,
    untranslatedMarkers: (chapter.match(/class="strong-untranslated"/gu) ?? [])
      .length,
    notes: (chapter.match(/class="[^"]*\bnote\b/gu) ?? []).length
  };
}

/** The biblical chapter container, excluding navigation and site chrome. */
export function chapterMarkup(html: string): string {
  const start = html.indexOf('<div class="chapter"');
  if (start < 0) return "";
  return html.slice(start);
}

export function concordanceChapterUrl(
  edition: string,
  chapter: string
): string {
  const [book, number] = chapter.split(".");
  if (!book || !number || !/^\d+$/u.test(number))
    throw new Error(`invalid-chapter:${chapter}`);
  if (!/^[A-Za-z0-9]+$/u.test(edition))
    throw new Error(`invalid-edition:${edition}`);
  return `${CONCORDANCE_ORIGIN}/${edition}/${book}/${number}/`;
}

export const rawPathFor = (root: string, edition: string, chapter: string) =>
  path.join(root, "raw", edition, `${chapter}.html`);
export const receiptPathFor = (
  root: string,
  edition: string,
  chapter: string
) => path.join(root, "raw", edition, `${chapter}.receipt.json`);

/**
 * Fetch public chapter pages sequentially with a fixed delay. Cached pages are
 * never refetched: a receipt is the frozen record of what the evaluator uses.
 * No query string, login, cookie or robots-disallowed path is ever requested.
 */
export async function acquireChapters(options: {
  requests: Array<{ edition: string; chapter: string }>;
  root?: string;
  delayMs: number;
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
}): Promise<{
  fetched: AcquisitionReceipt[];
  cached: AcquisitionReceipt[];
  failed: Array<{ edition: string; chapter: string; error: string }>;
}> {
  const root = options.root ?? ACQUISITION_ROOT;
  const delayMs = Math.max(MIN_DELAY_MS, options.delayMs);
  const fetchImpl = options.fetchImpl ?? fetch;
  const log = options.log ?? (() => undefined);
  const fetched: AcquisitionReceipt[] = [];
  const cached: AcquisitionReceipt[] = [];
  const failed: Array<{ edition: string; chapter: string; error: string }> = [];
  let first = true;
  for (const request of options.requests) {
    const rawPath = rawPathFor(root, request.edition, request.chapter);
    const receiptPath = receiptPathFor(root, request.edition, request.chapter);
    if (existsSync(receiptPath) && existsSync(rawPath)) {
      const receipt = JSON.parse(
        await readFile(receiptPath, "utf8")
      ) as AcquisitionReceipt;
      const actual = sha256(await readFile(rawPath));
      if (actual !== receipt.sha256)
        throw new Error(
          `cached-page-hash-mismatch:${request.edition}:${request.chapter}`
        );
      cached.push(receipt);
      continue;
    }
    if (!first) await sleep(delayMs);
    first = false;
    const url = concordanceChapterUrl(request.edition, request.chapter);
    const requestedAt = new Date().toISOString();
    try {
      const response = await fetchImpl(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        redirect: "follow"
      });
      const body = Buffer.from(await response.arrayBuffer());
      const receivedAt = new Date().toISOString();
      if (response.status !== 200) {
        failed.push({ ...request, error: `http-${response.status}` });
        log(`${request.edition} ${request.chapter} HTTP ${response.status}`);
        continue;
      }
      await mkdir(path.dirname(rawPath), { recursive: true });
      await writeFile(rawPath, body, { flag: "wx" });
      const receipt: AcquisitionReceipt = {
        version: ACQUISITION_VERSION,
        edition: request.edition,
        chapter: request.chapter,
        url,
        finalUrl: response.url || url,
        requestedAt,
        receivedAt,
        status: response.status,
        contentType: response.headers.get("content-type"),
        lastModified: response.headers.get("last-modified"),
        etag: response.headers.get("etag"),
        bytes: body.length,
        sha256: sha256(body),
        userAgent: USER_AGENT,
        rawPath: path.relative(root, rawPath),
        annotationCounts: countAnnotations(body.toString("utf8"))
      };
      await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
        flag: "wx"
      });
      fetched.push(receipt);
      log(
        `${request.edition} ${request.chapter} ${body.length}B verses=${receipt.annotationCounts.verses} strong=${receipt.annotationCounts.wordsWithStrong} empty=${receipt.annotationCounts.untranslatedMarkers}`
      );
    } catch (error) {
      failed.push({
        ...request,
        error: error instanceof Error ? error.message : String(error)
      });
      log(`${request.edition} ${request.chapter} failed ${String(error)}`);
    }
  }
  return { fetched, cached, failed };
}

/** Hash every receipt into one manifest, so later steps can pin the cache. */
export async function sealAcquisition(root = ACQUISITION_ROOT): Promise<{
  version: typeof ACQUISITION_VERSION;
  receipts: AcquisitionReceipt[];
  receiptsSha256: string;
}> {
  const receipts: AcquisitionReceipt[] = [];
  const rawRoot = path.join(root, "raw");
  for (const edition of (await readdir(rawRoot)).sort()) {
    for (const file of (await readdir(path.join(rawRoot, edition))).sort()) {
      if (!file.endsWith(".receipt.json")) continue;
      const receipt = JSON.parse(
        await readFile(path.join(rawRoot, edition, file), "utf8")
      ) as AcquisitionReceipt;
      const actual = sha256(await readFile(path.join(root, receipt.rawPath)));
      if (actual !== receipt.sha256)
        throw new Error(
          `raw-page-hash-mismatch:${receipt.edition}:${receipt.chapter}`
        );
      receipts.push(receipt);
    }
  }
  return {
    version: ACQUISITION_VERSION,
    receipts,
    receiptsSha256: sha256(stableStringify(receipts))
  };
}
