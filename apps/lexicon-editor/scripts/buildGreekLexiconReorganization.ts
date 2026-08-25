import { createReadStream, existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  ABBOTT_SMITH_RESOURCE_ID_OFFSET,
  ABBOTT_SMITH_RESOURCE_KIND,
  ABBOTT_SMITH_RESOURCE_SOURCE,
  classifyAbbottSmithDefinition,
  cleanLexiconSourceHtml,
  containsLsjAbsenceText,
  GREEK_LEXICON_REORGANIZATION_SCHEMA,
  type GreekMeaningSelection,
  type StepGreekLexiconEntry,
  htmlToText,
  parseStepGreekLexicon,
  selectGreekMeaning,
  sha256,
  sourceValuesEquivalent,
  STEP_GREEK_LEXICON_COMMIT,
  STEP_GREEK_LEXICON_SHA256,
  STEP_GREEK_LEXICON_URL,
  stripLsjAbsenceTail
} from "../src/greekLexiconReorganization.js";

const DEFAULT_SOURCE_DATABASE =
  "data/dictionaries/strong_lexicon.full.production.sqlite";
const DEFAULT_ENTITY_DATABASE =
  "data/entities/bible_entities.production.sqlite";
const DEFAULT_ENGLISH_AUDIT = "outputs/lexicon-v3/english-audit.jsonl";
const DEFAULT_STEP_LEXICON = "data/external/stepbible/lexicon_greek.txt";
const DEFAULT_OUTPUT_ROOT = "outputs/lexicon-greek-reorganization";

interface StepRow {
  id: number;
  baseCode: number;
  eStrong: string;
  dStrong: string;
  original: string;
  gloss: string;
  meaning: string;
  glossFr: string;
  meaningFr: string;
  meaningHtmlFr: string;
}

interface AuditDecision {
  status: string;
  quarantinedSources: string[];
  recordDigest: string;
}

interface EntityShortTranslation {
  uniqueName: string;
  shortDescriptionEn: string;
  shortDescriptionFr: string;
  provenanceHash: string;
}

interface ExistingResource {
  id: number;
  stepEntryId: number;
  source: string;
  kind: string;
  contentHtml: string;
  contentHtmlFr: string;
  contentTextFr: string;
}

interface FrenchReuse {
  status:
    | "reused_tipnr_short"
    | "reused_gloss_translation"
    | "reused_existing_meaning"
    | "missing";
  meaning: string;
  meaningHtml: string;
  parentLocator: string | null;
  parentHash: string | null;
}

interface AsTranslationReuse {
  status: "reused_existing_meaning" | "reused_tflsj_fallback" | "missing";
  contentHtml: string;
  contentText: string;
  parentLocator: string | null;
}

interface Args {
  sourceDatabase: string;
  entityDatabase: string;
  englishAudit: string;
  stepLexicon: string;
  outputRoot: string;
  force: boolean;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(path.dirname(args.stepLexicon), { recursive: true });
  await ensurePinnedStepLexicon(args.stepLexicon);

  for (const required of [
    args.sourceDatabase,
    args.entityDatabase,
    args.englishAudit,
    args.stepLexicon
  ]) {
    if (!existsSync(required)) throw new Error(`missing-input:${required}`);
  }

  await mkdir(args.outputRoot, { recursive: true });
  const outputDatabase = path.join(
    args.outputRoot,
    "strong_lexicon.greek-meaning.candidate.sqlite"
  );
  const manifestPath = path.join(args.outputRoot, "manifest.json");
  const reportPath = path.join(args.outputRoot, "report.md");
  const missingMeaningsPath = path.join(
    args.outputRoot,
    "missing-french-meanings.jsonl"
  );
  const missingAsTranslationsPath = path.join(
    args.outputRoot,
    "missing-french-as-resources.jsonl"
  );

  for (const output of [
    outputDatabase,
    manifestPath,
    reportPath,
    missingMeaningsPath,
    missingAsTranslationsPath
  ]) {
    if (existsSync(output) && !args.force) {
      throw new Error(`output-exists:${output}`);
    }
  }
  if (args.force) {
    await Promise.all(
      [
        outputDatabase,
        manifestPath,
        reportPath,
        missingMeaningsPath,
        missingAsTranslationsPath
      ].map((output) => rm(output, { force: true }))
    );
  }

  const [lexiconContent, auditDecisions, entityTranslations] =
    await Promise.all([
      readFile(args.stepLexicon, "utf8"),
      readAuditDecisions(args.englishAudit),
      readEntityShortTranslations(args.entityDatabase)
    ]);
  const parsedEntries = parseStepGreekLexicon(lexiconContent);
  const entriesByCode = uniqueMap(
    parsedEntries.map((entry) => [entry.code, entry] as const),
    "duplicate-step-lexicon-code"
  );
  const entriesByBaseCode = groupBy(parsedEntries, (entry) =>
    numericStrongCode(entry.code)
  );

