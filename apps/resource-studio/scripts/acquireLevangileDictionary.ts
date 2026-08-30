import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

type SupportedWork = "bost" | "calmet" | "lelievre";

type SourceEntry = {
  id: number;
  word: string;
  normalizedWord: string;
  definition: string;
  sourceUrl: string;
  sourceSha256: string;
};

const BASE_URL = "https://www.levangile.com";
const LIST_PATHS: Record<SupportedWork, string> = {
  bost: "/Dictionnaire-Biblique/Liste-Definitions-Bost.php",
  calmet: "/Dictionnaire-Biblique/Liste-Definitions-Calmet.php",
  lelievre: "/Dictionnaire-Biblique/Liste-Definitions-Lelievre.php"
};

const decodeHtml = (value: string): string =>
  value
    .replaceAll("&nbsp;", "\u00a0")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/&#(\d+);/gu, (_match, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&#x([a-f0-9]+);/giu, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    );

const stripTags = (value: string): string =>
  decodeHtml(value.replace(/<[^>]*>/gu, " "))
    .replace(/\s+/gu, " ")
    .trim();

const normalizeWord = (value: string): string =>
  value.normalize("NFKC").trim().toLocaleLowerCase("fr");

const sanitizeDefinition = (value: string): string =>
  value
    .replace(
      /<(script|style|iframe|object|embed|form|input|button)\b[^>]*>[\s\S]*?<\/\1>/giu,
      ""
    )
    .replace(
      /<(script|style|iframe|object|embed|form|input|button)\b[^>]*\/?\s*>/giu,
      ""
    )
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/giu, "")
    .trim();

const sha256 = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchText = async (url: string, delayMs: number): Promise<string> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    if (delayMs > 0) await delay(delayMs);
    try {
      const response = await fetch(url, {
        headers: {
          accept: "text/html;charset=UTF-8",
          "user-agent":
            "BibleStrongResourceStudio/1.0 (+https://github.com/smontlouis/bible-strong)"
        },
        signal: AbortSignal.timeout(30_000)
      });
      if (!response.ok) throw new Error(`http-${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await delay(attempt * 500);
    }
  }
  throw new Error(`levangile-fetch-failed:${url}`, { cause: lastError });
};

const collectEntryUrls = async (
  work: SupportedWork,
  delayMs: number
): Promise<Map<number, string>> => {
  const entries = new Map<number, string>();
  for (let page = 1; page <= 1_000; page += 1) {
    const listPath = LIST_PATHS[work];
    const url = `${BASE_URL}${listPath}${page === 1 ? "" : `?page=${page}`}`;
    const html = await fetchText(url, delayMs);
    const pattern = new RegExp(
      `href="(/Dictionnaire-Biblique/definition-${work}-(\\d+)-[^"]+)"`,
      "giu"
    );
    let match: RegExpExecArray | null;
    let additions = 0;
    while ((match = pattern.exec(html)) !== null) {
      const id = Number(match[2]);
      const sourcePath = match[1];
      if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        !sourcePath ||
        entries.has(id)
      )
        continue;
      entries.set(id, `${BASE_URL}${decodeHtml(sourcePath)}`);
      additions += 1;
    }
    if (additions === 0)
      throw new Error(`levangile-list-page-empty:${work}:${page}`);
    if (!html.includes(`?page=${page + 1}`)) break;
  }
  if (entries.size === 0) throw new Error(`levangile-list-empty:${work}`);
  return entries;
};

const parseEntry = (
  work: SupportedWork,
  id: number,
  url: string,
  sourceHtml: string,
  contentHtml: string = sourceHtml
): SourceEntry => {
  const titleMatch = sourceHtml.match(
    /<h1>([\s\S]*?)<br\s+class="rwd-break"/iu
  );
  const definitionStart = contentHtml.indexOf('<div id="logos">');
  const definitionEnd = contentHtml.indexOf(
    '<div class="read-more">',
    definitionStart
  );
  if (!titleMatch?.[1] || definitionStart < 0 || definitionEnd < 0) {
    throw new Error(`levangile-entry-shape-invalid:${work}:${id}`);
  }
  const word = stripTags(titleMatch[1]);
  const definition = sanitizeDefinition(
    contentHtml
      .slice(definitionStart + '<div id="logos">'.length, definitionEnd)
      .replace(/<\/div>\s*$/u, "")
  );
  if (!word || !definition)
    throw new Error(`levangile-entry-content-empty:${work}:${id}`);
  return {
    id,
    word,
    normalizedWord: normalizeWord(word),
    definition,
    sourceUrl: url,
    sourceSha256: sha256(`${sourceHtml}\n${contentHtml}`)
  };
};

