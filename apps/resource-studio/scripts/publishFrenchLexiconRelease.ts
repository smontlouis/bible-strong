import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

import {
  frenchRenderedHtmlSkeleton,
  frenchSourceHtmlSkeleton
} from "../src/lexiconV3/frenchHtmlRenderer.js";
import { hashFrenchInternalJson } from "../src/lexiconV3/frenchInternalReview.js";
import { lexiconV3FieldContentHash } from "../src/lexiconV3/review.js";

export const FRENCH_LEXICON_RELEASE_VERSION =
  "publish-french-lexicon-release@1" as const;

const DEFAULT_CORE_ROOT = "outputs/lexicon-fr-quality/revision/core";
const DEFAULT_LSJ_ROOT = "outputs/lexicon-fr-quality/revision/lsj";
const DEFAULT_BASELINE_ROOT =
  "outputs/lexicon-v3/fr-runs/lexicon-v3-en-2026-07-14.4/fr-adaptive/full";

export interface FrenchLexiconReleaseOptions {
  coreTasksPath: string;
  coreFinalPath: string;
  coreProvenancePath: string;
  coreSummaryPath: string;
  lsjFinalPath: string;
  lsjSummaryPath: string;
  authoringTemplatePath: string;
  productionTemplatePath: string;
  authoringTargetPath: string;
  productionTargetPath: string;
  occurrencesPath: string;
  candidateDirectory: string;
  archiveDirectory: string;
  reportPath: string;
  releaseKey: string;
}

interface CoreTask {
  entryKey: string;
  sourceHash: string;
  taskHash: string;
  identity: {
    stepEntryId: number;
    language: string;
    eStrong: string;
    dStrong: string;
    uStrong: string;
    original: string;
    transliteration: string;
    morph: string;
  };
  english: { gloss: string; meaning: string; meaningHtml: string };
}

interface CoreFinal {
  entryKey: string;
  sourceHash: string;
  taskHash: string;
  translationHash: string;
  reviewHash: string;
  arbitrationHash: string | null;
  finalHash: string;
  glossFr: string;
  meaningFr: string;
  meaningHtmlFr: string;
  validation: {
    valid: boolean;
    validationHash: string;
    rendered?: { meaningFr: string; meaningHtmlFr: string };
  };
}

interface AgentPointer {
  batchId: string;
  promptVersion: string;
  model: string;
  reasoningEffort: string;
  responseHash: string;
}

interface CoreProvenance {
  entryKey: string;
  sourceHash: string;
  taskHash: string;
  pipelineVersion: string;
  finalHash: string;
  translation?: AgentPointer & { translationHash?: string };
  translatorRevision?: AgentPointer & { translationHash?: string };
  review: AgentPointer & { reviewHash?: string };
  arbitration: (AgentPointer & { arbitrationHash?: string }) | null;
  deterministicValidation?: { valid: boolean; validationHash?: string };
  reviewedValidation?: { valid: boolean; validationHash?: string };
}

interface LsjFinal {
  key: string;
  sourceId: number;
  sourceHash: string;
  contentHtmlFr: string;
  contentTextFr: string;
  translationHash: string;
  stage: string;
  validation: { valid: boolean; issues?: string[]; checks?: unknown };
  provenance: unknown;
}

interface StepRow {
  id: number;
  language: string;
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  gloss: string;
  meaning: string;
}

interface BuildExpectation {
  stepEntries: number;
  resources: number;
  stepEntriesFingerprint: string;
  englishFingerprint: string;
  resourceSourceFingerprint: string;
  protectedFingerprint: string;
}

interface CandidateVerification extends BuildExpectation {
  integrity: string;
  foreignKeyErrors: number;
  frenchEntries: number;
  frenchProvenance: number;
  frenchResources: number;
  resourceProvenance: number;
  coreTranslationFingerprint: string;
  resourceTranslationFingerprint: string;
}

interface PreparedInputs {
  tasks: CoreTask[];
  finals: CoreFinal[];
  provenance: CoreProvenance[];
  resources: LsjFinal[];
  coreTranslationFingerprint: string;
  resourceTranslationFingerprint: string;
  artifacts: Record<string, ReturnType<typeof artifact>>;
}

