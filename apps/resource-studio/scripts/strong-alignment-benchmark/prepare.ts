/** Experimental preparation. Gold labels are written separately from aligner inputs. */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BOOK_IDS } from "../../src/books.js";
import { getOriginalStrongOccurrences } from "../../src/completeAlignment.js";
import {
  excludedReferenceNamesForGold,
  extractGoldCarrierPlacements,
  selectStratifiedRefs
} from "../../src/evaluateStrongGold.js";
import { buildLexicalCandidateReport } from "../../src/lexicalCandidateReport.js";
import {
  readStepOriginalVerseMap,
  selectStepOriginalTokensForRefs
} from "../../src/stepOriginals.js";
import { buildStrongVerseMap, readStrongCsv } from "../../src/strongCsv.js";
import { readStrongDictionaryTranslationCandidates } from "../../src/strongDictionaryLexicon.js";
import { generateStrongLedgerWithDictionary } from "../../src/strongLedger.js";
import { normalizeWord, stripTags, tokenizeText } from "../../src/tokenize.js";
import { placementOf } from "../strong-decision-benchmark/prepare.js";
import {
  chapter,
  GOLDS,
  sha,
  split,
  type BaselineVerse,
  type EvalVerse
} from "./shared.js";

const [mode, rootArg, goldArg] = process.argv.slice(2);
const root = path.resolve(rootArg ?? "outputs/strong-alignment-benchmark/v1");
const dictionaryPath =
  "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite";
