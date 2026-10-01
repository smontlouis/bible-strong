/**
 * Prediction step. It reads only the local target text, the witnesses allowed
 * by the scenario, STEP and the lexical resources. It must never import the
 * evaluator modules (gold, Concordance parser, acquisition) nor read their
 * directories; `assertNoEvaluatorInput` enforces the path side of that rule.
 */
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { BOOK_IDS } from "../../src/books.js";
import {
  generateStrongLedger,
  type StrongExperimentalPolicy,
  type StrongLedgerVerse
} from "../../src/strongLedger.js";
import { readStrongCsv } from "../../src/strongCsv.js";
import { withoutPublisherNotes } from "../../src/strongReaderText.js";
import { stripTags } from "../../src/tokenize.js";
import {
  ACQUISITION_ROOT,
  EDITIONS,
  EVALUATOR_ROOT,
  excludedWitnesses,
  fileSha256,
  sha256,
  stableStringify,
  type EditionDefinition,
  type ScenarioId
} from "./shared.js";

export const PREDICTION_VERSION = "strong-concordance-rebuild-prediction-v1";
export const DICTIONARY_PATH =
  "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite";

/** Experimental engine switches; an empty object is the initial engine. */
export type EnginePolicy = Partial<
  Record<keyof StrongExperimentalPolicy, boolean>
>;

/** Short labels used in run identifiers and reports. */
export const POLICY_LABELS: Record<keyof StrongExperimentalPolicy, string> = {
  readingInvariantVariants: "A",
  singleCarrierPerSourceIdentity: "B",
  encliticHostTransfer: "C",
  digitNumeralTransfer: "D"
};

export function policyFromLabels(labels: string[]): EnginePolicy {
  const policy: EnginePolicy = {};
  for (const label of labels) {
    const entry = Object.entries(POLICY_LABELS).find(
      ([, value]) => value === label
    );
    if (!entry) throw new Error(`unknown-policy-label:${label}`);
    policy[entry[0] as keyof StrongExperimentalPolicy] = true;
  }
  return policy;
}

export function policyId(policy: EnginePolicy): string {
  const labels = (Object.keys(policy) as Array<keyof StrongExperimentalPolicy>)
    .filter((key) => policy[key])
    .map((key) => POLICY_LABELS[key])
    .sort();
  return labels.length ? `policy-${labels.join("")}` : "initial";
}

export interface PredictedCarrier {
  id: string;
  strong: string;
  visibility: string;
  placement: string;
  startWordIndex?: number;
  endWordIndex?: number;
  insertAfterWordIndex?: number;
  source: string;
  confidence: number;
  diagnostic: string | null;
  originalOccurrenceId?: string;
  resolutionUnitId?: string;
  resolutionState?: string;
}

export interface PredictedDecision {
  sourceUnitId: string;
  occurrenceIds: string[];
  strong: string[];
  state: "visible" | "empty" | "unresolved";
  assurance: string;
  targetWordIndices: number[];
  anchor?: {
    insertAfterWordIndex: number;
    method: string;
    assurance: string;
    absenceEstablished: boolean;
  };
  readingUnresolved: boolean;
  reasons: string[];
}

export interface PredictedVerse {
  ref: string;
  canonicalRefs: string[];
  correspondence: string;
  text: string;
  tokens: string[];
  carriers: PredictedCarrier[];
  decisions: PredictedDecision[];
  resolutionIssues: string[];
}

export interface PredictionRun {
  version: typeof PREDICTION_VERSION;
  runId: string;
  edition: EditionDefinition["id"];
  scenario: ScenarioId;
  split: string;
  chapters: string[];
  policy: EnginePolicy;
  excludedWitnesses: string[];
  profileBible: string;
  ledgerBible: string;
  dictionaryPath: string;
  verses: PredictedVerse[];
}

export interface PredictionManifest {
  version: typeof PREDICTION_VERSION;
  runId: string;
  createdAt: string;
  durationMs: number;
  inputs: Record<string, string>;
  code: Record<string, string>;
  options: Record<string, unknown>;
  predictionsSha256: string;
  evaluatorAccess: "none";
}

export function assertNoEvaluatorInput(paths: string[]): void {
  const forbidden = [
    path.resolve(ACQUISITION_ROOT),
    path.resolve(EVALUATOR_ROOT)
  ];
  for (const candidate of paths) {
    const resolved = path.resolve(candidate);
    if (
      forbidden.some(
        (root) => resolved === root || resolved.startsWith(`${root}${path.sep}`)
      )
    )
      throw new Error(`evaluator-input-forbidden:${candidate}`);
  }
}

