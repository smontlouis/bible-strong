import { createReadStream, existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  GREEK_LEXICON_REORGANIZATION_SCHEMA,
  htmlToText,
  sha256
} from "../src/greekLexiconReorganization.js";

const DEFAULT_SOURCE_DATABASE =
  "outputs/lexicon-greek-reorganization/strong_lexicon.greek-meaning.candidate.sqlite";
const DEFAULT_BATCH_ROOT = "outputs/lexicon-greek-french-translation/batches";
const DEFAULT_REVIEW_ROOT = "outputs/lexicon-greek-french-translation/reviews";
const DEFAULT_OUTPUT_ROOT = "outputs/lexicon-greek-french-bilingual-candidate";

interface TranslationParent {
  kind: "meaning" | "abbott_smith";
  parentHash: string;
  englishHtml: string;
  targetStepEntryIds: number[];
  targetEntryKeys: string[];
  targetResourceIds: number[];
}

interface Translation {
  schema: string;
  kind: string;
  parentHash: string;
  englishHtml: string;
  frenchHtml: string;
  translator: string;
  reviewStatus: string;
}

interface BatchDescriptor {
  batchId: string;
  input: string;
}

interface BatchManifest {
  schema: string;
  batches: BatchDescriptor[];
}

interface TranslationValidation {
  schema: string;
  totals: {
    batches: number;
    validatedBatches: number;
    missingBatches: number;
    invalidBatches: number;
  };
  validated: Array<{
    batchId: string;
    output: string;
    inputSha256: string;
    outputSha256: string;
  }>;
}

interface ReviewInput {
  parentHash: string;
  translationHash: string;
  translator: string;
}

interface ReviewDecision {
  schema: string;
  parentHash: string;
  translationHash: string;
  status: "approved" | "corrected";
  correctedFrenchHtml: string;
  reviewer: string;
}

interface ReviewBatch {
  reviewId: string;
  reviewer: string;
  input: string;
}

interface ReviewManifest {
  schema: string;
  batches: ReviewBatch[];
}

interface ReviewValidation {
  schema: string;
  totals: {
    batches: number;
    validatedBatches: number;
    missingBatches: number;
    invalidBatches: number;
  };
  validated: Array<{
    reviewId: string;
    output: string;
    inputSha256: string;
    outputSha256: string;
  }>;
}

interface TranslationLedgerRecord {
  parent: TranslationParent;
  translation: Translation;
  sourceBatchId: string;
}

interface ReviewLedgerRecord {
  reviewId: string;
  decision: ReviewDecision;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  for (const required of [
    args.sourceDatabase,
    path.join(args.batchRoot, "manifest.json"),
    path.join(args.batchRoot, "validation-report.json"),
    path.join(args.reviewRoot, "manifest.json"),
    path.join(args.reviewRoot, "validation-report.json")
  ]) {
    if (!existsSync(required)) throw new Error(`missing-input:${required}`);
  }

  if (existsSync(args.outputRoot) && !args.force)
    throw new Error(`output-exists:${args.outputRoot}`);

  const batchManifest = JSON.parse(
    await readFile(path.join(args.batchRoot, "manifest.json"), "utf8")
  ) as BatchManifest;
  if (batchManifest.schema !== "greek-french-translation-batches@1")
    throw new Error(`invalid-batch-manifest-schema:${batchManifest.schema}`);
  const translationValidation = JSON.parse(
    await readFile(path.join(args.batchRoot, "validation-report.json"), "utf8")
  ) as TranslationValidation;
  if (translationValidation.schema !== "greek-french-translation-validation@1")
    throw new Error(
      `invalid-translation-validation-schema:${translationValidation.schema}`
    );
  requireCompleteValidation(
    translationValidation.totals,
    "translations-not-complete"
  );
  requireExactIds(
    batchManifest.batches.map((batch) => batch.batchId),
    translationValidation.validated.map((batch) => batch.batchId),
    "translation-validation-coverage"
  );
  const translations = await loadTranslations(
    batchManifest,
    translationValidation
  );

