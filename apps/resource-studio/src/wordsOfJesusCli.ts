import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildCanonicalBibleFromLegacy } from "./legacyBiblePublication.js";
import type { CanonicalBiblePublication } from "./strongBibleMobilePublication.js";
import {
  carrySpansThroughInsertedSpaces,
  compareVerseRefs,
  extractWordsOfJesusSpans,
  hashVerseText,
  importLegacyRedWords,
  normalizeSpans,
  parseVerseRef,
  parseWordsOfJesusDataset,
  refineGluedBoundaries,
  serializeWordsOfJesusDataset,
  spanCoverage,
  transferSpans,
  wordBoundaries,
  wordRangesToSpans,
  WORDS_OF_JESUS_FORMAT,
  WORDS_OF_JESUS_SCHEMA_VERSION,
  type WordsOfJesusDataset,
  type WordsOfJesusVerse
} from "./wordsOfJesus.js";
import {
  auditWordsOfJesus,
  buildWordsOfJesusReference,
  WORDS_OF_JESUS_REFERENCE_VERSION_IDS,
  type WordsOfJesusAudit,
  type WordsOfJesusReference
} from "./wordsOfJesusAudit.js";
import {
  fetchCached,
  legacyAssetSlug,
  loadBiblePericope,
  loadBibleText,
  readWordsOfJesusDataset,
  loadLegacyAuthoredText,
  loadLegacyRedWords,
  WORDS_OF_JESUS_OUTPUT_DIR,
  wordsOfJesusDatasetPath,
  type WordsOfJesusSourceOptions
} from "./wordsOfJesusSources.js";

/** Bibles whose words of Jesus come from the dataset; others carry source markup or none. */
export const WORDS_OF_JESUS_DATASET_VERSION_IDS = [
  "AMP",
  "ASV",
  "BCC1923",
  "BDS",
  "BFC",
  "BSB",
  "CHU",
  "CSB",
  "DARBY",
  "DBR",
  "DBY",
  "DEL",
  "EASY",
  "ESV",
  "FMAR",
  "FRC97",
  "GW",
  "KJF",
  "LAU",
  "LSG",
  "NBS",
  "NEG79",
  "NET",
  "NFC",
  "NIV",
  "NKJV",
  "NLT",
  "NVS78P",
  "OST",
  "PDV2017",
  "POV",
  "RV1895",
  "RWEBSTER",
  "S21",
  "TLV"
] as const;

const ALIGNMENT_BATCH_SIZE = 120;
const NARRATION_CUES: Record<string, RegExp> = {
  fr: /(?:^|[^\p{L}])(?:dit|disait|dis|répondit|répond|reprit|ajouta|déclara|demanda|cria|s['’]écria|Jésus|Seigneur)(?=[^\p{L}]|$)/iu,
  en: /\b(?:said|saith|says|answered|answering|replied|asked|cried|Jesus|Lord)\b/iu
};

type Args = Record<string, string[]>;

const parseArgs = (
  argv: readonly string[]
): { command: string; args: Args } => {
  const [command = "help", ...rest] = argv;
  const args: Args = {};
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index]!;
    if (!key.startsWith("--"))
      throw new Error(`words-of-jesus-argument-invalid:${key}`);
    const value = rest[index + 1];
    if (value === undefined || value.startsWith("--")) {
      (args[key] ??= []).push("true");
    } else {
      (args[key] ??= []).push(value);
      index += 1;
    }
  }
  return { command, args };
};

const selectedVersions = (args: Args) => {
  const requested = args["--version"]?.flatMap((value) => value.split(","));
  if (!requested?.length) return [...WORDS_OF_JESUS_DATASET_VERSION_IDS];
  for (const versionId of requested) {
    if (
      !(WORDS_OF_JESUS_DATASET_VERSION_IDS as readonly string[]).includes(
        versionId
      )
    ) {
      throw new Error(`words-of-jesus-version-unsupported:${versionId}`);
    }
  }
  return requested;
};

const readTextOverrides = async (root: string, args: Args) => {
  const overridesPath = args["--text-overrides"]?.[0];
  if (!overridesPath) return undefined;
  return JSON.parse(
    await readFile(path.resolve(root, overridesPath), "utf8")
  ) as Record<string, string>;
};

