import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { contentFingerprint } from "../../src/contentAddressedCache.js";
import { BOOK_IDS } from "../../src/books.js";
import { getOriginalStrongOccurrences } from "../../src/completeAlignment.js";
import {
  excludedReferenceNamesForGold,
  extractGoldCarrierPlacements
} from "../../src/evaluateStrongGold.js";
import { buildStrongVerseMap, readStrongCsv } from "../../src/strongCsv.js";
import {
  readStepOriginalVerseMap,
  selectStepOriginalTokensForRefs
} from "../../src/stepOriginals.js";
import {
  generateStrongLedgerWithDictionary,
  renderStrongTaggedText,
  type StrongLedger,
  type StrongLedgerAnnotation
} from "../../src/strongLedger.js";
import { stripTags, tokenizeText } from "../../src/tokenize.js";
import {
  resolveDossier,
  dossierKey,
  reviewKey,
  type ResolutionDossier,
  type ResolutionReview
} from "../../src/strongResolutionWorkflow.js";
import {
  sha,
  GOLDS,
  carrierKey,
  type EvalVerse,
  type BaselineVerse
} from "../strong-alignment-benchmark/shared.js";
import { withoutPublisherNotes } from "../strong-arbitration-benchmark/reader-text.js";
import { placementOf } from "../strong-decision-benchmark/prepare.js";
import {
  makeUnits,
  parseSourceRow,
  type SourceRow,
  type SourceUnit
} from "../strong-occurrence-prototype/model.js";
import { buildResolutionReviewHtml } from "./viewer.js";

interface CorpusPlan {
  sources: Array<{ file: string; sha256: string }>;
  manifests: Array<{ gold: string; goldSha256: string }>;
  dictionaryPath: string;
  dictionarySha256: string;
  reserveRefs: string[];
  evalRefs: string[];
}
interface FrozenPolicy {
  applyExactWitness: boolean;
  code: Record<string, string>;
  inputs: Record<string, string>;
  lexicalFingerprint: string;
}
interface PacketManifest {
  inputs: Record<string, string>;
  dossierSha256: string;
  freeze?: FrozenPolicy;
}
interface PredictionManifest {
  code: Record<string, string>;
  predictionsSha256: string;
  reviewSha256: string | null;
}
interface EvaluationSummary {
  split: string;
  options: { applyExactWitness: boolean };
  scores: {
    proposals: { total: number; exact: number };
    baseline: { fp: number };
    projected: { fp: number };
    lostCorrect: number;
  };
}
const archive = "outputs/strong-arbitration-benchmark/v2-reader-text";
const modelRoot = "outputs/strong-occurrence-prototype/v1-verified";
const planPath = "outputs/strong-alignment-benchmark/v2-reader-text/plan.json";
const [command, input, output, ...flags] = process.argv.slice(2);
const json = async <T>(file: string): Promise<T> =>
  JSON.parse(await readFile(file, "utf8"));
const write = async (file: string, data: unknown) =>
  writeFile(file, JSON.stringify(data, null, 2) + "\n", { flag: "wx" });
async function fresh(dir: string) {
  await mkdir(path.dirname(dir), { recursive: true });
  await mkdir(dir);
}
const codeFiles = [
  ...(await readdir("src", { recursive: true }))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join("src", f)),
  "src/strongResolution.ts",
  "src/strongResolutionWorkflow.ts",
  "src/strongLedger.ts",
  "src/readerAlignment.ts",
  "src/completeAlignment.ts",
  "src/tokenize.ts",
  "scripts/strong-resolution-workflow/run.ts",
  "scripts/strong-resolution-workflow/viewer.ts",
  "scripts/strong-occurrence-prototype/model.ts",
  "scripts/strong-arbitration-benchmark/reader-text.ts"
];
const lexicalFingerprint = () =>
  contentFingerprint({
    namespace: "resolution-frozen-lexical-v1",
    inputPaths: [
      "data/external/french-lexical/kaikki",
      "data/external/french-lexical/rezojdm-cache",
      "data/external/french-lexical/openoffice/synonymes/handler/dictionary.go",
      "data/external/french-lexical/wolf/wolf-1.0b4.xml.bz2"
    ]
  });
