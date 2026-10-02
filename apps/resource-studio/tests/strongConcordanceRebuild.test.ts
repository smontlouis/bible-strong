import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { promisify } from "node:util";
import {
  countAnnotations,
  concordanceChapterUrl
} from "../scripts/strong-concordance-rebuild/acquire.js";
import {
  parseConcordanceChapter,
  parseSourcePositions,
  verseReadingText
} from "../scripts/strong-concordance-rebuild/concordanceHtml.js";
import {
  alignTokenSequences,
  goldVerseFromConcordance
} from "../scripts/strong-concordance-rebuild/gold.js";
import { sourceWordOfStepRow } from "../scripts/strong-concordance-rebuild/compareView.js";
import {
  SEALED_SPLITS,
  allocateByShare,
  selectChapters,
  selectComparisonChapters,
  splitChapters,
  type ComparisonPlan
} from "../scripts/strong-concordance-rebuild/plan.js";
import { assertNoEvaluatorInput } from "../scripts/strong-concordance-rebuild/predict.js";
import type { PredictedVerse } from "../scripts/strong-concordance-rebuild/predict.js";
import {
  occurrenceRecords,
  stepPositionOfUnit,
  summarizeOccurrences
} from "../scripts/strong-concordance-rebuild/score.js";
import {
  EDITIONS,
  excludedWitnesses
} from "../scripts/strong-concordance-rebuild/shared.js";

// Synthetic markup reproducing the site's structure (invented wording).
const PAGE = `<html><body><main>
<div class="chapter" lang="fr">
<span class="titles style-s">Un titre de section</span>
<p class="style-p">
  <span class="verse"><sup class="numverse" id="v1"><a href="#v1">1</a> </sup><span class="versetxt"><w data-lm="le[a]">L’</w><w data-lm="Eternel[N]" data-pa="2/h3068" data-ns="3068">Eternel</w> <w data-lm="parler[v]" data-pa="1/h1696" data-ns="1696">parla</w> <w data-lm="à[é]" data-pa="3/h0413" data-ns="413">à</w> <w data-lm="le[a]">l’</w><span class="strong-untranslated"> <w data-lm="{fils}[§]" data-pa="4/h1121" data-ns="1121">◎</w> </span><w data-lm="homme[n]" data-pa="5/h0376" data-ns="376">homme</w> <w data-lm="et[ç]">et</w> <w data-lm="petit[j]" data-loc="petit_enfant[L]" data-pa="6/h1121+7/h1121" data-ns="1121, 1121">petits-enfants</w><w data-lm="dire[v]" data-pa="8/h0559" data-ns="559">,</w> <w data-lm="eux[q]" data-pa="9/h0000" data-ns="">eux</w> <w data-lm="gros[j]" data-loc="gros_bétail[L]" data-pa="10/h1241" data-ns="1241">gros</w> <w data-lm="bétail[n]" data-loc="gros_bétail[L]" data-pa="10/h1241" data-ns="1241">bétail</w>.</span></span>
</p>
<p class="style-q">
  <span class="verse"><sup class="numverse" id="v2"><a href="#v2">2</a> </sup><span class="versetxt"><span class="strong-untranslated"> <w data-lm="{que}[§]" data-pa="1/h3588" data-ns="3588">◎</w> </span><w data-lm="toi[q]" data-pa="2/h0859" data-ns="859">Toi</w>,</span></span>
</p>
<p class="style-q">
<w data-lm="voir[v]" data-pa="3/h7200" data-ns="7200">vois</w><a class="note" href="#" data-bs-content="&lt;em&gt;litt. : &lt;/em&gt;regarde">a</a> !</span>
</p>
</div>
<div class="clearfix"></div>
<div class="alert alert-light my-3 pb-1" role="alert"><p>Attribution.</p></div>
</main></body></html>`;