  await copyFile(args.sourceDatabase, outputDatabase);
  const database = new DatabaseSync(outputDatabase);
  database.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE;");

  const stepRows = database
    .prepare(
      `SELECT se.id,se.baseCode,se.eStrong,se.dStrong,se.original,se.gloss,se.meaning,
              coalesce(lt.gloss,'') AS glossFr,
              coalesce(lt.meaning,'') AS meaningFr,
              coalesce(lt.meaningHtml,'') AS meaningHtmlFr
         FROM StepEntries se
         LEFT JOIN LexiconTranslations lt
           ON lt.stepEntryId=se.id AND lt.language='fr'
        WHERE se.language='greek'
        ORDER BY se.id`
    )
    .all() as unknown as StepRow[];
  const existingResources = database
    .prepare(
      `SELECT lr.id,lr.stepEntryId,lr.source,lr.kind,lr.contentHtml,
              coalesce(lrt.contentHtml,'') AS contentHtmlFr,
              coalesce(lrt.contentText,'') AS contentTextFr
         FROM LexiconResources lr
         LEFT JOIN LexiconResourceTranslations lrt
           ON lrt.resourceId=lr.id AND lrt.language='fr'
        ORDER BY lr.id`
    )
    .all() as unknown as ExistingResource[];
  const resourcesByEntry = groupBy(
    existingResources,
    (resource) => resource.stepEntryId
  );