  const reviewManifest = JSON.parse(
    await readFile(path.join(args.reviewRoot, "manifest.json"), "utf8")
  ) as ReviewManifest;
  if (reviewManifest.schema !== "greek-french-translation-review-batches@1")
    throw new Error(`invalid-review-manifest-schema:${reviewManifest.schema}`);
  const reviewValidation = JSON.parse(
    await readFile(path.join(args.reviewRoot, "validation-report.json"), "utf8")
  ) as ReviewValidation;
  if (
    reviewValidation.schema !== "greek-french-translation-review-validation@1"
  )
    throw new Error(
      `invalid-review-validation-schema:${reviewValidation.schema}`
    );
  requireCompleteValidation(reviewValidation.totals, "reviews-not-complete");
  requireExactIds(
    reviewManifest.batches.map((batch) => batch.reviewId),
    reviewValidation.validated.map((batch) => batch.reviewId),
    "review-validation-coverage"
  );
  const reviews = await loadReviews(reviewManifest, reviewValidation);
  if (reviews.size !== translations.size)
    throw new Error(
      `review-coverage-mismatch:translations=${translations.size};reviews=${reviews.size}`
    );

  const workRoot = `${args.outputRoot}.tmp-${process.pid}-${Date.now()}`;
  await rm(workRoot, { recursive: true, force: true });
  await mkdir(workRoot, { recursive: true });
  const outputDatabase = path.join(
    workRoot,
    "strong_lexicon.greek-french.bilingual-candidate.sqlite"
  );
  const manifestPath = path.join(workRoot, "manifest.json");
  const reportPath = path.join(workRoot, "report.md");
  const finalDatabase = path.join(
    args.outputRoot,
    "strong_lexicon.greek-french.bilingual-candidate.sqlite"
  );
  const sourceDatabaseSha256 = await sha256File(args.sourceDatabase);
  await copyFile(args.sourceDatabase, outputDatabase);
  if ((await sha256File(outputDatabase)) !== sourceDatabaseSha256) {
    await rm(workRoot, { recursive: true, force: true });
    throw new Error("source-database-snapshot-hash-mismatch");
  }
  try {
    const database = new DatabaseSync(outputDatabase);
    database.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE;");
    createProvenanceTable(database);

    const selectMeaning = database.prepare(
      `SELECT gmp.entryKey,gmp.meaningHash,se.meaning AS englishHtml,
            lt.meaning,lt.meaningHtml
       FROM GreekMeaningProvenance gmp
       JOIN StepEntries se ON se.id=gmp.stepEntryId
       JOIN LexiconTranslations lt
         ON lt.stepEntryId=gmp.stepEntryId AND lt.language='fr'
      WHERE gmp.stepEntryId=?`
    );
    const updateMeaning = database.prepare(
      `UPDATE LexiconTranslations SET meaning=?,meaningHtml=?
      WHERE stepEntryId=? AND language='fr'`
    );
    const updateMeaningProvenance = database.prepare(
      `UPDATE GreekMeaningProvenance
        SET frenchStatus='translated_reviewed',
            frenchParentLocator=?,
            frenchParentHash=?
      WHERE stepEntryId=?`
    );
    const selectResource = database.prepare(
      `SELECT gmp.entryKey,lr.stepEntryId,lr.source,lr.contentHtml AS englishHtml,
            lrp.sourceHash,lrp.validationResult,
            lrt.resourceId AS translatedResourceId
       FROM LexiconResources lr
       JOIN LexiconResourceProvenance lrp ON lrp.resourceId=lr.id
       JOIN GreekMeaningProvenance gmp ON gmp.stepEntryId=lr.stepEntryId
       LEFT JOIN LexiconResourceTranslations lrt
         ON lrt.resourceId=lr.id AND lrt.language='fr'
      WHERE lr.id=?`
    );
    const insertResourceTranslation = database.prepare(
      `INSERT INTO LexiconResourceTranslations
       (resourceId,language,contentHtml,contentText)
     VALUES (?,'fr',?,?)`
    );
    const updateResourceProvenance = database.prepare(
      `UPDATE LexiconResourceProvenance
        SET translationHash=?,validationResult=?
      WHERE resourceId=?`
    );
    const insertProvenance = database.prepare(
      `INSERT INTO GreekFrenchTranslationProvenance
       (kind,parentHash,targetType,targetId,entryKey,sourceBatchId,
        translator,translationHash,reviewId,reviewer,reviewStatus,
        finalFrenchHash)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    );

    const counts = {
      uniqueParents: translations.size,
      meaningParents: 0,
      abbottSmithParents: 0,
      meaningTargetsUpdated: 0,
      abbottSmithTargetsInserted: 0,
      approved: 0,
      corrected: 0
    };

    database.exec("BEGIN IMMEDIATE;");
    try {
      for (const [parentHash, record] of translations) {
        const review = reviews.get(parentHash);
        if (!review) throw new Error(`missing-review:${parentHash}`);
        if (
          review.decision.translationHash !==
          sha256(record.translation.frenchHtml)
        )
          throw new Error(`review-translation-hash-mismatch:${parentHash}`);
        const finalFrenchHtml =
          review.decision.status === "corrected"
            ? review.decision.correctedFrenchHtml
            : record.translation.frenchHtml;
        const finalFrenchText = htmlToText(finalFrenchHtml);
        if (!finalFrenchText)
          throw new Error(`empty-final-translation:${parentHash}`);
        counts[review.decision.status] += 1;

        if (record.parent.kind === "meaning") {
          counts.meaningParents += 1;
          requireAlignedTargets(record.parent, "meaning");
          for (
            let index = 0;
            index < record.parent.targetStepEntryIds.length;
            index += 1
          ) {
            const stepEntryId = record.parent.targetStepEntryIds[index]!;
            const current = selectMeaning.get(stepEntryId) as
              | {
                  entryKey: string;
                  meaningHash: string;
                  englishHtml: string;
                  meaning: string;
                  meaningHtml: string;
                }
              | undefined;
            if (!current)
              throw new Error(`missing-meaning-target:${stepEntryId}`);
            if (current.entryKey !== record.parent.targetEntryKeys[index])
              throw new Error(`meaning-entry-key-mismatch:${stepEntryId}`);
            if (current.meaningHash !== parentHash)
              throw new Error(`meaning-parent-hash-mismatch:${stepEntryId}`);
            if (
              current.englishHtml !== record.parent.englishHtml ||
              sha256(current.englishHtml) !== parentHash
            )
              throw new Error(`meaning-parent-content-mismatch:${stepEntryId}`);
            if (current.meaning || current.meaningHtml)
              throw new Error(`meaning-target-not-blank:${stepEntryId}`);
            updateMeaning.run(finalFrenchText, finalFrenchHtml, stepEntryId);
            updateMeaningProvenance.run(
              `${review.reviewId}:${parentHash}`,
              parentHash,
              stepEntryId
            );
            insertProvenance.run(
              "meaning",
              parentHash,
              "step_entry",
              stepEntryId,
              current.entryKey,
              record.sourceBatchId,
              record.translation.translator,
              sha256(record.translation.frenchHtml),
              review.reviewId,
              review.decision.reviewer,
              review.decision.status,
              sha256(finalFrenchHtml)
            );
            counts.meaningTargetsUpdated += 1;
          }
        } else {
          counts.abbottSmithParents += 1;
          requireAlignedTargets(record.parent, "abbott_smith");
          for (
            let index = 0;
            index < record.parent.targetResourceIds.length;
            index += 1
          ) {
            const resourceId = record.parent.targetResourceIds[index]!;
            const current = selectResource.get(resourceId) as
              | {
                  entryKey: string;
                  stepEntryId: number;
                  source: string;
                  englishHtml: string;
                  sourceHash: string;
                  validationResult: string;
                  translatedResourceId: number | null;
                }
              | undefined;
            if (!current)
              throw new Error(`missing-resource-target:${resourceId}`);
            if (
              current.entryKey !== record.parent.targetEntryKeys[index] ||
              current.stepEntryId !== record.parent.targetStepEntryIds[index]
            )
              throw new Error(`resource-entry-key-mismatch:${resourceId}`);
            if (current.source !== "AS")
              throw new Error(`resource-source-mismatch:${resourceId}`);
            if (current.sourceHash !== parentHash)
              throw new Error(`resource-parent-hash-mismatch:${resourceId}`);
            if (
              current.englishHtml !== record.parent.englishHtml ||
              sha256(current.englishHtml) !== parentHash
            )
              throw new Error(`resource-parent-content-mismatch:${resourceId}`);
            if (current.translatedResourceId !== null)
              throw new Error(
                `resource-target-already-translated:${resourceId}`
              );
            insertResourceTranslation.run(
              resourceId,
              finalFrenchHtml,
              finalFrenchText
            );
            updateResourceProvenance.run(
              sha256(finalFrenchHtml),
              updateResourceValidation(
                current.validationResult,
                record,
                review,
                finalFrenchHtml
              ),
              resourceId
            );
            insertProvenance.run(
              "abbott_smith",
              parentHash,
              "resource",
              resourceId,
              current.entryKey,
              record.sourceBatchId,
              record.translation.translator,
              sha256(record.translation.frenchHtml),
              review.reviewId,
              review.decision.reviewer,
              review.decision.status,
              sha256(finalFrenchHtml)
            );
            counts.abbottSmithTargetsInserted += 1;
          }
        }
      }
      setMeta(
        database,
        "greekFrenchCandidateStatus",
        "bilingual-reviewed-candidate"
      );
      setMeta(
        database,
        "greekFrenchTranslationSchema",
        "greek-french-bilingual-candidate@1"
      );
      database.exec("COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK;");
      database.close();
      await rm(outputDatabase, { force: true });
      throw error;
    }

    const candidateCounts = {
      blankGreekFrenchMeanings: scalar(
        database,
        `SELECT count(*) FROM LexiconTranslations lt
        JOIN StepEntries se ON se.id=lt.stepEntryId
       WHERE se.language='greek' AND lt.language='fr'
         AND (lt.meaning='' OR lt.meaningHtml='')`
      ),
      untranslatedAbbottSmithResources: scalar(
        database,
        `SELECT count(*) FROM LexiconResources lr
        LEFT JOIN LexiconResourceTranslations lrt
          ON lrt.resourceId=lr.id AND lrt.language='fr'
       WHERE lr.source='AS' AND lrt.resourceId IS NULL`
      ),
      translationProvenanceRows: scalar(
        database,
        "SELECT count(*) FROM GreekFrenchTranslationProvenance"
      ),
      orphanLexiconTranslations: scalar(
        database,
        `SELECT count(*) FROM LexiconTranslations lt
        LEFT JOIN StepEntries se ON se.id=lt.stepEntryId
       WHERE se.id IS NULL`
      ),
      orphanResources: scalar(
        database,
        `SELECT count(*) FROM LexiconResources lr
        LEFT JOIN StepEntries se ON se.id=lr.stepEntryId
       WHERE se.id IS NULL`
      ),
      orphanResourceTranslations: scalar(
        database,
        `SELECT count(*) FROM LexiconResourceTranslations lrt
        LEFT JOIN LexiconResources lr ON lr.id=lrt.resourceId
       WHERE lr.id IS NULL`
      ),
      orphanResourceProvenance: scalar(
        database,
        `SELECT count(*) FROM LexiconResourceProvenance lrp
        LEFT JOIN LexiconResources lr ON lr.id=lrp.resourceId
       WHERE lr.id IS NULL`
      ),
      orphanMeaningTranslationProvenance: scalar(
        database,
        `SELECT count(*) FROM GreekFrenchTranslationProvenance gftp
        LEFT JOIN StepEntries se ON se.id=gftp.targetId
       WHERE gftp.targetType='step_entry' AND se.id IS NULL`
      ),
      orphanResourceTranslationProvenance: scalar(
        database,
        `SELECT count(*) FROM GreekFrenchTranslationProvenance gftp
        LEFT JOIN LexiconResources lr ON lr.id=gftp.targetId
       WHERE gftp.targetType='resource' AND lr.id IS NULL`
      )
    };
    const integrity = String(
      (
        database.prepare("PRAGMA integrity_check").get() as {
          integrity_check: string;
        }
      ).integrity_check
    );
    const foreignKeyViolations = (
      database.prepare("PRAGMA foreign_key_check").all() as unknown[]
    ).length;
    database.close();

    const manifest = {
      schema: "greek-french-bilingual-candidate@1",
      status: "bilingual-reviewed-candidate",
      inputs: {
        sourceDatabase: path.resolve(args.sourceDatabase),
        sourceDatabaseSha256,
        batchManifest: path.resolve(path.join(args.batchRoot, "manifest.json")),
        batchManifestSha256: await sha256File(
          path.join(args.batchRoot, "manifest.json")
        ),
        translationValidation: path.resolve(
          path.join(args.batchRoot, "validation-report.json")
        ),
        translationValidationSha256: await sha256File(
          path.join(args.batchRoot, "validation-report.json")
        ),
        validatedTranslationFilesFingerprint: sha256(
          stableJson(
            translationValidation.validated.map((item) => ({
              batchId: item.batchId,
              inputSha256: item.inputSha256,
              outputSha256: item.outputSha256
            }))
          )
        ),
        reviewManifest: path.resolve(
          path.join(args.reviewRoot, "manifest.json")
        ),
        reviewManifestSha256: await sha256File(
          path.join(args.reviewRoot, "manifest.json")
        ),
        reviewValidation: path.resolve(
          path.join(args.reviewRoot, "validation-report.json")
        ),
        reviewValidationSha256: await sha256File(
          path.join(args.reviewRoot, "validation-report.json")
        ),
        validatedReviewFilesFingerprint: sha256(
          stableJson(
            reviewValidation.validated.map((item) => ({
              reviewId: item.reviewId,
              inputSha256: item.inputSha256,
              outputSha256: item.outputSha256
            }))
          )
        )
      },
      output: {
        database: path.resolve(finalDatabase),
        databaseSha256: await sha256File(outputDatabase)
      },
      counts,
      candidateCounts,
      integrity,
      foreignKeyViolations,
      invariants: {
        noBlankGreekFrenchMeanings:
          candidateCounts.blankGreekFrenchMeanings === 0,
        allAbbottSmithResourcesTranslated:
          candidateCounts.untranslatedAbbottSmithResources === 0,
        exactTranslationProvenanceCoverage:
          candidateCounts.translationProvenanceRows ===
          counts.meaningTargetsUpdated + counts.abbottSmithTargetsInserted,
        noOrphans:
          candidateCounts.orphanLexiconTranslations === 0 &&
          candidateCounts.orphanResources === 0 &&
          candidateCounts.orphanResourceTranslations === 0 &&
          candidateCounts.orphanResourceProvenance === 0 &&
          candidateCounts.orphanMeaningTranslationProvenance === 0 &&
          candidateCounts.orphanResourceTranslationProvenance === 0,
        integrityOk: integrity === "ok",
        foreignKeysOk: foreignKeyViolations === 0
      }
    };
    if (!Object.values(manifest.invariants).every(Boolean))
      throw new Error("bilingual-candidate-invariants-failed");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(reportPath, renderReport(manifest));
    await publishDirectory(workRoot, args.outputRoot, args.force);
    console.log(JSON.stringify({ counts, candidateCounts }, null, 2));
  } catch (error) {
    await rm(workRoot, { recursive: true, force: true });
    throw error;
  }
}

async function loadTranslations(
  manifest: BatchManifest,
  validation: TranslationValidation
): Promise<Map<string, TranslationLedgerRecord>> {
  const batchById = new Map(
    manifest.batches.map((batch) => [batch.batchId, batch])
  );
  const result = new Map<string, TranslationLedgerRecord>();
  for (const validated of validation.validated) {
    const batch = batchById.get(validated.batchId);
    if (!batch) throw new Error(`missing-batch:${validated.batchId}`);
    if ((await sha256File(batch.input)) !== validated.inputSha256)
      throw new Error(`translation-input-hash-mismatch:${validated.batchId}`);
    if ((await sha256File(validated.output)) !== validated.outputSha256)
      throw new Error(`translation-output-hash-mismatch:${validated.batchId}`);
    const [parents, translations] = await Promise.all([
      readJsonl<TranslationParent>(batch.input),
      readJsonl<Translation>(validated.output)
    ]);
    if (parents.length !== translations.length)
      throw new Error(`translation-count-mismatch:${validated.batchId}`);
    for (let index = 0; index < parents.length; index += 1) {
      const parent = parents[index]!;
      const translation = translations[index]!;
      if (
        translation.schema !== "greek-french-translation@1" ||
        translation.kind !== parent.kind ||
        translation.reviewStatus !== "translated" ||
        !translation.translator ||
        !translation.frenchHtml.trim() ||
        parent.parentHash !== translation.parentHash ||
        parent.englishHtml !== translation.englishHtml
      ) {
        throw new Error(
          `translation-parent-mismatch:${validated.batchId}:${index + 1}`
        );
      }
      if (result.has(parent.parentHash))
        throw new Error(`duplicate-translation-parent:${parent.parentHash}`);
      result.set(parent.parentHash, {
        parent,
        translation,
        sourceBatchId: validated.batchId
      });
    }
  }
  return result;
}

async function loadReviews(
  manifest: ReviewManifest,
  validation: ReviewValidation
): Promise<Map<string, ReviewLedgerRecord>> {
  const batchById = new Map(
    manifest.batches.map((batch) => [batch.reviewId, batch])
  );
  const result = new Map<string, ReviewLedgerRecord>();
  for (const validated of validation.validated) {
    const batch = batchById.get(validated.reviewId);
    if (!batch) throw new Error(`missing-review-batch:${validated.reviewId}`);
    if ((await sha256File(batch.input)) !== validated.inputSha256)
      throw new Error(`review-input-hash-mismatch:${validated.reviewId}`);
    if ((await sha256File(validated.output)) !== validated.outputSha256)
      throw new Error(`review-output-hash-mismatch:${validated.reviewId}`);
    const [inputs, decisions] = await Promise.all([
      readJsonl<ReviewInput>(batch.input),
      readJsonl<ReviewDecision>(validated.output)
    ]);
    if (inputs.length !== decisions.length)
      throw new Error(`review-count-mismatch:${validated.reviewId}`);
    for (let index = 0; index < inputs.length; index += 1) {
      const input = inputs[index]!;
      const decision = decisions[index]!;
      if (
        decision.schema !== "greek-french-translation-review@1" ||
        !["approved", "corrected"].includes(decision.status) ||
        decision.reviewer !== batch.reviewer ||
        decision.reviewer === input.translator ||
        (decision.status === "approved" &&
          decision.correctedFrenchHtml !== "") ||
        (decision.status === "corrected" &&
          !decision.correctedFrenchHtml.trim()) ||
        input.parentHash !== decision.parentHash ||
        input.translationHash !== decision.translationHash
      ) {
        throw new Error(
          `review-parent-mismatch:${validated.reviewId}:${index + 1}`
        );
      }
      if (result.has(input.parentHash))
        throw new Error(`duplicate-review-parent:${input.parentHash}`);
      result.set(input.parentHash, {
        reviewId: validated.reviewId,
        decision
      });
    }
  }
  return result;
}

function updateResourceValidation(
  rawValue: string,
  translation: TranslationLedgerRecord,
  review: ReviewLedgerRecord,
  finalFrenchHtml: string
): string {
  let existing: unknown = rawValue;
  try {
    existing = JSON.parse(rawValue) as unknown;
  } catch {
    // Preserve a non-JSON legacy validation value verbatim.
  }
  return stableJson({
    previous: existing,
    frenchBatchTranslation: {
      schema: "greek-french-translation@1",
      sourceBatchId: translation.sourceBatchId,
      translator: translation.translation.translator,
      translationHash: sha256(translation.translation.frenchHtml),
      reviewId: review.reviewId,
      reviewer: review.decision.reviewer,
      reviewStatus: review.decision.status,
      finalFrenchHash: sha256(finalFrenchHtml)
    }
  });
}

function createProvenanceTable(database: DatabaseSync): void {
  database.exec(`
    DROP TABLE IF EXISTS GreekFrenchTranslationProvenance;
    CREATE TABLE GreekFrenchTranslationProvenance (
      kind TEXT NOT NULL,
      parentHash TEXT NOT NULL,
      targetType TEXT NOT NULL,
      targetId INTEGER NOT NULL,
      entryKey TEXT NOT NULL,
      sourceBatchId TEXT NOT NULL,
      translator TEXT NOT NULL,
      translationHash TEXT NOT NULL,
      reviewId TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      reviewStatus TEXT NOT NULL,
      finalFrenchHash TEXT NOT NULL,
      PRIMARY KEY(kind,parentHash,targetType,targetId)
    ) WITHOUT ROWID;
  `);
}

function requireCompleteValidation(
  totals: {
    batches: number;
    validatedBatches: number;
    missingBatches: number;
    invalidBatches: number;
  },
  errorCode: string
): void {
  if (
    totals.validatedBatches !== totals.batches ||
    totals.missingBatches !== 0 ||
    totals.invalidBatches !== 0
  ) {
    throw new Error(errorCode);
  }
}

function requireExactIds(
  expected: string[],
  actual: string[],
  errorCode: string
): void {
  const expectedSorted = [...expected].sort();
  const actualSorted = [...actual].sort();
  if (
    expectedSorted.length !== actualSorted.length ||
    expectedSorted.some((value, index) => value !== actualSorted[index]) ||
    new Set(expected).size !== expected.length ||
    new Set(actual).size !== actual.length
  ) {
    throw new Error(errorCode);
  }
}

function requireAlignedTargets(
  parent: TranslationParent,
  kind: TranslationParent["kind"]
): void {
  const expectedLength =
    kind === "meaning"
      ? parent.targetStepEntryIds.length
      : parent.targetResourceIds.length;
  if (
    expectedLength === 0 ||
    parent.targetEntryKeys.length !== expectedLength ||
    (kind === "meaning" && parent.targetResourceIds.length !== 0) ||
    (kind === "abbott_smith" &&
      parent.targetStepEntryIds.length !== expectedLength) ||
    new Set(parent.targetEntryKeys).size !== expectedLength ||
    new Set(parent.targetStepEntryIds).size !==
      parent.targetStepEntryIds.length ||
    new Set(parent.targetResourceIds).size !== parent.targetResourceIds.length
  ) {
    throw new Error(`unaligned-targets:${kind}:${parent.parentHash}`);
  }
}

function setMeta(database: DatabaseSync, key: string, value: string): void {
  database
    .prepare(
      `INSERT INTO DictionaryMeta(key,value) VALUES (?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`
    )
    .run(key, value);
}

function scalar(database: DatabaseSync, sql: string): number {
  const row = database.prepare(sql).get() as
    | Record<string, unknown>
    | undefined;
  return Number(row ? Object.values(row)[0] : undefined);
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  return (await readFile(filePath, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

async function sha256File(filePath: string): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of createReadStream(filePath)) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return sha256(Buffer.concat(chunks));
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)])
    );
  }
  return value;
}

function renderReport(manifest: {
  status: string;
  counts: Record<string, number>;
  candidateCounts: Record<string, number>;
  integrity: string;
  foreignKeyViolations: number;
  invariants: Record<string, boolean>;
}): string {
  const rows = (values: Record<string, number>): string =>
    Object.entries(values)
      .map(
        ([key, value]) => `| \`${key}\` | ${value.toLocaleString("fr-FR")} |`
      )
      .join("\n");
  return `# Candidate bilingue du lexique grec

Statut : **${manifest.status}**

## Traductions par lots

| Mesure | Valeur |
| --- | ---: |
${rows(manifest.counts)}

## Couverture finale

| Mesure | Valeur |
| --- | ---: |
${rows(manifest.candidateCounts)}

## Vérifications

- Intégrité SQLite : \`${manifest.integrity}\`
- Violations de clés étrangères : ${manifest.foreignKeyViolations}
${Object.entries(manifest.invariants)
  .map(([key, value]) => `- ${key} : ${value ? "OK" : "ÉCHEC"}`)
  .join("\n")}

La base de production, la candidate anglaise source et TIPNR ne sont pas
modifiés par cette construction.
`;
}

async function publishDirectory(
  workRoot: string,
  outputRoot: string,
  force: boolean
): Promise<void> {
  await mkdir(path.dirname(outputRoot), { recursive: true });
  if (!existsSync(outputRoot)) {
    await rename(workRoot, outputRoot);
    return;
  }
  if (!force) throw new Error(`output-exists:${outputRoot}`);

  const backupRoot = `${outputRoot}.backup-${process.pid}-${Date.now()}`;
  await rm(backupRoot, { recursive: true, force: true });
  await rename(outputRoot, backupRoot);
  try {
    await rename(workRoot, outputRoot);
  } catch (error) {
    await rename(backupRoot, outputRoot);
    throw error;
  }
  await rm(backupRoot, { recursive: true, force: true });
}

function parseArgs(rawArgs: string[]): {
  sourceDatabase: string;
  batchRoot: string;
  reviewRoot: string;
  outputRoot: string;
  force: boolean;
} {
  const values = new Map<string, string>();
  for (let index = 0; index < rawArgs.length; index += 1) {
    const argument = rawArgs[index]!;
    if (!argument.startsWith("--")) continue;
    const [key, inlineValue] = argument.slice(2).split("=", 2);
    const next = rawArgs[index + 1];
    if (inlineValue !== undefined) values.set(key!, inlineValue);
    else if (next && !next.startsWith("--")) {
      values.set(key!, next);
      index += 1;
    } else values.set(key!, "true");
  }
  return {
    sourceDatabase: path.resolve(
      values.get("source-database") ?? DEFAULT_SOURCE_DATABASE
    ),
    batchRoot: path.resolve(values.get("batch-root") ?? DEFAULT_BATCH_ROOT),
    reviewRoot: path.resolve(values.get("review-root") ?? DEFAULT_REVIEW_ROOT),
    outputRoot: path.resolve(values.get("output-root") ?? DEFAULT_OUTPUT_ROOT),
    force: values.get("force") === "true"
  };
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error
  );
  process.exitCode = 1;
});