describe("Concordance chapter parsing", () => {
  it("separates verses, headings, markers and continued poetic lines", () => {
    const chapter = parseConcordanceChapter(PAGE, "OT");
    assert.deepEqual(chapter.issues, []);
    assert.deepEqual(chapter.headings, ["Un titre de section"]);
    assert.equal(chapter.attribution, "Attribution.");
    assert.deepEqual(
      chapter.verses.map((verse) => verse.verse),
      [1, 2]
    );
    const first = verseReadingText(chapter.verses[0]!);
    assert.equal(
      first.text,
      "L’Eternel parla à l’homme et petits-enfants, eux gros bétail."
    );
    const second = verseReadingText(chapter.verses[1]!);
    assert.equal(second.text, "Toi, vois !");
    assert.deepEqual(chapter.verses[1]!.notes, ["litt. : regarde"]);
  });

  it("reads positions, unnumbered words and multi-position words", () => {
    assert.deepEqual(parseSourcePositions("6/h1121+7/h1121"), [
      { position: 6, strong: "H1121", raw: "6/h1121" },
      { position: 7, strong: "H1121", raw: "7/h1121" }
    ]);
    assert.deepEqual(parseSourcePositions("9/h0000"), [
      { position: 9, strong: null, raw: "9/h0000" }
    ]);
    assert.deepEqual(parseSourcePositions("4/g0846"), [
      { position: 4, strong: "G0846", raw: "4/g0846" }
    ]);
  });

  it("counts delivered annotations before accepting a page", () => {
    const counts = countAnnotations(PAGE);
    assert.equal(counts.verses, 2);
    assert.equal(counts.untranslatedMarkers, 2);
    assert.ok(counts.wordsWithStrong >= 10);
    assert.equal(counts.wordsWithSourcePosition, counts.wordsWithStrong + 1);
  });

  it("builds only robots-compatible chapter URLs", () => {
    assert.equal(
      concordanceChapterUrl("SG21", "1Sam.28"),
      "https://concordance.bible/SG21/1Sam/28/"
    );
    assert.throws(() => concordanceChapterUrl("SG21?x=1", "Gen.1"));
    assert.throws(() => concordanceChapterUrl("SG21", "Gen"));
  });
});

describe("reference occurrences on the local text", () => {
  const chapter = parseConcordanceChapter(PAGE, "OT");
  const local = "L'Eternel parla à l'homme et petits-enfants, eux gros bétail.";

  it("maps carriers, locutions, empties and punctuation onto local tokens", () => {
    const gold = goldVerseFromConcordance({
      ref: "Gen.1.1",
      verse: chapter.verses[0],
      localText: local
    });
    // Apostrophe style alone is not a text difference.
    assert.equal(gold.comparability, "identical-text");
    assert.equal(
      goldVerseFromConcordance({
        ref: "Gen.1.1",
        verse: chapter.verses[0],
        localText: local.replace("Eternel", "Éternel")
      }).comparability,
      "typographic-variants-only"
    );
    const byKey = new Map(
      gold.occurrences.map((occurrence) => [occurrence.key, occurrence])
    );
    assert.deepEqual(byKey.get("2:H3068")?.tokenIndices, [0]);
    // ◎ inside « l’◎homme »: anchored after « à ».
    assert.equal(byKey.get("4:H1121")?.kind, "empty");
    assert.equal(byKey.get("4:H1121")?.insertAfterWordIndex, 2);
    // One French word for two source positions keeps both occurrences.
    assert.deepEqual(byKey.get("6:H1121")?.tokenIndices, [5]);
    assert.deepEqual(byKey.get("7:H1121")?.tokenIndices, [5]);
    assert.equal(byKey.get("6:H1121")?.sharedWordWithOtherPositions, true);
    // A Strong shown on punctuation is an empty anchored after the previous word.
    assert.equal(byKey.get("8:H0559")?.kind, "empty");
    assert.equal(byKey.get("8:H0559")?.punctuationCarrier, true);
    assert.equal(byKey.get("8:H0559")?.insertAfterWordIndex, 5);
    // Locution: one occurrence carried by two words.
    assert.equal(byKey.get("10:H1241")?.kind, "phrase");
    assert.deepEqual(byKey.get("10:H1241")?.tokenIndices, [7, 8]);
    assert.deepEqual(gold.unnumberedPositions, [9]);
  });

  it("anchors a verse-initial empty before the first word", () => {
    const gold = goldVerseFromConcordance({
      ref: "Gen.1.2",
      verse: chapter.verses[1],
      localText: "Toi, vois!"
    });
    const empty = gold.occurrences.find(
      (occurrence) => occurrence.key === "1:H3588"
    );
    assert.equal(empty?.insertAfterWordIndex, -1);
  });

  it("keeps a divergent text comparable only where words align", () => {
    const gold = goldVerseFromConcordance({
      ref: "Gen.1.1",
      verse: chapter.verses[0],
      localText: "L'Eternel parla à l'homme, eux gros bétail."
    });
    assert.equal(gold.comparability, "text-divergent-unmapped");
    assert.ok(
      gold.issues.some((issue) => issue.startsWith("unmapped-carrier:6:H1121"))
    );
    assert.deepEqual(alignTokenSequences(["a", "b", "c"], ["a", "c"]), [
      0,
      null,
      1
    ]);
  });
});

