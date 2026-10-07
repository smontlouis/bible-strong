/** Evaluation only: compare immutable reader exports with public annotations. */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BOOK_IDS } from "../../src/books.js";
import { extractGoldCarrierPlacements } from "../../src/strongCarriers.js";
import { stripTags } from "../../src/tokenize.js";
import {
  carrierKey,
  goldVerse,
  indices,
  sha,
  words,
  type GoldVerse,
  type Placement,
  type RawVerse
} from "../strong-concordance-night/contract.js";
import { matching, metric } from "../strong-concordance-night/score.js";

const [experimentArgument, outputArgument] = process.argv.slice(2);
assert(
  experimentArgument && outputArgument,
  "Usage: compare-reader.ts <experiment-root> <output-root>"
);
const experiment = path.resolve(experimentArgument);
const output = path.resolve(outputArgument);
const delivery = JSON.parse(
  await readFile(path.join(experiment, "delivery-manifest.json"), "utf8")
);
const prepared = JSON.parse(
  await readFile(path.join(experiment, "prepared-inputs.json"), "utf8")
);
const frozen: Array<{ edition: string; path: string; sha256: string }> =
  JSON.parse(await readFile(path.join(output, "frozen-readers.json"), "utf8"));
const normalize = (s: string) =>
  s.normalize("NFC").replaceAll("’", "'").toLowerCase();
const sameStrong = (a: Placement, b: Placement) => a.strong === b.strong;
const isVisible = (p: Placement) => p.kind !== "empty";
const exact = (a: Placement, b: Placement) => carrierKey(a) === carrierKey(b);
const overlap = (a: Placement, b: Placement) =>
  sameStrong(a, b) &&
  (isVisible(a) && isVisible(b)
    ? indices(a).some((index) => indices(b).includes(index))
    : exact(a, b));

function compare(p: Placement[], g: Placement[]) {
  const measure = (left: Placement[], right: Placement[], rule: typeof exact) =>
    metric(left.length, right.length, matching(left, right, rule).length);
  const metrics = {
    exact: measure(p, g, exact),
    overlap: measure(p, g, overlap),
    inventory: measure(p, g, sameStrong),
    visibleExact: measure(p.filter(isVisible), g.filter(isVisible), exact),
    emptyAnchor: measure(
      p.filter((x) => !isVisible(x)),
      g.filter((x) => !isVisible(x)),
      exact
    ),
    emptyClassification: measure(
      p.filter((x) => !isVisible(x)),
      g.filter((x) => !isVisible(x)),
      sameStrong
    )
  };
  let left = [...p],
    right = [...g];
  const counts: Record<string, number> = {};
  // A reproducible surface classification, not a semantic verdict. Exact matches
  // are protected before repeated occurrences are paired by weaker criteria.
  const rules: Array<[string, typeof exact]> = [
    ["exact", exact],
    ["expression-boundary", overlap],
    [
      "other-carrier-or-repeated-occurrence",
      (a, b) => sameStrong(a, b) && isVisible(a) && isVisible(b)
    ],
    [
      "empty-anchor",
      (a, b) => sameStrong(a, b) && !isVisible(a) && !isVisible(b)
    ],
    ["visible-versus-empty", sameStrong]
  ];
  for (const [name, rule] of rules) {
    const pairs = matching(left, right, rule);
    counts[name] = pairs.length;
    const usedLeft = new Set(pairs.map((pair) => pair.predicted));
    const usedRight = new Set(pairs.map((pair) => pair.gold));
    left = left.filter((_, index) => !usedLeft.has(index));
    right = right.filter((_, index) => !usedRight.has(index));
  }
  counts["reference-not-displayed"] = right.length;
  counts["display-not-in-reference"] = left.length;
  assert.equal(
    g.length,
    Object.entries(counts)
      .filter(([name]) => name !== "display-not-in-reference")
      .reduce((sum, [, count]) => sum + count, 0)
  );
  return { metrics, counts };
}

type ReaderComparisonRow = ReturnType<typeof compare> & {
  ref: string;
  testament: "AT" | "NT";
  text: string;
  disagreements: Array<Placement & { surface: string }>;
  unmatchedReference: Array<Placement & { surface: string }>;
};