const writeDataset = async (root: string, dataset: WordsOfJesusDataset) => {
  const datasetPath = wordsOfJesusDatasetPath(root, dataset.versionId);
  await mkdir(path.dirname(datasetPath), { recursive: true });
  await writeFile(datasetPath, serializeWordsOfJesusDataset(dataset));
  return datasetPath;
};

const emptyDataset = (versionId: string): WordsOfJesusDataset => ({
  format: WORDS_OF_JESUS_FORMAT,
  schemaVersion: WORDS_OF_JESUS_SCHEMA_VERSION,
  versionId,
  verses: []
});

/** Replaces decisions by reference, keeping every other recorded decision. */
const mergeDecisions = (
  dataset: WordsOfJesusDataset,
  decisions: readonly WordsOfJesusVerse[],
  replace: (existing: WordsOfJesusVerse) => boolean = () => true
): WordsOfJesusDataset => {
  const byRef = new Map(dataset.verses.map((verse) => [verse.ref, verse]));
  for (const decision of decisions) {
    const existing = byRef.get(decision.ref);
    if (!existing || replace(existing)) byRef.set(decision.ref, decision);
  }
  return {
    ...dataset,
    verses: [...byRef.values()].sort((left, right) =>
      compareVerseRefs(left.ref, right.ref)
    )
  };
};

async function importLegacy(
  root: string,
  args: Args,
  options: WordsOfJesusSourceOptions
) {
  for (const versionId of selectedVersions(args)) {
    const legacy = await loadLegacyRedWords(versionId, options);
    if (!legacy) {
      console.log(`${versionId}: no legacy red-word file`);
      continue;
    }
    const text = await loadBibleText(versionId, options);
    // Strong-capable Bibles were re-typeset after their red words were authored.
    const authoredPublication = text.canonicalSource
      ? await loadLegacyAuthoredText(versionId, options)
      : undefined;
    const imported = importLegacyRedWords({
      versionId,
      publication: text.publication,
      redWords: legacy.redWords,
      ...(authoredPublication ? { authoredPublication } : {})
    });
    // Reviewed decisions survive a re-import; only legacy ones are refreshed.
    const current =
      (await readWordsOfJesusDataset(root, versionId)) ??
      emptyDataset(versionId);
    const merged = mergeDecisions(
      {
        ...current,
        verses: current.verses.filter(
          (verse) => verse.origin !== "legacy-red-words"
        )
      },
      imported.dataset.verses,
      (existing) => existing.origin === "legacy-red-words"
    );
    const datasetPath = await writeDataset(root, merged);
    console.log(
      `${versionId}: ${imported.dataset.verses.length} legacy verses, ` +
        `${imported.outOfRangeVerseRefs.length} out of range, ` +
        `${imported.missingVerseRefs.length} missing, ` +
        `${imported.untransferredVerseRefs.length} untransferred` +
        `${authoredPublication ? " (rebased from the legacy wording)" : ""} → ${path.relative(root, datasetPath)}`
    );
    if (imported.untransferredVerseRefs.length) {
      console.log(
        `  untransferred: ${imported.untransferredVerseRefs.slice(0, 20).join(" ")}`
      );
    }
    if (imported.outOfRangeVerseRefs.length) {
      console.log(
        `  out of range: ${imported.outOfRangeVerseRefs.slice(0, 20).join(" ")}`
      );
    }
    if (imported.missingVerseRefs.length) {
      console.log(
        `  missing: ${imported.missingVerseRefs.slice(0, 20).join(" ")}`
      );
    }
  }
}

/**
 * Rebuilds each ordinary Bible the way the historical publication did (legacy
 * text, pericopes and red words) and compares its text revision with the one
 * served in production, proving the inventory text is the published text.
 */