describe("experimental design", () => {
  const inventory = [
    "Gen",
    "Exod",
    "Lev",
    "Ps",
    "Prov",
    "Matt",
    "Mark",
    "Rom"
  ].flatMap((bookId) =>
    Array.from({ length: 12 }, (_, index) => ({
      chapter: `${bookId}.${index + 1}`,
      bookId,
      verses: 20
    }))
  );
  const counts = {
    law: { development: 2, test: 2 },
    "poetry-wisdom": { development: 1, test: 1 },
    "gospels-acts": { development: 1, test: 1 },
    pauline: { development: 1, test: 1 }
  };

  it("draws a deterministic split with fresh test chapters only", () => {
    const prior = new Set(["Gen.1", "Gen.2", "Exod.3", "Ps.4"]);
    const first = selectChapters({
      inventory,
      prior,
      consulted: ["Matt.5"],
      forcedDevelopment: ["Matt.5"],
      seed: "seed",
      counts
    });
    const second = selectChapters({
      inventory,
      prior,
      consulted: ["Matt.5"],
      forcedDevelopment: ["Matt.5"],
      seed: "seed",
      counts
    });
    assert.deepEqual(first, second);
    assert.ok(first.test.every((entry) => entry.fresh));
    assert.ok(
      first.test.every(
        (entry) => !prior.has(entry.chapter) && entry.chapter !== "Matt.5"
      )
    );
    assert.ok(first.development.some((entry) => entry.chapter === "Matt.5"));
    const testSet = new Set(first.test.map((entry) => entry.chapter));
    assert.ok(first.development.every((entry) => !testSet.has(entry.chapter)));
    assert.equal(first.test.length, 5);
  });

  it("withholds the target, Darby sisters and, in scenario two, the family", () => {
    assert.deepEqual(excludedWitnesses(EDITIONS.SG21, "target-excluded"), []);
    assert.deepEqual(excludedWitnesses(EDITIONS.SG21, "family-excluded"), [
      "Sg1910"
    ]);
    assert.deepEqual(excludedWitnesses(EDITIONS.Sg1910, "target-excluded"), [
      "Sg1910"
    ]);
    assert.deepEqual(excludedWitnesses(EDITIONS.Darby, "target-excluded"), [
      "Darby",
      "DarbyR"
    ]);
    assert.deepEqual(excludedWitnesses(EDITIONS.DarbyR, "target-excluded"), [
      "Darby",
      "DarbyR"
    ]);
  });

  it("refuses evaluator inputs in the prediction step", () => {
    assert.throws(() =>
      assertNoEvaluatorInput([
        "outputs/strong-concordance-night/acquisition/raw/SG21/Gen.1.html"
      ])
    );
    assert.throws(() =>
      assertNoEvaluatorInput([
        "outputs/strong-concordance-night/evaluator-only/x.json"
      ])
    );
    assert.doesNotThrow(() =>
      assertNoEvaluatorInput(["data/bibles/bible-s21.json"])
    );
  });

  it("keeps evaluator modules out of the prediction import graph", async () => {
    const root = "scripts/strong-concordance-rebuild";
    const seen = new Set<string>();
    const visit = async (file: string): Promise<void> => {
      if (seen.has(file)) return;
      seen.add(file);
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(/from "(\.[^"]+)\.js"/gu)) {
        const target = path.join(path.dirname(file), `${match[1]}.ts`);
        if (target.startsWith(root)) await visit(target);
      }
    };
    await visit(path.join(root, "predict.ts"));
    const forbidden = [
      "gold.ts",
      "concordanceHtml.ts",
      "acquire.ts",
      "score.ts"
    ];
    for (const file of seen)
      assert.ok(
        !forbidden.includes(path.basename(file)),
        `prediction imports ${file}`
      );
  });
});

