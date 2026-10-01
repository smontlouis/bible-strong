/** Mechanical disagreement taxonomy and text-only versification diagnostics.
 * Classifications are inspection candidates, not independent semantic labels. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BOOK_IDS } from "../../src/books.js";
import { readStrongCsv } from "../../src/strongCsv.js";
import { stripTags, normalizeWord } from "../../src/tokenize.js";
import { withoutPublisherNotes } from "../../src/strongReaderText.js";
import {
  sha,
  words,
  indices,
  type Placement,
  type Prediction
} from "./contract.js";
import type { scoreVerse } from "./score.js";

const root = path.resolve(
  process.argv[2] ?? "outputs/strong-concordance-night/final-v2"
);
await readFile(path.join(root, "rule-freeze.json"));
const texts = new Map<string, string>();
for (const r of await readStrongCsv("data/strongs/Darby.csv"))
  texts.set(
    `${r.bookId}.${r.chapter}.${r.verse}`,
    stripTags(withoutPublisherNotes(r.text))
  );
const tokens = (text: string) =>
  new Set(
    words(text)
      .map((w) => normalizeWord(w.text))
      .filter((w) => w.length > 3)
  );
function similarity(a: string, b: string) {
  const aa = tokens(a),
    bb = tokens(b);
  return aa.size + bb.size
    ? (2 * [...aa].filter((w) => bb.has(w)).length) / (aa.size + bb.size)
    : 0;
}
const cases = [
  ["SG21", "target-excluded"],
  ["SG21", "family-excluded"],
  ["NEG", "target-excluded"],
  ["NEG", "family-excluded"]
];
interface AuditCase {
  id: string;
  edition: string;
  scenario: string;
  split: string;
  ref: string;
  testament: string;
  category: string;
  targetText: string;
  strong: string;
  expected: Placement & { carrier: string };
  proposed: Array<Placement & { carrier: string }>;
  source: Array<
    Prediction["units"][number]["source"] & {
      id: string;
      state: string;
      reasons: string[];
    }
  >;
  independence: string;
}
const evidence: AuditCase[] = [];
const textAudit = [];
for (const split of ["development", "test"])
  for (const [edition, scenario] of cases) {
    const name = `${edition}-${scenario}-${split}`;
    const prediction: Prediction[] = JSON.parse(
      await readFile(
        path.join(root, "variants", `${name}-combined`, "predictions.json"),
        "utf8"
      )
    );
    const scored: ReturnType<typeof scoreVerse>[] = JSON.parse(
      await readFile(
        path.join(root, "evaluation", `${name}-combined`, "verses.json"),
        "utf8"
      )
    );
    const byRef = new Map(prediction.map((p) => [p.ref, p]));
    for (const row of scored) {
      const p = byRef.get(row.ref)!;
      const [book, chapter, verse] = row.ref.split(".");
      const same = similarity(p.text, texts.get(row.ref) ?? "");
      const nearby = [-2, -1, 1, 2]
        .map((n) => ({
          ref: `${book}.${chapter}.${Number(verse) + n}`,
          score: similarity(
            p.text,
            texts.get(`${book}.${chapter}.${Number(verse) + n}`) ?? ""
          )
        }))
        .sort((a, b) => b.score - a.score);
      if (scenario === "target-excluded")
        textAudit.push({
          edition,
          split,
          ref: row.ref,
          sameRefSimilarity: same,
          bestNearby: nearby[0],
          structuralReviewCandidate:
            same < 0.12 || nearby[0].score > same + 0.25
        });
      for (const expected of row.unmatchedExpected) {
        const proposed = row.unmatchedPredicted.filter(
          (x) => x.strong === expected.strong
        );
        const units = p.units.filter((u) => u.strong.includes(expected.strong));
        let category = "indecidable";
        if (!units.length || units.some((u) => u.source.readingUnresolved))
          category = "variante-source";
        else if (
          proposed.some((x) => x.kind === "empty") &&
          expected.kind === "empty"
        )
          category = "ancrage";
        else if (
          proposed.some(
            (x) => (x.kind === "empty") !== (expected.kind === "empty")
          )
        )
          category = "visible-vide-convention";
        else if (
          proposed.some((x) =>
            indices(x).some((i) => indices(expected).includes(i))
          )
        )
          category = "expression";
        else if (units.length > 1) category = "occurrence-repetee";
        else if (proposed.length) category = "mauvais-porteur";
        else if (same < 0.12) category = "decoupage-ou-reformulation";
        else if (expected.kind === "empty") category = "vide-non-etabli";
        const label = (x: Placement) =>
          x.kind === "empty"
            ? `vide après ${x.insertAfterWordIndex}`
            : indices(x)
                .map((i) => p.words[i])
                .join(" … ");
        evidence.push({
          id: `${name}:${row.ref}:${expected.id}`,
          edition,
          scenario,
          split,
          ref: row.ref,
          testament: BOOK_IDS.indexOf(book as never) < 39 ? "OT" : "NT",
          category,
          targetText: p.text,
          strong: expected.strong,
          expected: { ...expected, carrier: label(expected) },
          proposed: proposed.map((x) => ({ ...x, carrier: label(x) })),
          source: units.map((u) => ({
            id: u.sourceUnitId,
            state: u.state,
            ...u.source,
            reasons: u.reasons
          })),
          independence: "mechanical triage; no independent adjudication"
        });
      }
    }
  }
const strata = new Map<string, typeof evidence>();
for (const e of evidence) {
  const key = `${e.split}:${e.edition}:${e.scenario}:${e.testament}`;
  strata.set(key, [...(strata.get(key) ?? []), e]);
}
const sample = [...strata.values()].flatMap((rows) =>
  [...rows].sort((a, b) => sha(a.id).localeCompare(sha(b.id))).slice(0, 2)
);
await writeFile(
  path.join(root, "disagreements.json"),
  JSON.stringify(evidence) + "\n"
);
await writeFile(
  path.join(root, "audit-sample.json"),
  JSON.stringify(sample, null, 2) + "\n"
);
await writeFile(
  path.join(root, "text-correspondence-audit.json"),
  JSON.stringify(textAudit, null, 2) + "\n"
);
await writeFile(
  path.join(root, "audit-summary.json"),
  JSON.stringify(
    {
      disagreements: evidence.length,
      sampleSize: sample.length,
      stratification:
        "two sha256-smallest disagreements per split × edition × scenario × testament",
      categories: Object.fromEntries(
        [...new Set(evidence.map((e) => e.category))].map((c) => [
          c,
          evidence.filter((e) => e.category === c).length
        ])
      ),
      structuralReviewCandidates: textAudit.filter(
        (a) => a.structuralReviewCandidate
      )
    },
    null,
    2
  ) + "\n"
);
console.log(
  JSON.stringify({
    disagreements: evidence.length,
    sample: sample.length,
    structuralReviewCandidates: textAudit.filter(
      (a) => a.structuralReviewCandidate
    ).length
  })
);
