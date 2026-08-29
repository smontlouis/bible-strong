import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

import { buildLexiconEntryIdentity } from "../src/lexiconV3/identity.js";
import {
  applyEnglishExactRepairs,
  ENGLISH_EXACT_REPAIR_RULES,
  PINNED_ENGLISH_EXACT_REPAIR_SOURCES,
  validateEnglishExactFieldRepairEvidence,
  type EnglishExactRepairEntry
} from "../src/lexiconV3/englishExactRepairs.js";
import { HEBREW_CANONICAL_MEANING_POLICY_ID } from "../src/lexiconV3/hebrewCanonicalPolicy.js";
import {
  buildHebrewExactMeaningRepairProjection,
  validateHebrewExactMeaningRepairProjection,
  type HebrewExactMeaningRepairProjection
} from "../src/lexiconV3/hebrewExactMeaningRepair.js";
import {
  hasMeaningfulTbeshHtml,
  parseTbeshMeaning,
  type TbeshMeaningClassification,
  type TbeshMeaningSections
} from "../src/lexiconV3/tbeshMeaning.js";
import type { TbeshPublicationAction } from "../src/lexiconV3/tbeshPublication.js";

const DEFAULT_SOURCE_DATABASE =
  "data/dictionaries/strong_lexicon.full.production.sqlite";
const DEFAULT_AUTHORING_DATABASE =
  "outputs/lexicon-v3/staging/reviewed-english.sqlite";
const DEFAULT_OUTPUT_JSON =
  "outputs/lexicon-v3/staging/tbesh-sections.audit.json";
const DEFAULT_OUTPUT_MARKDOWN =
  "reports/lexicon-v3-staging/tbesh-sections.audit.md";
const AUDIT_SCHEMA = "lexicon-v3-tbesh-section-audit@4" as const;
const BUILDER_GENERATOR = "buildLexiconV3Authoring@1";
const PUBLICATION_GENERATOR = "tbesh-publication-selector@1";
const CANONICAL_MEANING_GENERATOR = HEBREW_CANONICAL_MEANING_POLICY_ID;
const EXACT_REPAIR_GENERATOR = "english-audit-field-repair@1";
const EXACT_REPAIR_ISSUE = "hebrew-tbesh-exact-meaning-repair-applied";

type CountMap = Record<string, number>;
type DetailValue = string | number | boolean | null;

interface SourceEntryRow extends EnglishExactRepairEntry {
  stepEntryId: number;
}

interface SectionedSourceEntry extends SourceEntryRow {
  entryKey: string;
  sections: TbeshMeaningSections;
}

interface EntryIdRow {
  entryKey: string;
  stepEntryId: number;
}

interface AssertionRow {
  id: number;
  entryKey: string;
  sourceKey: string;
  scope: string;
  valueText: string | null;
  valueHtml: string | null;
  locator: string;
  sha256: string;
}

interface FieldRow {
  id: number;
  entryKey: string;
  state: string;
  valueText: string;
  valueHtml: string | null;
  method: string;
  generator: string;
}

interface EvidenceRow {
  fieldVersionId: number;
  sourceAssertionId: number;
  fieldEntryKey: string;
  assertionEntryKey: string;
  assertionLocator: string;
  sourceKey: string;
  evidenceKind: string;
  stance: string;
  witnessFamily: string;
  detailsJson: string;
}

interface IssueRow {
  entryKey: string;
  fieldVersionId: number | null;
  sourceAssertionId: number | null;
  code: string;
  severity: string;
  status: string;
  detailsJson: string;
}

interface PublicationDecisionRecord {
  action: TbeshPublicationAction;
  content: { html: string; source: string } | null;
  rawProvenanceHtml: string;
  quarantinedParts: Array<{
    part: string;
    html: string;
    reasonCode: string;
  }>;
  reasonCodes: string[];
}

interface PublicationSelectionRecord {
  action: TbeshPublicationAction;
  canonicalPolicyProof: unknown | null;
  counterfactualAction: TbeshPublicationAction | null;
  proof: unknown;
  quarantinedParts: Array<{
    digest: string;
    part: string;
    reasonCode: string;
  }>;
  reasonCodes: string[];
  selectionDigest: string;
}

interface PublicationIssueRecord {
  decision: PublicationDecisionRecord;
  proof: unknown;
  selectionDigest: string;
}

interface FrenchContentCounts {
  fieldVersions: number;
  activeFieldVersions: number;
  sourceAssertions: number;
  carrierTerms: number;
  total: number;
}

export interface LexiconV3TbeshSectionAuditOptions {
  sourceDatabase: string;
  authoringDatabase: string;
  generatedAt?: string;
}

export interface RunLexiconV3TbeshSectionAuditOptions extends LexiconV3TbeshSectionAuditOptions {
  outputJson: string;
  outputMarkdown: string;
}

export interface LexiconV3TbeshSectionAuditViolation {
  code: string;
  entryKey: string | null;
  locator: string | null;
  details: Record<string, DetailValue>;
}

export interface LexiconV3TbeshSectionAuditReport {
  schemaVersion: typeof AUDIT_SCHEMA;
  generatedAt: string;
  inputs: {
    sourceDatabase: string;
    authoringDatabase: string;
  };
  logicalDigests: {
    sourceSections: string;
    authoringSections: string;
  };
  counts: {
    sourceHebrewEntries: number;
    sectionedEntries: number;
    entryMappings: {
      expected: number;
      found: number;
    };
    classifications: Record<TbeshMeaningClassification, number>;
    publicationActions: Record<TbeshPublicationAction, number>;
    separatorCounts: CountMap;
    activeEnglishMeaningStates: CountMap;
    issues: {
      total: number;
      byStatus: CountMap;
      bySeverity: CountMap;
      byCode: CountMap;
    };
    assertions: {
      rawExpected: number;
      rawFound: number;
      stepSpecificExpected: number;
      stepSpecificFound: number;
      legacyGeneralExpected: number;
      legacyGeneralFound: number;
    };
    evidence: {
      publishableSupportsExpected: number;
      publishableSupportsFound: number;
      rawSupportsExpected: number;
      rawSupportsFound: number;
      stepSpecificSupportsExpected: number;
      stepSpecificSupportsFound: number;
      legacyGeneralSupportsExpected: number;
      legacyGeneralSupportsFound: number;
      exactCompanionSupportsExpected: number;
      exactCompanionSupportsFound: number;
      editorialReconstructionSupportsExpected: number;
      editorialReconstructionSupportsFound: number;
      exactRepairSupportsExpected: number;
      exactRepairSupportsFound: number;
      rawContextExpected: number;
      rawContextFound: number;
      stepSpecificContextExpected: number;
      stepSpecificContextFound: number;
      legacyGeneralContextExpected: number;
      legacyGeneralContextFound: number;
    };
    exactMeaningRepairs: {
      expected: number;
      found: number;
      byMode: CountMap;
    };
    frenchContent: FrenchContentCounts;
    violations: {
      total: number;
      byCode: CountMap;
    };
  };
  ok: boolean;
  violations: LexiconV3TbeshSectionAuditViolation[];
}

interface AssertionCounters {
  rawExpected: number;
  rawFound: number;
  stepSpecificExpected: number;
  stepSpecificFound: number;
  legacyGeneralExpected: number;
  legacyGeneralFound: number;
}

interface EvidenceCounters {
  publishableSupportsExpected: number;
  publishableSupportsFound: number;
  rawSupportsExpected: number;
  rawSupportsFound: number;
  stepSpecificSupportsExpected: number;
  stepSpecificSupportsFound: number;
  legacyGeneralSupportsExpected: number;
  legacyGeneralSupportsFound: number;
  exactCompanionSupportsExpected: number;
  exactCompanionSupportsFound: number;
  editorialReconstructionSupportsExpected: number;
  editorialReconstructionSupportsFound: number;
  exactRepairSupportsExpected: number;
  exactRepairSupportsFound: number;
  rawContextExpected: number;
  rawContextFound: number;
  stepSpecificContextExpected: number;
  stepSpecificContextFound: number;
  legacyGeneralContextExpected: number;
  legacyGeneralContextFound: number;
}

/**
 * Build a read-only, reproducible structural audit of sectioned Hebrew TBESH
 * meanings. Detected invariant failures are returned in the report so callers
 * can inspect or persist them before turning the result into a failing gate.
 */