async function verifySources(args: Args, options: WordsOfJesusSourceOptions) {
  for (const versionId of selectedVersions(args)) {
    const text = await loadBibleText(versionId, options);
    const response = await fetch(
      `https://api.bible-strong.app/v1/bibles/${encodeURIComponent(versionId)}/books/40/chapters/1`
    );
    const production = response.ok
      ? (
          (await response.json()) as {
            resource?: { textRevision?: string; revision?: string };
          }
        ).resource
      : undefined;
    const productionRevision = production?.textRevision ?? production?.revision;
    let rebuiltRevision = text.publication.textRevision;
    if (!text.canonicalSource) {
      const [pericope, redWords] = await Promise.all([
        loadBiblePericope(versionId, options),
        loadLegacyRedWords(versionId, options)
      ]);
      rebuiltRevision = buildCanonicalBibleFromLegacy({
        versionId,
        sourceVersion: text.sourceLocation,
        sourceSha256: text.sourceSha256,
        bible: text.legacyBible,
        ...(pericope ? { pericope: pericope.pericope } : {}),
        ...(redWords ? { redWords: redWords.redWords } : {})
      }).textRevision;
    }
    const status =
      productionRevision === undefined
        ? "unpublished"
        : productionRevision === rebuiltRevision
          ? "identical"
          : "DIFFERENT";
    console.log(
      `${versionId.padEnd(9)} ${status.padEnd(11)} production=${productionRevision ?? "-"} rebuilt=${rebuiltRevision}`
    );
  }
}

const loadReferences = async (
  options: WordsOfJesusSourceOptions
): Promise<WordsOfJesusReference[]> =>
  Promise.all(
    WORDS_OF_JESUS_REFERENCE_VERSION_IDS.map(async (versionId) =>
      buildWordsOfJesusReference(
        versionId,
        (await loadBibleText(versionId, options)).publication
      )
    )
  );

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

async function audit(
  root: string,
  args: Args,
  options: WordsOfJesusSourceOptions
) {
  const references = await loadReferences(options);
  const outputDir = path.join(root, WORDS_OF_JESUS_OUTPUT_DIR, "audit");
  await mkdir(outputDir, { recursive: true });
  const summaries: WordsOfJesusAudit[] = [];
  for (const versionId of selectedVersions(args)) {
    const [text, dataset] = await Promise.all([
      loadBibleText(versionId, options),
      readWordsOfJesusDataset(root, versionId)
    ]);
    const result = auditWordsOfJesus({
      versionId,
      publication: text.publication,
      dataset,
      references
    });
    summaries.push(result);
    await writeFile(
      path.join(outputDir, `${legacyAssetSlug(versionId)}.json`),
      `${JSON.stringify(result, null, 2)}\n`
    );
  }
  const lines = [
    "| Bible | Decided | Marked | Drift | Missing | Uncertain | Unsupported | Coverage | Boundary |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...summaries.map(
      (summary) =>
        `| ${summary.versionId} | ${summary.decidedVerseCount} | ${summary.markedVerseCount} | ${summary.counts.drift} | ${summary.counts.missing} | ${summary.counts.uncertain} | ${summary.counts.unsupported} | ${summary.counts.coverage} | ${summary.counts.boundary} |`
    )
  ];
  await writeFile(path.join(outputDir, "summary.md"), `${lines.join("\n")}\n`);
  console.log(lines.join("\n"));
}

const markText = (
  text: string,
  spans: ReadonlyArray<readonly [number, number]>
) => {
  let result = "";
  let position = 0;
  for (const [start, end] of spans) {
    result += `${text.slice(position, start)}⟦${text.slice(start, end)}⟧`;
    position = end;
  }
  return result + text.slice(position);
};

const numberWords = (text: string) =>
  wordBoundaries(text)
    .map(([start, end], index) => `${index}:${text.slice(start, end)}`)
    .join(" ");

const verseText = (
  publication: Pick<CanonicalBiblePublication, "verses">,
  ref: string
) => {
  const { book, chapter, verse } = parseVerseRef(ref);
  return publication.verses[book]?.[chapter]?.[verse]?.text;
};

const neighborRef = (
  publication: Pick<CanonicalBiblePublication, "verses">,
  ref: string,
  delta: number
) => {
  const { book, chapter, verse } = parseVerseRef(ref);
  const candidate = `${book}-${chapter}-${Number(verse) + delta}`;
  return verseText(publication, candidate) === undefined
    ? undefined
    : candidate;
};