async function json(file: string, data: unknown) {
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", { flag: "wx" });
}
if (mode === "corpus") {
  assert(!existsSync(path.join(root, "plan.json")), "use-a-fresh-root");
  await mkdir(root, { recursive: true });
  const maps = await Promise.all(
    GOLDS.map(async (gold) =>
      buildStrongVerseMap(await readStrongCsv(`data/strongs/${gold}.csv`))
    )
  );
  const stepDir = "data/external/stepbible/amalgamated";
  const sourceFiles = (await readdir(stepDir))
    .filter((f) => /^(TAHOT|TAGNT).*\.txt$/.test(f))
    .sort()
    .map((f) => path.join(stepDir, f));
  const originals = await readStepOriginalVerseMap(sourceFiles);
  const old = JSON.parse(
    await readFile(
      "outputs/strong-decision-benchmark/pilot-v1/Sg1910/dataset.json",
      "utf8"
    )
  );
  const oldChapters = new Set<string>(
    old.verses.map((v: { ref: string }) => chapter(v.ref))
  );
  const sourceFor = (ref: string) => {
    const selected = selectStepOriginalTokensForRefs(originals, [ref], {
      preferAlternateRef: true
    });
    const [bookId, c, v] = ref.split(".");
    return getOriginalStrongOccurrences({
      bookId,
      chapter: Number(c),
      verse: Number(v),
      tokens: selected.tokens,
      strongSet: selected.strongSet
    });
  };
  const common = [...maps[0].keys()].filter(
    (ref) => maps.every((m) => m.has(ref)) && originals.has(ref)
  );
  const available = common.filter((ref) => !oldChapters.has(chapter(ref)));
  const evalRefs = selectStratifiedRefs(available, 240);
  assert.equal(evalRefs.length, 240);
  const evalChapters = new Set(evalRefs.map(chapter));
  const evalSourceIdentities = new Set(
    evalRefs.flatMap((ref) => sourceFor(ref).map((o) => o.sourceIdentity))
  );
  // Keep a further set of chapters untouched for later experiments.
  const reserveRefs = selectStratifiedRefs(
    available.filter((ref) => !evalChapters.has(chapter(ref))),
    100
  );
  const reserveChapters = new Set(reserveRefs.map(chapter));
  const reserveIdentities = new Set(
    reserveRefs.flatMap((ref) => sourceFor(ref).map((o) => o.sourceIdentity))
  );
  const trainingRefs = common
    .filter(
      (ref) =>
        !evalChapters.has(chapter(ref)) &&
        !reserveChapters.has(chapter(ref)) &&
        !oldChapters.has(chapter(ref))
    )
    .filter((ref) =>
      sourceFor(ref).every(
        (o) =>
          !evalSourceIdentities.has(o.sourceIdentity) &&
          !reserveIdentities.has(o.sourceIdentity)
      )
    );
  const sourceRows = new Map(common.map((ref) => [ref, sourceFor(ref)]));
  const lineSource = (ref: string, representation: "strong" | "surface") =>
    sourceRows.get(ref)!.map((o) =>
      representation === "strong"
        ? o.strong
        : o.text
            .replace(/\([^)]*\)/gu, "")
            .normalize("NFC")
            .replace(/\s+/gu, "_") || o.strong
    );
  const manifests: unknown[] = [];
  for (const [index, gold] of GOLDS.entries()) {
    const dir = path.join(root, gold);
    await mkdir(dir, { recursive: true });
    const wordsFor = (ref: string) =>
      tokenizeText(stripTags(maps[index].get(ref)!.row.text)).filter(
        (t) => t.kind === "word"
      );
    const train = trainingRefs.filter(
      (ref) =>
        sourceRows.get(ref)!.length > 0 &&
        sourceRows.get(ref)!.length < 1024 &&
        wordsFor(ref).length > 0 &&
        wordsFor(ref).length < 1024
    );
    const inputs: Record<string, string> = {};
    for (const representation of ["strong", "surface"] as const) {
      const name = `train.${representation}.txt`;
      const text =
        train
          .map((ref) => lineSource(ref, representation).join(" "))
          .join("\n") + "\n";
      await writeFile(path.join(dir, name), text, { flag: "wx" });
      inputs[name] = sha(text);
    }
    const french =
      train
        .map((ref) =>
          wordsFor(ref)
            .map((w) => w.normalized || normalizeWord(w.text))
            .join(" ")
        )
        .join("\n") + "\n";
    await writeFile(path.join(dir, "train.fr.txt"), french, { flag: "wx" });
    inputs["train.fr.txt"] = sha(french);
    await json(path.join(dir, "train-refs.json"), train);
    const evaluation: EvalVerse[] = evalRefs.map((ref) => ({
      ref,
      split: split(ref),
      text: stripTags(maps[index].get(ref)!.row.text),
      words: wordsFor(ref).map((w) => w.text),
      normalized: wordsFor(ref).map((w) => w.normalized),
      source: sourceRows.get(ref)!,
      strong: lineSource(ref, "strong"),
      surface: lineSource(ref, "surface")
    }));
    assert(
      evaluation.every(
        (v) =>
          v.source.length > 0 &&
          v.words.length > 0 &&
          v.source.length < 1024 &&
          v.words.length < 1024
      )
    );
    await json(path.join(dir, "eval-input.json"), evaluation);
    await json(
      path.join(dir, "expected.json"),
      Object.fromEntries(
        evalRefs.map((ref) => [
          ref,
          extractGoldCarrierPlacements(maps[index].get(ref)!.row.text)
        ])
      )
    );
    inputs["eval-input.json"] = sha(
      await readFile(path.join(dir, "eval-input.json"))
    );
    manifests.push({
      gold,
      trainingVerses: train.length,
      evaluationVerses: evaluation.length,
      inputs,
      goldSha256: sha(await readFile(`data/strongs/${gold}.csv`))
    });
    console.log(
      JSON.stringify({
        gold,
        training: train.length,
        evaluation: evaluation.length
      })
    );
  }
  await json(path.join(root, "plan.json"), {
    version: "strong-alignment-v1",
    createdAt: new Date().toISOString(),
    evalRefs,
    reserveRefs,
    oldExcludedChapters: [...oldChapters].sort(),
    calibrationChapters: [...evalChapters].filter(
      (c) => split(c + ".1") === "calibration"
    ),
    testChapters: [...evalChapters].filter((c) => split(c + ".1") === "test"),
    protocol:
      "Unsupervised training on other chapters per edition; fixed learned priors; each held-out verse inferred in isolation. No gold labels passed to aligner. Source policy is the same amalgamated STEP inventory with preferred alternate references, not a single manuscript edition.",
    dictionaryPath,
    dictionarySha256: sha(await readFile(dictionaryPath)),
    sources: await Promise.all(
      sourceFiles.map(async (file) => ({
        file,
        sha256: sha(await readFile(file))
      }))
    ),
    manifests,
    experiments: {
      representations: ["strong", "surface"],
      trainingSeed: 17,
      inferenceSeeds: [17, 29, 43],
      inferenceIterations: [4, 4, 16],
      candidateLimits: [5, 10, 100],
      projection:
        "One carrier per source occurrence when its target links are contiguous; otherwise abstain. Compare intersection and union of directions.",
      testUse:
        "Select hybrid policy on calibration only, report held-out test once. Reserved chapters are not scored."
    },
    sourceSha256: sha(await readFile(new URL(import.meta.url)))
  });
} else if (mode === "baseline") {
  assert(GOLDS.includes(goldArg as (typeof GOLDS)[number]));
  const gold = goldArg as (typeof GOLDS)[number];
  const dir = path.join(root, gold);
  assert(
    !existsSync(path.join(dir, "baseline.json")),
    "baseline-already-exists"
  );
  const plan = JSON.parse(await readFile(path.join(root, "plan.json"), "utf8"));
  assert.equal(sha(await readFile(dictionaryPath)), plan.dictionarySha256);
  const evaluation: EvalVerse[] = JSON.parse(
    await readFile(path.join(dir, "eval-input.json"), "utf8")
  );
  const bible: Record<string, Record<string, Record<string, string>>> = {};
  for (const v of evaluation) {
    const [book, c, verse] = v.ref.split(".");
    const number = String(
      BOOK_IDS.indexOf(book as (typeof BOOK_IDS)[number]) + 1
    );
    bible[number] ??= {};
    bible[number][c] ??= {};
    bible[number][c][verse] = v.text;
  }
  const biblePath = path.join(dir, "masked-input.json");
  await json(biblePath, bible);
  const excludedReferenceNames = excludedReferenceNamesForGold(gold, false);
  const ledger = await generateStrongLedgerWithDictionary(
    {
      bible: `alignment-eval-${gold.toLowerCase()}`,
      profileBible: gold === "Sg1910" ? "nbs" : "fmar",
      biblePath,
      outputDir: dir,
      writeArtifacts: false,
      writeLexicalReport: false,
      applyCuratedOverrides: false,
      excludedReferenceNames
    },
    {
      path: dictionaryPath,
      activation: { mode: "legacy", path: dictionaryPath }
    }
  );
  assert(
    !ledger.references.some((r) => excludedReferenceNames.includes(r.name))
  );
  const lexical = await buildLexicalCandidateReport({
    bible: ledger.bible,
    ledger,
    inputDir: dir,
    outputDir: dir,
    includeAllReaderAnnotations: true,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 100,
    dictionaryCandidates: readStrongDictionaryTranslationCandidates(
      dictionaryPath,
      { strict: true }
    ),
    ...Object.fromEntries(
      Object.entries({
        kaikkiPath:
          "data/external/french-lexical/kaikki/kaikki.org-dictionary-French.jsonl",
        jdmCacheDir: "data/external/french-lexical/rezojdm-cache",
        openOfficePath:
          "data/external/french-lexical/openoffice/synonymes/handler/dictionary.go",
        wolfPath: "data/external/french-lexical/wolf/wolf-1.0b4.xml.bz2"
      }).filter(([, p]) => existsSync(p))
    )
  });
  const verses: BaselineVerse[] = ledger.verses.map((v) => {
    const input = evaluation.find((e) => e.ref === v.ref)!;
    assert.deepEqual(
      v.tokens.map((t) => t.text),
      input.words,
      `token-drift:${v.ref}`
    );
    return {
      ref: v.ref,
      placements: v.annotations
        .filter((a) => a.visibility === "reader")
        .map((a) => ({
          ...placementOf(a),
          id: a.id,
          originalOccurrenceId: a.originalOccurrenceId
        })),
      original: v.inventories.original,
      items: lexical.items.filter((i) => i.ref === v.ref)
    };
  });
  await json(path.join(dir, "baseline.json"), {
    metadata: {
      inputFingerprint: ledger.inputFingerprint,
      references: ledger.references,
      lexicalSources: lexical.sources,
      includeAllReaderAnnotations: true,
      sourceSha256: sha(await readFile(new URL(import.meta.url)))
    },
    verses
  });
  console.log(
    JSON.stringify({ gold, verses: verses.length, items: lexical.items.length })
  );
} else throw new Error("usage: prepare.ts corpus|baseline ROOT [GOLD]");