describe("occurrence-level scoring", () => {
  const chapter = parseConcordanceChapter(PAGE, "OT");
  const local = "L'Eternel parla à l'homme et petits-enfants, eux gros bétail.";
  const gold = goldVerseFromConcordance({
    ref: "Gen.1.1",
    verse: chapter.verses[0],
    localText: local
  });
  const unit = (position: number) => `TAHOT.Gen.1.1.${position}.L`;
  const decision = (
    position: number,
    strong: string,
    state: "visible" | "empty" | "unresolved",
    targetWordIndices: number[] = [],
    anchor?: number
  ) => ({
    sourceUnitId: unit(position),
    occurrenceIds: [`${unit(position)}.main:0`],
    strong: [strong],
    state,
    assurance: "test",
    targetWordIndices,
    anchor:
      anchor === undefined
        ? undefined
        : {
            insertAfterWordIndex: anchor,
            method: "m",
            assurance: "a",
            absenceEstablished: false
          },
    readingUnresolved: false,
    reasons: []
  });
  const predicted: PredictedVerse = {
    ref: "Gen.1.1",
    canonicalRefs: ["Gen.1.1"],
    correspondence: "identity",
    text: local,
    tokens: [],
    carriers: [],
    resolutionIssues: [],
    decisions: [
      decision(1, "H1696", "visible", [1]),
      decision(2, "H3068", "unresolved", [], 0),
      decision(3, "H0413", "visible", [3]),
      decision(4, "H1121", "visible", [5]),
      decision(6, "H1121", "visible", [4]),
      decision(7, "H1121", "unresolved", [], 5),
      decision(8, "H0559", "empty", [], 5),
      decision(10, "H1241", "visible", [8]),
      decision(11, "H0853", "empty", [], 6)
    ]
  };

  it("classifies exact, swapped, wrong, empty and silent occurrences", () => {
    assert.deepEqual(stepPositionOfUnit("TAGNT.1John.3.16.12.NKO"), {
      ref: "1John.3.16",
      position: 12
    });
    const records = occurrenceRecords(
      { ref: "Gen.1.1", nativeRef: "Gen.1.1", gold },
      predicted
    );
    const outcome = (position: number) =>
      records.find((record) => record.position === position)?.outcome;
    assert.equal(outcome(1), "visible-exact");
    assert.equal(outcome(2), "gold-visible-pred-unresolved");
    assert.equal(outcome(3), "visible-wrong-carrier");
    assert.equal(outcome(4), "gold-empty-pred-visible");
    assert.equal(outcome(6), "visible-wrong-carrier");
    assert.equal(outcome(7), "gold-visible-pred-unresolved");
    assert.equal(outcome(8), "empty-anchor-exact");
    assert.equal(outcome(10), "visible-overlap");
    assert.equal(outcome(11), "gold-silent-pred-empty");
    const summary = summarizeOccurrences(records);
    assert.equal(summary.outcomes["visible-exact"], 1);
    assert.equal(summary.emptyAnchorExactRate, 1);
  });

  it("matches a renumbered source word only when its Strong is unique", () => {
    // Position 10 (H1241) is numbered 30 on the STEP side: unique on both
    // sides, so it is the same source word despite the distance.
    const shifted: PredictedVerse = {
      ...predicted,
      decisions: predicted.decisions.map((decision) =>
        decision.strong[0] === "H1241"
          ? {
              ...decision,
              sourceUnitId: unit(30),
              occurrenceIds: [`${unit(30)}.main:0`]
            }
          : decision
      )
    };
    const records = occurrenceRecords(
      { ref: "Gen.1.1", nativeRef: "Gen.1.1", gold },
      shifted
    );
    const record = records.find((candidate) => candidate.position === 10);
    assert.equal(record?.outcome, "visible-overlap");
    assert.ok(record?.difficulty.includes("source-position-shift"));
    assert.ok(!records.some((candidate) => candidate.position === 30));
  });
});