export function publishFrenchLexiconRelease(
  rawOptions: FrenchLexiconReleaseOptions
): object {
  const options = normalizeOptions(rawOptions);
  assertOptions(options);
  const occurrenceHashBefore = sha256File(options.occurrencesPath);
  const inputs = prepareInputs(options);
  const authoringExpectation = inspectTemplate(options.authoringTemplatePath);
  const productionExpectation = inspectTemplate(options.productionTemplatePath);
  assertTemplateCompatibility(
    authoringExpectation,
    productionExpectation,
    inputs
  );

  mkdirSync(options.candidateDirectory, { recursive: true });
  mkdirSync(options.archiveDirectory, { recursive: true });
  const authoringCandidate = resolve(
    options.candidateDirectory,
    "strong_lexicon.full.production.candidate.sqlite"
  );
  const productionCandidate = resolve(
    options.candidateDirectory,
    "strong_lexicon.en-fr.full.production.candidate.sqlite"
  );
  buildCandidate({
    templatePath: options.authoringTemplatePath,
    outputPath: authoringCandidate,
    expectation: authoringExpectation,
    inputs,
    options
  });
  buildCandidate({
    templatePath: options.productionTemplatePath,
    outputPath: productionCandidate,
    expectation: productionExpectation,
    inputs,
    options
  });

  const candidatePairs = [
    {
      role: "authoring",
      candidate: authoringCandidate,
      target: options.authoringTargetPath,
      expectation: authoringExpectation
    },
    {
      role: "production",
      candidate: productionCandidate,
      target: options.productionTargetPath,
      expectation: productionExpectation
    }
  ] as const;
  const candidateVerifications = candidatePairs.map((pair) =>
    verifyCandidate(
      pair.candidate,
      pair.expectation,
      inputs.coreTranslationFingerprint,
      inputs.resourceTranslationFingerprint
    )
  );
  const archives = candidatePairs.map((pair) =>
    archiveExisting(pair.target, options.archiveDirectory, pair.role)
  );

  const staged = candidatePairs.map((pair, index) => {
    const path = `${pair.target}.fr-release-stage-${process.pid}-${index}`;
    rmSync(path, { force: true });
    copyFileSync(pair.candidate, path);
    if (sha256File(path) !== sha256File(pair.candidate)) {
      throw new Error(`french-lexicon-release-staging-hash:${pair.role}`);
    }
    verifyCandidate(
      path,
      pair.expectation,
      inputs.coreTranslationFingerprint,
      inputs.resourceTranslationFingerprint
    );
    return { ...pair, path };
  });
  promotePair(staged);

  const occurrenceHashAfter = sha256File(options.occurrencesPath);
  if (occurrenceHashAfter !== occurrenceHashBefore) {
    throw new Error("french-lexicon-release-occurrences-mutated");
  }
  const published = candidatePairs.map((pair, index) => {
    const verification = verifyCandidate(
      pair.target,
      pair.expectation,
      inputs.coreTranslationFingerprint,
      inputs.resourceTranslationFingerprint
    );
    return {
      role: pair.role,
      path: pair.target,
      sha256: sha256File(pair.target),
      bytes: statSync(pair.target).size,
      archive: archives[index],
      verification
    };
  });
  const content = {
    schemaVersion: "french-lexicon-release-report@1",
    builderVersion: FRENCH_LEXICON_RELEASE_VERSION,
    releaseKey: options.releaseKey,
    publishedAt: new Date().toISOString(),
    execution: {
      internalOnly: true,
      cel: "forbidden",
      aiGateway: "forbidden",
      publication: "transactional-pair-with-rollback"
    },
    inputs: inputs.artifacts,
    counts: {
      coreEntries: inputs.finals.length,
      resourceEntries: inputs.resources.length
    },
    candidates: candidatePairs.map((pair, index) => ({
      role: pair.role,
      path: pair.candidate,
      sha256: sha256File(pair.candidate),
      bytes: statSync(pair.candidate).size,
      verification: candidateVerifications[index]
    })),
    occurrenceDatabase: {
      path: options.occurrencesPath,
      sha256Before: occurrenceHashBefore,
      sha256After: occurrenceHashAfter,
      unchanged: true
    },
    published
  };
  const report = { ...content, releaseHash: hashFrenchInternalJson(content) };
  installText(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function prepareInputs(options: FrenchLexiconReleaseOptions): PreparedInputs {
  const tasks = readJsonl<CoreTask>(options.coreTasksPath);
  const finals = readJsonl<CoreFinal>(options.coreFinalPath);
  const provenance = readJsonl<CoreProvenance>(options.coreProvenancePath);
  const resources = readJsonl<LsjFinal>(options.lsjFinalPath);
  verifyCoreSummary(
    options.coreSummaryPath,
    options.coreFinalPath,
    options.coreProvenancePath
  );
  verifyLsjSummary(options.lsjSummaryPath, options.lsjFinalPath);
  assertOrderedCoverage(tasks, finals, provenance);
  if (
    resources.length === 0 ||
    new Set(resources.map((row) => row.sourceId)).size !== resources.length
  ) {
    throw new Error("french-lexicon-release-lsj-coverage");
  }
  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index]!;
    const final = finals[index]!;
    const proof = provenance[index]!;
    if (
      final.entryKey !== task.entryKey ||
      proof.entryKey !== task.entryKey ||
      final.sourceHash !== task.sourceHash ||
      proof.sourceHash !== task.sourceHash ||
      final.taskHash !== task.taskHash ||
      proof.taskHash !== task.taskHash ||
      proof.finalHash !== final.finalHash ||
      !final.validation.valid ||
      !final.glossFr.trim() ||
      !final.meaningFr.trim() ||
      !final.meaningHtmlFr.trim() ||
      !isSha256(final.sourceHash) ||
      !isSha256(final.taskHash) ||
      !isSha256(final.finalHash) ||
      !isSha256(final.validation.validationHash) ||
      (final.validation.rendered !== undefined &&
        (final.validation.rendered.meaningFr !== final.meaningFr ||
          final.validation.rendered.meaningHtmlFr !== final.meaningHtmlFr)) ||
      !sameArray(
        frenchSourceHtmlSkeleton(task.english.meaningHtml),
        frenchRenderedHtmlSkeleton(final.meaningHtmlFr)
      )
    ) {
      throw new Error(`french-lexicon-release-invalid-core:${task.entryKey}`);
    }
    normalizeCoreProvenance(proof, final);
  }
  for (const row of resources) {
    if (
      !row.key ||
      !Number.isInteger(row.sourceId) ||
      row.sourceId <= 0 ||
      !row.contentHtmlFr.trim() ||
      !row.contentTextFr.trim() ||
      !row.validation.valid ||
      !isSha256(row.sourceHash) ||
      row.translationHash !== sha256(row.contentHtmlFr)
    ) {
      throw new Error(`french-lexicon-release-invalid-lsj:${row.key}`);
    }
  }
  return {
    tasks,
    finals,
    provenance,
    resources,
    coreTranslationFingerprint: expectedCoreTranslationFingerprint(
      tasks,
      finals
    ),
    resourceTranslationFingerprint: hashFrenchInternalJson(
      [...resources]
        .sort((left, right) => left.sourceId - right.sourceId)
        .map((row) => [row.sourceId, row.contentHtmlFr, row.contentTextFr])
    ),
    artifacts: {
      coreTasks: artifact(options.coreTasksPath),
      coreFinal: artifact(options.coreFinalPath),
      coreProvenance: artifact(options.coreProvenancePath),
      coreSummary: artifact(options.coreSummaryPath),
      lsjFinal: artifact(options.lsjFinalPath),
      lsjSummary: artifact(options.lsjSummaryPath)
    }
  };
}