  createCandidateTables(database);
  const insertLegacyFrench = database.prepare(
    `INSERT INTO GreekMeaningLegacyTranslations
       (stepEntryId,meaning,meaningHtml,contentHash)
     VALUES (?,?,?,?)`
  );
  const insertMeaningProvenance = database.prepare(
    `INSERT INTO GreekMeaningProvenance
       (stepEntryId,entryKey,source,sourceField,sourceLocator,sourceMappingRule,sourceHash,
        selectionRule,previousMeaningHash,meaningHash,meaningText,
        frenchStatus,frenchParentLocator,frenchParentHash)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const updateEnglishMeaning = database.prepare(
    "UPDATE StepEntries SET meaning=? WHERE id=?"
  );
  const updateFrenchMeaning = database.prepare(
    `UPDATE LexiconTranslations
        SET meaning=?,meaningHtml=?
      WHERE stepEntryId=? AND language='fr'`
  );
  const insertAsResource = database.prepare(
    `INSERT INTO LexiconResources
       (id,stepEntryId,source,kind,contentHtml)
     VALUES (?,?,?,?,?)`
  );
  const insertAsTranslation = database.prepare(
    `INSERT INTO LexiconResourceTranslations
       (resourceId,language,contentHtml,contentText)
     VALUES (?,'fr',?,?)`
  );
  const insertAsProvenance = database.prepare(
    `INSERT INTO LexiconResourceProvenance
       (resourceId,sourceHash,translationHash,importedFrom,validationResult)
     VALUES (?,?,?,?,?)`
  );

  const counts: Record<string, number> = {
    greekEntries: stepRows.length,
    stepLexiconBlocks: parsedEntries.length,
    mappedEntries: 0,
    unmatchedDatabaseEntries: 0,
    unmatchedSourceBlocks: 0,
    updatedMeanings: 0,
    unchangedMeanings: 0,
    frenchMeaningReused: 0,
    frenchMeaningMissing: 0,
    tflsjPlaceholdersRemoved: 0,
    asResourcesInserted: 0,
    asResourcesExcludedLsjFallback: 0,
    asResourcesExcludedSourceIssue: 0,
    asResourceFrenchReused: 0,
    asResourceFrenchMissing: 0
  };
  const meaningSourceCounts = new Map<string, number>();
  const sourceMappingRuleCounts = new Map<string, number>();
  const frenchMeaningStatusCounts = new Map<string, number>();
  const missingFrenchMeanings: unknown[] = [];
  const missingFrenchAsResources: unknown[] = [];
  const unmatchedDatabaseEntries: unknown[] = [];
  const mappedCodes = new Set<string>();

  database.exec("BEGIN IMMEDIATE;");
  try {
    for (const resource of existingResources) {
      if (
        resource.source === "TFLSJ" &&
        containsLsjAbsenceText(resource.contentHtml)
      ) {
        database
          .prepare("DELETE FROM LexiconResourceTranslations WHERE resourceId=?")
          .run(resource.id);
        database
          .prepare("DELETE FROM LexiconResourceProvenance WHERE resourceId=?")
          .run(resource.id);
        database
          .prepare("DELETE FROM LexiconResources WHERE id=?")
          .run(resource.id);
        counts.tflsjPlaceholdersRemoved += 1;
      }
    }

    for (const row of stepRows) {
      const exactCode = extractPrimaryDStrong(row.dStrong);
      const exactSourceEntry = entriesByCode.get(exactCode);
      const sameBaseEntries = entriesByBaseCode.get(row.baseCode) ?? [];
      const sameBaseGlossMatches = exactSourceEntry
        ? []
        : sameBaseEntries.filter(
            (entry) =>
              Boolean(entry.fields.StepGloss?.trim()) &&
              sourceValuesEquivalent(entry.fields.StepGloss ?? "", row.gloss)
          );
      const sourceEntry =
        exactSourceEntry ??
        (sameBaseGlossMatches.length === 1
          ? sameBaseGlossMatches[0]
          : undefined);
      const sourceMappingRule = exactSourceEntry
        ? "EXACT_CODE"
        : sourceEntry
          ? "SAME_BASE_UNIQUE_GLOSS"
          : "DATABASE_GLOSS_FALLBACK";
      increment(sourceMappingRuleCounts, sourceMappingRule);
      let selected: GreekMeaningSelection;
      let sourceLocator: string;
      if (sourceEntry) {
        mappedCodes.add(sourceEntry.code);
        counts.mappedEntries += 1;
        selected =
          selectGreekMeaning(sourceEntry) ??
          databaseGlossFallback(row, sourceEntry.sourceLine);
        sourceLocator = `${path.basename(args.stepLexicon)}:${selected.sourceLine}:${sourceEntry.code}:@${selected.sourceField}`;
      } else {
        counts.unmatchedDatabaseEntries += 1;
        unmatchedDatabaseEntries.push({
          stepEntryId: row.id,
          eStrong: row.eStrong,
          dStrong: row.dStrong,
          exactCode,
          fallback: "STEP_DATABASE_GLOSS_FALLBACK"
        });
        selected = databaseGlossFallback(row, 0);
        sourceLocator = `StepEntries:${row.id}:gloss`;
      }

      const entityArticle = sourceEntry?.fields.STEP_Article?.trim() ?? "";
      const french = selectFrenchMeaning({
        selected,
        sourceEntry,
        row,
        entityArticle,
        entityTranslations
      });
      increment(meaningSourceCounts, selected.source);
      increment(frenchMeaningStatusCounts, french.status);
      if (french.status === "missing") {
        counts.frenchMeaningMissing += 1;
        missingFrenchMeanings.push({
          stepEntryId: row.id,
          entryKey: `greek:${exactCode}`,
          eStrong: row.eStrong,
          dStrong: row.dStrong,
          source: selected.source,
          sourceField: selected.sourceField,
          sourceLocator,
          englishMeaning: selected.meaningText,
          englishMeaningHtml: selected.meaningHtml,
          englishMeaningHash: sha256(selected.meaningHtml)
        });
      } else {
        counts.frenchMeaningReused += 1;
      }

      insertLegacyFrench.run(
        row.id,
        row.meaningFr,
        row.meaningHtmlFr,
        sha256(
          stableJson({
            meaning: row.meaningFr,
            meaningHtml: row.meaningHtmlFr
          })
        )
      );
      updateEnglishMeaning.run(selected.meaningHtml, row.id);
      updateFrenchMeaning.run(french.meaning, french.meaningHtml, row.id);
      if (row.meaning === selected.meaningHtml) counts.unchangedMeanings += 1;
      else counts.updatedMeanings += 1;

      const sourceHash =
        sourceEntry === undefined
          ? sha256(
              stableJson({
                stepEntryId: row.id,
                field: "gloss",
                value: row.gloss
              })
            )
          : sha256(
              stableJson({
                sourceFileSha256: STEP_GREEK_LEXICON_SHA256,
                code: sourceEntry.code,
                field: selected.sourceField,
                line: selected.sourceLine,
                value: sourceEntry.fields[selected.sourceField] ?? ""
              })
            );
      insertMeaningProvenance.run(
        row.id,
        `greek:${exactCode}`,
        selected.source,
        selected.sourceField,
        sourceLocator,
        sourceMappingRule,
        sourceHash,
        selected.rule,
        sha256(row.meaning),
        sha256(selected.meaningHtml),
        selected.meaningText,
        french.status,
        french.parentLocator,
        french.parentHash
      );

      const asSourceEntry = resolveAbbottSmithSourceEntry(
        sourceEntry,
        sameBaseEntries,
        row.meaning
      );
      if (asSourceEntry) {
        const asDefinition = asSourceEntry.fields.AS_Def;
        const classification = classifyAbbottSmithDefinition(asDefinition);
        if (classification === "lsj_fallback") {
          counts.asResourcesExcludedLsjFallback += 1;
        } else if (classification === "abbott_smith") {
          const audit = auditDecisions.get(`greek:${exactCode}`);
          if (!audit) {
            throw new Error(`missing-english-audit:greek:${exactCode}`);
          }
          if (audit.quarantinedSources.includes("TBESG")) {
            counts.asResourcesExcludedSourceIssue += 1;
          } else {
            const asContentHtml = cleanLexiconSourceHtml(asDefinition!);
            const translation = selectAsTranslation({
              asContentHtml,
              row,
              existingResources: resourcesByEntry.get(row.id) ?? []
            });
            const resourceId = ABBOTT_SMITH_RESOURCE_ID_OFFSET + row.id;
            insertAsResource.run(
              resourceId,
              row.id,
              ABBOTT_SMITH_RESOURCE_SOURCE,
              ABBOTT_SMITH_RESOURCE_KIND,
              asContentHtml
            );
            if (translation.status !== "missing") {
              insertAsTranslation.run(
                resourceId,
                translation.contentHtml,
                translation.contentText
              );
              counts.asResourceFrenchReused += 1;
            } else {
              counts.asResourceFrenchMissing += 1;
              missingFrenchAsResources.push({
                resourceId,
                stepEntryId: row.id,
                entryKey: `greek:${exactCode}`,
                source: ABBOTT_SMITH_RESOURCE_SOURCE,
                kind: ABBOTT_SMITH_RESOURCE_KIND,
                sourceLocator: `${path.basename(args.stepLexicon)}:${asSourceEntry.fieldLines.AS_Def}:${asSourceEntry.code}:@AS_Def`,
                contentHtml: asContentHtml,
                contentText: htmlToText(asContentHtml),
                sourceHash: sha256(asContentHtml)
              });
            }
            insertAsProvenance.run(
              resourceId,
              sha256(asContentHtml),
              sha256(translation.contentHtml),
              `${path.basename(args.stepLexicon)}:${asSourceEntry.fieldLines.AS_Def}:${asSourceEntry.code}:@AS_Def`,
              stableJson({
                schema: GREEK_LEXICON_REORGANIZATION_SCHEMA,
                valid: true,
                source: "Abbott-Smith adapted by STEP",
                sourceEntryCode: asSourceEntry.code,
                sourceMappingRule:
                  asSourceEntry === sourceEntry
                    ? sourceMappingRule
                    : "SAME_BASE_EXISTING_AS_PARENT",
                sourceCommit: STEP_GREEK_LEXICON_COMMIT,
                sourceFileSha256: STEP_GREEK_LEXICON_SHA256,
                englishAudit: {
                  status: audit.status,
                  recordDigest: audit.recordDigest
                },
                french: {
                  status: translation.status,
                  parentLocator: translation.parentLocator
                }
              })
            );
            counts.asResourcesInserted += 1;
          }
        }
      }
    }

    counts.unmatchedSourceBlocks = parsedEntries.filter(
      (entry) => !mappedCodes.has(entry.code)
    ).length;

    database.exec(`
      DELETE FROM LexiconFieldStatus
       WHERE field='meaning'
         AND stepEntryId IN (
           SELECT id FROM StepEntries WHERE language='greek'
         );
      DELETE FROM LexiconFrenchProvenance
       WHERE stepEntryId IN (
         SELECT id FROM StepEntries WHERE language='greek'
       );
    `);
    setMeta(
      database,
      "greekMeaningCandidateSchema",
      GREEK_LEXICON_REORGANIZATION_SCHEMA
    );
    setMeta(database, "greekMeaningSourceCommit", STEP_GREEK_LEXICON_COMMIT);
    setMeta(database, "greekMeaningSourceSha256", STEP_GREEK_LEXICON_SHA256);
    setMeta(database, "greekMeaningCandidateStatus", "not-publishable");
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    database.close();
    await rm(outputDatabase, { force: true });
    throw error;
  }

  const integrity = String(
    (
      database.prepare("PRAGMA integrity_check;").get() as {
        integrity_check: string;
      }
    ).integrity_check
  );
  const foreignKeyViolations = (
    database.prepare("PRAGMA foreign_key_check;").all() as unknown[]
  ).length;
  const candidateCounts = {
    stepEntries: scalar(database, "SELECT count(*) FROM StepEntries"),
    resources: scalar(database, "SELECT count(*) FROM LexiconResources"),
    asResources: scalar(
      database,
      "SELECT count(*) FROM LexiconResources WHERE source='AS'"
    ),
    tflsjResources: scalar(
      database,
      "SELECT count(*) FROM LexiconResources WHERE source='TFLSJ'"
    ),
    resourceTranslations: scalar(
      database,
      "SELECT count(*) FROM LexiconResourceTranslations"
    ),
    meaningProvenance: scalar(
      database,
      "SELECT count(*) FROM GreekMeaningProvenance"
    ),
    frenchMeaningStatusRows: scalar(
      database,
      `SELECT count(*) FROM LexiconFieldStatus lfs
        JOIN StepEntries se ON se.id=lfs.stepEntryId
       WHERE se.language='greek' AND lfs.locale='fr' AND lfs.field='meaning'`
    )
  };
  database.close();

  await writeJsonl(missingMeaningsPath, missingFrenchMeanings);
  await writeJsonl(missingAsTranslationsPath, missingFrenchAsResources);

  const inputHashes = {
    sourceDatabase: await sha256File(args.sourceDatabase),
    entityDatabase: await sha256File(args.entityDatabase),
    englishAudit: await sha256File(args.englishAudit),
    stepLexicon: await sha256File(args.stepLexicon)
  };
  const outputHash = await sha256File(outputDatabase);
  const manifest = {
    schema: GREEK_LEXICON_REORGANIZATION_SCHEMA,
    status: "candidate-not-publishable",
    generatedAt: new Date().toISOString(),
    inputs: {
      sourceDatabase: path.resolve(args.sourceDatabase),
      entityDatabase: path.resolve(args.entityDatabase),
      englishAudit: path.resolve(args.englishAudit),
      stepLexicon: path.resolve(args.stepLexicon),
      stepSourceUrl: STEP_GREEK_LEXICON_URL,
      stepSourceCommit: STEP_GREEK_LEXICON_COMMIT,
      hashes: inputHashes
    },
    outputs: {
      database: path.resolve(outputDatabase),
      databaseSha256: outputHash,
      missingFrenchMeanings: path.resolve(missingMeaningsPath),
      missingFrenchAsResources: path.resolve(missingAsTranslationsPath)
    },
    counts,
    meaningSourceCounts: sortedRecord(meaningSourceCounts),
    sourceMappingRuleCounts: sortedRecord(sourceMappingRuleCounts),
    frenchMeaningStatusCounts: sortedRecord(frenchMeaningStatusCounts),
    candidateCounts,
    integrity,
    foreignKeyViolations,
    invariants: {
      sourceSnapshotPinned:
        inputHashes.stepLexicon === STEP_GREEK_LEXICON_SHA256,
      allGreekEntriesHaveMeaningProvenance:
        candidateCounts.meaningProvenance === counts.greekEntries,
      noPublishedGreekMeaningStatus:
        candidateCounts.frenchMeaningStatusRows === 0,
      noTflsjAbbottSmithPlaceholders: counts.tflsjPlaceholdersRemoved > 0,
      integrityOk: integrity === "ok",
      foreignKeysOk: foreignKeyViolations === 0
    },
    samples: {
      unmatchedDatabaseEntries: unmatchedDatabaseEntries.slice(0, 50)
    }
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(reportPath, renderReport(manifest));

  if (
    !Object.values(manifest.invariants).every(Boolean) ||
    integrity !== "ok" ||
    foreignKeyViolations !== 0
  ) {
    throw new Error("candidate-invariants-failed");
  }

  console.log(`Wrote ${outputDatabase}`);
  console.log(`Wrote ${manifestPath}`);
  console.log(`Wrote ${reportPath}`);
  console.log(JSON.stringify({ counts, candidateCounts }, null, 2));
}

function parseArgs(rawArgs: string[]): Args {
  const values = new Map<string, string>();
  for (let index = 0; index < rawArgs.length; index += 1) {
    const argument = rawArgs[index]!;
    if (!argument.startsWith("--")) continue;
    const [rawKey, inlineValue] = argument.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      values.set(rawKey!, inlineValue);
      continue;
    }
    const next = rawArgs[index + 1];
    if (next && !next.startsWith("--")) {
      values.set(rawKey!, next);
      index += 1;
    } else {
      values.set(rawKey!, "true");
    }
  }
  return {
    sourceDatabase: path.resolve(
      values.get("source-database") ?? DEFAULT_SOURCE_DATABASE
    ),
    entityDatabase: path.resolve(
      values.get("entity-database") ?? DEFAULT_ENTITY_DATABASE
    ),
    englishAudit: path.resolve(
      values.get("english-audit") ?? DEFAULT_ENGLISH_AUDIT
    ),
    stepLexicon: path.resolve(
      values.get("step-lexicon") ?? DEFAULT_STEP_LEXICON
    ),
    outputRoot: path.resolve(values.get("output-root") ?? DEFAULT_OUTPUT_ROOT),
    force: values.get("force") === "true"
  };
}

async function ensurePinnedStepLexicon(filePath: string): Promise<void> {
  if (!existsSync(filePath)) {
    const response = await fetch(STEP_GREEK_LEXICON_URL);
    if (!response.ok) {
      throw new Error(`step-lexicon-download-failed:${response.status}`);
    }
    await writeFile(filePath, new Uint8Array(await response.arrayBuffer()));
  }
  const digest = await sha256File(filePath);
  if (digest !== STEP_GREEK_LEXICON_SHA256) {
    throw new Error(
      `step-lexicon-digest-mismatch:${digest}:${STEP_GREEK_LEXICON_SHA256}`
    );
  }
}

async function readAuditDecisions(
  filePath: string
): Promise<Map<string, AuditDecision>> {
  const decisions = new Map<string, AuditDecision>();
  const lines = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Number.POSITIVE_INFINITY
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(line) as {
      key?: string;
      language?: string;
      decision?: { status?: string; quarantinedSources?: string[] };
      recordDigest?: string;
    };
    if (record.language !== "greek" || !record.key) continue;
    decisions.set(record.key, {
      status: record.decision?.status ?? "unknown",
      quarantinedSources: record.decision?.quarantinedSources ?? [],
      recordDigest: record.recordDigest ?? sha256(line)
    });
  }
  return decisions;
}

function readEntityShortTranslations(
  databasePath: string
): Map<string, EntityShortTranslation> {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const rows = database
      .prepare(
        `SELECT e.uniqueName,
                e.shortDescription AS shortDescriptionEn,
                et.shortDescription AS shortDescriptionFr,
                coalesce(etp.finalTranslationHash,'') AS provenanceHash
           FROM Entities e
           JOIN EntityTranslations et
             ON et.entityId=e.id AND et.language='fr'
           LEFT JOIN EntityTranslationProvenance etp
             ON etp.entityId=e.id AND etp.language='fr'
          ORDER BY e.uniqueName`
      )
      .all() as unknown as EntityShortTranslation[];
    return uniqueMap(
      rows.map((row) => [row.uniqueName, row] as const),
      "duplicate-entity-unique-name"
    );
  } finally {
    database.close();
  }
}

function selectFrenchMeaning(input: {
  selected: GreekMeaningSelection;
  sourceEntry: ReturnType<typeof parseStepGreekLexicon>[number] | undefined;
  row: StepRow;
  entityArticle: string;
  entityTranslations: Map<string, EntityShortTranslation>;
}): FrenchReuse {
  const { selected, sourceEntry, row, entityArticle, entityTranslations } =
    input;
  if (
    selected.source === "TIPNR_SHORT" &&
    entityArticle &&
    sourceEntry !== undefined
  ) {
    const entity = entityTranslations.get(entityArticle);
    if (
      entity &&
      entity.shortDescriptionFr.trim() &&
      sourceValuesEquivalent(selected.meaningHtml, entity.shortDescriptionEn)
    ) {
      return {
        status: "reused_tipnr_short",
        meaning: htmlToText(entity.shortDescriptionFr),
        meaningHtml: cleanLexiconSourceHtml(entity.shortDescriptionFr),
        parentLocator: `Entities:${entityArticle}:shortDescription`,
        parentHash:
          entity.provenanceHash ||
          sha256(
            stableJson({
              english: entity.shortDescriptionEn,
              french: entity.shortDescriptionFr
            })
          )
      };
    }
  }

  if (
    row.meaningHtmlFr.trim() &&
    sourceValuesEquivalent(selected.meaningHtml, row.meaning)
  ) {
    return {
      status: "reused_existing_meaning",
      meaning: row.meaningFr,
      meaningHtml: row.meaningHtmlFr,
      parentLocator: `LexiconTranslations:${row.id}:meaning`,
      parentHash: sha256(
        stableJson({
          english: row.meaning,
          french: row.meaningHtmlFr
        })
      )
    };
  }

  if (
    row.glossFr.trim() &&
    sourceValuesEquivalent(selected.meaningHtml, row.gloss)
  ) {
    return {
      status: "reused_gloss_translation",
      meaning: row.glossFr,
      meaningHtml: escapeHtml(row.glossFr),
      parentLocator: `LexiconTranslations:${row.id}:gloss`,
      parentHash: sha256(
        stableJson({ english: row.gloss, french: row.glossFr })
      )
    };
  }

  return {
    status: "missing",
    meaning: "",
    meaningHtml: "",
    parentLocator: null,
    parentHash: null
  };
}

function selectAsTranslation(input: {
  asContentHtml: string;
  row: StepRow;
  existingResources: ExistingResource[];
}): AsTranslationReuse {
  const { asContentHtml, row, existingResources } = input;
  if (
    row.meaningHtmlFr.trim() &&
    sourceValuesEquivalent(asContentHtml, row.meaning)
  ) {
    return {
      status: "reused_existing_meaning",
      contentHtml: row.meaningHtmlFr,
      contentText: row.meaningFr || htmlToText(row.meaningHtmlFr),
      parentLocator: `LexiconTranslations:${row.id}:meaning`
    };
  }

  for (const resource of existingResources) {
    if (
      resource.source !== "TFLSJ" ||
      !containsLsjAbsenceText(resource.contentHtml) ||
      !resource.contentHtmlFr.trim()
    ) {
      continue;
    }
    if (
      sourceValuesEquivalent(
        asContentHtml,
        stripLsjAbsenceTail(resource.contentHtml)
      )
    ) {
      const contentHtml = stripLsjAbsenceTail(resource.contentHtmlFr);
      return {
        status: "reused_tflsj_fallback",
        contentHtml,
        contentText: htmlToText(contentHtml),
        parentLocator: `LexiconResourceTranslations:${resource.id}:fr`
      };
    }
  }

  return {
    status: "missing",
    contentHtml: "",
    contentText: "",
    parentLocator: null
  };
}

function databaseGlossFallback(
  row: StepRow,
  sourceLine: number
): GreekMeaningSelection {
  return {
    code: extractPrimaryDStrong(row.dStrong),
    meaningHtml: escapeHtml(row.gloss),
    meaningText: row.gloss,
    source: "STEP_DATABASE_GLOSS_FALLBACK",
    sourceField: "StepGloss",
    sourceLine,
    rule: "step-gloss-last-resort"
  };
}

function createCandidateTables(database: DatabaseSync): void {
  database.exec(`
    DROP TABLE IF EXISTS GreekMeaningProvenance;
    CREATE TABLE GreekMeaningProvenance (
      stepEntryId INTEGER PRIMARY KEY,
      entryKey TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL,
      sourceField TEXT NOT NULL,
      sourceLocator TEXT NOT NULL,
      sourceMappingRule TEXT NOT NULL,
      sourceHash TEXT NOT NULL,
      selectionRule TEXT NOT NULL,
      previousMeaningHash TEXT NOT NULL,
      meaningHash TEXT NOT NULL,
      meaningText TEXT NOT NULL,
      frenchStatus TEXT NOT NULL,
      frenchParentLocator TEXT,
      frenchParentHash TEXT,
      FOREIGN KEY(stepEntryId) REFERENCES StepEntries(id) ON DELETE CASCADE
    ) WITHOUT ROWID;
    CREATE INDEX idx_GreekMeaningProvenance_source
      ON GreekMeaningProvenance(source);
    CREATE INDEX idx_GreekMeaningProvenance_frenchStatus
      ON GreekMeaningProvenance(frenchStatus);

    DROP TABLE IF EXISTS GreekMeaningLegacyTranslations;
    CREATE TABLE GreekMeaningLegacyTranslations (
      stepEntryId INTEGER PRIMARY KEY,
      meaning TEXT NOT NULL,
      meaningHtml TEXT NOT NULL,
      contentHash TEXT NOT NULL,
      FOREIGN KEY(stepEntryId) REFERENCES StepEntries(id) ON DELETE CASCADE
    ) WITHOUT ROWID;
  `);
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
  const value = row ? Object.values(row)[0] : undefined;
  return Number(value);
}

function extractPrimaryDStrong(value: string): string {
  const match = value.match(/\bG\d{4,5}[A-Za-z]?\b/u);
  if (!match) throw new Error(`invalid-dstrong:${value}`);
  return match[0];
}

function numericStrongCode(value: string): number {
  const match = value.match(/^G(\d{4,5})[A-Za-z]?$/u);
  if (!match) throw new Error(`invalid-step-lexicon-code:${value}`);
  return Number(match[1]);
}

function resolveAbbottSmithSourceEntry(
  meaningSourceEntry: StepGreekLexiconEntry | undefined,
  sameBaseEntries: StepGreekLexiconEntry[],
  existingMeaning: string
): StepGreekLexiconEntry | undefined {
  if (meaningSourceEntry) return meaningSourceEntry;

  const abbottSmithEntries = sameBaseEntries.filter(
    (entry) =>
      classifyAbbottSmithDefinition(entry.fields.AS_Def) === "abbott_smith"
  );
  const matches = abbottSmithEntries.filter((entry) => {
    const definition = entry.fields.AS_Def;
    return sourceValuesEquivalent(
      cleanLexiconSourceHtml(definition ?? ""),
      existingMeaning
    );
  });
  const candidates = matches.length > 0 ? matches : abbottSmithEntries;
  if (candidates.length === 0) return undefined;

  const first = candidates[0]!;
  const firstDefinition = cleanLexiconSourceHtml(first.fields.AS_Def ?? "");
  if (
    candidates.every((entry) =>
      sourceValuesEquivalent(
        firstDefinition,
        cleanLexiconSourceHtml(entry.fields.AS_Def ?? "")
      )
    )
  ) {
    return first;
  }
  return undefined;
}

function uniqueMap<K, V>(
  entries: ReadonlyArray<readonly [K, V]>,
  errorCode: string
): Map<K, V> {
  const result = new Map<K, V>();
  for (const [key, value] of entries) {
    if (result.has(key)) throw new Error(`${errorCode}:${String(key)}`);
    result.set(key, value);
  }
  return result;
}

function groupBy<K, V>(
  values: readonly V[],
  keyFor: (value: V) => K
): Map<K, V[]> {
  const result = new Map<K, V[]>();
  for (const value of values) {
    const key = keyFor(value);
    const group = result.get(key) ?? [];
    group.push(value);
    result.set(key, group);
  }
  return result;
}

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function sortedRecord(counts: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))
  );
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

async function writeJsonl(filePath: string, values: unknown[]): Promise<void> {
  await writeFile(
    filePath,
    values.length === 0
      ? ""
      : `${values.map((value) => JSON.stringify(value)).join("\n")}\n`
  );
}

async function sha256File(filePath: string): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of createReadStream(filePath)) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return sha256(Buffer.concat(chunks));
}

function renderReport(manifest: {
  status: string;
  counts: Record<string, number>;
  meaningSourceCounts: Record<string, number>;
  sourceMappingRuleCounts: Record<string, number>;
  frenchMeaningStatusCounts: Record<string, number>;
  candidateCounts: Record<string, number>;
  integrity: string;
  foreignKeyViolations: number;
  invariants: Record<string, boolean>;
}): string {
  const rows = (record: Record<string, number>): string =>
    Object.entries(record)
      .map(
        ([key, value]) => `| \`${key}\` | ${value.toLocaleString("fr-FR")} |`
      )
      .join("\n");
  return `# Réorganisation déterministe du lexique grec

Statut : **${manifest.status}**

Cette base est une candidate de travail. Elle ne doit pas être publiée tant que
les meanings français manquants n'ont pas été traduits, validés et rattachés à
leur parent anglais exact.

## Résultat

| Mesure | Valeur |
| --- | ---: |
${rows(manifest.counts)}

## Sources des meanings anglais

| Source | Entrées |
| --- | ---: |
${rows(manifest.meaningSourceCounts)}

## Appariement à la source STEP

| Règle | Entrées |
| --- | ---: |
${rows(manifest.sourceMappingRuleCounts)}

## Réutilisation française

| Statut | Entrées |
| --- | ---: |
${rows(manifest.frenchMeaningStatusCounts)}

## Base candidate

| Table/mesure | Valeur |
| --- | ---: |
${rows(manifest.candidateCounts)}

## Vérifications

- Intégrité SQLite : \`${manifest.integrity}\`
- Violations de clés étrangères : ${manifest.foreignKeyViolations}
${Object.entries(manifest.invariants)
  .map(([key, value]) => `- ${key} : ${value ? "OK" : "ÉCHEC"}`)
  .join("\n")}

## Contrat éditorial

- Abbott-Smith est une ressource \`AS / biblical_full\`, jamais le nouveau
  meaning par défaut.
- Une pseudo-notice \`AS_Def\` explicitement issue de FLSJ/MLSJ n'est pas
  attribuée à Abbott-Smith.
- Une source TBESG mise en quarantaine par l'audit anglais n'est pas publiée
  comme ressource AS.
- Le meaning est choisi sans paraphrase : TIPNR \`ShortDef\` lorsqu'il nomme
  explicitement l'entité, sinon \`MounceShortDef\`, puis des fallbacks
  déterministes documentés.
- Une traduction française n'est réutilisée que lorsque son parent anglais est
  exactement équivalent après normalisation de présentation.
`;
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error
  );
  process.exitCode = 1;
});