export function buildLexiconV3TbeshSectionAudit(
  options: LexiconV3TbeshSectionAuditOptions
): LexiconV3TbeshSectionAuditReport {
  const sourceDatabase = resolve(options.sourceDatabase);
  const authoringDatabase = resolve(options.authoringDatabase);
  assertFilesExist([sourceDatabase, authoringDatabase]);

  const source = new DatabaseSync(sourceDatabase, { readOnly: true });
  const authoring = new DatabaseSync(authoringDatabase, { readOnly: true });
  try {
    assertRequiredTables(source, "source", ["StepEntries"]);
    assertRequiredTables(authoring, "authoring", [
      "LexiconEntryIds",
      "LexiconSources",
      "LexiconSourceAssertions",
      "LexiconFieldVersions",
      "LexiconFieldEvidence",
      "LexiconIssues",
      "LexiconCarrierTerms"
    ]);

    const sourceEntries = readSourceEntries(source);
    const sectionedEntries = sourceEntries
      .map((entry): SectionedSourceEntry | null => {
        const sections = parseTbeshMeaning(entry.meaning);
        if (!sections.hasSectionSeparator) return null;
        return {
          ...entry,
          entryKey: buildLexiconEntryIdentity({
            language: "hebrew",
            eStrong: entry.eStrong,
            dStrong: entry.dStrong,
            uStrong: entry.uStrong
          }).entryKey,
          sections
        };
      })
      .filter((entry): entry is SectionedSourceEntry => entry !== null)
      .sort(compareSectionedEntries);

    const entryIds = readEntryIds(authoring);
    const assertions = readMeaningAssertions(authoring);
    const fields = readActiveEnglishMeaningFields(authoring);
    const evidence = readMeaningEvidence(authoring);
    const issues = readIssues(authoring);
    const frenchContent = readFrenchContentCounts(authoring);

    const violations: LexiconV3TbeshSectionAuditViolation[] = [];
    const assertionCounts: AssertionCounters = {
      rawExpected: 0,
      rawFound: 0,
      stepSpecificExpected: 0,
      stepSpecificFound: 0,
      legacyGeneralExpected: 0,
      legacyGeneralFound: 0
    };
    const evidenceCounts: EvidenceCounters = {
      publishableSupportsExpected: 0,
      publishableSupportsFound: 0,
      rawSupportsExpected: 0,
      rawSupportsFound: 0,
      stepSpecificSupportsExpected: 0,
      stepSpecificSupportsFound: 0,
      legacyGeneralSupportsExpected: 0,
      legacyGeneralSupportsFound: 0,
      exactCompanionSupportsExpected: 0,
      exactCompanionSupportsFound: 0,
      editorialReconstructionSupportsExpected: 0,
      editorialReconstructionSupportsFound: 0,
      exactRepairSupportsExpected: 0,
      exactRepairSupportsFound: 0,
      rawContextExpected: 0,
      rawContextFound: 0,
      stepSpecificContextExpected: 0,
      stepSpecificContextFound: 0,
      legacyGeneralContextExpected: 0,
      legacyGeneralContextFound: 0
    };
    const publicationActions: Record<TbeshPublicationAction, number> = {
      raw_combined: 0,
      step_specific_only: 0,
      legacy_general_only: 0,
      exact_companion: 0,
      editorial_reconstruction: 0,
      blocked: 0
    };
    let exactMeaningRepairsExpected = 0;
    let exactMeaningRepairsFound = 0;
    const exactMeaningRepairModes: CountMap = {};

    auditSourceSections(sectionedEntries, violations);

    const exactEntryIds = groupBy(
      entryIds,
      (row) => `${row.entryKey}\u0000${row.stepEntryId}`
    );
    const entryIdsByKey = groupBy(entryIds, (row) => row.entryKey);
    const entryIdsByStepId = groupBy(entryIds, (row) =>
      String(row.stepEntryId)
    );
    let entryMappingsFound = 0;
    for (const entry of sectionedEntries) {
      const matches =
        exactEntryIds.get(`${entry.entryKey}\u0000${entry.stepEntryId}`) ?? [];
      entryMappingsFound += matches.length;
      if (matches.length !== 1) {
        addViolation(violations, {
          code:
            matches.length === 0
              ? "tbesh-entry-mapping-missing"
              : "tbesh-entry-mapping-ambiguous",
          entryKey: entry.entryKey,
          locator: `StepEntries:${entry.stepEntryId}`,
          details: {
            expectedStepEntryId: entry.stepEntryId,
            exactMatchCount: matches.length,
            mappedStepEntryIds: stableJson(
              (entryIdsByKey.get(entry.entryKey) ?? []).map(
                (row) => row.stepEntryId
              )
            ),
            mappedEntryKeys: stableJson(
              (entryIdsByStepId.get(String(entry.stepEntryId)) ?? []).map(
                (row) => row.entryKey
              )
            )
          }
        });
      }
    }

    const assertionsBySlot = groupBy(
      assertions,
      (row) => `${row.entryKey}\u0000${row.locator}`
    );
    const fieldsByEntry = groupBy(fields, (row) => row.entryKey);
    const evidenceByLink = groupBy(
      evidence,
      (row) => `${row.fieldVersionId}\u0000${row.sourceAssertionId}`
    );
    const evidenceByField = groupBy(evidence, (row) =>
      String(row.fieldVersionId)
    );
    const issuesByEntry = groupBy(issues, (row) => row.entryKey);

    for (const entry of sectionedEntries) {
      const rawLocator = `StepEntries:${entry.stepEntryId}:meaning`;
      const stepLocator = `${rawLocator}:step-specific`;
      const legacyLocator = `${rawLocator}:legacy-general`;
      const rawAssertions = auditAssertionSlot({
        entry,
        kind: "raw",
        locator: rawLocator,
        expected: true,
        expectedScope: "entry",
        expectedHtml: entry.meaning,
        rows:
          assertionsBySlot.get(`${entry.entryKey}\u0000${rawLocator}`) ?? [],
        counts: assertionCounts,
        violations
      });
      const expectsStep = hasMeaningfulTbeshHtml(
        entry.sections.stepSpecificHtml
      );
      const stepAssertions = auditAssertionSlot({
        entry,
        kind: "step-specific",
        locator: stepLocator,
        expected: expectsStep,
        expectedScope: "entry",
        expectedHtml: entry.sections.stepSpecificHtml,
        rows:
          assertionsBySlot.get(`${entry.entryKey}\u0000${stepLocator}`) ?? [],
        counts: assertionCounts,
        violations
      });
      const expectsLegacy = hasMeaningfulTbeshHtml(
        entry.sections.legacyGeneralHtml
      );
      const legacyAssertions = auditAssertionSlot({
        entry,
        kind: "legacy-general",
        locator: legacyLocator,
        expected: expectsLegacy,
        expectedScope: "base_strong",
        expectedHtml: entry.sections.legacyGeneralHtml,
        rows:
          assertionsBySlot.get(`${entry.entryKey}\u0000${legacyLocator}`) ?? [],
        counts: assertionCounts,
        violations
      });

      const activeFields = fieldsByEntry.get(entry.entryKey) ?? [];
      if (activeFields.length !== 1) {
        addViolation(violations, {
          code:
            activeFields.length === 0
              ? "tbesh-active-meaning-missing"
              : "tbesh-active-meaning-ambiguous",
          entryKey: entry.entryKey,
          locator: rawLocator,
          details: { activeMeaningCount: activeFields.length }
        });
        continue;
      }

      const field = activeFields[0]!;
      const expectedExactRepair = expectedSectionedExactMeaningRepair(entry);
      const exactRepairMarkersPresent =
        field.generator === EXACT_REPAIR_GENERATOR ||
        (issuesByEntry.get(entry.entryKey) ?? []).some(
          (issue) => issue.code === EXACT_REPAIR_ISSUE
        ) ||
        (evidenceByField.get(String(field.id)) ?? []).some(
          (row) => row.witnessFamily === "lexicon-v3-audit-field-repair"
        );
      if (expectedExactRepair || exactRepairMarkersPresent) {
        if (expectedExactRepair) exactMeaningRepairsExpected += 1;
        const exactRepair = auditExactMeaningRepairPublication({
          entry,
          expectedRepair: expectedExactRepair,
          field,
          rawAssertion: rawAssertions.length === 1 ? rawAssertions[0]! : null,
          stepAssertion:
            stepAssertions.length === 1 ? stepAssertions[0]! : null,
          legacyAssertion:
            legacyAssertions.length === 1 ? legacyAssertions[0]! : null,
          assertions,
          evidence: evidenceByField.get(String(field.id)) ?? [],
          issues: issuesByEntry.get(entry.entryKey) ?? [],
          counts: evidenceCounts,
          violations
        });
        if (exactRepair) {
          exactMeaningRepairsFound += 1;
          exactMeaningRepairModes[exactRepair.mode] =
            (exactMeaningRepairModes[exactRepair.mode] ?? 0) + 1;
        }
        auditSectionContextEvidence({
          entry,
          action: null,
          stepAssertion:
            stepAssertions.length === 1 ? stepAssertions[0]! : null,
          legacyAssertion:
            legacyAssertions.length === 1 ? legacyAssertions[0]! : null,
          field,
          rows: evidenceByLink,
          counts: evidenceCounts,
          violations
        });
        continue;
      }
      const publication = auditPublicationSelection({
        entry,
        field,
        rawLocator,
        rawAssertion: rawAssertions.length === 1 ? rawAssertions[0]! : null,
        stepAssertion: stepAssertions.length === 1 ? stepAssertions[0]! : null,
        legacyAssertion:
          legacyAssertions.length === 1 ? legacyAssertions[0]! : null,
        assertions,
        evidence: evidenceByField.get(String(field.id)) ?? [],
        issues: issuesByEntry.get(entry.entryKey) ?? [],
        counts: evidenceCounts,
        violations
      });
      if (publication) publicationActions[publication.decision.action] += 1;

      auditSectionContextEvidence({
        entry,
        action: publication?.decision.action ?? null,
        stepAssertion: stepAssertions.length === 1 ? stepAssertions[0]! : null,
        legacyAssertion:
          legacyAssertions.length === 1 ? legacyAssertions[0]! : null,
        field,
        rows: evidenceByLink,
        counts: evidenceCounts,
        violations
      });
    }

    if (frenchContent.total > 0) {
      addViolation(violations, {
        code: "tbesh-french-content-present",
        entryKey: null,
        locator: null,
        details: {
          fieldVersions: frenchContent.fieldVersions,
          activeFieldVersions: frenchContent.activeFieldVersions,
          sourceAssertions: frenchContent.sourceAssertions,
          carrierTerms: frenchContent.carrierTerms,
          total: frenchContent.total
        }
      });
    }

    violations.sort(compareViolations);
    const sectionedKeys = new Set(
      sectionedEntries.map((entry) => entry.entryKey)
    );
    const relevantFields = fields.filter((field) =>
      sectionedKeys.has(field.entryKey)
    );
    const relevantIssues = issues.filter((issue) =>
      sectionedKeys.has(issue.entryKey)
    );
    const relevantAssertions = assertions.filter((assertion) =>
      sectionedKeys.has(assertion.entryKey)
    );
    const relevantEvidence = evidence.filter(
      (item) =>
        sectionedKeys.has(item.fieldEntryKey) ||
        sectionedKeys.has(item.assertionEntryKey)
    );
    const classifications = countClassifications(sectionedEntries);
    const separatorCounts = countBy(sectionedEntries, (entry) =>
      String(entry.sections.sectionSeparatorCount)
    );
    const activeEnglishMeaningStates = countBy(
      relevantFields,
      (field) => field.state
    );
    const violationCounts = countBy(violations, (violation) => violation.code);

    return {
      schemaVersion: AUDIT_SCHEMA,
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      inputs: { sourceDatabase, authoringDatabase },
      logicalDigests: {
        sourceSections: digestSourceSections(sectionedEntries),
        authoringSections: digestAuthoringSections({
          entryIds,
          assertions: relevantAssertions,
          fields: relevantFields,
          evidence: relevantEvidence,
          issues: relevantIssues,
          frenchContent
        })
      },
      counts: {
        sourceHebrewEntries: sourceEntries.length,
        sectionedEntries: sectionedEntries.length,
        entryMappings: {
          expected: sectionedEntries.length,
          found: entryMappingsFound
        },
        classifications,
        publicationActions,
        separatorCounts,
        activeEnglishMeaningStates,
        issues: {
          total: relevantIssues.length,
          byStatus: countBy(relevantIssues, (issue) => issue.status),
          bySeverity: countBy(relevantIssues, (issue) => issue.severity),
          byCode: countBy(relevantIssues, (issue) => issue.code)
        },
        assertions: assertionCounts,
        evidence: evidenceCounts,
        exactMeaningRepairs: {
          expected: exactMeaningRepairsExpected,
          found: exactMeaningRepairsFound,
          byMode: Object.fromEntries(
            Object.entries(exactMeaningRepairModes).sort(([left], [right]) =>
              left.localeCompare(right, "en")
            )
          )
        },
        frenchContent,
        violations: {
          total: violations.length,
          byCode: violationCounts
        }
      },
      ok: violations.length === 0,
      violations
    };
  } finally {
    authoring.close();
    source.close();
  }
}

/** Turn a built report into a release-gate failure. */
export function assertLexiconV3TbeshSectionAudit(
  report: LexiconV3TbeshSectionAuditReport
): void {
  if (report.ok) return;
  const summary = Object.entries(report.counts.violations.byCode)
    .map(([code, count]) => `${code}=${count}`)
    .join(",");
  throw new Error(
    `tbesh-section-audit-failed:${report.counts.violations.total}:${summary}`
  );
}

/** Render a stable JSON representation (apart from the report generatedAt). */
export function renderLexiconV3TbeshSectionAuditJson(
  report: LexiconV3TbeshSectionAuditReport
): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