const editions = [];
for (const [edition, external] of [
  ["s21", "SG21"],
  ["neg79", "NEG"]
]) {
  const identity = frozen.find((item) => item.edition === edition);
  assert(identity, `missing-frozen-reader:${edition}`);
  const bytes = await readFile(identity.path);
  assert.equal(sha(bytes), identity.sha256, "reader-drift");
  assert.equal(identity.sha256, delivery.editions[edition].readerSha256);
  const reader = new Map<string, { version: string; text: string }>(
    bytes
      .toString()
      .trim()
      .split("\n")
      .map((line) => {
        const verse = JSON.parse(line);
        return [verse.ref, verse];
      })
  );
  assert.equal(reader.size, delivery.editions[edition].counts.verses);
  const subsets: Array<{
    name: string;
    gold: GoldVerse[];
    labelSha256: string;
  }> = [];
  for (const split of ["development", "test"]) {
    const relative = `evaluator-only/${external}-${split}.gold.json`;
    const data = await readFile(path.join(experiment, relative));
    assert.equal(sha(data), prepared.files[relative], "reference-drift");
    subsets.push({
      name: split === "test" ? "reserved-201" : "consumed-968",
      gold: JSON.parse(data.toString()),
      labelSha256: sha(data)
    });
  }
  const chapterBytes = await readFile(
    path.join(output, "evaluator-only", `${external}-1John.1.json`)
  );
  const chapter = JSON.parse(chapterBytes.toString()) as { verses: RawVerse[] };
  subsets.push({
    name: "viewer-chapter-1John.1",
    gold: chapter.verses.map((raw) => goldVerse("1John.1", raw)),
    labelSha256: sha(chapterBytes)
  });
  const results = [];
  for (const subset of subsets) {
    const rows: ReaderComparisonRow[] = [];
    const excluded = [];
    for (const gold of subset.gold) {
      const native = reader.get(gold.ref);
      if (!native) {
        excluded.push({ ref: gold.ref, reason: "missing-native-coordinate" });
        continue;
      }
      assert.equal(native.version, `${edition.toUpperCase()}-CANDIDATE`);
      const text = stripTags(native.text);
      const nativeWords = words(text).map((word) => word.text);
      const externalWords = words(gold.text).map((word) => word.text);
      if (
        JSON.stringify(nativeWords.map(normalize)) !==
          JSON.stringify(externalWords.map(normalize)) ||
        gold.diagnostics.length
      ) {
        excluded.push({
          ref: gold.ref,
          reason: gold.diagnostics.length
            ? "reference-parser-diagnostic"
            : "different-token-sequence",
          nativeText: text,
          referenceText: gold.text,
          diagnostics: gold.diagnostics
        });
        continue;
      }
      const p = extractGoldCarrierPlacements(native.text).map(
        (placement, i) => ({ ...placement, id: `reader-${i}` })
      );
      const result = compare(p, gold.placements);
      const matched = matching(p, gold.placements, exact);
      const matchedP = new Set(matched.map((pair) => pair.predicted));
      const matchedG = new Set(matched.map((pair) => pair.gold));
      const describe = (placement: Placement) => ({
        ...placement,
        surface:
          placement.kind === "empty"
            ? "∅"
            : indices(placement)
                .map((i) => nativeWords[i])
                .join(" ")
      });
      rows.push({
        ref: gold.ref,
        testament:
          BOOK_IDS.indexOf(
            gold.ref.split(".")[0] as (typeof BOOK_IDS)[number]
          ) < 39
            ? "AT"
            : "NT",
        text,
        ...result,
        disagreements: p.filter((_, i) => !matchedP.has(i)).map(describe),
        unmatchedReference: gold.placements
          .filter((_, i) => !matchedG.has(i))
          .map(describe)
      });
    }
    const summarize = (items: typeof rows) => {
      const metrics: Record<string, ReturnType<typeof metric>> = {},
        counts: Record<string, number> = {};
      for (const row of items) {
        for (const [name, m] of Object.entries(row.metrics)) {
          const old = metrics[name] ?? metric(0, 0, 0);
          metrics[name] = metric(
            old.predicted + m.predicted,
            old.expected + m.expected,
            old.tp + m.tp
          );
        }
        for (const [name, n] of Object.entries(row.counts))
          counts[name] = (counts[name] ?? 0) + n;
      }
      return {
        verses: items.length,
        fullyMatchingVerses: items.filter(
          (row) => row.metrics.exact.fp === 0 && row.metrics.exact.fn === 0
        ).length,
        metrics,
        counts
      };
    };
    const summary = summarize(rows);
    results.push({
      subset: subset.name,
      examined: subset.gold.length,
      labelSha256: subset.labelSha256,
      summary,
      testament: {
        AT: summarize(rows.filter((row) => row.testament === "AT")),
        NT: summarize(rows.filter((row) => row.testament === "NT"))
      },
      excluded,
      rows
    });
    console.log(
      JSON.stringify({
        edition,
        subset: subset.name,
        examined: subset.gold.length,
        excluded: excluded.length,
        ...summary
      })
    );
  }
  editions.push({
    edition,
    readerSha256: identity.sha256,
    fullBibleCounts: delivery.editions[edition].counts,
    results
  });
}
await mkdir(output, { recursive: true });
await writeFile(
  path.join(output, "comparison.json"),
  `${JSON.stringify(
    {
      status: "reader-export-comparison-not-independent-semantic-validation",
      fullBibleAccuracyClaim: false,
      modelCalls: 0,
      sourceIdentityScored: false,
      normalization:
        "same token sequence; case and typographic apostrophes only",
      editions
    },
    null,
    2
  )}\n`
);