export function expectedCoreTranslationFingerprint(
  tasks: Array<{ identity: { stepEntryId: number } }>,
  finals: Array<{
    glossFr: string;
    meaningFr: string;
    meaningHtmlFr: string;
  }>
): string {
  if (tasks.length !== finals.length) {
    throw new Error(
      `french-lexicon-release-core-fingerprint-coverage:${tasks.length}:${finals.length}`
    );
  }
  return hashFrenchInternalJson(
    finals
      .map(
        (row, index) =>
          [
            tasks[index]!.identity.stepEntryId,
            row.glossFr,
            row.meaningFr,
            row.meaningHtmlFr
          ] as const
      )
      .sort((left, right) => left[0] - right[0])
  );
}

function buildCandidate(input: {
  templatePath: string;
  outputPath: string;
  expectation: BuildExpectation;
  inputs: PreparedInputs;
  options: FrenchLexiconReleaseOptions;
}): void {
  const temporary = `${input.outputPath}.tmp-${process.pid}-${Date.now()}`;
  rmSync(temporary, { force: true });
  copyFileSync(input.templatePath, temporary);
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(temporary);
    db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON; BEGIN IMMEDIATE;"
    );
    try {
      installCore(db, input.inputs, input.options);
      installResources(db, input.inputs.resources, input.options);
      installMetadata(db, input.inputs, input.options);
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }
    const verification = verifyOpenDatabase(
      db,
      input.expectation,
      input.inputs.coreTranslationFingerprint,
      input.inputs.resourceTranslationFingerprint
    );
    if (
      verification.protectedFingerprint !==
      input.expectation.protectedFingerprint
    ) {
      throw new Error("french-lexicon-release-protected-data-mutated");
    }
    db.exec("PRAGMA journal_mode=DELETE; VACUUM;");
    verifyOpenDatabase(
      db,
      input.expectation,
      input.inputs.coreTranslationFingerprint,
      input.inputs.resourceTranslationFingerprint
    );
    db.close();
    db = null;
    rmSync(input.outputPath, { force: true });
    renameSync(temporary, input.outputPath);
  } catch (error) {
    db?.close();
    rmSync(temporary, { force: true });
    throw error;
  }
}