/** Render the same audit as a deterministic, reviewable Markdown report. */
export function renderLexiconV3TbeshSectionAuditMarkdown(
  report: LexiconV3TbeshSectionAuditReport
): string {
  const lines = [
    "# Lexicon v3 TBESH section audit",
    "",
    `Status: **${report.ok ? "PASS" : "FAIL"}**`,
    "",
    `- Generated at: \`${escapeInline(report.generatedAt)}\``,
    `- Source database: \`${escapeInline(report.inputs.sourceDatabase)}\``,
    `- Authoring database: \`${escapeInline(report.inputs.authoringDatabase)}\``,
    `- Source logical digest: \`${report.logicalDigests.sourceSections}\``,
    `- Authoring logical digest: \`${report.logicalDigests.authoringSections}\``,
    "",
    "## Summary",
    "",
    "| Measure | Count |",
    "| --- | ---: |",
    `| Source Hebrew entries | ${report.counts.sourceHebrewEntries} |`,
    `| Sectioned TBESH entries | ${report.counts.sectionedEntries} |`,
    `| Exact entry mappings | ${report.counts.entryMappings.found} / ${report.counts.entryMappings.expected} |`,
    `| Active English meaning fields | ${sumCounts(report.counts.activeEnglishMeaningStates)} |`,
    `| Exact meaning repairs | ${report.counts.exactMeaningRepairs.found} / ${report.counts.exactMeaningRepairs.expected} |`,
    `| Issues attached to sectioned entries | ${report.counts.issues.total} |`,
    `| French content records | ${report.counts.frenchContent.total} |`,
    `| Invariant violations | ${report.counts.violations.total} |`,
    "",
    "## Publication actions",
    "",
    "| Action | Count |",
    "| --- | ---: |",
    `| raw_combined | ${report.counts.publicationActions.raw_combined} |`,
    `| step_specific_only | ${report.counts.publicationActions.step_specific_only} |`,
    `| legacy_general_only | ${report.counts.publicationActions.legacy_general_only} |`,
    `| exact_companion | ${report.counts.publicationActions.exact_companion} |`,
    `| editorial_reconstruction | ${report.counts.publicationActions.editorial_reconstruction} |`,
    `| blocked | ${report.counts.publicationActions.blocked} |`,
    "",
    "## Section classifications",
    "",
    "| Classification | Count |",
    "| --- | ---: |",
    `| both | ${report.counts.classifications.both} |`,
    `| specific_only | ${report.counts.classifications.specific_only} |`,
    `| legacy_only | ${report.counts.classifications.legacy_only} |`,
    `| empty | ${report.counts.classifications.empty} |`,
    "",
    ...renderCountMap("Separator counts", report.counts.separatorCounts),
    ...renderCountMap(
      "Active English meaning states",
      report.counts.activeEnglishMeaningStates
    ),
    "## Assertions and evidence",
    "",
    "| Record | Found | Expected |",
    "| --- | ---: | ---: |",
    `| Raw assertions | ${report.counts.assertions.rawFound} | ${report.counts.assertions.rawExpected} |`,
    `| STEP-specific assertions | ${report.counts.assertions.stepSpecificFound} | ${report.counts.assertions.stepSpecificExpected} |`,
    `| Legacy-general assertions | ${report.counts.assertions.legacyGeneralFound} | ${report.counts.assertions.legacyGeneralExpected} |`,
    `| Publishable supporting links | ${report.counts.evidence.publishableSupportsFound} | ${report.counts.evidence.publishableSupportsExpected} |`,
    `| Raw supporting links | ${report.counts.evidence.rawSupportsFound} | ${report.counts.evidence.rawSupportsExpected} |`,
    `| STEP-specific supporting links | ${report.counts.evidence.stepSpecificSupportsFound} | ${report.counts.evidence.stepSpecificSupportsExpected} |`,
    `| Legacy-general supporting links | ${report.counts.evidence.legacyGeneralSupportsFound} | ${report.counts.evidence.legacyGeneralSupportsExpected} |`,
    `| Exact-companion supporting links | ${report.counts.evidence.exactCompanionSupportsFound} | ${report.counts.evidence.exactCompanionSupportsExpected} |`,
    `| Editorial-reconstruction supporting links | ${report.counts.evidence.editorialReconstructionSupportsFound} | ${report.counts.evidence.editorialReconstructionSupportsExpected} |`,
    `| Exact-repair supporting links | ${report.counts.evidence.exactRepairSupportsFound} | ${report.counts.evidence.exactRepairSupportsExpected} |`,
    `| Raw quarantine/context links | ${report.counts.evidence.rawContextFound} | ${report.counts.evidence.rawContextExpected} |`,
    `| STEP-specific context links | ${report.counts.evidence.stepSpecificContextFound} | ${report.counts.evidence.stepSpecificContextExpected} |`,
    `| Legacy-general context links | ${report.counts.evidence.legacyGeneralContextFound} | ${report.counts.evidence.legacyGeneralContextExpected} |`,
    "",
    "## French-content gate",
    "",
    "| Record | Count |",
    "| --- | ---: |",
    `| Field versions | ${report.counts.frenchContent.fieldVersions} |`,
    `| Active field versions | ${report.counts.frenchContent.activeFieldVersions} |`,
    `| Source assertions | ${report.counts.frenchContent.sourceAssertions} |`,
    `| Carrier terms | ${report.counts.frenchContent.carrierTerms} |`,
    "",
    ...renderCountMap("Issue statuses", report.counts.issues.byStatus),
    ...renderCountMap("Issue severities", report.counts.issues.bySeverity),
    ...renderCountMap("Issue codes", report.counts.issues.byCode),
    ...renderCountMap(
      "Exact meaning repair modes",
      report.counts.exactMeaningRepairs.byMode
    ),
    ...renderCountMap("Violation codes", report.counts.violations.byCode),
    "## Violations",
    "",
    "| Code | Entry | Locator | Details |",
    "| --- | --- | --- | --- |"
  ];

  if (report.violations.length === 0) {
    lines.push("| — | — | — | No invariant violation. |");
  } else {
    for (const violation of report.violations) {
      lines.push(
        `| ${escapeTable(violation.code)} | ${escapeTable(violation.entryKey ?? "—")} | ${escapeTable(violation.locator ?? "—")} | ${escapeTable(stableJson(violation.details))} |`
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}

/** Persist both reports before asserting, so failed CI gates retain diagnostics. */
export function runLexiconV3TbeshSectionAudit(
  options: RunLexiconV3TbeshSectionAuditOptions
): LexiconV3TbeshSectionAuditReport {
  const report = buildLexiconV3TbeshSectionAudit(options);
  writeText(options.outputJson, renderLexiconV3TbeshSectionAuditJson(report));
  writeText(
    options.outputMarkdown,
    renderLexiconV3TbeshSectionAuditMarkdown(report)
  );
  assertLexiconV3TbeshSectionAudit(report);
  return report;
}

function auditSourceSections(
  entries: SectionedSourceEntry[],
  violations: LexiconV3TbeshSectionAuditViolation[]
): void {
  const byEntryKey = groupBy(entries, (entry) => entry.entryKey);
  for (const entry of entries) {
    const locator = `StepEntries:${entry.stepEntryId}:meaning`;
    if (entry.sections.sectionSeparatorCount > 1) {
      addViolation(violations, {
        code: "tbesh-multiple-section-separators",
        entryKey: entry.entryKey,
        locator,
        details: {
          sectionSeparatorCount: entry.sections.sectionSeparatorCount,
          rawSha256: sha256(entry.meaning)
        }
      });
    }
    if (entry.sections.classification === "empty") {
      addViolation(violations, {
        code: "tbesh-empty-sectioned-meaning",
        entryKey: entry.entryKey,
        locator,
        details: { rawSha256: sha256(entry.meaning) }
      });
    }
  }
  for (const [entryKey, duplicates] of byEntryKey) {
    if (duplicates.length < 2) continue;
    addViolation(violations, {
      code: "tbesh-source-entry-key-duplicate",
      entryKey,
      locator: null,
      details: {
        count: duplicates.length,
        stepEntryIds: stableJson(
          duplicates.map((entry) => entry.stepEntryId).sort((a, b) => a - b)
        )
      }
    });
  }
}

function auditAssertionSlot(input: {
  entry: SectionedSourceEntry;
  kind: "raw" | "step-specific" | "legacy-general";
  locator: string;
  expected: boolean;
  expectedScope: "entry" | "base_strong";
  expectedHtml: string;
  rows: AssertionRow[];
  counts: AssertionCounters;
  violations: LexiconV3TbeshSectionAuditViolation[];
}): AssertionRow[] {
  const prefix = assertionCounterPrefix(input.kind);
  input.counts[`${prefix}Found`] += input.rows.length;
  if (input.expected) input.counts[`${prefix}Expected`] += 1;

  if (!input.expected) {
    if (input.rows.length > 0) {
      addViolation(input.violations, {
        code: `tbesh-${input.kind}-assertion-unexpected`,
        entryKey: input.entry.entryKey,
        locator: input.locator,
        details: { assertionCount: input.rows.length }
      });
    }
    return input.rows;
  }
  if (input.rows.length === 0) {
    addViolation(input.violations, {
      code: `tbesh-${input.kind}-assertion-missing`,
      entryKey: input.entry.entryKey,
      locator: input.locator,
      details: {}
    });
    return input.rows;
  }
  if (input.rows.length > 1) {
    addViolation(input.violations, {
      code: `tbesh-${input.kind}-assertion-ambiguous`,
      entryKey: input.entry.entryKey,
      locator: input.locator,
      details: { assertionCount: input.rows.length }
    });
    return input.rows;
  }

  const row = input.rows[0]!;
  if (row.scope !== input.expectedScope) {
    addViolation(input.violations, {
      code: `tbesh-${input.kind}-assertion-scope-drift`,
      entryKey: input.entry.entryKey,
      locator: input.locator,
      details: { expected: input.expectedScope, actual: row.scope }
    });
  }
  if (row.valueHtml !== input.expectedHtml) {
    addHtmlDriftViolation(
      input.violations,
      input.kind === "raw"
        ? "tbesh-raw-html-lost"
        : `tbesh-${input.kind}-html-drift`,
      input.entry.entryKey,
      input.locator,
      input.expectedHtml,
      row.valueHtml
    );
  }
  const expectedAssertionDigest = sha256(
    `${row.valueText ?? ""}\u0000${row.valueHtml ?? ""}`
  );
  if (row.sha256 !== expectedAssertionDigest) {
    addViolation(input.violations, {
      code: `tbesh-${input.kind}-assertion-digest-invalid`,
      entryKey: input.entry.entryKey,
      locator: input.locator,
      details: {
        expected: expectedAssertionDigest,
        actual: row.sha256
      }
    });
  }
  return input.rows;
}

function expectedSectionedExactMeaningRepair(
  entry: SectionedSourceEntry
): boolean {
  const rule = ENGLISH_EXACT_REPAIR_RULES.get(entry.entryKey);
  return Boolean(
    rule?.sourceFamily === "TBESH" &&
    rule.changes.some(
      (change) =>
        change.field === "meaning" &&
        parseTbeshMeaning(change.sourceValue).hasSectionSeparator
    )
  );
}

function auditExactMeaningRepairPublication(input: {
  entry: SectionedSourceEntry;
  expectedRepair: boolean;
  field: FieldRow;
  rawAssertion: AssertionRow | null;
  stepAssertion: AssertionRow | null;
  legacyAssertion: AssertionRow | null;
  assertions: AssertionRow[];
  evidence: EvidenceRow[];
  issues: IssueRow[];
  counts: EvidenceCounters;
  violations: LexiconV3TbeshSectionAuditViolation[];
}): HebrewExactMeaningRepairProjection | null {
  const initialViolationCount = input.violations.length;
  const locator = `StepEntries:${input.entry.stepEntryId}:meaning`;
  if (!input.expectedRepair) {
    addViolation(input.violations, {
      code: "tbesh-exact-repair-unexpected",
      entryKey: input.entry.entryKey,
      locator,
      details: { generator: input.field.generator }
    });
    return null;
  }

  let replay: ReturnType<typeof applyEnglishExactRepairs> = null;
  try {
    replay = applyEnglishExactRepairs(input.entry, {
      databaseDigest: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.database,
      sourceDigests: {
        TBESH: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESH,
        TIPNR: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TIPNR
      }
    });
  } catch (error) {
    addViolation(input.violations, {
      code: "tbesh-exact-repair-registry-replay-failed",
      entryKey: input.entry.entryKey,
      locator,
      details: {
        reason: error instanceof Error ? error.message : String(error)
      }
    });
  }
  const expectedRepair = replay?.repairs.find(
    (repair) => repair.field === "meaning"
  );
  if (!replay || !expectedRepair) {
    if (replay) {
      addViolation(input.violations, {
        code: "tbesh-exact-repair-proof-missing",
        entryKey: input.entry.entryKey,
        locator,
        details: {}
      });
    }
    return null;
  }

  let expectedProjection: HebrewExactMeaningRepairProjection | null = null;
  try {
    expectedProjection =
      buildHebrewExactMeaningRepairProjection(expectedRepair);
  } catch (error) {
    addViolation(input.violations, {
      code: "tbesh-exact-repair-projection-replay-failed",
      entryKey: input.entry.entryKey,
      locator,
      details: {
        reason: error instanceof Error ? error.message : String(error)
      }
    });
  }
  if (!expectedProjection) return null;

  if (
    input.field.generator !== EXACT_REPAIR_GENERATOR ||
    input.field.method !== "rule" ||
    input.field.state !== "auto_validated"
  ) {
    addViolation(input.violations, {
      code: "tbesh-exact-repair-field-contract-invalid",
      entryKey: input.entry.entryKey,
      locator,
      details: {
        expectedGenerator: EXACT_REPAIR_GENERATOR,
        actualGenerator: input.field.generator,
        expectedMethod: "rule",
        actualMethod: input.field.method,
        expectedState: "auto_validated",
        actualState: input.field.state
      }
    });
  }
  const expectedPublishedHtml = normalizeCanonicalTbeshHtml(
    expectedProjection.publishedHtml
  );
  if (input.field.valueHtml !== expectedPublishedHtml) {
    addHtmlDriftViolation(
      input.violations,
      "tbesh-exact-repair-publication-html-drift",
      input.entry.entryKey,
      locator,
      expectedPublishedHtml,
      input.field.valueHtml
    );
  }

  const exactIssues = input.issues.filter(
    (issue) => issue.code === EXACT_REPAIR_ISSUE
  );
  if (exactIssues.length !== 1) {
    addViolation(input.violations, {
      code:
        exactIssues.length === 0
          ? "tbesh-exact-repair-issue-missing"
          : "tbesh-exact-repair-issue-ambiguous",
      entryKey: input.entry.entryKey,
      locator,
      details: { issueCount: exactIssues.length }
    });
  }

  const supports = input.evidence.filter((row) => row.stance === "supports");
  input.counts.publishableSupportsExpected += 1;
  input.counts.publishableSupportsFound += supports.length;
  input.counts.exactRepairSupportsExpected += 1;
  input.counts.exactRepairSupportsFound += supports.length;
  const support = supports.length === 1 ? supports[0]! : null;
  if (
    !support ||
    support.evidenceKind !== "validator" ||
    support.witnessFamily !== "lexicon-v3-audit-field-repair" ||
    support.sourceKey !== "artifact-english-audit"
  ) {
    addViolation(input.violations, {
      code: "tbesh-exact-repair-support-invalid",
      entryKey: input.entry.entryKey,
      locator,
      details: {
        supportCount: supports.length,
        evidenceKind: support?.evidenceKind ?? null,
        witnessFamily: support?.witnessFamily ?? null,
        sourceKey: support?.sourceKey ?? null
      }
    });
  }
  const repairAssertion = support
    ? (input.assertions.find(
        (assertion) => assertion.id === support.sourceAssertionId
      ) ?? null)
    : null;
  const expectedRepairLocator = `english-audit-field-repair:${input.entry.entryKey}:meaning:${expectedRepair.ruleId}`;
  if (
    !repairAssertion ||
    repairAssertion.entryKey !== input.entry.entryKey ||
    repairAssertion.sourceKey !== "artifact-english-audit" ||
    repairAssertion.scope !== "entry" ||
    repairAssertion.locator !== expectedRepairLocator ||
    repairAssertion.valueHtml !== expectedRepair.repairedValue ||
    repairAssertion.sha256 !== expectedRepair.repairDigest
  ) {
    addViolation(input.violations, {
      code: "tbesh-exact-repair-assertion-invalid",
      entryKey: input.entry.entryKey,
      locator: repairAssertion?.locator ?? expectedRepairLocator,
      details: {
        assertionPresent: repairAssertion !== null,
        sourceKey: repairAssertion?.sourceKey ?? null,
        scope: repairAssertion?.scope ?? null,
        locatorValid: repairAssertion?.locator === expectedRepairLocator,
        repairedBytesValid:
          repairAssertion?.valueHtml === expectedRepair.repairedValue,
        repairDigestValid:
          repairAssertion?.sha256 === expectedRepair.repairDigest
      }
    });
  }

  const supportDetails = support ? tryParseObject(support.detailsJson) : null;
  const recordedRepair = supportDetails?.repair;
  const recordedProjection = supportDetails?.exactMeaningRepairProjection;
  const evidenceIssues = validateEnglishExactFieldRepairEvidence({
    sourceEntry: input.entry,
    repairedEntry: replay.entry,
    repair: expectedRepair,
    context: {
      databaseDigest: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.database,
      sourceDigests: {
        TBESH: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESH,
        TIPNR: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TIPNR
      }
    }
  });
  if (
    stableJson(recordedRepair) !== stableJson(expectedRepair) ||
    evidenceIssues.length > 0
  ) {
    addViolation(input.violations, {
      code: "tbesh-exact-repair-proof-invalid",
      entryKey: input.entry.entryKey,
      locator: support?.assertionLocator ?? locator,
      details: {
        repairMatchesRegistry:
          stableJson(recordedRepair) === stableJson(expectedRepair),
        replayIssues: stableJson(evidenceIssues)
      }
    });
  }
  const projectionIssues = validateHebrewExactMeaningRepairProjection(
    expectedRepair,
    recordedProjection
  );
  if (projectionIssues.length > 0) {
    addViolation(input.violations, {
      code: "tbesh-exact-repair-projection-invalid",
      entryKey: input.entry.entryKey,
      locator: support?.assertionLocator ?? locator,
      details: { issues: stableJson(projectionIssues) }
    });
  }

  const exactIssue = exactIssues.length === 1 ? exactIssues[0]! : null;
  const issueDetails = exactIssue
    ? tryParseObject(exactIssue.detailsJson)
    : null;
  const rawSource = asRecord(issueDetails?.rawSource);
  if (
    !exactIssue ||
    exactIssue.severity !== "info" ||
    exactIssue.fieldVersionId !== input.field.id ||
    exactIssue.sourceAssertionId !== repairAssertion?.id ||
    stableJson(issueDetails?.repair) !== stableJson(expectedRepair) ||
    stableJson(issueDetails?.projection) !== stableJson(expectedProjection) ||
    issueDetails?.publicationSource !== "artifact-english-audit" ||
    rawSource?.assertionId !== input.rawAssertion?.id ||
    rawSource?.rawHtmlDigest !== sha256(input.entry.meaning) ||
    rawSource?.sectionSeparatorCount !==
      input.entry.sections.sectionSeparatorCount ||
    rawSource?.stepSpecificAssertionId !== input.stepAssertion?.id ||
    rawSource?.stepSpecificDigest !==
      sha256(input.entry.sections.stepSpecificHtml) ||
    rawSource?.legacyGeneralAssertionId !== input.legacyAssertion?.id ||
    rawSource?.legacyGeneralDigest !==
      sha256(input.entry.sections.legacyGeneralHtml)
  ) {
    addViolation(input.violations, {
      code: "tbesh-exact-repair-issue-contract-invalid",
      entryKey: input.entry.entryKey,
      locator,
      details: {
        issuePresent: exactIssue !== null,
        fieldLinkValid: exactIssue?.fieldVersionId === input.field.id,
        assertionLinkValid:
          exactIssue?.sourceAssertionId === repairAssertion?.id,
        repairValid:
          stableJson(issueDetails?.repair) === stableJson(expectedRepair),
        projectionValid:
          stableJson(issueDetails?.projection) ===
          stableJson(expectedProjection),
        rawSourceValid: rawSource?.rawHtmlDigest === sha256(input.entry.meaning)
      }
    });
  }

  input.counts.rawContextExpected += 1;
  const rawContext = input.rawAssertion
    ? input.evidence.filter((row) => {
        if (
          row.sourceAssertionId !== input.rawAssertion!.id ||
          row.evidenceKind !== "direct_source" ||
          row.stance === "supports" ||
          row.witnessFamily !== "STEP-TBES"
        ) {
          return false;
        }
        const details = tryParseObject(row.detailsJson);
        return (
          details?.role === "quarantined-raw-source" &&
          stableJson(details.exactMeaningRepairProjection) ===
            stableJson(expectedProjection)
        );
      })
    : [];
  input.counts.rawContextFound += rawContext.length;
  if (rawContext.length !== 1) {
    addViolation(input.violations, {
      code: "tbesh-exact-repair-raw-context-invalid",
      entryKey: input.entry.entryKey,
      locator,
      details: { matchingEvidenceCount: rawContext.length }
    });
  }

  return input.violations.length === initialViolationCount
    ? expectedProjection
    : null;
}

function auditPublicationSelection(input: {
  entry: SectionedSourceEntry;
  field: FieldRow;
  rawLocator: string;
  rawAssertion: AssertionRow | null;
  stepAssertion: AssertionRow | null;
  legacyAssertion: AssertionRow | null;
  assertions: AssertionRow[];
  evidence: EvidenceRow[];
  issues: IssueRow[];
  counts: EvidenceCounters;
  violations: LexiconV3TbeshSectionAuditViolation[];
}): PublicationIssueRecord | null {
  const publicationIssues = input.issues.filter(
    (issue) => issue.code === "hebrew-tbesh-meaning-sectioned"
  );
  if (publicationIssues.length !== 1) {
    addViolation(input.violations, {
      code:
        publicationIssues.length === 0
          ? "tbesh-publication-issue-missing"
          : "tbesh-publication-issue-ambiguous",
      entryKey: input.entry.entryKey,
      locator: input.rawLocator,
      details: { issueCount: publicationIssues.length }
    });
    return null;
  }
  const publicationIssue = publicationIssues[0]!;
  if (
    publicationIssue.severity !== "info" ||
    publicationIssue.fieldVersionId !== input.field.id ||
    (input.rawAssertion !== null &&
      publicationIssue.sourceAssertionId !== input.rawAssertion.id)
  ) {
    addViolation(input.violations, {
      code: "tbesh-publication-issue-link-invalid",
      entryKey: input.entry.entryKey,
      locator: input.rawLocator,
      details: {
        severity: publicationIssue.severity,
        expectedFieldVersionId: input.field.id,
        actualFieldVersionId: publicationIssue.fieldVersionId,
        expectedSourceAssertionId: input.rawAssertion?.id ?? null,
        actualSourceAssertionId: publicationIssue.sourceAssertionId
      }
    });
  }

  const issueRecord = parsePublicationIssue(
    publicationIssue,
    input.entry,
    input.rawLocator,
    input.violations
  );
  if (!issueRecord) return null;

  const evidenceSelections: PublicationSelectionRecord[] = [];
  for (const evidence of input.evidence) {
    const details = parseDetailsObject(
      evidence.detailsJson,
      "tbesh-publication-evidence-details-invalid",
      input.entry.entryKey,
      evidence.assertionLocator,
      input.violations
    );
    if (!details || details.publicationSelection === undefined) continue;
    const selection = parsePublicationSelection(details.publicationSelection);
    if (!selection) {
      addViolation(input.violations, {
        code: "tbesh-publication-selection-invalid",
        entryKey: input.entry.entryKey,
        locator: evidence.assertionLocator,
        details: { detailsSha256: sha256(evidence.detailsJson) }
      });
      continue;
    }
    evidenceSelections.push(selection);
  }
  const distinctSelections = new Map(
    evidenceSelections.map((selection) => [stableJson(selection), selection])
  );
  if (distinctSelections.size !== 1) {
    addViolation(input.violations, {
      code:
        distinctSelections.size === 0
          ? "tbesh-publication-selection-missing"
          : "tbesh-publication-selection-ambiguous",
      entryKey: input.entry.entryKey,
      locator: input.rawLocator,
      details: {
        selectionCount: evidenceSelections.length,
        distinctSelectionCount: distinctSelections.size
      }
    });
    return issueRecord;
  }
  const selection = [...distinctSelections.values()][0]!;
  auditPublicationRecordAgreement({
    entry: input.entry,
    locator: input.rawLocator,
    issueRecord,
    selection,
    violations: input.violations
  });
  auditCanonicalPolicySelection({
    entry: input.entry,
    field: input.field,
    issueRecord,
    selection,
    locator: input.rawLocator,
    violations: input.violations
  });

  const action = issueRecord.decision.action;
  const supports = input.evidence.filter((row) => row.stance === "supports");
  if (action !== "blocked") {
    input.counts.publishableSupportsExpected += 1;
    input.counts.publishableSupportsFound += supports.length;
    if (supports.length !== 1) {
      addViolation(input.violations, {
        code:
          supports.length === 0
            ? "tbesh-publication-support-missing"
            : "tbesh-publication-support-ambiguous",
        entryKey: input.entry.entryKey,
        locator: input.rawLocator,
        details: { supportCount: supports.length, action }
      });
    }
  }

  const companionAssertions = input.assertions.filter(
    (row) =>
      row.entryKey === input.entry.entryKey &&
      row.sourceKey === "artifact-hebrew-open-english" &&
      row.locator.startsWith("hebrew-open-english:")
  );
  const editorialAssertions = input.assertions.filter(
    (row) =>
      row.entryKey === input.entry.entryKey &&
      row.sourceKey === "artifact-hebrew-meaning-adjudication" &&
      row.locator.startsWith(
        `hebrew-meaning-adjudication:${input.entry.entryKey.slice("hebrew:".length)}:`
      )
  );
  const expected = expectedPublicationContent({
    entry: input.entry,
    action,
    rawAssertion: input.rawAssertion,
    stepAssertion: input.stepAssertion,
    legacyAssertion: input.legacyAssertion,
    companionAssertions,
    editorialAssertions,
    selection,
    violations: input.violations
  });
  if (expected) {
    if (input.field.valueHtml !== expected.normalizedHtml) {
      addHtmlDriftViolation(
        input.violations,
        "tbesh-publication-html-drift",
        input.entry.entryKey,
        expected.locator,
        expected.normalizedHtml,
        input.field.valueHtml
      );
    }
    if (
      issueRecord.decision.content?.html !== expected.sourceHtml ||
      issueRecord.decision.content?.source !== expected.contentSource
    ) {
      addViolation(input.violations, {
        code: "tbesh-publication-decision-content-drift",
        entryKey: input.entry.entryKey,
        locator: expected.locator,
        details: {
          expectedSource: expected.contentSource,
          actualSource: issueRecord.decision.content?.source ?? null,
          expectedHtmlSha256: sha256(expected.sourceHtml),
          actualHtmlSha256: issueRecord.decision.content
            ? sha256(issueRecord.decision.content.html)
            : null
        }
      });
    }
    auditExpectedPublicationSupport({
      entry: input.entry,
      action,
      expectedAssertion: expected.assertion,
      supports,
      field: input.field,
      counts: input.counts,
      violations: input.violations
    });
  } else if (action === "blocked") {
    if (issueRecord.decision.content !== null) {
      addViolation(input.violations, {
        code: "tbesh-blocked-publication-content-present",
        entryKey: input.entry.entryKey,
        locator: input.rawLocator,
        details: {
          contentSha256: sha256(stableJson(issueRecord.decision.content))
        }
      });
    }
    const expectedHtml = normalizeCanonicalTbeshHtml(input.entry.meaning);
    if (input.field.valueHtml !== expectedHtml) {
      addHtmlDriftViolation(
        input.violations,
        "tbesh-blocked-diagnostic-html-drift",
        input.entry.entryKey,
        input.rawLocator,
        expectedHtml,
        input.field.valueHtml
      );
    }
    if (!["candidate", "blocked_source_issue"].includes(input.field.state)) {
      addViolation(input.violations, {
        code: "tbesh-blocked-publication-declared-safe",
        entryKey: input.entry.entryKey,
        locator: input.rawLocator,
        details: { state: input.field.state }
      });
    }
    const nonRawSupports = supports.filter(
      (row) => row.sourceAssertionId !== input.rawAssertion?.id
    );
    if (nonRawSupports.length > 0) {
      addViolation(input.violations, {
        code: "tbesh-blocked-publication-safe-support-present",
        entryKey: input.entry.entryKey,
        locator: input.rawLocator,
        details: { supportCount: nonRawSupports.length }
      });
    }
  }

  auditPublicationFieldMethod({
    entry: input.entry,
    field: input.field,
    action,
    selection,
    locator: input.rawLocator,
    violations: input.violations
  });
  if (issueRecord.decision.rawProvenanceHtml !== input.entry.meaning) {
    addHtmlDriftViolation(
      input.violations,
      "tbesh-publication-raw-provenance-drift",
      input.entry.entryKey,
      input.rawLocator,
      input.entry.meaning,
      issueRecord.decision.rawProvenanceHtml
    );
  }

  if (
    [
      "step_specific_only",
      "legacy_general_only",
      "exact_companion",
      "editorial_reconstruction"
    ].includes(action)
  ) {
    auditQuarantinedSourceNotSupporting({
      entry: input.entry,
      field: input.field,
      action,
      rawAssertion: input.rawAssertion,
      legacyAssertion:
        action === "legacy_general_only" ? null : input.legacyAssertion,
      evidence: input.evidence,
      counts: input.counts,
      violations: input.violations
    });
  }
  return issueRecord;
}

function auditSectionContextEvidence(input: {
  entry: SectionedSourceEntry;
  action: TbeshPublicationAction | null;
  stepAssertion: AssertionRow | null;
  legacyAssertion: AssertionRow | null;
  field: FieldRow;
  rows: Map<string, EvidenceRow[]>;
  counts: EvidenceCounters;
  violations: LexiconV3TbeshSectionAuditViolation[];
}): void {
  if (input.stepAssertion && input.action !== "step_specific_only") {
    input.counts.stepSpecificContextExpected += 1;
    const matching = matchingNonSupportingSectionEvidence(
      input.rows.get(`${input.field.id}\u0000${input.stepAssertion.id}`) ?? [],
      "STEP-TBESH-step-specific",
      "step-specific",
      sha256(input.entry.sections.stepSpecificHtml)
    );
    input.counts.stepSpecificContextFound += matching.length;
    if (matching.length !== 1) {
      addSectionEvidenceCardinalityViolation(
        input,
        "step-specific",
        input.stepAssertion.locator,
        matching.length
      );
    }
  }
  if (input.legacyAssertion && input.action !== "legacy_general_only") {
    input.counts.legacyGeneralContextExpected += 1;
    const matching = matchingNonSupportingSectionEvidence(
      input.rows.get(`${input.field.id}\u0000${input.legacyAssertion.id}`) ??
        [],
      "STEP-TBESH-legacy-general",
      "legacy-general",
      sha256(input.entry.sections.legacyGeneralHtml)
    );
    input.counts.legacyGeneralContextFound += matching.length;
    if (matching.length !== 1) {
      addSectionEvidenceCardinalityViolation(
        input,
        "legacy-general",
        input.legacyAssertion.locator,
        matching.length
      );
    }
  }
}

function matchingNonSupportingSectionEvidence(
  rows: EvidenceRow[],
  witnessFamily: string,
  role: string,
  digest: string
): EvidenceRow[] {
  return rows.filter((row) => {
    if (
      row.evidenceKind !== "direct_source" ||
      row.stance === "supports" ||
      row.witnessFamily !== witnessFamily
    ) {
      return false;
    }
    const details = tryParseObject(row.detailsJson);
    return details?.role === role && details.digest === digest;
  });
}

function addSectionEvidenceCardinalityViolation(
  input: {
    entry: SectionedSourceEntry;
    field: FieldRow;
    rows: Map<string, EvidenceRow[]>;
    violations: LexiconV3TbeshSectionAuditViolation[];
  },
  kind: "step-specific" | "legacy-general",
  locator: string,
  matchingCount: number
): void {
  addViolation(input.violations, {
    code:
      matchingCount === 0
        ? `tbesh-${kind}-context-evidence-missing`
        : `tbesh-${kind}-context-evidence-ambiguous`,
    entryKey: input.entry.entryKey,
    locator,
    details: { matchingEvidenceCount: matchingCount }
  });
}

function auditExpectedPublicationSupport(input: {
  entry: SectionedSourceEntry;
  action: TbeshPublicationAction;
  expectedAssertion: AssertionRow;
  supports: EvidenceRow[];
  field: FieldRow;
  counts: EvidenceCounters;
  violations: LexiconV3TbeshSectionAuditViolation[];
}): void {
  const descriptor =
    input.action === "raw_combined"
      ? {
          evidenceKind: "direct_source",
          witnessFamily: "STEP-TBES",
          counter: "rawSupports" as const
        }
      : input.action === "step_specific_only"
        ? {
            evidenceKind: "direct_source",
            witnessFamily: "STEP-TBESH-step-specific",
            counter: "stepSpecificSupports" as const
          }
        : input.action === "legacy_general_only"
          ? {
              evidenceKind: "direct_source",
              witnessFamily: "STEP-TBESH-legacy-general",
              counter: "legacyGeneralSupports" as const
            }
          : input.action === "editorial_reconstruction"
            ? {
                evidenceKind: "validator",
                witnessFamily: "lexicon-v3-hebrew-adjudication",
                counter: "editorialReconstructionSupports" as const
              }
            : {
                evidenceKind: "cross_source",
                witnessFamily: "OpenScriptures+STEP-TIPNR",
                counter: "exactCompanionSupports" as const
              };
  input.counts[`${descriptor.counter}Expected`] += 1;
  const matching = input.supports.filter(
    (row) =>
      row.sourceAssertionId === input.expectedAssertion.id &&
      row.evidenceKind === descriptor.evidenceKind &&
      row.witnessFamily === descriptor.witnessFamily
  );
  input.counts[`${descriptor.counter}Found`] += matching.length;
  if (matching.length !== 1) {
    addViolation(input.violations, {
      code: "tbesh-publication-support-source-invalid",
      entryKey: input.entry.entryKey,
      locator: input.expectedAssertion.locator,
      details: {
        action: input.action,
        matchingEvidenceCount: matching.length,
        expectedEvidenceKind: descriptor.evidenceKind,
        expectedWitnessFamily: descriptor.witnessFamily
      }
    });
  }
}

function parsePublicationIssue(
  issue: IssueRow,
  entry: SectionedSourceEntry,
  locator: string,
  violations: LexiconV3TbeshSectionAuditViolation[]
): PublicationIssueRecord | null {
  const details = parseDetailsObject(
    issue.detailsJson,
    "tbesh-publication-issue-details-invalid",
    entry.entryKey,
    locator,
    violations
  );
  if (!details) return null;
  const decision = parsePublicationDecision(details.publicationDecision);
  const selectionDigest =
    typeof details.selectionDigest === "string"
      ? details.selectionDigest
      : null;
  if (
    !decision ||
    !selectionDigest ||
    !/^[a-f0-9]{64}$/u.test(selectionDigest)
  ) {
    addViolation(violations, {
      code: "tbesh-publication-issue-contract-invalid",
      entryKey: entry.entryKey,
      locator,
      details: {
        decisionValid: Boolean(decision),
        selectionDigestValid: Boolean(
          selectionDigest && /^[a-f0-9]{64}$/u.test(selectionDigest)
        )
      }
    });
    return null;
  }
  return {
    decision,
    proof: details.publicationProof ?? null,
    selectionDigest
  };
}

function parsePublicationDecision(
  value: unknown
): PublicationDecisionRecord | null {
  const record = asRecord(value);
  if (!record || !isPublicationAction(record.action)) return null;
  const contentRecord =
    record.content === null ? null : asRecord(record.content);
  const content =
    contentRecord &&
    typeof contentRecord.html === "string" &&
    typeof contentRecord.source === "string"
      ? { html: contentRecord.html, source: contentRecord.source }
      : null;
  if (record.content !== null && content === null) return null;
  if (typeof record.rawProvenanceHtml !== "string") return null;
  const quarantinedParts = parseQuarantinedParts(record.quarantinedParts);
  const reasonCodes = stringArray(record.reasonCodes);
  if (!quarantinedParts || !reasonCodes) return null;
  return {
    action: record.action,
    content,
    rawProvenanceHtml: record.rawProvenanceHtml,
    quarantinedParts,
    reasonCodes
  };
}

function parsePublicationSelection(
  value: unknown
): PublicationSelectionRecord | null {
  const record = asRecord(value);
  if (!record || !isPublicationAction(record.action)) return null;
  const canonicalPolicyProof = record.canonicalPolicyProof ?? null;
  const counterfactualAction = record.counterfactualAction ?? null;
  const quarantinedParts = parseSelectionQuarantinedParts(
    record.quarantinedParts
  );
  const reasonCodes = stringArray(record.reasonCodes);
  if (
    !quarantinedParts ||
    !reasonCodes ||
    (canonicalPolicyProof !== null && !asRecord(canonicalPolicyProof)) ||
    (counterfactualAction !== null &&
      !isPublicationAction(counterfactualAction)) ||
    typeof record.selectionDigest !== "string" ||
    !/^[a-f0-9]{64}$/u.test(record.selectionDigest)
  ) {
    return null;
  }
  return {
    action: record.action,
    canonicalPolicyProof,
    counterfactualAction,
    proof: record.proof ?? null,
    quarantinedParts,
    reasonCodes,
    selectionDigest: record.selectionDigest
  };
}

function parseQuarantinedParts(
  value: unknown
): PublicationDecisionRecord["quarantinedParts"] | null {
  if (!Array.isArray(value)) return null;
  const result: PublicationDecisionRecord["quarantinedParts"] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (
      !record ||
      typeof record.part !== "string" ||
      typeof record.html !== "string" ||
      typeof record.reasonCode !== "string"
    ) {
      return null;
    }
    result.push({
      part: record.part,
      html: record.html,
      reasonCode: record.reasonCode
    });
  }
  return result;
}

function parseSelectionQuarantinedParts(
  value: unknown
): PublicationSelectionRecord["quarantinedParts"] | null {
  if (!Array.isArray(value)) return null;
  const result: PublicationSelectionRecord["quarantinedParts"] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (
      !record ||
      typeof record.part !== "string" ||
      typeof record.digest !== "string" ||
      !/^[a-f0-9]{64}$/u.test(record.digest) ||
      typeof record.reasonCode !== "string"
    ) {
      return null;
    }
    result.push({
      digest: record.digest,
      part: record.part,
      reasonCode: record.reasonCode
    });
  }
  return result;
}

function auditPublicationRecordAgreement(input: {
  entry: SectionedSourceEntry;
  locator: string;
  issueRecord: PublicationIssueRecord;
  selection: PublicationSelectionRecord;
  violations: LexiconV3TbeshSectionAuditViolation[];
}): void {
  const expectedQuarantinedParts =
    input.issueRecord.decision.quarantinedParts.map((part) => ({
      digest: sha256(part.html),
      part: part.part,
      reasonCode: part.reasonCode
    }));
  const expectedDigest = publicationSelectionDigest(
    input.entry,
    input.issueRecord,
    input.selection
  );
  if (
    input.selection.action !== input.issueRecord.decision.action ||
    stableJson(input.selection.proof) !== stableJson(input.issueRecord.proof) ||
    stableJson(input.selection.reasonCodes) !==
      stableJson(input.issueRecord.decision.reasonCodes) ||
    stableJson(input.selection.quarantinedParts) !==
      stableJson(expectedQuarantinedParts) ||
    input.selection.selectionDigest !== input.issueRecord.selectionDigest ||
    input.issueRecord.selectionDigest !== expectedDigest
  ) {
    addViolation(input.violations, {
      code: "tbesh-publication-selection-drift",
      entryKey: input.entry.entryKey,
      locator: input.locator,
      details: {
        issueAction: input.issueRecord.decision.action,
        evidenceAction: input.selection.action,
        expectedSelectionDigest: expectedDigest,
        issueSelectionDigest: input.issueRecord.selectionDigest,
        evidenceSelectionDigest: input.selection.selectionDigest
      }
    });
  }
}

function publicationSelectionDigest(
  entry: SectionedSourceEntry,
  record: PublicationIssueRecord,
  selection: PublicationSelectionRecord
): string {
  const proof = asRecord(record.proof);
  const canonicalContract =
    selection.canonicalPolicyProof !== null ||
    selection.counterfactualAction !== null;
  return sha256(
    stableJson({
      action: record.decision.action,
      ...(canonicalContract
        ? { canonicalPolicyProof: selection.canonicalPolicyProof }
        : {}),
      contentHtml: record.decision.content?.html ?? null,
      ...(canonicalContract
        ? { counterfactualAction: selection.counterfactualAction }
        : {}),
      proof: proof
        ? {
            issueCodes: proof.issueCodes,
            method: proof.method,
            normalizedCandidateDStrong: proof.normalizedCandidateDStrong,
            normalizedPrimaryDStrong: proof.normalizedPrimaryDStrong,
            proven: proof.proven,
            ...(canonicalContract ? { facts: proof.facts } : {}),
            references: proof.references
          }
        : null,
      quarantinedParts: record.decision.quarantinedParts,
      rawDigest: sha256(entry.meaning),
      reasonCodes: record.decision.reasonCodes
    })
  );
}

function auditCanonicalPolicySelection(input: {
  entry: SectionedSourceEntry;
  field: FieldRow;
  issueRecord: PublicationIssueRecord;
  selection: PublicationSelectionRecord;
  locator: string;
  violations: LexiconV3TbeshSectionAuditViolation[];
}): void {
  const canonicalRequired =
    input.field.generator === CANONICAL_MEANING_GENERATOR ||
    ["legacy_general_only", "editorial_reconstruction"].includes(
      input.issueRecord.decision.action
    );
  if (!canonicalRequired && input.selection.canonicalPolicyProof === null) {
    return;
  }

  const proof = asRecord(input.selection.canonicalPolicyProof);
  const policy = asRecord(proof?.policy);
  const structure = asRecord(proof?.structure);
  const digests = asRecord(proof?.digests);
  const selected =
    proof?.selection === null ? null : asRecord(proof?.selection);
  const expectedDisposition: Record<TbeshPublicationAction, string> = {
    raw_combined: "publish_raw",
    step_specific_only: "publish_step_specific",
    legacy_general_only: "publish_legacy_general",
    exact_companion: "publish_exact_companion",
    editorial_reconstruction: "publish_editorial_reconstruction",
    blocked: "block_publication"
  };
  const expectedContentSource: Record<
    Exclude<TbeshPublicationAction, "blocked">,
    string
  > = {
    raw_combined: "tbesh_raw",
    step_specific_only: "tbesh_step_specific",
    legacy_general_only: "tbesh_legacy_general",
    exact_companion: "hebrew_english_exact_companion",
    editorial_reconstruction: "lexicon_v3_hebrew_adjudication"
  };
  const action = input.issueRecord.decision.action;
  const decisionContent = input.issueRecord.decision.content;
  const expectedStepDigest = hasMeaningfulTbeshHtml(
    input.entry.sections.stepSpecificHtml
  )
    ? sha256(input.entry.sections.stepSpecificHtml)
    : null;
  const expectedLegacyDigest = hasMeaningfulTbeshHtml(
    input.entry.sections.legacyGeneralHtml
  )
    ? sha256(input.entry.sections.legacyGeneralHtml)
    : null;
  const selectedRecordValid =
    selected === null ||
    (typeof selected.html === "string" &&
      typeof selected.source === "string" &&
      isSha256Digest(selected.recordDigest) &&
      selected.html === decisionContent?.html &&
      selected.source === decisionContent?.source);
  const selectionRequired = [
    "legacy_general_only",
    "editorial_reconstruction"
  ].includes(action);
  const expectedSource =
    action === "blocked" ? null : expectedContentSource[action];
  const policyDigest =
    typeof policy?.digest === "string" ? policy.digest : null;
  const digestContractValid =
    isSha256Digest(policyDigest) &&
    digests?.policy === policyDigest &&
    isSha256Digest(digests?.ledger) &&
    isSha256Digest(digests?.content) &&
    isSha256Digest(digests?.proof);
  const structureValid =
    structure?.rawHtmlDigest === sha256(input.entry.meaning) &&
    structure?.stepSpecificDigest === expectedStepDigest &&
    structure?.baseStrongContextDigest === expectedLegacyDigest &&
    structure?.hasSectionSeparator === true &&
    structure?.sectionSeparatorCount === 1 &&
    structure?.rawPreserved === (action === "raw_combined");
  const contractValid =
    canonicalRequired &&
    proof !== null &&
    policy?.id === HEBREW_CANONICAL_MEANING_POLICY_ID &&
    proof.proven === true &&
    proof.disposition === expectedDisposition[action] &&
    input.selection.counterfactualAction !== null &&
    stringArray(proof.reasonCodes) !== null &&
    (stringArray(proof.reasonCodes)?.length ?? 0) > 0 &&
    digestContractValid &&
    structureValid &&
    selectedRecordValid &&
    (!selectionRequired || selected !== null) &&
    (action === "blocked"
      ? decisionContent === null
      : decisionContent?.source === expectedSource);

  if (!contractValid) {
    addViolation(input.violations, {
      code: "tbesh-canonical-policy-proof-invalid",
      entryKey: input.entry.entryKey,
      locator: input.locator,
      details: {
        action,
        canonicalRequired,
        policyIdValid: policy?.id === HEBREW_CANONICAL_MEANING_POLICY_ID,
        proofProven: proof?.proven === true,
        dispositionValid: proof?.disposition === expectedDisposition[action],
        counterfactualActionValid:
          input.selection.counterfactualAction !== null,
        digestContractValid,
        structureValid,
        selectedRecordValid,
        selectionRequired,
        selectionPresent: selected !== null,
        contentSourceValid:
          action === "blocked"
            ? decisionContent === null
            : decisionContent?.source === expectedSource
      }
    });
  }
}

function expectedPublicationContent(input: {
  entry: SectionedSourceEntry;
  action: TbeshPublicationAction;
  rawAssertion: AssertionRow | null;
  stepAssertion: AssertionRow | null;
  legacyAssertion: AssertionRow | null;
  companionAssertions: AssertionRow[];
  editorialAssertions: AssertionRow[];
  selection: PublicationSelectionRecord;
  violations: LexiconV3TbeshSectionAuditViolation[];
}): {
  sourceHtml: string;
  normalizedHtml: string;
  contentSource: string;
  locator: string;
  assertion: AssertionRow;
} | null {
  const rawLocator = `StepEntries:${input.entry.stepEntryId}:meaning`;
  if (input.action === "blocked") return null;
  if (input.action === "editorial_reconstruction") {
    if (input.editorialAssertions.length !== 1) {
      addViolation(input.violations, {
        code:
          input.editorialAssertions.length === 0
            ? "tbesh-editorial-reconstruction-assertion-missing"
            : "tbesh-editorial-reconstruction-assertion-ambiguous",
        entryKey: input.entry.entryKey,
        locator: rawLocator,
        details: { assertionCount: input.editorialAssertions.length }
      });
      return null;
    }
    const assertion = input.editorialAssertions[0]!;
    const canonicalProof = asRecord(input.selection.canonicalPolicyProof);
    const selected = asRecord(canonicalProof?.selection);
    const recordDigest =
      typeof selected?.recordDigest === "string" ? selected.recordDigest : null;
    const expectedLocator = `hebrew-meaning-adjudication:${input.entry.entryKey.slice("hebrew:".length)}:${recordDigest ?? "missing"}`;
    if (
      assertion.scope !== "entry" ||
      !assertion.valueHtml ||
      assertion.valueHtml !== selected?.html ||
      selected?.source !== "lexicon_v3_hebrew_adjudication" ||
      !isSha256Digest(recordDigest) ||
      assertion.sha256 !== recordDigest ||
      assertion.locator !== expectedLocator
    ) {
      addViolation(input.violations, {
        code: "tbesh-editorial-reconstruction-assertion-invalid",
        entryKey: input.entry.entryKey,
        locator: assertion.locator,
        details: {
          scopeValid: assertion.scope === "entry",
          htmlMatchesSelection: assertion.valueHtml === selected?.html,
          sourceValid: selected?.source === "lexicon_v3_hebrew_adjudication",
          recordDigestValid: isSha256Digest(recordDigest),
          assertionDigestMatches: assertion.sha256 === recordDigest,
          locatorMatches: assertion.locator === expectedLocator
        }
      });
      return null;
    }
    return {
      sourceHtml: assertion.valueHtml,
      normalizedHtml: normalizeCanonicalTbeshHtml(assertion.valueHtml),
      contentSource: "lexicon_v3_hebrew_adjudication",
      locator: assertion.locator,
      assertion
    };
  }
  if (input.action === "exact_companion") {
    if (input.companionAssertions.length !== 1) {
      addViolation(input.violations, {
        code:
          input.companionAssertions.length === 0
            ? "tbesh-exact-companion-assertion-missing"
            : "tbesh-exact-companion-assertion-ambiguous",
        entryKey: input.entry.entryKey,
        locator: rawLocator,
        details: { assertionCount: input.companionAssertions.length }
      });
      return null;
    }
    const assertion = input.companionAssertions[0]!;
    if (
      !assertion.valueHtml ||
      assertion.locator.slice("hebrew-open-english:".length) !==
        assertion.sha256
    ) {
      addViolation(input.violations, {
        code: "tbesh-exact-companion-assertion-invalid",
        entryKey: input.entry.entryKey,
        locator: assertion.locator,
        details: {
          hasHtml: Boolean(assertion.valueHtml),
          locatorDigestMatches: assertion.locator.endsWith(assertion.sha256)
        }
      });
      return null;
    }
    return {
      sourceHtml: assertion.valueHtml,
      normalizedHtml: normalizeCanonicalTbeshHtml(assertion.valueHtml),
      contentSource: "hebrew_english_exact_companion",
      locator: assertion.locator,
      assertion
    };
  }
  const locator =
    input.action === "step_specific_only"
      ? `${rawLocator}:step-specific`
      : input.action === "legacy_general_only"
        ? `${rawLocator}:legacy-general`
        : rawLocator;
  const assertion =
    input.action === "step_specific_only"
      ? input.stepAssertion
      : input.action === "legacy_general_only"
        ? input.legacyAssertion
        : input.rawAssertion;
  if (!assertion) {
    addViolation(input.violations, {
      code: "tbesh-publication-assertion-missing",
      entryKey: input.entry.entryKey,
      locator,
      details: { action: input.action }
    });
    return null;
  }
  const sourceHtml =
    input.action === "step_specific_only"
      ? input.entry.sections.stepSpecificHtml
      : input.action === "legacy_general_only"
        ? input.entry.sections.legacyGeneralHtml
        : input.entry.meaning;
  return {
    sourceHtml,
    normalizedHtml: normalizeCanonicalTbeshHtml(sourceHtml),
    contentSource:
      input.action === "step_specific_only"
        ? "tbesh_step_specific"
        : input.action === "legacy_general_only"
          ? "tbesh_legacy_general"
          : "tbesh_raw",
    locator,
    assertion
  };
}

function auditPublicationFieldMethod(input: {
  entry: SectionedSourceEntry;
  field: FieldRow;
  action: TbeshPublicationAction;
  selection: PublicationSelectionRecord;
  locator: string;
  violations: LexiconV3TbeshSectionAuditViolation[];
}): void {
  const canonicalGenerator =
    input.field.generator === CANONICAL_MEANING_GENERATOR;
  const expectedMethod = canonicalGenerator
    ? input.action === "editorial_reconstruction"
      ? "editorial"
      : "rule"
    : input.action === "exact_companion"
      ? "import"
      : input.action === "step_specific_only"
        ? "rule"
        : "source";
  const generatorValid =
    input.action === "exact_companion" || input.action === "step_specific_only"
      ? [PUBLICATION_GENERATOR, CANONICAL_MEANING_GENERATOR].includes(
          input.field.generator
        )
      : ["legacy_general_only", "editorial_reconstruction"].includes(
            input.action
          )
        ? input.field.generator === CANONICAL_MEANING_GENERATOR
        : input.action === "raw_combined"
          ? [
              BUILDER_GENERATOR,
              PUBLICATION_GENERATOR,
              CANONICAL_MEANING_GENERATOR
            ].includes(input.field.generator)
          : [BUILDER_GENERATOR, CANONICAL_MEANING_GENERATOR].includes(
              input.field.generator
            );
  if (input.field.method !== expectedMethod || !generatorValid) {
    addViolation(input.violations, {
      code: "tbesh-publication-field-method-invalid",
      entryKey: input.entry.entryKey,
      locator: input.locator,
      details: {
        action: input.action,
        expectedMethod,
        actualMethod: input.field.method,
        actualGenerator: input.field.generator,
        canonicalPolicyPresent: input.selection.canonicalPolicyProof !== null
      }
    });
  }
  if (
    input.action !== "blocked" &&
    [PUBLICATION_GENERATOR, CANONICAL_MEANING_GENERATOR].includes(
      input.field.generator
    ) &&
    input.field.state !== "auto_validated"
  ) {
    addViolation(input.violations, {
      code: "tbesh-ledger-publication-state-invalid",
      entryKey: input.entry.entryKey,
      locator: input.locator,
      details: { state: input.field.state }
    });
  }
}

function auditQuarantinedSourceNotSupporting(input: {
  entry: SectionedSourceEntry;
  field: FieldRow;
  action: TbeshPublicationAction;
  rawAssertion: AssertionRow | null;
  legacyAssertion: AssertionRow | null;
  evidence: EvidenceRow[];
  counts: EvidenceCounters;
  violations: LexiconV3TbeshSectionAuditViolation[];
}): void {
  for (const assertion of [input.rawAssertion, input.legacyAssertion]) {
    if (!assertion) continue;
    const links = input.evidence.filter(
      (row) => row.sourceAssertionId === assertion.id
    );
    if (links.some((row) => row.stance === "supports")) {
      addViolation(input.violations, {
        code: "tbesh-quarantined-source-still-supports",
        entryKey: input.entry.entryKey,
        locator: assertion.locator,
        details: { action: input.action }
      });
    }
    if (assertion === input.rawAssertion) {
      input.counts.rawContextExpected += 1;
      const matching = links.filter((row) => {
        if (
          row.evidenceKind !== "direct_source" ||
          row.stance === "supports" ||
          row.witnessFamily !== "STEP-TBES"
        ) {
          return false;
        }
        return (
          tryParseObject(row.detailsJson)?.role === "quarantined-raw-source"
        );
      });
      input.counts.rawContextFound += matching.length;
      if (matching.length !== 1) {
        addViolation(input.violations, {
          code:
            matching.length === 0
              ? "tbesh-raw-context-evidence-missing"
              : "tbesh-raw-context-evidence-ambiguous",
          entryKey: input.entry.entryKey,
          locator: assertion.locator,
          details: { matchingEvidenceCount: matching.length }
        });
      }
    }
  }
}

function parseDetailsObject(
  value: string,
  code: string,
  entryKey: string,
  locator: string,
  violations: LexiconV3TbeshSectionAuditViolation[]
): Record<string, unknown> | null {
  const parsed = tryParseObject(value);
  if (parsed) return parsed;
  addViolation(violations, {
    code,
    entryKey,
    locator,
    details: { detailsSha256: sha256(value) }
  });
  return null;
}

function tryParseObject(value: string): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : null;
}

