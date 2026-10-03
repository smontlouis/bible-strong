/**
 * Local prototype: shows what the Strong generator does to a Bible, chapter by
 * chapter, before and after a change of engine (`/`), and our S21 and NEG79
 * placements beside Concordance's on the comparison sample (`/concordance`).
 * It only reads local ledgers and comparison views; Bible text and Concordance
 * annotations never leave this machine.
 *
 *   yarn exec tsx scripts/strong-prototype/server.ts [--port 4321]
 *     [--before outputs/strong-autonomous/v4] [--after outputs/strong-autonomous/v6]
    [--before-label "moteur A–G"] [--after-label "moteur A–L"]
 *     [--concordance <compare-view.json>,...]  (one view per Bible and engine)
 */
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { uncertainDisplayAnchor } from "../../src/strongResolution.js";
import { tokenizeText } from "../../src/tokenize.js";

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const PORT = Number(flag("--port", "4321"));
const RUNS = {
  before: flag("--before", "outputs/strong-autonomous/v4"),
  after: flag("--after", "outputs/strong-autonomous/v6")
} as const;
const RUN_LABELS = {
  before: flag("--before-label", "moteur A–G"),
  after: flag("--after-label", "moteur A–L")
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
  anchor?: {
    insertAfterWordIndex: number;
    absenceEstablished: boolean;
    method?: string;
  };
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
  const order = new Map(decisions.map((d, index) => [d.sourceUnitId, index]));
  const placed = carriers.flatMap((c) => {
    const index = order.get(c.unit ?? "");
    return index === undefined
      ? []
      : [{ order: index, startWordIndex: c.start, endWordIndex: c.end }];
  });
  const carried = new Set(carriers.map((c) => c.unit));
  const units = Object.fromEntries(
    decisions.map((d, index) => [
      d.sourceUnitId,
      {
        order: index,
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
    // An uncertain source word is shown among its neighbours, without any claim
    // that it is untranslated; one already shown on a word is not drawn again.
    uncertain: decisions.flatMap((d, index) => {
      if (d.state !== "unresolved" || carried.has(d.sourceUnitId)) return [];
      const shown = uncertainDisplayAnchor({
        order: index,
        anchor: d.anchor,
        placed
      });
      return [
        {
          after: shown.insertAfterWordIndex,
          basis: shown.basis,
          strong: d.strong.join(" "),
          unit: d.sourceUnitId
        }
      ];
    })
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
        runs: RUN_LABELS,
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

const COMPARISON_DIR = "outputs/strong-concordance-night/comparison";
const COMPARISONS = flag(
  "--concordance",
  ["SG21", "NEG"]
    .flatMap((edition) =>
      ["ABCDEFGHIJKLMNOPQRS", "ABCDEFGHIJKL", "ABCDEFGHIJ", "ABCDEFG"].map(
        (policy) =>
          `${COMPARISON_DIR}/${edition}__target-excluded__comparison__policy-${policy}.json`
      )
    )
    .join(",")
).split(",");
/** `…__policy-ABCDEFGHIJ` is engine « A–J ». */
const engineOf = (runId: string) => {
  const letters = /__policy-([A-Z]+)$/u.exec(runId)?.[1];
  return letters ? `A–${letters.at(-1)}` : "initial";
};
const EDITION_LABELS: Record<string, string> = {
  SG21: "Segond 21",
  NEG: "Nouvelle Édition de Genève 1979"
};

/** Outcomes of one source word, grouped as the page shows them. */
const OUTCOME_GROUPS: Record<string, string> = {
  "visible-exact": "same",
  "empty-anchor-exact": "same",
  "visible-overlap": "span",
  "visible-wrong-carrier": "other-word",
  "visible-swapped-occurrence": "other-word",
  "empty-anchor-different": "other-word",
  "gold-visible-pred-unresolved": "ours-uncertain",
  "gold-empty-pred-unresolved": "ours-uncertain",
  "gold-visible-pred-empty": "ours-untranslated",
  "gold-empty-pred-visible": "theirs-untranslated",
  "source-strong-differs": "strong-differs",
  "gold-occurrence-without-source-unit": "strong-differs",
  "gold-silent-pred-visible": "ours-only",
  "gold-silent-pred-empty": "ours-only",
  "gold-silent-pred-unresolved": "uncertain-silent"
};

interface CompareView {
  runId: string;
  edition: string;
  chapters: Record<
    string,
    Array<{ comparability: string; outcomes: Array<{ outcome: string }> }>
  >;
}

/** Views by `<edition>|<engine>`, in the order given (latest engine first). */
const views = new Map<string, CompareView>();
function comparisonViews(): Map<string, CompareView> {
  if (views.size) return views;
  for (const file of COMPARISONS)
    if (existsSync(file)) {
      const view = JSON.parse(readFileSync(file, "utf8")) as CompareView;
      views.set(`${view.edition}|${engineOf(view.runId)}`, view);
    }
  return views;
}

function tally(
  verses: Array<{ comparability: string; outcomes: Array<{ outcome: string }> }>
) {
  const groups: Record<string, number> = {};
  let compared = 0;
  for (const verse of verses) {
    if (verse.outcomes.length) compared += 1;
    for (const { outcome } of verse.outcomes) {
      const group = OUTCOME_GROUPS[outcome] ?? "other";
      groups[group] = (groups[group] ?? 0) + 1;
    }
  }
  return { verses: verses.length, compared, groups };
}

function concordanceCatalog() {
  return [...comparisonViews().values()].map((view) => {
    const books = new Map<string, number[]>();
    const byBook = new Map<string, CompareView["chapters"][string]>();
    for (const [chapter, verses] of Object.entries(view.chapters)) {
      const [book, number] = chapter.split(".");
      books.set(book!, [...(books.get(book!) ?? []), Number(number)]);
      byBook.set(book!, [...(byBook.get(book!) ?? []), ...verses]);
    }
    return {
      id: view.edition,
      engine: engineOf(view.runId),
      label: EDITION_LABELS[view.edition] ?? view.edition,
      runId: view.runId,
      books: [...books].map(([book, chapters]) => ({
        book,
        chapters: chapters.sort((a, b) => a - b),
        tally: tally(byBook.get(book)!)
      })),
      tally: tally(Object.values(view.chapters).flat())
    };
  });
}

const here = path.dirname(fileURLToPath(import.meta.url));
const page = path.join(here, "index.html");
const PAGES: Record<string, [string, string]> = {
  "/": [page, "text/html; charset=utf-8"],
  "/concordance": [
    path.join(here, "concordance.html"),
    "text/html; charset=utf-8"
  ],
  "/style.css": [path.join(here, "style.css"), "text/css; charset=utf-8"]
};

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
      const known = PAGES[url.pathname];
      if (known) {
        response.writeHead(200, { "content-type": known[1] });
        response.end(readFileSync(known[0]));
      } else if (url.pathname === "/api/catalog") json(catalog());
      else if (url.pathname === "/api/concordance/catalog")
        json(concordanceCatalog());
      else if (url.pathname === "/api/concordance/chapter") {
        const view = comparisonViews().get(
          `${url.searchParams.get("edition") ?? "SG21"}|${url.searchParams.get("engine") ?? "A–S"}`
        );
        const verses = view?.chapters[url.searchParams.get("chapter") ?? ""];
        if (!verses) json({ error: "not-in-comparison-sample" }, 404);
        else json({ verses, tally: tally(verses) });
      } else if (url.pathname === "/api/chapter")
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