function installCore(
  db: DatabaseSync,
  inputs: PreparedInputs,
  options: FrenchLexiconReleaseOptions
): void {
  ensureCoreProvenanceTable(db);
  db.exec("DELETE FROM LexiconFrenchProvenance;");
  const selectStep = db.prepare(
    `SELECT id, language, eStrong, dStrong, uStrong, original, transliteration,
            morph, gloss, meaning FROM StepEntries WHERE id=?`
  );
  const selectTranslation = db.prepare(
    "SELECT gloss, meaning, meaningHtml FROM LexiconTranslations WHERE stepEntryId=? AND language='fr'"
  );
  const updateTranslation = db.prepare(
    "UPDATE LexiconTranslations SET gloss=?, meaning=?, meaningHtml=? WHERE stepEntryId=? AND language='fr'"
  );
  const hasStatuses = hasTable(db, "LexiconFieldStatus");
  const selectStatus = hasStatuses
    ? db.prepare(
        "SELECT field, fieldVersionId, derivedFromVersionId FROM LexiconFieldStatus WHERE stepEntryId=? AND locale='fr' ORDER BY field"
      )
    : null;
  const updateStatus = hasStatuses
    ? db.prepare(
        `UPDATE LexiconFieldStatus
            SET fieldVersionId=?, state='auto_validated', confidence=1.0,
                method='targeted-translation-revision', generator=?, contentHash=?, releaseKey=?
          WHERE stepEntryId=? AND locale='fr' AND field=?`
      )
    : null;
  let nextVersion = hasStatuses
    ? scalar(
        db,
        "SELECT coalesce(max(fieldVersionId),0) FROM LexiconFieldStatus"
      ) + 1
    : 0;
  const insertProof = db.prepare(
    `INSERT INTO LexiconFrenchProvenance(
       stepEntryId, entryKey, sourceHash, taskHash, translationHash, reviewHash,
       arbitrationHash, finalHash, finalValidationHash, pipelineVersion,
       translatorPromptVersion, translatorModel, translatorReasoning,
       translatorResponseHash, reviewerPromptVersion, reviewerModel,
       reviewerReasoning, reviewerResponseHash, arbiterPromptVersion,
       arbiterModel, arbiterReasoning, arbiterResponseHash, validationPassed
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );
  for (let index = 0; index < inputs.tasks.length; index += 1) {
    const task = inputs.tasks[index]!;
    const final = inputs.finals[index]!;
    const proof = normalizeCoreProvenance(inputs.provenance[index]!, final);
    const step = selectStep.get(task.identity.stepEntryId) as unknown as
      | StepRow
      | undefined;
    assertStep(task, step);
    const previous = selectTranslation.get(task.identity.stepEntryId) as
      | { gloss: string; meaning: string; meaningHtml: string }
      | undefined;
    if (!previous)
      throw new Error(`french-lexicon-release-missing-fr:${task.entryKey}`);
    const changedGloss = previous.gloss !== final.glossFr;
    const changedMeaning =
      previous.meaning !== final.meaningFr ||
      previous.meaningHtml !== final.meaningHtmlFr;
    const result = updateTranslation.run(
      final.glossFr,
      final.meaningFr,
      final.meaningHtmlFr,
      task.identity.stepEntryId
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`french-lexicon-release-update-core:${task.entryKey}`);
    }
    if (selectStatus && updateStatus && (changedGloss || changedMeaning)) {
      const statuses = selectStatus.all(
        task.identity.stepEntryId
      ) as unknown as Array<{
        field: "gloss" | "meaning";
        fieldVersionId: number;
        derivedFromVersionId: number | null;
      }>;
      if (statuses.length !== 2) {
        throw new Error(`french-lexicon-release-fr-status:${task.entryKey}`);
      }
      for (const status of statuses) {
        if (
          (status.field === "gloss" && !changedGloss) ||
          (status.field === "meaning" && !changedMeaning)
        ) {
          continue;
        }
        const contentHash = lexiconV3FieldContentHash({
          entryKey: task.entryKey,
          locale: "fr",
          field: status.field,
          valueText: status.field === "gloss" ? final.glossFr : final.meaningFr,
          valueHtml: status.field === "meaning" ? final.meaningHtmlFr : null,
          derivedFromVersionId: status.derivedFromVersionId
        });
        updateStatus.run(
          nextVersion++,
          proof.pipelineVersion,
          contentHash,
          options.releaseKey,
          task.identity.stepEntryId,
          status.field
        );
      }
    }
    insertProof.run(
      task.identity.stepEntryId,
      task.entryKey,
      task.sourceHash,
      task.taskHash,
      proof.translationHash,
      proof.reviewHash,
      proof.arbitrationHash,
      final.finalHash,
      final.validation.validationHash,
      proof.pipelineVersion,
      proof.translator.promptVersion,
      proof.translator.model,
      proof.translator.reasoningEffort,
      proof.translator.responseHash,
      proof.reviewer.promptVersion,
      proof.reviewer.model,
      proof.reviewer.reasoningEffort,
      proof.reviewer.responseHash,
      proof.arbiter?.promptVersion ?? null,
      proof.arbiter?.model ?? null,
      proof.arbiter?.reasoningEffort ?? null,
      proof.arbiter?.responseHash ?? null
    );
  }
}

function installResources(
  db: DatabaseSync,
  resources: LsjFinal[],
  options: FrenchLexiconReleaseOptions
): void {
  ensureResourceProvenanceTable(db);
  db.exec("DELETE FROM LexiconResourceProvenance;");
  const select = db.prepare(
    "SELECT contentHtml FROM LexiconResources WHERE id=?"
  );
  const update = db.prepare(
    "UPDATE LexiconResourceTranslations SET contentHtml=?, contentText=? WHERE resourceId=? AND language='fr'"
  );
  const insertProof = db.prepare(
    `INSERT INTO LexiconResourceProvenance(
       resourceId, sourceHash, translationHash, importedFrom, validationResult
     ) VALUES (?, ?, ?, ?, ?)`
  );
  for (const row of resources) {
    const source = select.get(row.sourceId) as
      | { contentHtml: string }
      | undefined;
    if (!source || lsjAuditSourceHash(source.contentHtml) !== row.sourceHash) {
      throw new Error(`french-lexicon-release-lsj-source-drift:${row.key}`);
    }
    const result = update.run(
      row.contentHtmlFr,
      row.contentTextFr,
      row.sourceId
    );
    if (Number(result.changes) !== 1) {
      throw new Error(`french-lexicon-release-update-lsj:${row.key}`);
    }
    insertProof.run(
      row.sourceId,
      row.sourceHash,
      row.translationHash,
      options.lsjFinalPath,
      JSON.stringify({
        valid: true,
        stage: row.stage,
        validation: row.validation,
        provenance: row.provenance,
        releaseKey: options.releaseKey
      })
    );
  }
}

function installMetadata(
  db: DatabaseSync,
  inputs: PreparedInputs,
  options: FrenchLexiconReleaseOptions
): void {
  const upsert = db.prepare(
    `INSERT INTO DictionaryMeta(key,value) VALUES (?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  );
  const values: Record<string, string> = {
    lexiconFrenchQualityReleaseKey: options.releaseKey,
    lexiconFrenchQualityReleaseVersion: FRENCH_LEXICON_RELEASE_VERSION,
    lexiconFrenchQualityCoreFinalSha256: inputs.artifacts.coreFinal.sha256,
    lexiconFrenchQualityCoreProvenanceSha256:
      inputs.artifacts.coreProvenance.sha256,
    lexiconFrenchQualityLsjFinalSha256: inputs.artifacts.lsjFinal.sha256,
    lexiconFrenchQualityExecution:
      "internal-codex;cel=forbidden;ai-gateway=forbidden",
    generatedAt: new Date().toISOString()
  };
  for (const [key, value] of Object.entries(values)) upsert.run(key, value);
}

function inspectTemplate(path: string): BuildExpectation {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const integrity = String(
      db.prepare("PRAGMA integrity_check").get()?.integrity_check ?? ""
    );
    if (
      integrity !== "ok" ||
      db.prepare("PRAGMA foreign_key_check").all().length !== 0
    ) {
      throw new Error(`french-lexicon-release-invalid-template:${path}`);
    }
    return {
      stepEntries: scalar(db, "SELECT count(*) FROM StepEntries"),
      resources: scalar(db, "SELECT count(*) FROM LexiconResources"),
      stepEntriesFingerprint: tableFingerprint(db, "StepEntries"),
      englishFingerprint: englishFingerprint(db),
      resourceSourceFingerprint: tableFingerprint(db, "LexiconResources"),
      protectedFingerprint: protectedFingerprint(db)
    };
  } finally {
    db.close();
  }
}