function isPublicationAction(value: unknown): value is TbeshPublicationAction {
  return [
    "raw_combined",
    "step_specific_only",
    "legacy_general_only",
    "exact_companion",
    "editorial_reconstruction",
    "blocked"
  ].includes(String(value));
}

function assertionCounterPrefix(
  kind: "raw" | "step-specific" | "legacy-general"
): "raw" | "stepSpecific" | "legacyGeneral" {
  if (kind === "step-specific") return "stepSpecific";
  if (kind === "legacy-general") return "legacyGeneral";
  return "raw";
}

function readSourceEntries(db: DatabaseSync): SourceEntryRow[] {
  return db
    .prepare(
      `SELECT id AS stepEntryId, language, eStrong, dStrong, uStrong,
              original, transliteration, morph, gloss, meaning
       FROM StepEntries
       WHERE language = 'hebrew'
       ORDER BY id`
    )
    .all() as unknown as SourceEntryRow[];
}

function readEntryIds(db: DatabaseSync): EntryIdRow[] {
  return db
    .prepare(
      `SELECT entryKey, stepEntryId
       FROM LexiconEntryIds
       ORDER BY entryKey COLLATE BINARY, stepEntryId`
    )
    .all() as unknown as EntryIdRow[];
}

function readMeaningAssertions(db: DatabaseSync): AssertionRow[] {
  return db
    .prepare(
      `SELECT assertion.id, assertion.entryKey, source.sourceKey,
              assertion.scope,
              assertion.valueText, assertion.valueHtml, assertion.locator,
              assertion.sha256
       FROM LexiconSourceAssertions assertion
       JOIN LexiconSources source ON source.id = assertion.sourceId
       WHERE source.sourceKey IN (
           'step-tbesh-meaning', 'artifact-hebrew-open-english',
           'artifact-hebrew-meaning-adjudication', 'artifact-english-audit'
         )
         AND assertion.field = 'meaning' AND assertion.locale = 'en'
       ORDER BY assertion.entryKey COLLATE BINARY,
                assertion.locator COLLATE BINARY, assertion.id`
    )
    .all() as unknown as AssertionRow[];
}