async function prepareAlignment(
  root: string,
  args: Args,
  options: WordsOfJesusSourceOptions
) {
  const config = JSON.parse(
    await readFile(
      path.join(root, "config/ordinary-bible-publications.json"),
      "utf8"
    )
  ) as { bibles: Array<{ id: string; language: string }> };
  const referenceTexts = new Map(
    await Promise.all(
      WORDS_OF_JESUS_REFERENCE_VERSION_IDS.map(
        async (versionId) =>
          [
            versionId,
            (await loadBibleText(versionId, options)).publication
          ] as const
      )
    )
  );
  const references = [...referenceTexts].map(([versionId, publication]) =>
    buildWordsOfJesusReference(versionId, publication)
  );
  const lsgText = (await loadBibleText("LSG", options)).publication;
  const lsgDataset = await readWordsOfJesusDataset(root, "LSG");
  const lsgDecisions = new Map(
    lsgDataset?.verses.map((verse) => [verse.ref, verse])
  );
  const autoFull = args["--auto-full"]?.[0] === "true";

  for (const versionId of selectedVersions(args)) {
    const language =
      config.bibles.find((bible) => bible.id === versionId)?.language ?? "";
    const [text, existing] = await Promise.all([
      loadBibleText(versionId, options),
      readWordsOfJesusDataset(root, versionId)
    ]);
    let dataset = existing ?? emptyDataset(versionId);
    const result = auditWordsOfJesus({
      versionId,
      publication: text.publication,
      dataset,
      references
    });
    const candidates = result.flags.filter((flag) => flag.kind !== "drift");

    // A verse every reference marks completely transfers deterministically
    // when the target text shows no narration around the speech.
    const transferred: WordsOfJesusVerse[] = [];
    const cue = NARRATION_CUES[language];
    const queued = candidates.filter((flag) => {
      const target = verseText(text.publication, flag.ref);
      if (
        !autoFull ||
        !cue ||
        target === undefined ||
        flag.kind !== "missing" ||
        flag.referenceCoverage.length !==
          WORDS_OF_JESUS_REFERENCE_VERSION_IDS.length ||
        flag.referenceCoverage.some((coverage) => coverage < 0.98) ||
        cue.test(target)
      ) {
        return true;
      }
      transferred.push({
        ref: flag.ref,
        verseSha256: hashVerseText(target),
        spans: normalizeSpans(target, [[0, target.length]]),
        origin: "aligned"
      });
      return false;
    });
    if (transferred.length) {
      dataset = mergeDecisions(dataset, transferred);
      await writeDataset(root, dataset);
    }

    const decisions = new Map(
      dataset.verses.map((verse) => [verse.ref, verse])
    );
    const batchDir = path.join(
      root,
      WORDS_OF_JESUS_OUTPUT_DIR,
      "alignment",
      legacyAssetSlug(versionId)
    );
    await rm(batchDir, { recursive: true, force: true });
    await mkdir(batchDir, { recursive: true });
    const items = queued.map((flag) => {
      const target = verseText(text.publication, flag.ref)!;
      const decision = decisions.get(flag.ref);
      const referencesForVerse: Record<string, string> = {};
      for (const [referenceId, publication] of referenceTexts) {
        const { book, chapter, verse } = parseVerseRef(flag.ref);
        const value = publication.verses[book]?.[chapter]?.[verse];
        if (value)
          referencesForVerse[referenceId] = markText(
            value.text,
            extractWordsOfJesusSpans(value)
          );
      }
      const lsgVerse = verseText(lsgText, flag.ref);
      if (language === "fr" && versionId !== "LSG" && lsgVerse !== undefined) {
        referencesForVerse.LSG = markText(
          lsgVerse,
          lsgDecisions.get(flag.ref)?.spans ?? []
        );
      }
      const previous = neighborRef(text.publication, flag.ref, -1);
      const next = neighborRef(text.publication, flag.ref, 1);
      return {
        ref: flag.ref,
        flag: flag.kind,
        words: numberWords(target),
        current: decision ? markText(target, decision.spans) : null,
        references: referencesForVerse,
        previous: previous ? verseText(text.publication, previous) : null,
        next: next ? verseText(text.publication, next) : null
      };
    });
    const batchCount = Math.ceil(items.length / ALIGNMENT_BATCH_SIZE);
    for (let index = 0; index < batchCount; index += 1) {
      const batchName = `batch-${String(index + 1).padStart(3, "0")}`;
      await writeFile(
        path.join(batchDir, `${batchName}.json`),
        `${JSON.stringify(
          {
            versionId,
            language,
            batch: batchName,
            resultPath: path.join(batchDir, `${batchName}.result.json`),
            verses: items.slice(
              index * ALIGNMENT_BATCH_SIZE,
              (index + 1) * ALIGNMENT_BATCH_SIZE
            )
          },
          null,
          2
        )}\n`
      );
    }
    console.log(
      `${versionId}: ${transferred.length} transferred, ${items.length} queued in ${batchCount} batches`
    );
  }
}