/** Prediction-side code whose hash pins every run. */
export async function predictionCodeHashes(): Promise<Record<string, string>> {
  const files = [
    ...(await readdir("src", { recursive: true }))
      .filter((file) => file.endsWith(".ts"))
      .map((file) => path.join("src", file)),
    "scripts/strong-concordance-rebuild/predict.ts",
    "scripts/strong-concordance-rebuild/shared.ts"
  ].sort();
  return Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [file, await fileSha256(file)] as const)
    )
  );
}

const STEP_FILES = [
  "data/external/stepbible/amalgamated/TAHOT Gen-Deu.txt",
  "data/external/stepbible/amalgamated/TAHOT Jos-Est.txt",
  "data/external/stepbible/amalgamated/TAHOT Job-Sng.txt",
  "data/external/stepbible/amalgamated/TAHOT Isa-Mal.txt",
  "data/external/stepbible/amalgamated/TAGNT Mat-Jhn.txt",
  "data/external/stepbible/amalgamated/TAGNT Act-Rev.txt"
];

/**
 * Native chapters to generate: for a Bible with its own versification, every
 * native verse whose correspondence block touches a planned canonical chapter.
 */
async function nativeScope(
  edition: EditionDefinition,
  chapters: string[]
): Promise<{
  onlyRef: string;
  canonicalByNative: Map<string, { refs: string[]; kind: string }>;
}> {
  const canonicalByNative = new Map<string, { refs: string[]; kind: string }>();
  const planned = new Set(chapters);
  if (
    edition.localText.kind !== "bible-json" ||
    !edition.localText.verseCorrespondencePath
  )
    return { onlyRef: chapters.join(","), canonicalByNative };
  const manifest = JSON.parse(
    await readFile(edition.localText.verseCorrespondencePath, "utf8")
  ) as {
    blocks: Array<{
      targetRefs: string[];
      canonicalRefs: string[];
      kind: string;
    }>;
  };
  const nativeChapters = new Set<string>();
  for (const block of manifest.blocks) {
    const touches = block.canonicalRefs.some((ref) =>
      planned.has(ref.split(".").slice(0, 2).join("."))
    );
    if (!touches) continue;
    for (const ref of block.targetRefs) {
      nativeChapters.add(ref.split(".").slice(0, 2).join("."));
      canonicalByNative.set(ref, {
        refs: block.canonicalRefs,
        kind: block.kind
      });
    }
  }
  return { onlyRef: [...nativeChapters].join(","), canonicalByNative };
}

function compactCarrier(
  annotation: StrongLedgerVerse["annotations"][number]
): PredictedCarrier {
  return {
    id: annotation.id,
    strong: annotation.strong,
    visibility: annotation.visibility,
    placement: annotation.placement,
    startWordIndex: annotation.startWordIndex ?? annotation.wordIndex,
    endWordIndex: annotation.endWordIndex ?? annotation.wordIndex,
    insertAfterWordIndex: annotation.insertAfterWordIndex,
    source: annotation.source,
    confidence: annotation.confidence,
    diagnostic: annotation.diagnostics[0] ?? null,
    originalOccurrenceId: annotation.originalOccurrenceId,
    resolutionUnitId: annotation.resolutionUnitId,
    resolutionState: annotation.resolutionState
  };
}

