import { once } from "node:events";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { link, mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { DatabaseSync } from "node:sqlite";

import { BOOK_IDS } from "./books.js";
import { contentFingerprint } from "./contentAddressedCache.js";
import { getCuratedStrongOverrides } from "./curatedStrongOverrides.js";
import { writeJsonFileImmutable } from "./immutableFile.js";
import {
  type StepLexicalIdentityIndex,
  readStepLexicalIdentityIndex
} from "./stepLexicalIdentity.js";
import {
  curatedOverrideFingerprints,
  renderStrongTaggedText,
  strongLedgerInputFingerprint,
  type StrongLedgerAnnotation
} from "./strongLedger.js";
import { readStrongLedgerSqlite } from "./strongLedgerStore.js";
import {
  applyPermissivePromotionPlan,
  parsePermissivePromotionPlan,
  promotionMap,
  type PermissivePromotion,
  type PermissivePromotionPlan
} from "./permissiveStrongProjection.js";
import { escapeHtml, tokenizeText } from "./tokenize.js";

export const GENERATED_STRONG_JSONL_SCHEMA_VERSION = 2;
export type GeneratedStrongJsonlView = "reader" | "permissive";

export interface GeneratedStrongJsonlMetrics {
  verseCount: number;
  taggedTokenCount: number;
  enrichedTagCount: number;
  exactOccurrenceTagCount: number;
  partiallyResolvedTagCount: number;
  unresolvedTagCount: number;
  missingAnnotationTagCount: number;
  ambiguousOccurrenceTagCount: number;
  multiOccurrenceTagCount: number;
  extendedStrongCount: number;
  distinguishedStrongCount: number;
  unifiedStrongCount: number;
  strippedAuthoringAttributeCount: number;
  emptyTagCount: number;
  promotedAnnotationCount: number;
  promotedWordCount: number;
  promotedPhraseCount: number;
  skippedDuplicateCarrierCount: number;
  deduplicatedStrongValueCount: number;
}

export interface GeneratedStrongJsonlRecord {
  ref: string;
  version: string;
  book: number;
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface GeneratedStrongJsonlResult {
  outputPath: string;
  manifestPath: string;
  artifactSha256: string;
  sourceSqliteSha256: string;
  sizeBytes: number;
  sourceSizeBytes: number;
  sizeReductionRatio?: number;
  metrics: GeneratedStrongJsonlMetrics;
}

interface SqliteVerseRow {
  ref: string;
  book_id: string;
  book_order: number;
  chapter: number;
  verse: number;
  text: string;
  annotations_json: string;
  reader_html: string;
  advanced_html: string;
}

interface CompactIdentitySet {
  estrong: string[];
  dstrong: string[];
  ustrong: string[];
}

interface TagResolution {
  compact: CompactIdentitySet;
  exactOccurrence: boolean;
  missingAnnotation: boolean;
  ambiguous: boolean;
  multiOccurrence: boolean;
  partiallyResolved: boolean;
  resolved: boolean;
}

export async function writeGeneratedStrongJsonl(options: {
  bible: string;
  version: string;
  sqlitePath: string;
  outputPath: string;
  manifestPath: string;
  identityIndex: StepLexicalIdentityIndex;
  identityFiles: string[];
  only?: string;
  view?: GeneratedStrongJsonlView;
  promotionPlanPath?: string;
}): Promise<GeneratedStrongJsonlResult> {
  const view = options.view ?? "reader";
  if (existsSync(options.outputPath)) {
    throw new Error(`generated-jsonl-already-exists:${options.outputPath}`);
  }
  if (existsSync(options.manifestPath)) {
    throw new Error(
      `generated-jsonl-manifest-already-exists:${options.manifestPath}`
    );
  }
  const ledger = readStrongLedgerSqlite({
    sqlitePath: options.sqlitePath,
    includeVerses: false
  });
  if (ledger.bible.toLowerCase() !== options.bible.toLowerCase()) {
    throw new Error(
      `generated-jsonl-ledger-bible-mismatch:${ledger.bible}:${options.bible}`
    );
  }
  const permissive = await loadPermissivePlan({
    view,
    bible: options.bible,
    only: options.only,
    inputFingerprint: ledger.inputFingerprint,
    promotionPlanPath: options.promotionPlanPath
  });
  if (!options.only) {
    const currentInputFingerprint = strongLedgerInputFingerprint({
      bible: options.bible,
      biblePath: ledger.inputPath,
      outputDir: path.dirname(options.sqlitePath),
      profileBible: ledger.translationProfile.bible
    });
    if (currentInputFingerprint !== ledger.inputFingerprint) {
      throw new Error(
        `generated-jsonl-stale-input-fingerprint:${ledger.inputFingerprint ?? "missing"}:${currentInputFingerprint}`
      );
    }
    const currentOverrideFingerprint = contentFingerprint({
      namespace: "curated-strong-overrides-v1",
      values: curatedOverrideFingerprints(
        options.bible,
        getCuratedStrongOverrides()
      )
    });
    if (currentOverrideFingerprint !== ledger.overrideFingerprint) {
      throw new Error(
        `generated-jsonl-stale-override-fingerprint:${ledger.overrideFingerprint ?? "missing"}:${currentOverrideFingerprint}`
      );
    }
  }
  await mkdir(path.dirname(options.outputPath), { recursive: true });
  const temporaryPath = `${options.outputPath}.tmp-${process.pid}-${Date.now()}`;
  await rm(temporaryPath, { force: true });
  const metrics = emptyMetrics();
  const database = new DatabaseSync(options.sqlitePath, { readOnly: true });
  const output = createWriteStream(temporaryPath, {
    encoding: "utf8",
    flags: "wx"
  });
  let expectedVerseCount = 0;
  try {
    const selection = sqliteSelection(options.only);
    expectedVerseCount = Number(
      (
        database
          .prepare(
            `select count(*) as count from verses where bible = ?${selection.sql}`
          )
          .get(options.bible, ...selection.params) as { count: number | bigint }
      ).count
    );
    if (!options.only && expectedVerseCount !== ledger.metrics.verseCount) {
      throw new Error(
        `generated-jsonl-ledger-verse-count-drift:${ledger.metrics.verseCount}:${expectedVerseCount}`
      );
    }
    // Keep the statement strongly referenced for the lifetime of the iterator.
    // Node's sqlite iterator does not retain it: on a full Bible the statement
    // can otherwise be garbage-collected and finalized during an awaited
    // stream drain.
    const verseStatement = database.prepare(
      `select ref, book_id, book_order, chapter, verse,
              text, annotations_json, reader_html, advanced_html
       from verses
       where bible = ?${selection.sql}
       order by book_order, chapter, verse`
    );
    const rows = verseStatement.iterate(
      options.bible,
      ...selection.params
    ) as Iterable<SqliteVerseRow>;
    let previousOrder = -1;
    let previousChapter = -1;
    let previousVerse = -1;
    for (const row of rows) {
      assertCanonicalRowOrder(row, {
        previousOrder,
        previousChapter,
        previousVerse
      });
      previousOrder = row.book_order;
      previousChapter = row.chapter;
      previousVerse = row.verse;
      const annotations = JSON.parse(
        row.annotations_json
      ) as StrongLedgerAnnotation[];
      const projected = projectGeneratedHtml({
        view,
        ref: row.ref,
        text: row.text,
        readerHtml: row.reader_html,
        advancedHtml: row.advanced_html,
        annotations,
        promotionsByAnnotationId: permissive.promotionsByAnnotationId
      });
      const transformed = enrichGeneratedHtml({
        html: projected.html,
        annotations: projected.annotations,
        identityIndex: options.identityIndex,
        view
      });
      mergeMetrics(metrics, transformed.metrics);
      metrics.promotedAnnotationCount += projected.promotedAnnotationCount;
      metrics.promotedWordCount += projected.promotedWordCount;
      metrics.promotedPhraseCount += projected.promotedPhraseCount;
      metrics.skippedDuplicateCarrierCount +=
        projected.skippedDuplicateCarrierCount;
      metrics.verseCount += 1;
      const expectedMinified = minifyGeneratedHtml(projected.html, view);
      if (
        stripCompactStepIdentityAttributes(transformed.text) !==
        expectedMinified
      ) {
        throw new Error(
          `generated-jsonl-structural-roundtrip-failed:${row.ref}`
        );
      }
      const record: GeneratedStrongJsonlRecord = {
        ref: row.ref,
        version: options.version,
        book: row.book_order + 1,
        bookId: row.book_id,
        chapter: row.chapter,
        verse: row.verse,
        text: transformed.text
      };
      await writeStreamLine(output, `${JSON.stringify(record)}\n`);
    }
    output.end();
    await once(output, "finish");
  } catch (error) {
    output.destroy();
    await rm(temporaryPath, { force: true });
    throw error;
  } finally {
    database.close();
  }

  let outputPublished = false;
  try {
    if (metrics.verseCount !== expectedVerseCount) {
      throw new Error(
        `generated-jsonl-verse-count-mismatch:${expectedVerseCount}:${metrics.verseCount}`
      );
    }
    await verifyGeneratedJsonl({
      jsonlPath: temporaryPath,
      sqlitePath: options.sqlitePath,
      bible: options.bible,
      version: options.version,
      only: options.only,
      expectedVerseCount,
      view,
      promotionsByAnnotationId: permissive.promotionsByAnnotationId
    });
    const [
      artifactSha256,
      sourceSqliteSha256,
      promotionPlanSha256,
      artifactStat,
      sourceStat
    ] = await Promise.all([
      sha256File(temporaryPath),
      sha256File(options.sqlitePath),
      permissive.planPath
        ? sha256File(permissive.planPath)
        : Promise.resolve(undefined),
      stat(temporaryPath),
      stat(options.sqlitePath)
    ]);
    const identitySources = await Promise.all(
      options.identityFiles.map(async (file) => ({
        path: file,
        sha256: await sha256File(file)
      }))
    );
    const sizeReductionRatio = options.only
      ? undefined
      : 1 - artifactStat.size / Math.max(1, sourceStat.size);
    const manifest = {
      artifactSchemaVersion: GENERATED_STRONG_JSONL_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      format: "jsonl",
      bible: options.bible,
      version: options.version,
      view,
      scope: options.only ?? "all",
      status: options.only
        ? "validated-scoped-preview"
        : "validated-full-artifact",
      textPolicy:
        view === "reader"
          ? "lossless-reader-inline-markup-with-compact-step-identities"
          : "lossless-permissive-reader-plus-advanced-with-deterministic-carrier-promotions-and-compact-step-identities",
      compactAttributes: ["estrong", "dstrong", "ustrong"],
      identityPolicy:
        "exact ledger originalOccurrenceId and STEP evidence first; TBESH/TBESG only extend that exact dStrong; ambiguous or missing evidence emits no guessed STEP identity",
      source: {
        sqlitePath: options.sqlitePath,
        sqliteSha256: sourceSqliteSha256,
        sqliteSizeBytes: sourceStat.size,
        inputFingerprint: ledger.inputFingerprint,
        overrideFingerprint: ledger.overrideFingerprint,
        verseCount: expectedVerseCount,
        currentFingerprintGate: options.only
          ? "not-run-scoped-preview"
          : "passed"
      },
      ...(permissive.plan && permissive.planPath && promotionPlanSha256
        ? {
            promotionPlan: {
              path: permissive.planPath,
              sha256: promotionPlanSha256,
              schemaVersion: permissive.plan.schemaVersion,
              policy: permissive.plan.policy,
              metrics: permissive.plan.metrics,
              inputFingerprint: permissive.plan.inputFingerprint
            }
          }
        : {}),
      identitySources,
      artifact: {
        path: options.outputPath,
        sha256: artifactSha256,
        sizeBytes: artifactStat.size,
        ...(sizeReductionRatio === undefined ? {} : { sizeReductionRatio })
      },
      metrics,
      validation: {
        lineByLineJsonParse: true,
        canonicalReferenceOrder: true,
        verseCountMatchesSqlite: true,
        strippingCompactIdentityAttributesReconstructsProjectedHtml: true,
        emittedStepIdentitiesRequireExactOccurrenceEvidence: true,
        structuralMarkupPreserved: true,
        deterministicPromotionPlanApplied: true,
        permissiveStrongAttributesAreSets: true
      }
    };

    await link(temporaryPath, options.outputPath);
    outputPublished = true;
    await writeJsonFileImmutable(options.manifestPath, manifest);

    return {
      outputPath: options.outputPath,
      manifestPath: options.manifestPath,
      artifactSha256,
      sourceSqliteSha256,
      sizeBytes: artifactStat.size,
      sourceSizeBytes: sourceStat.size,
      ...(sizeReductionRatio === undefined ? {} : { sizeReductionRatio }),
      metrics
    };
  } catch (error) {
    if (outputPublished) await rm(options.outputPath, { force: true });
    if (!outputPublished && isAlreadyExists(error)) {
      throw new Error(`generated-jsonl-already-exists:${options.outputPath}`);
    }
    throw error;
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

interface LoadedPermissivePlan {
  plan?: PermissivePromotionPlan;
  planPath?: string;
  promotionsByAnnotationId: ReadonlyMap<string, PermissivePromotion>;
}

function projectGeneratedHtml(options: {
  view: GeneratedStrongJsonlView;
  ref: string;
  text: string;
  readerHtml: string;
  advancedHtml: string;
  annotations: StrongLedgerAnnotation[];
  promotionsByAnnotationId: ReadonlyMap<string, PermissivePromotion>;
}): {
  html: string;
  annotations: StrongLedgerAnnotation[];
  promotedAnnotationCount: number;
  promotedWordCount: number;
  promotedPhraseCount: number;
  skippedDuplicateCarrierCount: number;
} {
  if (options.view === "reader") {
    return {
      html: options.readerHtml,
      annotations: options.annotations,
      promotedAnnotationCount: 0,
      promotedWordCount: 0,
      promotedPhraseCount: 0,
      skippedDuplicateCarrierCount: 0
    };
  }

  const applied = applyPermissivePromotionPlan({
    ref: options.ref,
    annotations: options.annotations,
    promotionsByAnnotationId: options.promotionsByAnnotationId
  });
  const html = renderStrongTaggedText(
    tokenizeText(options.text),
    applied.annotations,
    "advanced"
  );
  if (
    stripStrongTags(html) !== stripStrongTags(options.advancedHtml) ||
    stripStrongTags(html) !== escapeHtml(options.text)
  ) {
    throw new Error(
      `generated-jsonl-permissive-structural-drift:${options.ref}`
    );
  }
  return {
    html,
    annotations: applied.annotations,
    promotedAnnotationCount: applied.promotedAnnotationCount,
    promotedWordCount: applied.promotedWordCount,
    promotedPhraseCount: applied.promotedPhraseCount,
    skippedDuplicateCarrierCount: applied.skippedDuplicateCarrierCount
  };
}

async function loadPermissivePlan(options: {
  view: GeneratedStrongJsonlView;
  bible: string;
  only?: string;
  inputFingerprint?: string;
  promotionPlanPath?: string;
}): Promise<LoadedPermissivePlan> {
  if (options.view === "reader") {
    return { promotionsByAnnotationId: new Map() };
  }
  if (!options.promotionPlanPath) {
    throw new Error("generated-jsonl-permissive-plan-required");
  }
  const plan = parsePermissivePromotionPlan(
    JSON.parse(await readFile(options.promotionPlanPath, "utf8")) as unknown
  );
  if (plan.bible !== options.bible) {
    throw new Error(
      `generated-jsonl-permissive-plan-bible-mismatch:${plan.bible}:${options.bible}`
    );
  }
  if (plan.scope !== "all" && plan.scope !== (options.only ?? "all")) {
    throw new Error(
      `generated-jsonl-permissive-plan-scope-mismatch:${plan.scope}:${options.only ?? "all"}`
    );
  }
  if (
    !options.inputFingerprint ||
    plan.inputFingerprint !== options.inputFingerprint
  ) {
    throw new Error(
      `generated-jsonl-permissive-plan-fingerprint-mismatch:${plan.inputFingerprint}:${options.inputFingerprint ?? "missing"}`
    );
  }
  if (plan.metrics.promotedAnnotationCount !== plan.promotions.length) {
    throw new Error("generated-jsonl-permissive-plan-count-mismatch");
  }
  return {
    plan,
    planPath: options.promotionPlanPath,
    promotionsByAnnotationId: promotionMap(plan)
  };
}

export function enrichGeneratedReaderHtml(options: {
  html: string;
  annotations: StrongLedgerAnnotation[];
  identityIndex?: StepLexicalIdentityIndex;
}): { text: string; metrics: GeneratedStrongJsonlMetrics } {
  return enrichGeneratedHtml({ ...options, view: "reader" });
}

export function enrichGeneratedHtml(options: {
  html: string;
  annotations: StrongLedgerAnnotation[];
  identityIndex?: StepLexicalIdentityIndex;
  view: GeneratedStrongJsonlView;
}): { text: string; metrics: GeneratedStrongJsonlMetrics } {
  const metrics = emptyMetrics();
  const text = options.html.replace(
    /<w\b([^>]*)>([\s\S]*?)<\/w>/giu,
    (match, rawAttributes, body) => {
      const attributes = String(rawAttributes);
      const strongValue = readAttribute(attributes, "strong");
      if (!strongValue) return match;
      metrics.taggedTokenCount += 1;
      const sourceStrongCodes = strongValue.split(/\s+/u).filter(Boolean);
      const strongCodes =
        options.view === "permissive"
          ? unique(sourceStrongCodes)
          : sourceStrongCodes;
      metrics.deduplicatedStrongValueCount +=
        sourceStrongCodes.length - strongCodes.length;
      const resolution = resolveTagIdentities({
        attributes,
        strongCodes,
        annotations: options.annotations,
        identityIndex: options.identityIndex,
        view: options.view
      });
      recordResolution(metrics, resolution);
      const stripped =
        options.view === "permissive"
          ? replaceStrongAttribute(
              stripAuthoringAttributes(attributes),
              strongCodes
            )
          : stripAuthoringAttributes(attributes);
      metrics.strippedAuthoringAttributeCount +=
        countAuthoringAttributes(attributes);
      const identityAttributes = [
        renderAttribute("estrong", resolution.compact.estrong),
        renderAttribute("dstrong", resolution.compact.dstrong),
        renderAttribute("ustrong", resolution.compact.ustrong)
      ]
        .filter(Boolean)
        .join("");
      return `<w${stripped.trimEnd()}${identityAttributes}>${body}</w>`;
    }
  );
  metrics.emptyTagCount = countEmptyStrongTags(text);
  return { text, metrics };
}

function resolveTagIdentities(options: {
  attributes: string;
  strongCodes: string[];
  annotations: StrongLedgerAnnotation[];
  identityIndex?: StepLexicalIdentityIndex;
  view: GeneratedStrongJsonlView;
}): TagResolution {
  const compact: CompactIdentitySet = {
    estrong: [],
    dstrong: [],
    ustrong: []
  };
  let exactOccurrence = false;
  let missingAnnotation = false;
  let ambiguous = false;
  let multiOccurrence = false;
  let resolvedStrongCount = 0;

  for (const sourceStrong of options.strongCodes) {
    const matches = options.annotations.filter(
      (annotation) =>
        isVisibleInGeneratedView(annotation, options.view) &&
        annotation.strong.toUpperCase() === sourceStrong.toUpperCase() &&
        annotationMatchesRenderedTag(annotation, options.attributes)
    );
    if (matches.length === 0) {
      missingAnnotation = true;
      continue;
    }
    const occurrenceIds = unique(
      matches.flatMap((annotation) => annotation.originalOccurrenceId ?? [])
    );
    if (occurrenceIds.length > 1) multiOccurrence = true;
    const exactMatches = matches.filter(
      (annotation) =>
        Boolean(annotation.originalOccurrenceId) &&
        Boolean(annotation.step?.length)
    );
    if (exactMatches.length === 0) continue;
    exactOccurrence = true;
    const dStrongValues = unique(
      exactMatches.flatMap(
        (annotation) => annotation.step?.map((step) => step.dStrong) ?? []
      )
    );
    const exactOccurrenceCount = new Set(
      exactMatches.map((annotation) => annotation.originalOccurrenceId)
    ).size;
    if (dStrongValues.length > Math.max(1, exactOccurrenceCount)) {
      ambiguous = true;
      continue;
    }
    if (dStrongValues.length === 0) continue;
    resolvedStrongCount += 1;
    for (const dStrong of dStrongValues) {
      const identity = options.identityIndex?.get(dStrong);
      const eStrong = identity?.eStrong;
      if (eStrong && !sameIdentity(eStrong, sourceStrong)) {
        compact.estrong.push(eStrong);
      }
      if (
        !sameIdentity(dStrong, sourceStrong) &&
        (!eStrong || !sameIdentity(dStrong, eStrong))
      ) {
        compact.dstrong.push(dStrong);
      }
      for (const uStrong of identity?.uStrong ?? []) {
        if (
          !sameIdentity(uStrong, sourceStrong) &&
          !sameIdentity(uStrong, dStrong) &&
          (!eStrong || !sameIdentity(uStrong, eStrong))
        ) {
          compact.ustrong.push(uStrong);
        }
      }
    }
  }

  compact.estrong = unique(compact.estrong);
  compact.dstrong = unique(compact.dstrong);
  compact.ustrong = unique(compact.ustrong);
  return {
    compact,
    exactOccurrence,
    missingAnnotation,
    ambiguous,
    multiOccurrence,
    partiallyResolved:
      resolvedStrongCount > 0 &&
      resolvedStrongCount < options.strongCodes.length,
    resolved: resolvedStrongCount === options.strongCodes.length
  };
}

function isVisibleInGeneratedView(
  annotation: StrongLedgerAnnotation,
  view: GeneratedStrongJsonlView
): boolean {
  return view === "reader"
    ? annotation.visibility === "reader"
    : annotation.visibility === "reader" ||
        annotation.visibility === "advanced";
}

function annotationMatchesRenderedTag(
  annotation: StrongLedgerAnnotation,
  attributes: string
): boolean {
  const target = readAttribute(attributes, "data-target") ?? "word";
  if (target === "word") {
    const wordIndex = integerAttribute(attributes, "data-word-index");
    return (
      (annotation.placement === "word" ||
        annotation.placement === "duplicate") &&
      annotation.wordIndex === wordIndex
    );
  }
  if (target === "phrase") {
    return (
      annotation.placement === "phrase" &&
      annotation.startWordIndex ===
        integerAttribute(attributes, "data-start-word-index") &&
      annotation.endWordIndex ===
        integerAttribute(attributes, "data-end-word-index")
    );
  }
  return (
    annotation.placement === target &&
    annotation.insertAfterWordIndex ===
      integerAttribute(attributes, "data-insert-after-word-index")
  );
}

function recordResolution(
  metrics: GeneratedStrongJsonlMetrics,
  resolution: TagResolution
): void {
  if (resolution.exactOccurrence) metrics.exactOccurrenceTagCount += 1;
  if (resolution.missingAnnotation) metrics.missingAnnotationTagCount += 1;
  if (resolution.ambiguous) metrics.ambiguousOccurrenceTagCount += 1;
  if (resolution.multiOccurrence) metrics.multiOccurrenceTagCount += 1;
  if (resolution.partiallyResolved) metrics.partiallyResolvedTagCount += 1;
  if (!resolution.resolved) metrics.unresolvedTagCount += 1;
  if (
    resolution.compact.estrong.length > 0 ||
    resolution.compact.dstrong.length > 0 ||
    resolution.compact.ustrong.length > 0
  ) {
    metrics.enrichedTagCount += 1;
  }
  metrics.extendedStrongCount += resolution.compact.estrong.length;
  metrics.distinguishedStrongCount += resolution.compact.dstrong.length;
  metrics.unifiedStrongCount += resolution.compact.ustrong.length;
}

export function minifyGeneratedReaderHtml(html: string): string {
  return minifyGeneratedHtml(html, "reader");
}

export function minifyGeneratedHtml(
  html: string,
  view: GeneratedStrongJsonlView
): string {
  return html.replace(/<w\b([^>]*)>/giu, (_match, rawAttributes) => {
    const stripped = stripAuthoringAttributes(String(rawAttributes));
    const strongValue = readAttribute(stripped, "strong");
    const compact =
      view === "permissive" && strongValue
        ? replaceStrongAttribute(
            stripped,
            unique(strongValue.split(/\s+/u).filter(Boolean))
          )
        : stripped;
    return `<w${compact.trimEnd()}>`;
  });
}

export function stripCompactStepIdentityAttributes(text: string): string {
  return text.replace(/\s+(?:e|d|u)strong=(['"])[\s\S]*?\1/giu, "");
}

function stripStrongTags(text: string): string {
  return text.replace(/<w\b[^>]*>/giu, "").replace(/<\/w>/giu, "");
}

function countEmptyStrongTags(text: string): number {
  return [...text.matchAll(/<w\b[^>]*>\s*<\/w>/giu)].length;
}

function stripAuthoringAttributes(attributes: string): string {
  return attributes.replace(/\s+data-[\w:-]+=(['"])[\s\S]*?\1/giu, "");
}

function countAuthoringAttributes(attributes: string): number {
  return attributes.match(/\s+data-[\w:-]+=(['"])[\s\S]*?\1/giu)?.length ?? 0;
}

function readAttribute(attributes: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`\\b${escaped}=(['"])([\\s\\S]*?)\\1`, "iu").exec(
    attributes
  )?.[2];
}

function replaceStrongAttribute(
  attributes: string,
  strongCodes: string[]
): string {
  return attributes.replace(
    /\bstrong=(['"])[\s\S]*?\1/iu,
    (match, quote: string) =>
      strongCodes.length > 0
        ? `strong=${quote}${escapeAttribute(strongCodes.join(" "))}${quote}`
        : match
  );
}

function integerAttribute(
  attributes: string,
  name: string
): number | undefined {
  const value = readAttribute(attributes, name);
  if (value === undefined || !/^-?\d+$/u.test(value)) return undefined;
  return Number(value);
}

function renderAttribute(name: string, values: string[]): string {
  return values.length > 0
    ? ` ${name}="${escapeAttribute(values.join(" "))}"`
    : "";
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function sameIdentity(left: string, right: string): boolean {
  return left === right;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function emptyMetrics(): GeneratedStrongJsonlMetrics {
  return {
    verseCount: 0,
    taggedTokenCount: 0,
    enrichedTagCount: 0,
    exactOccurrenceTagCount: 0,
    partiallyResolvedTagCount: 0,
    unresolvedTagCount: 0,
    missingAnnotationTagCount: 0,
    ambiguousOccurrenceTagCount: 0,
    multiOccurrenceTagCount: 0,
    extendedStrongCount: 0,
    distinguishedStrongCount: 0,
    unifiedStrongCount: 0,
    strippedAuthoringAttributeCount: 0,
    emptyTagCount: 0,
    promotedAnnotationCount: 0,
    promotedWordCount: 0,
    promotedPhraseCount: 0,
    skippedDuplicateCarrierCount: 0,
    deduplicatedStrongValueCount: 0
  };
}

function mergeMetrics(
  target: GeneratedStrongJsonlMetrics,
  source: GeneratedStrongJsonlMetrics
): void {
  for (const key of Object.keys(source) as Array<
    keyof GeneratedStrongJsonlMetrics
  >) {
    if (key === "verseCount") continue;
    target[key] += source[key];
  }
}

async function writeStreamLine(
  stream: ReturnType<typeof createWriteStream>,
  line: string
): Promise<void> {
  if (!stream.write(line)) await once(stream, "drain");
}

async function verifyGeneratedJsonl(options: {
  jsonlPath: string;
  sqlitePath: string;
  bible: string;
  version: string;
  only?: string;
  expectedVerseCount: number;
  view: GeneratedStrongJsonlView;
  promotionsByAnnotationId: ReadonlyMap<string, PermissivePromotion>;
}): Promise<void> {
  const database = new DatabaseSync(options.sqlitePath, { readOnly: true });
  const selection = sqliteSelection(options.only);
  const verseStatement = database.prepare(
    `select ref, book_id, book_order, chapter, verse, text,
            annotations_json, reader_html, advanced_html
     from verses
     where bible = ?${selection.sql}
     order by book_order, chapter, verse`
  );
  const rowIterable = verseStatement.iterate(
    options.bible,
    ...selection.params
  ) as Iterable<SqliteVerseRow>;
  const rows = rowIterable[Symbol.iterator]();
  const lines = readline.createInterface({
    input: createReadStream(options.jsonlPath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  let count = 0;
  try {
    for await (const line of lines) {
      if (!line) throw new Error(`generated-jsonl-empty-line:${count + 1}`);
      const record = JSON.parse(line) as GeneratedStrongJsonlRecord;
      const expected = rows.next();
      if (expected.done) {
        throw new Error(`generated-jsonl-extra-line:${count + 1}`);
      }
      const row = expected.value;
      const annotations = JSON.parse(
        row.annotations_json
      ) as StrongLedgerAnnotation[];
      const projected = projectGeneratedHtml({
        view: options.view,
        ref: row.ref,
        text: row.text,
        readerHtml: row.reader_html,
        advancedHtml: row.advanced_html,
        annotations,
        promotionsByAnnotationId: options.promotionsByAnnotationId
      });
      if (
        record.ref !== row.ref ||
        record.version !== options.version ||
        record.book !== row.book_order + 1 ||
        record.bookId !== row.book_id ||
        record.chapter !== row.chapter ||
        record.verse !== row.verse ||
        stripCompactStepIdentityAttributes(record.text) !==
          minifyGeneratedHtml(projected.html, options.view)
      ) {
        throw new Error(
          `generated-jsonl-roundtrip-mismatch:${count + 1}:${row.ref}`
        );
      }
      validateCompactIdentityTags(record.text, count + 1, options.view);
      count += 1;
    }
    if (!rows.next().done) throw new Error("generated-jsonl-missing-lines");
  } finally {
    database.close();
  }
  if (count !== options.expectedVerseCount) {
    throw new Error(
      `generated-jsonl-roundtrip-count-mismatch:${options.expectedVerseCount}:${count}`
    );
  }
}

function validateCompactIdentityTags(
  text: string,
  line: number,
  view: GeneratedStrongJsonlView
): void {
  for (const match of text.matchAll(/<w\b([^>]*)>/giu)) {
    const attributes = match[1] ?? "";
    const strong = readAttribute(attributes, "strong");
    if (view === "permissive" && strong) {
      const codes = strong.split(/\s+/u).filter(Boolean);
      if (unique(codes).length !== codes.length) {
        throw new Error(`duplicate-strong-value:${line}:${strong}`);
      }
    }
    for (const name of ["estrong", "dstrong", "ustrong"] as const) {
      const value = readAttribute(attributes, name);
      if (!value) continue;
      if (!strong) throw new Error(`${name}-without-strong:${line}`);
      for (const code of value.split(/\s+/u).filter(Boolean)) {
        if (!/^[GH]\d{4,5}[A-Za-z]?(?:_[A-Za-z])?$/u.test(code)) {
          throw new Error(`invalid-${name}:${line}:${code}`);
        }
      }
    }
  }
}

function sqliteSelection(only?: string): {
  sql: string;
  params: Array<string | number>;
} {
  if (!only || only === "all") return { sql: "", params: [] };
  const parts = only.split(".");
  const book = parts[0];
  if (!book || !BOOK_IDS.includes(book as (typeof BOOK_IDS)[number])) {
    throw new Error(`invalid-generated-jsonl-scope:${only}`);
  }
  if (parts.length === 1) {
    return { sql: " and book_id = ?", params: [book] };
  }
  if (parts.length === 2 && /^\d+$/u.test(parts[1] ?? "")) {
    return {
      sql: " and book_id = ? and chapter = ?",
      params: [book, Number(parts[1])]
    };
  }
  throw new Error(`invalid-generated-jsonl-scope:${only}`);
}

function assertCanonicalRowOrder(
  row: SqliteVerseRow,
  previous: {
    previousOrder: number;
    previousChapter: number;
    previousVerse: number;
  }
): void {
  if (
    row.book_order < previous.previousOrder ||
    (row.book_order === previous.previousOrder &&
      (row.chapter < previous.previousChapter ||
        (row.chapter === previous.previousChapter &&
          row.verse <= previous.previousVerse)))
  ) {
    throw new Error(`generated-jsonl-noncanonical-order:${row.ref}`);
  }
  const canonicalOrder = BOOK_IDS.indexOf(
    row.book_id as (typeof BOOK_IDS)[number]
  );
  if (canonicalOrder !== row.book_order) {
    throw new Error(`generated-jsonl-book-order-mismatch:${row.ref}`);
  }
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function isAlreadyExists(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}

export async function loadDefaultStepIdentityIndex(
  options: {
    stepLexiconDir?: string;
  } = {}
): Promise<{
  identityIndex: StepLexicalIdentityIndex;
  identityFiles: string[];
}> {
  const directory = options.stepLexiconDir ?? "data/external/stepbible";
  const identityFiles = [
    path.join(directory, "TBESH.txt"),
    path.join(directory, "TBESG.txt")
  ];
  for (const file of identityFiles) {
    if (!existsSync(file))
      throw new Error(`missing-step-identity-file:${file}`);
  }
  return {
    identityFiles,
    identityIndex: await readStepLexicalIdentityIndex(identityFiles)
  };
}