describe("comparison sample and sealed reserve", () => {
  const inventory = [
    "Gen",
    "Exod",
    "Lev",
    "Ps",
    "Prov",
    "Matt",
    "Mark",
    "Rom"
  ].flatMap((bookId) =>
    Array.from({ length: 12 }, (_, index) => ({
      chapter: `${bookId}.${index + 1}`,
      bookId,
      verses: 20
    }))
  );

  it("splits a total in proportion, largest remainder first", () => {
    assert.deepEqual(allocateByShare(10, { a: 1, b: 1, c: 1 }), {
      a: 4,
      b: 3,
      c: 3
    });
    assert.deepEqual(allocateByShare(5, { law: 187, minor: 67 }), {
      law: 4,
      minor: 1
    });
    assert.deepEqual(allocateByShare(0, { a: 1 }), { a: 0 });
  });

  it("draws a disjoint, deterministic reserve and sample from fresh chapters", () => {
    const excluded = new Set(["Gen.1", "Ps.2"]);
    const prior = new Set(["Gen.2", "Matt.3"]);
    const options = {
      inventory,
      excluded,
      prior,
      seed: "seed",
      reserve: 8,
      comparison: 16
    };
    const first = selectComparisonChapters(options);
    assert.deepEqual(selectComparisonChapters(options), first);
    assert.equal(first.reserve.length, 8);
    assert.equal(first.comparison.length, 16);
    const reserved = new Set(first.reserve.map((entry) => entry.chapter));
    assert.ok(first.comparison.every((entry) => !reserved.has(entry.chapter)));
    for (const entry of [...first.reserve, ...first.comparison])
      assert.ok(!excluded.has(entry.chapter) && !prior.has(entry.chapter));
    // The law holds 36 of the 96 chapters: 3 of 8 reserved, 6 of 16 compared.
    assert.equal(
      first.reserve.filter((entry) => entry.genre === "law").length,
      3
    );
    assert.equal(
      first.comparison.filter((entry) => entry.genre === "law").length,
      6
    );
    assert.equal(first.pool.law, 34);
    assert.throws(
      () =>
        selectComparisonChapters({ ...options, reserve: 60, comparison: 60 }),
      /not-enough-chapters:law/u
    );
    // Once fresh chapters run out, earlier benchmark chapters may be admitted.
    const wider = selectComparisonChapters({
      ...options,
      allowPrior: true,
      excluded: new Set([
        ...excluded,
        ...first.reserve.map((entry) => entry.chapter),
        ...first.comparison.map((entry) => entry.chapter)
      ])
    });
    // 36 law chapters, minus Gen.1 and the 9 already drawn; Gen.2 is back.
    assert.equal(wider.pool.law, 26);
    assert.ok(
      wider.reserve.every((entry) => entry.fresh === !prior.has(entry.chapter))
    );
  });

  it("names plan splits and keeps the test and the reserve behind a freeze", () => {
    assert.ok(SEALED_SPLITS.has("test") && SEALED_SPLITS.has("reserve"));
    assert.ok(!SEALED_SPLITS.has("comparison"));
    const plan = {
      comparison: [{ chapter: "Gen.3" }],
      reserve: [{ chapter: "Gen.4" }]
    } as unknown as ComparisonPlan;
    assert.deepEqual(splitChapters(plan, "comparison"), ["Gen.3"]);
    assert.throws(() => splitChapters(plan, "development"), /unknown-split/u);
    assert.throws(() => splitChapters(plan, "seed"), /unknown-split/u);
  });

  it("refuses to acquire the reserve without a freeze", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "comparison-plan-"));
    const planPath = path.join(dir, "plan.json");
    await writeFile(
      planPath,
      JSON.stringify({ comparison: [], reserve: [{ chapter: "Gen.4" }] })
    );
    await assert.rejects(
      promisify(execFile)(process.execPath, [
        "--import",
        "tsx",
        "scripts/strong-concordance-rebuild/run.ts",
        "acquire",
        "--plan",
        planPath,
        "--editions",
        "SG21",
        "--splits",
        "reserve"
      ]),
      (error: { stderr?: string }) =>
        /reserve-split-requires-freeze/u.test(error.stderr ?? "")
    );
  });

  it("reads a STEP source word as the reader sees it", () => {
    const hebrew = "וְ/הַ/נָּחָשׁ";
    assert.deepEqual(
      sourceWordOfStepRow(
        `Gen.3.1#01=L | ${hebrew} | ve./ha./na.Chash | and/ the/ snake | H9002/H9009/{H5175} | HC/Td/Ncmsa`
      ),
      {
        surface: hebrew.replace(/\//gu, ""),
        gloss: "and/ the/ snake",
        morphology: "HC/Td/Ncmsa"
      }
    );
    assert.deepEqual(
      sourceWordOfStepRow(
        "Mat.1.1#01=NKO | Βίβλος (Biblos) | [The] book | G0976=N-NSF | βίβλος=book | NA28+NA27"
      ),
      { surface: "Βίβλος", gloss: "[The] book", morphology: "N-NSF" }
    );
  });
});