function readActiveEnglishMeaningFields(db: DatabaseSync): FieldRow[] {
  return db
    .prepare(
      `SELECT id, entryKey, state, valueText, valueHtml, method, generator
       FROM LexiconFieldVersions
       WHERE locale = 'en' AND field = 'meaning' AND state <> 'superseded'
       ORDER BY entryKey COLLATE BINARY, id`
    )
    .all() as unknown as FieldRow[];
}

function readMeaningEvidence(db: DatabaseSync): EvidenceRow[] {
  return db
    .prepare(
      `SELECT evidence.fieldVersionId, evidence.sourceAssertionId,
              field.entryKey AS fieldEntryKey,
              assertion.entryKey AS assertionEntryKey,
              assertion.locator AS assertionLocator,
              source.sourceKey,
              evidence.evidenceKind, evidence.stance,
              evidence.witnessFamily, evidence.detailsJson
       FROM LexiconFieldEvidence evidence
       JOIN LexiconFieldVersions field ON field.id = evidence.fieldVersionId
       JOIN LexiconSourceAssertions assertion
         ON assertion.id = evidence.sourceAssertionId
       JOIN LexiconSources source ON source.id = assertion.sourceId
       WHERE source.sourceKey IN (
           'step-tbesh-meaning', 'artifact-hebrew-open-english',
           'artifact-hebrew-meaning-adjudication', 'artifact-english-audit'
         )
         AND field.locale = 'en' AND field.field = 'meaning'
       ORDER BY field.entryKey COLLATE BINARY,
                assertion.locator COLLATE BINARY,
                evidence.fieldVersionId, evidence.sourceAssertionId,
                evidence.id`
    )
    .all() as unknown as EvidenceRow[];
}