async function hashes(files: string[]) {
  return Object.fromEntries(
    await Promise.all(files.map(async (f) => [f, sha(await readFile(f))]))
  );
}
async function verify(values: Record<string, string>) {
  for (const [file, hash] of Object.entries(values))
    assert.equal(sha(await readFile(file)), hash, `frozen-input-drift:${file}`);
}
async function sources() {
  const plan = await json<CorpusPlan>(planPath);
  const inputs = Object.fromEntries(
    plan.sources.map((s: { file: string; sha256: string }) => [
      s.file,
      s.sha256
    ])
  );
  for (const g of GOLDS)
    inputs[`data/strongs/${g}.csv`] = plan.manifests.find(
      (m: { gold: string }) => m.gold === g
    )!.goldSha256;
  inputs[plan.dictionaryPath] = plan.dictionarySha256;
  await verify(inputs);
  return { plan, inputs: { ...inputs, ...(await hashes([planPath])) } };
}
async function witnessMaps() {
  return new Map(
    await Promise.all(
      GOLDS.map(
        async (g) =>
          [
            g,
            buildStrongVerseMap(await readStrongCsv(`data/strongs/${g}.csv`))
          ] as const
      )
    )
  );
}
function dossier(
  edition: string,
  verse: EvalVerse,
  baseline: BaselineVerse,
  units: SourceUnit[],
  maps: Awaited<ReturnType<typeof witnessMaps>>,
  split: ResolutionDossier["split"]
): ResolutionDossier {
  const excluded = GOLDS.includes(edition as (typeof GOLDS)[number])
    ? excludedReferenceNamesForGold(edition as (typeof GOLDS)[number], false)
    : [];
  return {
    edition,
    ref: verse.ref,
    split,
    text: verse.text,
    words: verse.words,
    placements: baseline.placements,
    units: units.map((u) => ({
      unit: {
        id: u.id,
        occurrenceIds: u.occurrenceIds,
        strong: u.logicalStrong,
        readingUnresolved: u.structure === "variant-conditioned",
        sourceEvidenceSha256: sha(JSON.stringify(u.row))
      },
      surface: u.row.surface,
      gloss: u.row.gloss,
      morphology:
        verse.source.find((s) => u.occurrenceIds.includes(s.occurrenceId))
          ?.morph ?? "",
      sourceFile: u.row.file,
      sourceLine: u.row.line
    })),
    witnesses: GOLDS.filter(
      (g) => !excluded.includes(g) && maps.get(g)!.has(verse.ref)
    ).map((g) => {
      const tagged = withoutPublisherNotes(
        maps.get(g)!.get(verse.ref)!.row.text
      );
      const text = stripTags(tagged);
      return {
        name: g,
        family: g === "Sg1910" ? g : "Darby-family",
        text,
        words: tokenizeText(text)
          .filter((t) => t.kind === "word")
          .map((t) => t.text),
        placements: extractGoldCarrierPlacements(tagged).map((p, i) => ({
          ...p,
          id: `${g}:${verse.ref}:${i}`
        }))
      };
    })
  };
}
async function loadSourceUnits(plan: CorpusPlan, refs: string[]) {
  const originals = await readStepOriginalVerseMap(
    plan.sources.map((s: { file: string }) => s.file)
  );
  const sourceFor = (ref: string) => {
    const selected = selectStepOriginalTokensForRefs(originals, [ref], {
      preferAlternateRef: true
    });
    const [bookId, c, v] = ref.split(".");
    return getOriginalStrongOccurrences({
      bookId,
      chapter: +c,
      verse: +v,
      tokens: selected.tokens,
      strongSet: selected.strongSet
    });
  };
  const source = new Map(refs.map((r) => [r, sourceFor(r)]));
  const needed = new Set(
    [...source.values()].flatMap((s) => s.map((o) => o.sourceIdentity))
  );
  const sourceRows = new Map<string, SourceRow>();
  for (const s of plan.sources as Array<{ file: string }>) {
    const lines = (await readFile(s.file, "utf8")).split(/\r?\n/u);
    for (const [i, line] of lines.entries()) {
      const row = parseSourceRow(line, s.file, i + 1);
      if (row && needed.has(row.id)) {
        assert(!sourceRows.has(row.id));
        sourceRows.set(row.id, row);
      }
    }
  }
  return { source, sourceRows };
}
async function savePacket(
  root: string,
  dossiers: ResolutionDossier[],
  inputs: Record<string, string>,
  extra = {}
) {
  assert.equal(new Set(dossiers.map(dossierKey)).size, dossiers.length);
  for (const d of dossiers) resolveDossier(d);
  await write(path.join(root, "dossiers.json"), dossiers);
  await write(path.join(root, "manifest.json"), {
    version: 1,
    count: dossiers.length,
    inputs,
    dossierSha256: sha(await readFile(path.join(root, "dossiers.json"))),
    code: await hashes(codeFiles),
    ...extra
  });
  console.log(JSON.stringify({ output: root, dossiers: dossiers.length }));
}