function verifyCandidate(
  path: string,
  expectation: BuildExpectation,
  expectedCore: string,
  expectedResources: string
): CandidateVerification {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return verifyOpenDatabase(db, expectation, expectedCore, expectedResources);
  } finally {
    db.close();
  }
}

function verifyOpenDatabase(
  db: DatabaseSync,
  expectation: BuildExpectation,
  expectedCore: string,
  expectedResources: string
): CandidateVerification {
  const result: CandidateVerification = {
    integrity: String(
      db.prepare("PRAGMA integrity_check").get()?.integrity_check ?? ""
    ),
    foreignKeyErrors: db.prepare("PRAGMA foreign_key_check").all().length,
    stepEntries: scalar(db, "SELECT count(*) FROM StepEntries"),
    resources: scalar(db, "SELECT count(*) FROM LexiconResources"),
    frenchEntries: scalar(
      db,
      "SELECT count(*) FROM LexiconTranslations WHERE language='fr'"
    ),
    frenchProvenance: scalar(
      db,
      "SELECT count(*) FROM LexiconFrenchProvenance"
    ),
    frenchResources: scalar(
      db,
      "SELECT count(*) FROM LexiconResourceTranslations WHERE language='fr'"
    ),
    resourceProvenance: scalar(
      db,
      "SELECT count(*) FROM LexiconResourceProvenance"
    ),
    stepEntriesFingerprint: tableFingerprint(db, "StepEntries"),
    englishFingerprint: englishFingerprint(db),
    resourceSourceFingerprint: tableFingerprint(db, "LexiconResources"),
    protectedFingerprint: protectedFingerprint(db),
    coreTranslationFingerprint: coreTranslationFingerprint(db),
    resourceTranslationFingerprint: resourceTranslationFingerprint(db)
  };
  if (
    result.integrity !== "ok" ||
    result.foreignKeyErrors !== 0 ||
    result.stepEntries !== expectation.stepEntries ||
    result.resources !== expectation.resources ||
    result.frenchEntries !== expectation.stepEntries ||
    result.frenchProvenance !== expectation.stepEntries ||
    result.frenchResources !== expectation.resources ||
    result.resourceProvenance !== expectation.resources ||
    result.stepEntriesFingerprint !== expectation.stepEntriesFingerprint ||
    result.englishFingerprint !== expectation.englishFingerprint ||
    result.resourceSourceFingerprint !==
      expectation.resourceSourceFingerprint ||
    result.protectedFingerprint !== expectation.protectedFingerprint ||
    result.coreTranslationFingerprint !== expectedCore ||
    result.resourceTranslationFingerprint !== expectedResources ||
    scalar(
      db,
      `SELECT count(*) FROM LexiconTranslations
       WHERE language='fr' AND (trim(gloss)='' OR trim(meaning)='' OR trim(meaningHtml)='')`
    ) !== 0 ||
    scalar(
      db,
      `SELECT count(*) FROM LexiconResourceTranslations
       WHERE language='fr' AND (trim(contentHtml)='' OR trim(contentText)='')`
    ) !== 0
  ) {
    throw new Error(
      `french-lexicon-release-candidate-gate:${JSON.stringify(result)}`
    );
  }
  return result;
}

function assertTemplateCompatibility(
  authoring: BuildExpectation,
  production: BuildExpectation,
  inputs: PreparedInputs
): void {
  if (
    authoring.stepEntries !== production.stepEntries ||
    authoring.resources !== production.resources ||
    authoring.stepEntriesFingerprint !== production.stepEntriesFingerprint ||
    authoring.resourceSourceFingerprint !==
      production.resourceSourceFingerprint ||
    inputs.tasks.length !== authoring.stepEntries ||
    inputs.resources.length !== authoring.resources
  ) {
    throw new Error("french-lexicon-release-template-coverage-drift");
  }
}