const acquireEntries = async (
  work: SupportedWork,
  urls: Map<number, string>,
  concurrency: number,
  delayMs: number
): Promise<SourceEntry[]> => {
  const queue = [...urls.entries()].sort(([left], [right]) => left - right);
  const results: SourceEntry[] = [];
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < queue.length) {
      const item = queue[cursor];
      cursor += 1;
      if (!item) return;
      const [id, url] = item;
      const html = await fetchText(url, delayMs);
      const redirectUrl = html.match(
        /document\.location\.href="(https:\/\/www\.levangile\.com\/Dictionnaire-Biblique\/[^"?]+)"/iu
      )?.[1];
      const contentHtml = redirectUrl
        ? await fetchText(redirectUrl, delayMs)
        : html;
      results.push(parseEntry(work, id, url, html, contentHtml));
      if (results.length % 100 === 0) {
        process.stderr.write(
          `acquire:${work}:${results.length}/${queue.length}\n`
        );
      }
    }
  });
  await Promise.all(workers);
  return results.sort((left, right) => left.id - right.id);
};

const quoteSql = (value: string): string => `'${value.replaceAll("'", "''")}'`;

const buildSqlite = async (
  sqlitePath: string,
  entries: readonly SourceEntry[]
) => {
  const sql = `PRAGMA journal_mode=OFF;
PRAGMA synchronous=OFF;
BEGIN IMMEDIATE;
CREATE TABLE dictionnaire (
  id INTEGER PRIMARY KEY,
  sanitized_word TEXT NOT NULL,
  word TEXT NOT NULL,
  definition TEXT NOT NULL
);
CREATE INDEX dictionnaire_browse ON dictionnaire(sanitized_word, id);
CREATE TABLE verses (id TEXT PRIMARY KEY, ref TEXT NOT NULL);
${entries
  .map(
    (entry) =>
      `INSERT INTO dictionnaire VALUES (${entry.id}, ${quoteSql(entry.normalizedWord)}, ${quoteSql(entry.word)}, ${quoteSql(entry.definition)});`
  )
  .join("\n")}
COMMIT;
PRAGMA integrity_check;
`;
  await new Promise<void>((resolve, reject) => {
    const child = spawn("sqlite3", [sqlitePath], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stderr = "";
    let stdout = "";
    child.stderr.setEncoding("utf8");
    child.stdout.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 || !stdout.trim().endsWith("ok")) {
        reject(
          new Error(`levangile-sqlite-build-failed:${code}:${stderr || stdout}`)
        );
      } else resolve();
    });
    child.stdin.end(sql);
  });
};

const parseArgs = () => {
  const values = new Map<string, string>();
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key || !value || !key.startsWith("--") || value.startsWith("--"))
      throw new Error("levangile-cli-argument-invalid");
    values.set(key, value);
  }
  const work = values.get("--work");
  const outputDir = values.get("--output-dir");
  if (
    (work !== "bost" && work !== "calmet" && work !== "lelievre") ||
    !outputDir
  ) {
    throw new Error(
      "usage: --work bost|calmet|lelievre --output-dir <dir> [--concurrency 2] [--delay-ms 100]"
    );
  }
  const concurrency = Number(values.get("--concurrency") ?? "2");
  const delayMs = Number(values.get("--delay-ms") ?? "100");
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8)
    throw new Error("levangile-cli-concurrency-invalid");
  if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 10_000)
    throw new Error("levangile-cli-delay-invalid");
  return { work, outputDir: path.resolve(outputDir), concurrency, delayMs };
};

const main = async () => {
  const { work, outputDir, concurrency, delayMs } = parseArgs();
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const urls = await collectEntryUrls(work, delayMs);
  const entries = await acquireEntries(work, urls, concurrency, delayMs);
  const source = {
    format: "bible-strong-levangile-dictionary-source",
    schemaVersion: 1,
    work,
    source: `${BASE_URL}${LIST_PATHS[work]}`,
    acquiredAt: new Date().toISOString(),
    entries
  };
  await Promise.all([
    writeFile(
      path.join(outputDir, `${work}.json`),
      `${JSON.stringify(source)}\n`,
      "utf8"
    ),
    buildSqlite(path.join(outputDir, `${work}.sqlite`), entries)
  ]);
  process.stdout.write(
    `${JSON.stringify({ work, entries: entries.length, outputDir }, null, 2)}\n`
  );
};

await main();