async function applyAlignment(
  root: string,
  args: Args,
  options: WordsOfJesusSourceOptions
) {
  for (const versionId of selectedVersions(args)) {
    const batchDir = path.join(
      root,
      WORDS_OF_JESUS_OUTPUT_DIR,
      "alignment",
      legacyAssetSlug(versionId)
    );
    if (!existsSync(batchDir)) continue;
    const text = await loadBibleText(versionId, options);
    const files = (await readdir(batchDir)).filter((name) =>
      /^batch-\d+\.json$/u.test(name)
    );
    const decisions: WordsOfJesusVerse[] = [];
    const pending: string[] = [];
    for (const file of files.sort()) {
      const batch = JSON.parse(
        await readFile(path.join(batchDir, file), "utf8")
      ) as {
        verses: Array<{ ref: string }>;
      };
      const resultPath = path.join(
        batchDir,
        file.replace(/\.json$/u, ".result.json")
      );
      if (!existsSync(resultPath)) {
        pending.push(...batch.verses.map((verse) => verse.ref));
        continue;
      }
      const results = JSON.parse(await readFile(resultPath, "utf8")) as Array<{
        ref: string;
        words: Array<[number, number]>;
      }>;
      const resultsByRef = new Map(results.map((entry) => [entry.ref, entry]));
      for (const { ref } of batch.verses) {
        const entry = resultsByRef.get(ref);
        const target = verseText(text.publication, ref);
        if (!entry || target === undefined || !Array.isArray(entry.words)) {
          pending.push(ref);
          continue;
        }
        const { spans, outOfRange } = wordRangesToSpans(
          target,
          entry.words.map(([start, end]) => ({ start, end }))
        );
        if (outOfRange) {
          pending.push(ref);
          continue;
        }
        decisions.push({
          ref,
          verseSha256: hashVerseText(target),
          spans: refineGluedBoundaries(target, spans),
          origin: "aligned"
        });
      }
    }
    const dataset = mergeDecisions(
      (await readWordsOfJesusDataset(root, versionId)) ??
        emptyDataset(versionId),
      decisions
    );
    await writeDataset(root, dataset);
    console.log(
      `${versionId}: ${decisions.length} aligned decisions applied, ${pending.length} pending`
    );
    if (pending.length)
      console.log(`  pending: ${pending.slice(0, 30).join(" ")}`);
  }
}

/** Words of Jesus of a pivot Bible: its dataset, or its publisher markup. */
const pivotDecisions = async (
  root: string,
  versionId: string,
  publication: Pick<CanonicalBiblePublication, "verses">
) => {
  const dataset = await readWordsOfJesusDataset(root, versionId);
  if (dataset)
    return new Map(dataset.verses.map((verse) => [verse.ref, verse.spans]));
  const spansByRef = new Map<string, Array<[number, number]>>();
  for (const [book, chapters] of Object.entries(publication.verses)) {
    for (const [chapter, verses] of Object.entries(chapters)) {
      for (const [verse, value] of Object.entries(verses)) {
        const spans = extractWordsOfJesusSpans(value);
        if (spans.length) spansByRef.set(`${book}-${chapter}-${verse}`, spans);
      }
    }
  }
  return spansByRef;
};