function readIssues(db: DatabaseSync): IssueRow[] {
  return db
    .prepare(
      `SELECT entryKey, fieldVersionId, sourceAssertionId, code, severity,
              status, detailsJson
       FROM LexiconIssues
       ORDER BY entryKey COLLATE BINARY, code COLLATE BINARY,
                severity COLLATE BINARY, status COLLATE BINARY, id`
    )
    .all() as unknown as IssueRow[];
}

function readFrenchContentCounts(db: DatabaseSync): FrenchContentCounts {
  const fieldVersions = scalarCount(
    db,
    "SELECT count(*) AS count FROM LexiconFieldVersions WHERE locale = 'fr'"
  );
  const activeFieldVersions = scalarCount(
    db,
    `SELECT count(*) AS count FROM LexiconFieldVersions
     WHERE locale = 'fr' AND state <> 'superseded'`
  );
  const sourceAssertions = scalarCount(
    db,
    "SELECT count(*) AS count FROM LexiconSourceAssertions WHERE locale = 'fr'"
  );
  const carrierTerms = scalarCount(
    db,
    "SELECT count(*) AS count FROM LexiconCarrierTerms WHERE locale = 'fr'"
  );
  return {
    fieldVersions,
    activeFieldVersions,
    sourceAssertions,
    carrierTerms,
    total: fieldVersions + sourceAssertions + carrierTerms
  };
}