if (command === "prepare-development") {
  const root = input;
  const { plan, inputs } = await sources();
  const archived = await json<{ files: Record<string, string> }>(
    `${archive}/manifest.json`
  );
  const rowsPath = `${archive}/verses.json`;
  assert.equal(sha(await readFile(rowsPath)), archived.files["verses.json"]);
  const rows: Array<{
    gold: (typeof GOLDS)[number];
    verse: EvalVerse;
    baseline: BaselineVerse;
  }> = await json(rowsPath);
  const units: Array<{ ref: string; units: SourceUnit[] }> = await json(
    `${modelRoot}/source-units.json`
  );
  const maps = await witnessMaps();
  assert.equal(rows.length, 720);
  assert(rows.every((r) => !plan.reserveRefs.includes(r.verse.ref)));
  await fresh(root);
  await savePacket(
    root,
    rows.map((r) =>
      dossier(
        r.gold,
        r.verse,
        r.baseline,
        units.find((u) => u.ref === r.verse.ref)!.units,
        maps,
        "development"
      )
    ),
    {
      ...inputs,
      ...(await hashes([rowsPath, `${modelRoot}/source-units.json`]))
    }
  );
} else if (command === "prepare-reserve") {
  const frozen = await json<FrozenPolicy>(input);
  await verify(frozen.code);
  await verify(frozen.inputs);
  assert.equal(
    lexicalFingerprint(),
    frozen.lexicalFingerprint,
    "lexical-input-drift"
  );
  const { plan, inputs } = await sources();
  assert.equal(plan.reserveRefs.length, 100);
  const refs: string[] = plan.reserveRefs;
  assert(refs.every((r) => !plan.evalRefs.includes(r)));
  const maps = await witnessMaps();
  const { source, sourceRows } = await loadSourceUnits(plan, refs);
  await fresh(output);
  const dossiers: ResolutionDossier[] = [];
  for (const edition of GOLDS) {
    const dir = path.join(output, edition);
    await mkdir(dir);
    const verses: EvalVerse[] = refs.map((ref) => {
      const text = stripTags(
        withoutPublisherNotes(maps.get(edition)!.get(ref)!.row.text)
      );
      const words = tokenizeText(text).filter((t) => t.kind === "word");
      const src = source.get(ref)!;
      return {
        ref,
        split: "test",
        text,
        words: words.map((w) => w.text),
        normalized: words.map((w) => w.normalized),
        source: src,
        strong: src.map((s) => s.strong),
        surface: src.map((s) => s.text)
      };
    });
    const bible: Record<string, Record<string, Record<string, string>>> = {};
    for (const v of verses) {
      const [book, c, verse] = v.ref.split(".");
      const n = String(BOOK_IDS.indexOf(book as (typeof BOOK_IDS)[number]) + 1);
      bible[n] ??= {};
      bible[n][c] ??= {};
      bible[n][c][verse] = v.text;
    }
    const biblePath = path.join(dir, "masked-input.json");
    await write(biblePath, bible);
    console.log(
      JSON.stringify({ phase: "baseline", edition, refs: refs.length })
    );
    const excludedReferenceNames = excludedReferenceNamesForGold(
      edition,
      false
    );
    const ledger = await generateStrongLedgerWithDictionary(
      {
        bible: `resolution-reserve-${edition.toLowerCase()}`,
        profileBible: edition === "Sg1910" ? "nbs" : "fmar",
        biblePath,
        outputDir: dir,
        writeArtifacts: false,
        writeLexicalReport: false,
        applyCuratedOverrides: false,
        excludedReferenceNames
      },
      {
        path: plan.dictionaryPath,
        activation: { mode: "legacy", path: plan.dictionaryPath }
      }
    );
    assert(
      ledger.references.every((r) => !excludedReferenceNames.includes(r.name))
    );
    await write(path.join(dir, "baseline-ledger.json"), ledger);
    for (const verse of verses) {
      const v = ledger.verses.find((v) => v.ref === verse.ref)!;
      assert(v);
      assert.deepEqual(
        v.tokens.map((t) => t.text),
        verse.words
      );
      const baseline: BaselineVerse = {
        ref: v.ref,
        original: v.inventories.original,
        items: [],
        placements: v.annotations
          .filter((a) => a.visibility === "reader")
          .map((a) => ({
            ...placementOf(a),
            id: a.id,
            originalOccurrenceId: a.originalOccurrenceId
          }))
      };
      dossiers.push(
        dossier(
          edition,
          verse,
          baseline,
          makeUnits(verse, sourceRows),
          maps,
          "reserve"
        )
      );
    }
  }
  await savePacket(output, dossiers, inputs, {
    freeze: frozen,
    freezeSha256: sha(await readFile(input))
  });
} else if (command === "prepare-ledger") {
  const ledger = await json<StrongLedger>(input);
  assert(
    Array.isArray(ledger.verses) && ledger.verses.length,
    "a-materialized-ledger-with-verses-is-required"
  );
  const { plan, inputs } = await sources();
  const { source, sourceRows } = await loadSourceUnits(
    plan,
    ledger.verses.map((v) => v.ref)
  );
  const maps = await witnessMaps();
  const dossiers = ledger.verses.map((v) => {
    const src = source.get(v.ref)!;
    const verse: EvalVerse = {
      ref: v.ref,
      split: "test",
      text: v.text,
      words: v.tokens.map((t) => t.text),
      normalized: v.tokens.map((t) => t.normalized),
      source: src,
      strong: src.map((s) => s.strong),
      surface: src.map((s) => s.text)
    };
    const baseline: BaselineVerse = {
      ref: v.ref,
      original: v.inventories.original,
      items: [],
      placements: v.annotations
        .filter((a) => a.visibility === "reader")
        .map((a) => ({
          ...placementOf(a),
          id: a.id,
          originalOccurrenceId: a.originalOccurrenceId
        }))
    };
    return dossier(
      ledger.bible,
      verse,
      baseline,
      makeUnits(verse, sourceRows),
      maps,
      "authoring"
    );
  });
  await fresh(output);
  await savePacket(
    output,
    dossiers,
    { ...inputs, ...(await hashes([input])) },
    { origin: "materialized-ledger", ledgerBible: ledger.bible }
  );
} else if (command === "evaluate" || command === "apply") {
  const manifest = await json<PacketManifest>(
    path.join(input, "manifest.json")
  );
  await verify(manifest.inputs);
  const content = await readFile(path.join(input, "dossiers.json"), "utf8");
  assert.equal(sha(content), manifest.dossierSha256);
  const dossiers: ResolutionDossier[] = JSON.parse(content);
  const isReserve = dossiers.some((d) => d.split === "reserve");
  const exact = flags.includes("--exact");
  if (isReserve) {
    assert(manifest.freeze, "reserve-requires-frozen-policy");
    assert(
      !flags.includes("--grammar-fr"),
      "new-rule-requires-a-new-validation-protocol"
    );
    await verify(manifest.freeze.code);
    assert.equal(
      exact,
      manifest.freeze.applyExactWitness,
      "policy-drift-on-reserve"
    );
    assert(
      !flags.includes("--reviews") && !flags.includes("--assisted"),
      "reserve-predictions-must-precede-reviews"
    );
  }
  const reviewPath = flags.includes("--reviews")
    ? flags[flags.indexOf("--reviews") + 1]
    : undefined;
  const reviews: ResolutionReview[] = reviewPath ? await json(reviewPath) : [];
  assert.equal(
    new Set(reviews.map(reviewKey)).size,
    reviews.length,
    "duplicate-review-key"
  );
  assert(
    reviews.every((r) =>
      dossiers.some((d) => d.edition === r.edition && d.ref === r.ref)
    ),
    "review-outside-packet"
  );
  const options = {
    applyExactWitness: exact,
    applyAssistedReviews: flags.includes("--assisted"),
    ...(flags.includes("--grammar-fr")
      ? { applyGrammaticalEmpties: true, targetLanguage: "fr" }
      : {})
  };
  const predictions = dossiers.map((d) =>
    resolveDossier(
      d,
      reviews.filter((r) => r.edition === d.edition && r.ref === d.ref),
      options
    )
  );
  assert.deepEqual(
    predictions,
    dossiers.map((d) =>
      resolveDossier(
        d,
        reviews.filter((r) => r.edition === d.edition && r.ref === d.ref),
        options
      )
    )
  );
  await fresh(output);
  // Seal predictions before opening target labels for scoring.
  await write(path.join(output, "predictions.json"), predictions);
  await write(path.join(output, "prediction-manifest.json"), {
    options,
    packetSha256: sha(content),
    predictionsSha256: sha(
      await readFile(path.join(output, "predictions.json"))
    ),
    code: await hashes(codeFiles),
    reviewSha256: reviewPath ? sha(await readFile(reviewPath)) : null
  });
  const preview = predictions.map((p) => ({
    edition: p.edition,
    ref: p.ref,
    text: p.text,
    taggedText: renderStrongTaggedText(
      tokenizeText(p.text),
      p.placements.map(
        (a) =>
          ({
            id: a.id,
            strong: a.strong,
            visibility: "reader",
            placement: a.kind,
            source: "original-complete",
            confidence: 0,
            reason:
              "Local resolution preview; assurance is in predictions.json, not a numeric probability.",
            diagnostics: [],
            wordIndex: a.kind === "word" ? a.startWordIndex : undefined,
            startWordIndex: a.startWordIndex,
            endWordIndex: a.endWordIndex,
            insertAfterWordIndex: a.insertAfterWordIndex,
            originalOccurrenceId: a.originalOccurrenceId
          }) satisfies StrongLedgerAnnotation
      ),
      "reader"
    )
  }));
  await write(path.join(output, "generated-preview.json"), preview);
  if (command === "apply") {
    await write(path.join(output, "summary.json"), {
      mode: "local-authoring",
      texts: predictions.length,
      options,
      verses: predictions.map((p) => ({
        edition: p.edition,
        ref: p.ref,
        ...p.summary
      })),
      semanticValidation:
        "Review provenance is retained per occurrence; no claim of independent adjudication."
    });
    await writeFile(
      path.join(output, "review.html"),
      buildResolutionReviewHtml(dossiers, predictions),
      { flag: "wx" }
    );
    console.log(
      JSON.stringify({
        output,
        texts: predictions.length,
        reviews: reviews.length
      })
    );
  } else {
    const maps = await witnessMaps();
    const total = {
      baseline: { tp: 0, fp: 0, fn: 0 },
      projected: { tp: 0, fp: 0, fn: 0 },
      proposals: { total: 0, exact: 0, contradicted: 0, unscorable: 0 },
      lostCorrect: 0
    };
    const audits: unknown[] = [];
    function compare(
      actual: ResolutionDossier["placements"],
      expected: ResolutionDossier["placements"]
    ) {
      const counts = new Map<string, number>();
      for (const p of expected.filter((p) => p.kind !== "empty"))
        counts.set(carrierKey(p), (counts.get(carrierKey(p)) ?? 0) + 1);
      let tp = 0,
        fp = 0;
      for (const p of actual.filter((p) => p.kind !== "empty")) {
        const k = carrierKey(p);
        if ((counts.get(k) ?? 0) > 0) {
          tp++;
          counts.set(k, counts.get(k)! - 1);
        } else fp++;
      }
      return { tp, fp, fn: [...counts.values()].reduce((a, b) => a + b, 0) };
    }
    for (const [i, d] of dossiers.entries()) {
      const expected = extractGoldCarrierPlacements(
        withoutPublisherNotes(
          maps.get(d.edition as (typeof GOLDS)[number])!.get(d.ref)!.row.text
        )
      ).map((p, i) => ({ ...p, id: `gold:${i}` }));
      const prediction = predictions[i];
      for (const [name, placements] of [
        ["baseline", d.placements],
        ["projected", prediction.placements]
      ] as const) {
        const scores = compare(placements, expected);
        for (const key of ["tp", "fp", "fn"] as const)
          total[name][key] += scores[key];
      }
      const beforeCorrect = compare(d.placements, expected).tp;
      const kept = d.placements.filter((p) =>
        prediction.placements.some((q) => carrierKey(q) === carrierKey(p))
      );
      total.lostCorrect += beforeCorrect - compare(kept, expected).tp;
      for (const decision of prediction.decisions.filter((r) => r.proposal)) {
        const unit = d.units.find(
          (u) => u.unit.id === decision.sourceUnitId
        )!.unit;
        const target = expected.filter((p) => unit.strong.includes(p.strong));
        const p = decision.proposal!;
        const status =
          target.length !== 1
            ? "unscorable"
            : target[0].kind !== "empty" &&
                target[0].startWordIndex === p.startWordIndex &&
                target[0].endWordIndex === p.endWordIndex
              ? "exact"
              : "contradicted";
        total.proposals.total++;
        total.proposals[status]++;
        audits.push({
          edition: d.edition,
          ref: d.ref,
          unit: decision.sourceUnitId,
          proposal: p,
          expected: target,
          status
        });
      }
    }
    const summary = {
      split: isReserve ? "reserve" : "development",
      texts: dossiers.length,
      options,
      accounting: Object.fromEntries(
        [
          "units",
          "visible",
          "empty",
          "unresolved",
          "assisted",
          "humanReviewed"
        ].map((k) => [
          k,
          predictions.reduce(
            (n, p) => n + Number(p.summary[k as keyof typeof p.summary]),
            0
          )
        ])
      ),
      fullyHumanReviewed: predictions.filter(
        (p) => p.summary.fullyHumanReviewed
      ).length,
      operationallyCovered: predictions.filter(
        (p) => p.summary.translationAccountedFor
      ).length,
      scores: total,
      metric:
        "Exact editorial CSV carrier agreement, not semantic correctness or calibrated certainty."
    };
    await write(path.join(output, "summary.json"), summary);
    await write(path.join(output, "proposal-audit.json"), audits);
    await writeFile(
      path.join(output, "review.html"),
      buildResolutionReviewHtml(dossiers, predictions),
      { flag: "wx" }
    );
    console.log(JSON.stringify(summary, null, 2));
  }
} else if (command === "freeze") {
  const summary = await json<EvaluationSummary>(
    path.join(input, "summary.json")
  );
  const prediction = await json<PredictionManifest>(
    path.join(input, "prediction-manifest.json")
  );
  assert.equal(summary.split, "development");
  assert.equal(
    prediction.reviewSha256,
    null,
    "do-not-tune-with-assisted-reviews"
  );
  await verify(prediction.code);
  const { inputs } = await sources();
  const scores = summary.scores;
  const pass =
    summary.options.applyExactWitness &&
    scores.proposals.total >= 30 &&
    scores.proposals.exact / scores.proposals.total >= 0.98 &&
    scores.projected.fp <= scores.baseline.fp &&
    scores.lostCorrect === 0;
  await write(output, {
    version: 1,
    applyExactWitness: Boolean(pass),
    threshold:
      "At least 30 proposals; 98% exact editorial agreement; no increased false positives; zero lost correct baseline carriers.",
    absencePolicy:
      "No automatic semantic absence certification. Explicit, text-bound reviews only; assistant provenance always retained.",
    anchorPolicy:
      "Retain neighbor intervals and conflicts; only a separately reviewed display choice yields a reviewed point.",
    inputs,
    lexicalFingerprint: lexicalFingerprint(),
    code: prediction.code,
    developmentSummarySha256: sha(
      await readFile(path.join(input, "summary.json"))
    ),
    developmentPredictionSha256: prediction.predictionsSha256
  });
  console.log(
    JSON.stringify({ freeze: output, applyExactWitness: Boolean(pass) })
  );
} else
  throw new Error(
    "Usage: run.ts prepare-development OUT | prepare-ledger LEDGER OUT | apply PACKET OUT [--reviews FILE --assisted] | evaluate PACKET OUT [--exact] [--reviews FILE --assisted] | freeze DEV_RESULT FILE | prepare-reserve FREEZE_FILE OUT"
  );