function assertStep(
  task: CoreTask,
  step: StepRow | undefined
): asserts step is StepRow {
  if (
    !step ||
    step.id !== task.identity.stepEntryId ||
    step.language !== task.identity.language ||
    step.eStrong !== task.identity.eStrong ||
    step.dStrong !== task.identity.dStrong ||
    step.uStrong !== task.identity.uStrong ||
    step.original !== task.identity.original ||
    step.transliteration !== task.identity.transliteration ||
    step.morph !== task.identity.morph ||
    step.gloss !== task.english.gloss ||
    (step.meaning !== task.english.meaning &&
      step.meaning !== task.english.meaningHtml)
  ) {
    throw new Error(`french-lexicon-release-step-drift:${task.entryKey}`);
  }
}

function normalizeCoreProvenance(
  proof: CoreProvenance,
  final: CoreFinal
): {
  pipelineVersion: string;
  translationHash: string;
  reviewHash: string;
  arbitrationHash: string | null;
  translator: AgentPointer;
  reviewer: AgentPointer;
  arbiter: AgentPointer | null;
} {
  const translator = proof.translatorRevision ?? proof.translation;
  if (!translator || !validPointer(translator) || !validPointer(proof.review)) {
    throw new Error(
      `french-lexicon-release-provenance-pointer:${proof.entryKey}`
    );
  }
  if (proof.arbitration && !validPointer(proof.arbitration)) {
    throw new Error(
      `french-lexicon-release-provenance-arbiter:${proof.entryKey}`
    );
  }
  const translationHash = translator.translationHash ?? final.translationHash;
  const reviewHash = proof.review.reviewHash ?? final.reviewHash;
  const arbitrationHash =
    proof.arbitration?.arbitrationHash ?? final.arbitrationHash;
  if (
    !proof.pipelineVersion ||
    !isSha256(translationHash) ||
    !isSha256(reviewHash) ||
    (arbitrationHash !== null && !isSha256(arbitrationHash)) ||
    translationHash !== final.translationHash ||
    reviewHash !== final.reviewHash ||
    arbitrationHash !== final.arbitrationHash
  ) {
    throw new Error(`french-lexicon-release-provenance-hash:${proof.entryKey}`);
  }
  return {
    pipelineVersion: proof.pipelineVersion,
    translationHash,
    reviewHash,
    arbitrationHash,
    translator,
    reviewer: proof.review,
    arbiter: proof.arbitration
  };
}

function validPointer(value: AgentPointer): boolean {
  return Boolean(
    value.batchId &&
    value.promptVersion &&
    value.model &&
    value.reasoningEffort &&
    isSha256(value.responseHash)
  );
}

function ensureCoreProvenanceTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS LexiconFrenchProvenance (
      stepEntryId INTEGER PRIMARY KEY,
      entryKey TEXT NOT NULL UNIQUE,
      sourceHash TEXT NOT NULL,
      taskHash TEXT NOT NULL,
      translationHash TEXT NOT NULL,
      reviewHash TEXT NOT NULL,
      arbitrationHash TEXT,
      finalHash TEXT NOT NULL,
      finalValidationHash TEXT NOT NULL,
      pipelineVersion TEXT NOT NULL,
      translatorPromptVersion TEXT NOT NULL,
      translatorModel TEXT NOT NULL,
      translatorReasoning TEXT NOT NULL,
      translatorResponseHash TEXT NOT NULL,
      reviewerPromptVersion TEXT NOT NULL,
      reviewerModel TEXT NOT NULL,
      reviewerReasoning TEXT NOT NULL,
      reviewerResponseHash TEXT NOT NULL,
      arbiterPromptVersion TEXT,
      arbiterModel TEXT,
      arbiterReasoning TEXT,
      arbiterResponseHash TEXT,
      validationPassed INTEGER NOT NULL CHECK(validationPassed = 1),
      FOREIGN KEY(stepEntryId) REFERENCES StepEntries(id) ON DELETE CASCADE
    ) WITHOUT ROWID;
  `);
}

function ensureResourceProvenanceTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS LexiconResourceProvenance (
      resourceId INTEGER PRIMARY KEY,
      sourceHash TEXT NOT NULL,
      translationHash TEXT NOT NULL,
      importedFrom TEXT NOT NULL,
      validationResult TEXT NOT NULL
    );
  `);
}

function verifyCoreSummary(
  summaryPath: string,
  finalPath: string,
  provenancePath: string
): void {
  const summary = readVerifiedSummary(summaryPath);
  const outputs = summary.outputs as
    | Record<string, { sha256?: string }>
    | undefined;
  if (
    summary.status !== "complete" ||
    Number(summary.invalidFinal) !== 0 ||
    !outputs ||
    outputs.final?.sha256 !== sha256File(finalPath) ||
    outputs.provenance?.sha256 !== sha256File(provenancePath) ||
    !isInternalOnly(summary.execution)
  ) {
    throw new Error("french-lexicon-release-core-summary");
  }
}

function verifyLsjSummary(summaryPath: string, finalPath: string): void {
  const summary = readVerifiedSummary(summaryPath);
  const counts = summary.counts as Record<string, unknown> | undefined;
  const artifacts = summary.artifacts as
    | Record<string, { sha256?: string }>
    | undefined;
  if (
    summary.status !== "complete" ||
    summary.scope !== "full" ||
    Number(counts?.invalidFinal) !== 0 ||
    artifacts?.finalResources?.sha256 !== sha256File(finalPath) ||
    !isInternalOnly(summary.execution)
  ) {
    throw new Error("french-lexicon-release-lsj-summary");
  }
}