function scalarCount(db: DatabaseSync, sql: string): number {
  const row = db.prepare(sql).get() as { count?: number } | undefined;
  return Number(row?.count ?? 0);
}

function digestSourceSections(entries: SectionedSourceEntry[]): string {
  return sha256(
    stableJson(
      entries.map((entry) => ({
        entryKey: entry.entryKey,
        stepEntryId: entry.stepEntryId,
        classification: entry.sections.classification,
        separatorCount: entry.sections.sectionSeparatorCount,
        rawSha256: sha256(entry.meaning),
        stepSpecificSha256: hasMeaningfulTbeshHtml(
          entry.sections.stepSpecificHtml
        )
          ? sha256(entry.sections.stepSpecificHtml)
          : null,
        legacyGeneralSha256: hasMeaningfulTbeshHtml(
          entry.sections.legacyGeneralHtml
        )
          ? sha256(entry.sections.legacyGeneralHtml)
          : null
      }))
    )
  );
}

function digestAuthoringSections(input: {
  entryIds: EntryIdRow[];
  assertions: AssertionRow[];
  fields: FieldRow[];
  evidence: EvidenceRow[];
  issues: IssueRow[];
  frenchContent: FrenchContentCounts;
}): string {
  return sha256(
    stableJson({
      entryIds: input.entryIds.map((row) => ({
        entryKey: row.entryKey,
        stepEntryId: row.stepEntryId
      })),
      assertions: input.assertions.map((row) => ({
        entryKey: row.entryKey,
        sourceKey: row.sourceKey,
        locator: row.locator,
        scope: row.scope,
        valueTextSha256: sha256(row.valueText ?? ""),
        valueHtmlSha256: sha256(row.valueHtml ?? ""),
        sha256: row.sha256
      })),
      fields: input.fields.map((row) => ({
        entryKey: row.entryKey,
        state: row.state,
        method: row.method,
        generator: row.generator,
        valueTextSha256: sha256(row.valueText),
        valueHtmlSha256: sha256(row.valueHtml ?? "")
      })),
      evidence: input.evidence.map((row) => ({
        fieldEntryKey: row.fieldEntryKey,
        assertionEntryKey: row.assertionEntryKey,
        assertionLocator: row.assertionLocator,
        evidenceKind: row.evidenceKind,
        stance: row.stance,
        witnessFamily: row.witnessFamily,
        details: canonicalJsonText(row.detailsJson)
      })),
      issues: input.issues.map((row) => ({
        ...row,
        detailsJson: canonicalJsonText(row.detailsJson)
      })),
      frenchContent: input.frenchContent
    })
  );
}