export async function predict(options: {
  editionId: EditionDefinition["id"];
  scenario: ScenarioId;
  split: string;
  chapters: string[];
  policy: EnginePolicy;
  /** Translation profile override, to compare a common rule with an edition adaptation. */
  profileBible?: string;
}): Promise<{ run: PredictionRun; manifest: PredictionManifest }> {
  const started = Date.now();
  const edition = {
    ...EDITIONS[options.editionId],
    ...(options.profileBible ? { profileBible: options.profileBible } : {})
  };
  const excluded = excludedWitnesses(edition, options.scenario);
  const runId = [
    edition.id,
    options.scenario,
    options.split,
    policyId(options.policy) +
      (options.profileBible ? `__profile-${options.profileBible}` : "")
  ].join("__");
  const workDir = await mkdtemp(
    path.join(tmpdir(), "strong-concordance-predict-")
  );
  try {
    let biblePath: string;
    let onlyRef: string | undefined;
    let canonicalByNative = new Map<string, { refs: string[]; kind: string }>();
    const inputPaths: string[] = [DICTIONARY_PATH, ...STEP_FILES];
    const usedWitnesses = (["Sg1910", "Darby", "DarbyR"] as const).filter(
      (witness) => !excluded.includes(witness)
    );
    inputPaths.push(
      ...usedWitnesses.map((witness) => `data/strongs/${witness}.csv`)
    );
    if (edition.localText.kind === "bible-json") {
      biblePath = edition.localText.path;
      inputPaths.push(biblePath);
      if (edition.localText.verseCorrespondencePath)
        inputPaths.push(edition.localText.verseCorrespondencePath);
      const scope = await nativeScope(edition, options.chapters);
      onlyRef = scope.onlyRef;
      canonicalByNative = scope.canonicalByNative;
    } else {
      // A witness edition is its own target: strip its tags and notes into a
      // masked Bible; the CSV itself is withheld from the witnesses above.
      inputPaths.push(edition.localText.path);
      const planned = new Set(options.chapters);
      const rows = (await readStrongCsv(edition.localText.path)).filter((row) =>
        planned.has(`${row.bookId}.${row.chapter}`)
      );
      const bible: Record<string, Record<string, Record<string, string>>> = {};
      for (const row of rows) {
        const bookNumber = String(BOOK_IDS.indexOf(row.bookId as never) + 1);
        if (bookNumber === "0") continue;
        bible[bookNumber] ??= {};
        bible[bookNumber]![String(row.chapter)] ??= {};
        bible[bookNumber]![String(row.chapter)]![String(row.verse)] = stripTags(
          withoutPublisherNotes(row.text)
        );
      }
      biblePath = path.join(workDir, "masked-target.json");
      await writeFile(biblePath, `${JSON.stringify(bible)}\n`, "utf8");
    }
    assertNoEvaluatorInput([...inputPaths, biblePath]);
    const ledger = await generateStrongLedger({
      dictionaryPath: DICTIONARY_PATH,
      bible: edition.ledgerBible,
      profileBible: edition.profileBible,
      biblePath,
      outputDir: path.join(workDir, "ledger"),
      onlyRef,
      writeArtifacts: false,
      writeLexicalReport: false,
      applyCuratedOverrides: false,
      excludedReferenceNames: excluded,
      verseCorrespondencePath:
        edition.localText.kind === "bible-json"
          ? edition.localText.verseCorrespondencePath
          : undefined,
      ...(policyId(options.policy) === "initial"
        ? {}
        : { experimentalPolicy: options.policy })
    });
    const verses: PredictedVerse[] = ledger.verses.map((verse) => {
      const mapping = canonicalByNative.get(verse.ref);
      return {
        ref: verse.ref,
        canonicalRefs: mapping?.refs ?? [verse.ref],
        correspondence: mapping?.kind ?? "identity",
        text: verse.text,
        tokens: verse.tokens.map((token) => token.text),
        carriers: verse.annotations.map(compactCarrier),
        decisions: (verse.resolution?.decisions ?? []).map((decision) => ({
          sourceUnitId: decision.sourceUnitId,
          occurrenceIds: decision.occurrenceIds,
          strong: decision.strong,
          state: decision.state,
          assurance: decision.assurance,
          targetWordIndices: decision.targetWordIndices,
          anchor: decision.anchor
            ? {
                insertAfterWordIndex: decision.anchor.insertAfterWordIndex,
                method: decision.anchor.method,
                assurance: decision.anchor.assurance,
                absenceEstablished: decision.anchor.absenceEstablished
              }
            : undefined,
          readingUnresolved: decision.source.readingUnresolved,
          reasons: decision.reasons.slice(0, 4)
        })),
        resolutionIssues: verse.resolution?.issues ?? []
      };
    });
    const run: PredictionRun = {
      version: PREDICTION_VERSION,
      runId,
      edition: edition.id,
      scenario: options.scenario,
      split: options.split,
      chapters: [...options.chapters],
      policy: options.policy,
      excludedWitnesses: excluded,
      profileBible: edition.profileBible,
      ledgerBible: edition.ledgerBible,
      dictionaryPath: DICTIONARY_PATH,
      verses
    };
    const inputs: Record<string, string> = {};
    for (const file of [...new Set(inputPaths)].sort())
      inputs[file] = await fileSha256(file);
    if (edition.localText.kind === "witness-csv")
      inputs["masked-target.json"] = await fileSha256(biblePath);
    const manifest: PredictionManifest = {
      version: PREDICTION_VERSION,
      runId,
      createdAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      inputs,
      code: await predictionCodeHashes(),
      options: {
        bible: edition.ledgerBible,
        profileBible: edition.profileBible,
        onlyRef: onlyRef ?? null,
        applyCuratedOverrides: false,
        excludedReferenceNames: excluded,
        policy: options.policy
      },
      predictionsSha256: sha256(stableStringify(run)),
      evaluatorAccess: "none"
    };
    return { run, manifest };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
