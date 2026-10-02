/**
 * Local prototype: shows what the Strong generator does to a Bible, chapter by
 * chapter, before and after a change of engine. It only reads the canonical
 * SQLite ledgers of two autonomous runs; Bible text never leaves this machine.
 *
 *   yarn exec tsx scripts/strong-prototype/server.ts [--port 4321]
 *     [--before outputs/strong-autonomous/v3] [--after outputs/strong-autonomous/v4]
 */
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { tokenizeText } from "../../src/tokenize.js";

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const PORT = Number(flag("--port", "4321"));
const RUNS = {
  before: flag("--before", "outputs/strong-autonomous/v3"),
  after: flag("--after", "outputs/strong-autonomous/v4")
} as const;
type Side = keyof typeof RUNS;
const LABELS: Record<string, string> = {
  nbs: "Nouvelle Bible Segond",
  nfc: "Nouvelle Français courant",
  bds: "Bible du Semeur",
  bfc: "Bible en français courant",
  fmar: "Martin",
  frc97: "Français courant 1997",
  nvs78p: "Nouvelle version Segond révisée",
  ost: "Ostervald",
  s21: "Segond 21"
};

interface RunEntry {
  status: string;
  directory: string;
  summary?: Record<string, number>;
}

function runBibles(side: Side): Record<string, RunEntry> {
  const file = path.join(RUNS[side], "run.json");
  if (!existsSync(file)) return {};
  return (
    JSON.parse(readFileSync(file, "utf8")) as {
      bibles: Record<string, RunEntry>;
    }
  ).bibles;
}

const databases = new Map<string, DatabaseSync>();
function database(side: Side, bible: string): DatabaseSync | undefined {
  const entry = runBibles(side)[bible];
  if (!entry || entry.status !== "verified") return undefined;
  const file = path.join(entry.directory, `bible-${bible}-strong.sqlite`);
  if (!existsSync(file)) return undefined;
  const key = `${side}:${file}`;
  if (!databases.has(key))
    databases.set(key, new DatabaseSync(file, { readOnly: true }));
  return databases.get(key);
}

interface Annotation {
  strong: string;
  visibility: string;
  placement: string;
  source: string;
  diagnostics?: string[];
  wordIndex?: number;
  startWordIndex?: number;
  endWordIndex?: number;
  originalOccurrenceId?: string;
  sourcePositions?: string[];
}

interface Decision {
  sourceUnitId: string;
  occurrenceIds: string[];
  strong: string[];
  source: { surface: string; gloss: string; morphology: string };
  state: "visible" | "empty" | "unresolved";
  assurance: string;
  targetWordIndices: number[];
  anchor?: { insertAfterWordIndex: number; absenceEstablished: boolean };
}

/** `TAHOT.Gen.2.3.7.L` is word 7 of Gen.2.3. */
const sourcePosition = (unitId: string) =>
  Number(
    /^TA(?:HOT|GNT)\.[^.]+\.\d+\.\d+\.(\d+)\./u.exec(`${unitId}.`)?.[1] ?? 0
  );

/** What the page needs to draw one verse with one engine. */
function verseView(row: Record<string, string>) {
  let word = 0;
  const segments = tokenizeText(row.text!.trimEnd()).map((segment) =>
    segment.kind === "word"
      ? { t: segment.text, w: word++ }
      : { t: segment.text }
  );
  const annotations = JSON.parse(row.annotations_json!) as Annotation[];
  const decisions = row.resolution_json
    ? (JSON.parse(row.resolution_json) as { decisions: Decision[] }).decisions
    : [];
  const unitOf = new Map<string, string>();
  for (const decision of decisions)
    for (const id of decision.occurrenceIds)
      unitOf.set(id, decision.sourceUnitId);
  const carriers = annotations
    .filter(
      (a) =>
        a.visibility === "reader" &&
        (a.placement === "word" || a.placement === "phrase")
    )
    .map((a) => ({
      start: a.wordIndex ?? a.startWordIndex!,
      end: a.wordIndex ?? a.endWordIndex!,
      strong: a.strong,
      source: a.source,
      method: a.diagnostics?.[0] ?? "",
      locution: a.diagnostics?.includes("witness-locution") ?? false,
      positioned: Boolean(a.sourcePositions?.length),
      unit: a.originalOccurrenceId
        ? unitOf.get(a.originalOccurrenceId)
        : undefined
    }));
  const units = Object.fromEntries(
    decisions.map((d) => [
      d.sourceUnitId,
      {
        strong: d.strong,
        surface: d.source.surface,
        gloss: d.source.gloss,
        morphology: d.source.morphology,
        position: sourcePosition(d.sourceUnitId),
        state: d.state,
        assurance: d.assurance
      }
    ])
  );
  return {
    segments,
    carriers,
    units,
    empties: decisions
      .filter((d) => d.state === "empty")
      .map((d) => ({
        after: d.anchor?.insertAfterWordIndex ?? -1,
        strong: d.strong.join(" "),
        unit: d.sourceUnitId,
        assurance: d.assurance
      })),
    uncertain: decisions
      .filter((d) => d.state === "unresolved")
      .map((d) => ({ strong: d.strong.join(" "), unit: d.sourceUnitId }))
  };
}

function catalog() {
  const before = runBibles("before");
  const after = runBibles("after");
  return Object.keys(after)
    .filter((bible) => database("after", bible))
    .map((bible) => {
      const books = database("after", bible)!
        .prepare(
          "select book_id as book, max(chapter) as chapters from verses group by book_id order by min(book_order)"
        )
        .all() as Array<{ book: string; chapters: number }>;
      return {
        id: bible,
        label: LABELS[bible] ?? bible.toUpperCase(),
        books,
        summary: {
          before: before[bible]?.summary,
          after: after[bible]?.summary
        }
      };
    });
}

function chapter(bible: string, book: string, number: number) {
  const read = (side: Side) =>
    new Map(
      (
        (database(side, bible)
          ?.prepare(
            "select ref, verse, text, annotations_json, resolution_json from verses where bible = ? and book_id = ? and chapter = ? order by verse"
          )
          .all(bible, book, number) ?? []) as Array<Record<string, string>>
      ).map((row) => [Number(row.verse), row])
    );
  const before = read("before");
  const after = read("after");
  return [...after.keys()].map((verse) => ({
    verse,
    ref: after.get(verse)!.ref,
    after: verseView(after.get(verse)!),
    before: before.has(verse) ? verseView(before.get(verse)!) : null
  }));
}

const page = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "index.html"
);

http
  .createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const json = (value: unknown, status = 200) => {
      response.writeHead(status, {
        "content-type": "application/json; charset=utf-8"
      });
      response.end(JSON.stringify(value));
    };
    try {
      if (url.pathname === "/") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(readFileSync(page));
      } else if (url.pathname === "/api/catalog") json(catalog());
      else if (url.pathname === "/api/chapter")
        json(
          chapter(
            url.searchParams.get("bible") ?? "nbs",
            url.searchParams.get("book") ?? "Gen",
            Number(url.searchParams.get("chapter") ?? "1")
          )
        );
      else json({ error: "not-found" }, 404);
    } catch (error) {
      json(
        { error: error instanceof Error ? error.message : String(error) },
        500
      );
    }
  })
  .listen(PORT, () =>
    console.log(
      `Strong prototype on http://localhost:${PORT} (${RUNS.before} → ${RUNS.after})`
    )
  );