function countClassifications(
  entries: SectionedSourceEntry[]
): Record<TbeshMeaningClassification, number> {
  const result: Record<TbeshMeaningClassification, number> = {
    both: 0,
    specific_only: 0,
    legacy_only: 0,
    empty: 0
  };
  for (const entry of entries) result[entry.sections.classification] += 1;
  return result;
}

function countBy<T>(values: T[], key: (value: T) => string): CountMap {
  const counts = new Map<string, number>();
  for (const value of values) {
    const itemKey = key(value);
    counts.set(itemKey, (counts.get(itemKey) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) =>
      left.localeCompare(right, "en")
    )
  );
}

function groupBy<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) {
    const itemKey = key(value);
    const grouped = result.get(itemKey) ?? [];
    grouped.push(value);
    result.set(itemKey, grouped);
  }
  return result;
}

function addHtmlDriftViolation(
  violations: LexiconV3TbeshSectionAuditViolation[],
  code: string,
  entryKey: string,
  locator: string,
  expected: string,
  actual: string | null
): void {
  addViolation(violations, {
    code,
    entryKey,
    locator,
    details: {
      expectedSha256: sha256(expected),
      actualSha256: actual === null ? null : sha256(actual),
      expectedLength: expected.length,
      actualLength: actual?.length ?? 0
    }
  });
}

function addViolation(
  violations: LexiconV3TbeshSectionAuditViolation[],
  violation: LexiconV3TbeshSectionAuditViolation
): void {
  violations.push(violation);
}

function compareSectionedEntries(
  left: SectionedSourceEntry,
  right: SectionedSourceEntry
): number {
  return (
    left.entryKey.localeCompare(right.entryKey, "en") ||
    left.stepEntryId - right.stepEntryId
  );
}

function compareViolations(
  left: LexiconV3TbeshSectionAuditViolation,
  right: LexiconV3TbeshSectionAuditViolation
): number {
  return (
    left.code.localeCompare(right.code, "en") ||
    (left.entryKey ?? "").localeCompare(right.entryKey ?? "", "en") ||
    (left.locator ?? "").localeCompare(right.locator ?? "", "en") ||
    stableJson(left.details).localeCompare(stableJson(right.details), "en")
  );
}

function normalizeCanonicalTbeshHtml(value: string): string {
  return value.replaceAll("<->", "&lt;-&gt;");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isSha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function canonicalJsonText(value: string): string {
  try {
    return stableJson(JSON.parse(value) as unknown);
  } catch {
    return value;
  }
}

function renderCountMap(title: string, counts: CountMap): string[] {
  const lines = [`## ${title}`, "", "| Value | Count |", "| --- | ---: |"];
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    lines.push("| — | 0 |");
  } else {
    for (const [value, count] of entries) {
      lines.push(`| ${escapeTable(value)} | ${count} |`);
    }
  }
  lines.push("");
  return lines;
}

function sumCounts(counts: CountMap): number {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

function escapeInline(value: string): string {
  return value.replaceAll("`", "\\`").replaceAll("\n", " ");
}

function escapeTable(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ");
}

function assertFilesExist(paths: string[]): void {
  const missing = paths.filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new Error(`missing-required-databases:${missing.join(",")}`);
  }
}

function assertRequiredTables(
  db: DatabaseSync,
  databaseLabel: string,
  required: string[]
): void {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as unknown as Array<{ name: string }>;
  const names = new Set(rows.map((row) => row.name));
  const missing = required.filter((name) => !names.has(name));
  if (missing.length > 0) {
    throw new Error(
      `missing-required-${databaseLabel}-tables:${missing.join(",")}`
    );
  }
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, content, "utf8");
}

export function parseLexiconV3TbeshSectionAuditArgs(
  args: readonly string[]
): RunLexiconV3TbeshSectionAuditOptions {
  const allowed = new Set([
    "source",
    "authoring",
    "output-json",
    "output-markdown",
    "generated-at"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument?.startsWith("--")) {
      throw new Error(`unexpected-argument:${argument ?? ""}`);
    }
    const [key = "", inlineValue] = argument.slice(2).split("=", 2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (values.has(key)) throw new Error(`duplicate-option:${key}`);
    const next = args[index + 1];
    const value = inlineValue ?? (next && !next.startsWith("--") ? next : null);
    if (value === null || value.length === 0) {
      throw new Error(`missing-option-value:${key}`);
    }
    values.set(key, value);
    if (inlineValue === undefined) index += 1;
  }
  return {
    sourceDatabase: values.get("source") ?? DEFAULT_SOURCE_DATABASE,
    authoringDatabase: values.get("authoring") ?? DEFAULT_AUTHORING_DATABASE,
    outputJson: values.get("output-json") ?? DEFAULT_OUTPUT_JSON,
    outputMarkdown: values.get("output-markdown") ?? DEFAULT_OUTPUT_MARKDOWN,
    generatedAt: values.get("generated-at")
  };
}

function main(): void {
  const options = parseLexiconV3TbeshSectionAuditArgs(process.argv.slice(2));
  const report = runLexiconV3TbeshSectionAudit(options);
  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        sectionedEntries: report.counts.sectionedEntries,
        violations: report.counts.violations.total,
        outputJson: resolve(options.outputJson),
        outputMarkdown: resolve(options.outputMarkdown)
      },
      null,
      2
    )
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  try {
    main();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `${basename(process.argv[1] ?? "auditLexiconV3TbeshSections")}: ${message}`
    );
    process.exitCode = 1;
  }
}