function readVerifiedSummary(path: string): Record<string, unknown> {
  const summary = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  const runHash = summary.runHash;
  const content = { ...summary };
  delete content.runHash;
  if (!isSha256(runHash) || hashFrenchInternalJson(content) !== runHash) {
    throw new Error(`french-lexicon-release-summary-hash:${path}`);
  }
  return summary;
}

function isInternalOnly(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const execution = value as Record<string, unknown>;
  return (
    execution.internalCodex === true &&
    execution.cel === "forbidden" &&
    execution.aiGateway === "forbidden"
  );
}

function promotePair(
  pairs: ReadonlyArray<{ role: string; path: string; target: string }>
): void {
  const backups = pairs.map((pair, index) => ({
    ...pair,
    backup: `${pair.target}.fr-release-rollback-${process.pid}-${index}`,
    installed: false,
    moved: false
  }));
  for (const pair of backups) rmSync(pair.backup, { force: true });
  try {
    for (const pair of backups) {
      renameSync(pair.target, pair.backup);
      pair.moved = true;
    }
    for (const pair of backups) {
      renameSync(pair.path, pair.target);
      pair.installed = true;
    }
  } catch (error) {
    for (const pair of [...backups].reverse()) {
      if (pair.installed && existsSync(pair.target))
        rmSync(pair.target, { force: true });
      if (pair.moved && existsSync(pair.backup))
        renameSync(pair.backup, pair.target);
    }
    throw error;
  } finally {
    for (const pair of backups) rmSync(pair.path, { force: true });
  }
  for (const pair of backups) rmSync(pair.backup, { force: true });
}

function archiveExisting(
  target: string,
  directory: string,
  role: string
): string {
  const digest = sha256File(target);
  const path = resolve(
    directory,
    `${basename(target, ".sqlite")}.pre-fr-release-${role}-${digest.slice(0, 12)}.sqlite`
  );
  if (existsSync(path)) {
    if (sha256File(path) !== digest) {
      throw new Error(`french-lexicon-release-archive-collision:${role}`);
    }
    return path;
  }
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  copyFileSync(target, temporary);
  if (sha256File(temporary) !== digest) {
    rmSync(temporary, { force: true });
    throw new Error(`french-lexicon-release-archive-hash:${role}`);
  }
  renameSync(temporary, path);
  return path;
}

const MUTABLE_TABLES = new Set([
  "DictionaryMeta",
  "LexiconTranslations",
  "LexiconFieldStatus",
  "LexiconFrenchProvenance",
  "LexiconResourceTranslations",
  "LexiconResourceProvenance"
]);

function protectedFingerprint(db: DatabaseSync): string {
  const tables = (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as unknown as Array<{ name: string }>
  )
    .map((row) => row.name)
    .filter((name) => !MUTABLE_TABLES.has(name));
  return hashFrenchInternalJson(
    tables.map((name) => [name, tableRows(db, name)])
  );
}

function englishFingerprint(db: DatabaseSync): string {
  return hashFrenchInternalJson({
    entries: tableRows(db, "StepEntries"),
    statuses: hasTable(db, "LexiconFieldStatus")
      ? db
          .prepare(
            "SELECT * FROM LexiconFieldStatus WHERE locale='en' ORDER BY stepEntryId, field"
          )
          .all()
      : []
  });
}

function coreTranslationFingerprint(db: DatabaseSync): string {
  return hashFrenchInternalJson(
    (
      db
        .prepare(
          "SELECT stepEntryId, gloss, meaning, meaningHtml FROM LexiconTranslations WHERE language='fr' ORDER BY stepEntryId"
        )
        .all() as unknown as Array<Record<string, unknown>>
    ).map((row) => Object.values(row))
  );
}

function resourceTranslationFingerprint(db: DatabaseSync): string {
  return hashFrenchInternalJson(
    (
      db
        .prepare(
          "SELECT resourceId, contentHtml, contentText FROM LexiconResourceTranslations WHERE language='fr' ORDER BY resourceId"
        )
        .all() as unknown as Array<Record<string, unknown>>
    ).map((row) => Object.values(row))
  );
}

function tableFingerprint(db: DatabaseSync, table: string): string {
  return hashFrenchInternalJson(tableRows(db, table));
}

function tableRows(db: DatabaseSync, table: string): unknown[] {
  const columns = db
    .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
    .all() as unknown as Array<{
    name: string;
    pk: number;
  }>;
  const primary = columns
    .filter((column) => column.pk > 0)
    .sort((left, right) => left.pk - right.pk)
    .map((column) => quoteIdentifier(column.name));
  const order = primary.length
    ? primary
    : columns.map((column) => quoteIdentifier(column.name));
  return db
    .prepare(
      `SELECT * FROM ${quoteIdentifier(table)} ORDER BY ${order.join(",")}`
    )
    .all();
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function assertOrderedCoverage(
  tasks: CoreTask[],
  finals: CoreFinal[],
  proofs: CoreProvenance[]
): void {
  if (
    tasks.length === 0 ||
    finals.length !== tasks.length ||
    proofs.length !== tasks.length ||
    new Set(tasks.map((row) => row.entryKey)).size !== tasks.length ||
    tasks.some(
      (task, index) =>
        finals[index]?.entryKey !== task.entryKey ||
        proofs[index]?.entryKey !== task.entryKey
    )
  ) {
    throw new Error("french-lexicon-release-core-coverage");
  }
}

function hasTable(db: DatabaseSync, name: string): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
      .get(name)
  );
}