/**
 * Carries a pivot Bible's decisions to the queued verses of a closely related
 * wording by word alignment. Verses whose span boundaries do not align, or
 * where the pivot has no words of Jesus, stay queued for review.
 */
async function transfer(
  root: string,
  args: Args,
  options: WordsOfJesusSourceOptions
) {
  const pivotId = args["--from"]?.[0];
  if (!pivotId) throw new Error("words-of-jesus-transfer-pivot-required");
  const pivotText = (await loadBibleText(pivotId, options)).publication;
  const pivot = await pivotDecisions(root, pivotId, pivotText);
  const references = await loadReferences(options);
  // Publisher markings (NASB notably) also cover Jesus' words quoted by
  // others; carry one only when a reference of another family marks it too.
  const family = (versionId: string) => versionId.replace(/\d+$/u, "");
  const independentReferences = (
    WORDS_OF_JESUS_REFERENCE_VERSION_IDS as readonly string[]
  ).includes(pivotId)
    ? references.filter(
        (reference) => family(reference.versionId) !== family(pivotId)
      )
    : undefined;
  for (const versionId of selectedVersions(args)) {
    if (versionId === pivotId) continue;
    const [text, existing] = await Promise.all([
      loadBibleText(versionId, options),
      readWordsOfJesusDataset(root, versionId)
    ]);
    const dataset = existing ?? emptyDataset(versionId);
    const flags = auditWordsOfJesus({
      versionId,
      publication: text.publication,
      dataset,
      references
    }).flags.filter((flag) => flag.kind !== "drift");
    const decisions: WordsOfJesusVerse[] = [];
    for (const flag of flags) {
      const target = verseText(text.publication, flag.ref);
      const source = verseText(pivotText, flag.ref);
      const spans = pivot.get(flag.ref);
      if (target === undefined || source === undefined || !spans?.length)
        continue;
      if (
        independentReferences &&
        !independentReferences.some((reference) =>
          reference.coverageByRef.has(flag.ref)
        )
      ) {
        continue;
      }
      const transferred = transferSpans(source, spans, target, 0.7);
      if (!transferred?.length) continue;
      if (
        Math.abs(
          spanCoverage(source, spans) - spanCoverage(target, transferred)
        ) > 0.3
      ) {
        continue;
      }
      decisions.push({
        ref: flag.ref,
        verseSha256: hashVerseText(target),
        spans: transferred,
        origin: "aligned"
      });
    }
    await writeDataset(root, mergeDecisions(dataset, decisions));
    console.log(
      `${versionId}: ${decisions.length} of ${flags.length} queued verses transferred from ${pivotId}`
    );
  }
}

/**
 * Carries decisions to a corrected wording of the same Bible, such as restored
 * spaces: each drifted decision must match the previous text, then its spans
 * move by word alignment. Decisions that do not transfer are left to `check`.
 */
async function rebaseText(
  root: string,
  args: Args,
  options: WordsOfJesusSourceOptions
) {
  const previousLocation = args["--previous-text"]?.[0];
  if (!previousLocation)
    throw new Error("words-of-jesus-previous-text-required");
  for (const versionId of selectedVersions(args)) {
    const dataset = await readWordsOfJesusDataset(root, versionId);
    if (!dataset) continue;
    const [current, previous] = await Promise.all([
      loadBibleText(versionId, options),
      loadBibleText(versionId, {
        ...options,
        textOverrides: {
          ...options.textOverrides,
          [versionId]: previousLocation
        }
      })
    ]);
    let rebased = 0;
    const failed: string[] = [];
    const verses = dataset.verses.map((decision) => {
      const target = verseText(current.publication, decision.ref);
      if (
        target !== undefined &&
        hashVerseText(target) === decision.verseSha256
      ) {
        return decision;
      }
      const source = verseText(previous.publication, decision.ref);
      if (
        target === undefined ||
        source === undefined ||
        hashVerseText(source) !== decision.verseSha256
      ) {
        failed.push(decision.ref);
        return decision;
      }
      const spans = decision.spans.length
        ? (carrySpansThroughInsertedSpaces(source, target, decision.spans) ??
          transferSpans(source, decision.spans, target, 0.95))
        : [];
      if (!spans) {
        failed.push(decision.ref);
        return decision;
      }
      rebased += 1;
      return { ...decision, verseSha256: hashVerseText(target), spans };
    });
    await writeDataset(root, { ...dataset, verses });
    console.log(
      `${versionId}: ${rebased} decisions rebased, ${failed.length} failed`
    );
    if (failed.length)
      console.log(`  failed: ${failed.slice(0, 30).join(" ")}`);
  }
}

/** Copies every decision of a Bible whose verse text is identical. */
async function adopt(
  root: string,
  args: Args,
  options: WordsOfJesusSourceOptions
) {
  const sourceId = args["--from"]?.[0];
  if (!sourceId) throw new Error("words-of-jesus-adopt-source-required");
  const source = await readWordsOfJesusDataset(root, sourceId);
  if (!source) throw new Error(`words-of-jesus-dataset-missing:${sourceId}`);
  for (const versionId of selectedVersions(args)) {
    const text = await loadBibleText(versionId, options);
    const adopted = source.verses.filter((decision) => {
      const target = verseText(text.publication, decision.ref);
      return (
        target !== undefined && hashVerseText(target) === decision.verseSha256
      );
    });
    const adoptedRefs = new Set(adopted.map((decision) => decision.ref));
    const existing =
      (await readWordsOfJesusDataset(root, versionId)) ??
      emptyDataset(versionId);
    await writeDataset(root, {
      ...existing,
      verses: [
        ...existing.verses.filter(
          (decision) =>
            !adoptedRefs.has(decision.ref) &&
            !source.verses.some((other) => other.ref === decision.ref)
        ),
        ...adopted
      ].sort((left, right) => compareVerseRefs(left.ref, right.ref))
    });
    console.log(
      `${versionId}: ${adopted.length} of ${source.verses.length} ${sourceId} decisions adopted`
    );
  }
}

/** Verifies every dataset still anchors to the Bible text it will be merged into. */
async function check(
  root: string,
  args: Args,
  options: WordsOfJesusSourceOptions
) {
  let failures = 0;
  for (const versionId of selectedVersions(args)) {
    const dataset = await readWordsOfJesusDataset(root, versionId);
    if (!dataset) {
      console.log(`${versionId}: no dataset`);
      failures += 1;
      continue;
    }
    const text = await loadBibleText(versionId, options);
    let drift = 0;
    let marked = 0;
    for (const decision of dataset.verses) {
      const target = verseText(text.publication, decision.ref);
      if (
        target === undefined ||
        hashVerseText(target) !== decision.verseSha256
      )
        drift += 1;
      else if (spanCoverage(target, decision.spans) > 0) marked += 1;
    }
    if (drift) failures += 1;
    console.log(`${versionId}: ${marked} marked verses, ${drift} drifted`);
  }
  if (failures) throw new Error(`words-of-jesus-check-failed:${failures}`);
}

export async function runWordsOfJesusCli(argv: readonly string[]) {
  const { command, args } = parseArgs(argv);
  const root = path.resolve(args["--root"]?.[0] ?? process.cwd());
  const options: WordsOfJesusSourceOptions = {
    root,
    textOverrides: await readTextOverrides(root, args)
  };
  switch (command) {
    case "import-legacy":
      return importLegacy(root, args, options);
    case "verify-sources":
      return verifySources(args, options);
    case "audit":
      return audit(root, args, options);
    case "prepare-alignment":
      return prepareAlignment(root, args, options);
    case "apply-alignment":
      return applyAlignment(root, args, options);
    case "transfer":
      return transfer(root, args, options);
    case "rebase-text":
      return rebaseText(root, args, options);
    case "adopt":
      return adopt(root, args, options);
    case "check":
      return check(root, args, options);
    default:
      console.log(
        "usage: words-of-jesus <import-legacy|verify-sources|audit|prepare-alignment|transfer|apply-alignment|adopt|rebase-text|check> " +
          "[--version V[,V]] [--from V] [--previous-text location] [--text-overrides overrides.json] [--auto-full]"
      );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runWordsOfJesusCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