function scalar(db: DatabaseSync, sql: string): number {
  const row = db.prepare(sql).get() as Record<string, unknown> | undefined;
  return Number(Object.values(row ?? {})[0] ?? 0);
}

function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

function sameArray(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function lsjAuditSourceHash(contentHtml: string): string {
  return sha256(`${contentHtml}\n${stripHtml(contentHtml)}`);
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function artifact(path: string): {
  path: string;
  sha256: string;
  bytes: number;
} {
  return { path, sha256: sha256File(path), bytes: statSync(path).size };
}

function installText(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, value, "utf8");
  renameSync(temporary, path);
}

function normalizeOptions(
  options: FrenchLexiconReleaseOptions
): FrenchLexiconReleaseOptions {
  return Object.fromEntries(
    Object.entries(options).map(([key, value]) => [
      key,
      key === "releaseKey" ? value : resolve(value)
    ])
  ) as unknown as FrenchLexiconReleaseOptions;
}

function assertOptions(options: FrenchLexiconReleaseOptions): void {
  if (!/^[a-z0-9][a-z0-9._-]+$/u.test(options.releaseKey)) {
    throw new Error("french-lexicon-release-key");
  }
  for (const path of [
    options.coreTasksPath,
    options.coreFinalPath,
    options.coreProvenancePath,
    options.coreSummaryPath,
    options.lsjFinalPath,
    options.lsjSummaryPath,
    options.authoringTemplatePath,
    options.productionTemplatePath,
    options.authoringTargetPath,
    options.productionTargetPath,
    options.occurrencesPath
  ]) {
    if (!existsSync(path) || !statSync(path).isFile()) {
      throw new Error(`french-lexicon-release-missing:${path}`);
    }
  }
  if (
    options.authoringTargetPath === options.productionTargetPath ||
    options.authoringTargetPath === options.occurrencesPath ||
    options.productionTargetPath === options.occurrencesPath
  ) {
    throw new Error("french-lexicon-release-path-collision");
  }
}

export function parseFrenchLexiconReleaseArgs(
  argv: string[]
): FrenchLexiconReleaseOptions {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (!token.startsWith("--"))
      throw new Error(`unexpected-argument:${token}`);
    const [key, inline] = token.slice(2).split("=", 2);
    if (args.has(key)) throw new Error(`duplicate-option:${key}`);
    const value = inline ?? argv[++index];
    if (!value || value.startsWith("--"))
      throw new Error(`missing-value:${key}`);
    args.set(key, value);
  }
  const allowed = new Set([
    "core-tasks",
    "core-final",
    "core-provenance",
    "core-summary",
    "lsj-final",
    "lsj-summary",
    "authoring-template",
    "production-template",
    "authoring-target",
    "production-target",
    "occurrences",
    "candidate-directory",
    "archive-directory",
    "report",
    "release-key"
  ]);
  for (const key of args.keys())
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
  const releaseKey = args.get("release-key");
  if (!releaseKey) throw new Error("missing-value:release-key");
  return {
    coreTasksPath:
      args.get("core-tasks") ?? `${DEFAULT_BASELINE_ROOT}/tasks.jsonl`,
    coreFinalPath: args.get("core-final") ?? `${DEFAULT_CORE_ROOT}/final.jsonl`,
    coreProvenancePath:
      args.get("core-provenance") ?? `${DEFAULT_CORE_ROOT}/provenance.jsonl`,
    coreSummaryPath:
      args.get("core-summary") ?? `${DEFAULT_CORE_ROOT}/summary.json`,
    lsjFinalPath:
      args.get("lsj-final") ?? `${DEFAULT_LSJ_ROOT}/final-resources.jsonl`,
    lsjSummaryPath:
      args.get("lsj-summary") ?? `${DEFAULT_LSJ_ROOT}/summary.json`,
    authoringTemplatePath:
      args.get("authoring-template") ??
      "data/dictionaries/strong_lexicon.full.production.sqlite",
    productionTemplatePath:
      args.get("production-template") ??
      "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite",
    authoringTargetPath:
      args.get("authoring-target") ??
      "data/dictionaries/strong_lexicon.full.production.sqlite",
    productionTargetPath:
      args.get("production-target") ??
      "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite",
    occurrencesPath:
      args.get("occurrences") ??
      "data/dictionaries/strong_lexicon.occurrences.production.sqlite",
    candidateDirectory:
      args.get("candidate-directory") ??
      "outputs/lexicon-fr-quality/release/final",
    archiveDirectory:
      args.get("archive-directory") ?? "data/dictionaries/archive",
    reportPath:
      args.get("report") ??
      "outputs/lexicon-fr-quality/release/final/publication.json",
    releaseKey
  };
}

function isMain(): boolean {
  return (
    Boolean(process.argv[1]) &&
    import.meta.url === pathToFileURL(resolve(process.argv[1]!)).href
  );
}

if (isMain()) {
  try {
    const report = publishFrenchLexiconRelease(
      parseFrenchLexiconReleaseArgs(process.argv.slice(2))
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
