import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { readFrenchInternalPackets } from "./assembleLexiconV3FrenchInternalReview.js";
import {
  assertFrenchCodexBatchManifest,
  FRENCH_CODEX_BATCH_MANIFEST_SCHEMA_VERSION,
  type FrenchCodexBatchManifest
} from "./buildLexiconV3FrenchCodexBatches.js";
import {
  assertFrenchInternalRemediationSourceFile,
  frenchInternalRemediationReviewSource,
  readFrenchInternalRemediationPlan,
  readFrenchInternalReviewRecords
} from "./buildLexiconV3FrenchRemediation.js";
import {
  buildFrenchInternalRemediationProposerInputLink,
  buildFrenchInternalRemediationMerge,
  FRENCH_INTERNAL_REMEDIATION_VIEW_CONTEXT_SCHEMA_VERSION,
  renderFrenchInternalRemediationReviews,
  type FrenchInternalRemediationMerge,
  type FrenchInternalRemediationPlan
} from "../src/lexiconV3/frenchInternalRemediation.js";
import { hashFrenchInternalJson } from "../src/lexiconV3/frenchInternalReview.js";
import { frenchInternalViewHash } from "../src/lexiconV3/frenchInternalWork.js";
import {
  assertFrenchEntityMentionsArtifact,
  type FrenchEntityMentionsArtifact
} from "../src/lexiconV3/frenchEntityMentions.js";

const DEFAULT_ROOT = "outputs/lexicon-v3/fr-internal/remediation/round-001";

export interface MergeLexiconV3FrenchInternalReviewsOptions {
  planPath: string;
  batchManifestPath: string;
  packetsPath: string;
  previousReviewsPath: string;
  attemptedReviewsPath: string;
  entityMentionsPath?: string;
  outputPath: string;
  summaryPath: string;
}

export function mergeLexiconV3FrenchInternalReviews(
  options: MergeLexiconV3FrenchInternalReviewsOptions
): FrenchInternalRemediationMerge {
  const plan = readFrenchInternalRemediationPlan(options.planPath);
  const manifest = readFrenchRemediationBatchManifest(
    options.batchManifestPath
  );
  assertFrenchCodexBatchManifest(manifest, {
    verifyFiles: true,
    expectedEntries: plan.keys.length
  });
  assertFrenchInternalRemediationSourceFile(plan.sources.packets, "packets");
  assertFrenchInternalRemediationSourceFile(plan.sources.reviews, "reviews");
  if (
    resolve(options.packetsPath) !== plan.sources.packets.path ||
    resolve(options.previousReviewsPath) !== plan.sources.reviews.path
  ) {
    throw new Error("french-remediation-merge-plan-source-path-mismatch");
  }
  const batchManifestSha256 = sha256(readFileSync(options.batchManifestPath));
  if (
    manifest.schemaVersion !== FRENCH_CODEX_BATCH_MANIFEST_SCHEMA_VERSION ||
    manifest.runKind !== "custom" ||
    manifest.namespace !==
      `/fr-internal/custom/remediation-r${String(plan.round).padStart(3, "0")}` ||
    resolve(manifest.sourcePaths.selection) !== resolve(options.planPath) ||
    manifest.selection.sourceFileHash !==
      sha256(readFileSync(options.planPath)) ||
    manifest.selection.sourceContentHash !== plan.contentHash ||
    resolve(manifest.sourcePaths.packets) !== resolve(options.packetsPath) ||
    manifest.selection.keys.length !== plan.keys.length ||
    manifest.selection.keys.some(
      (entryKey, index) => entryKey !== plan.keys[index]
    )
  ) {
    throw new Error("french-remediation-batch-manifest-plan-mismatch");
  }
  assertRemediationManifestViews(manifest, plan);
  const inputHashes = new Map<
    string,
    { proposerA: string; proposerB: string }
  >();
  for (const batch of manifest.batches) {
    for (const [index, entryKey] of batch.keys.entries()) {
      inputHashes.set(entryKey, {
        proposerA: batch.proposerAViewHashes[index]!,
        proposerB: batch.proposerBViewHashes[index]!
      });
    }
  }
  const proposerInputs = plan.items.map((item) => {
    const hashes = inputHashes.get(item.entryKey);
    if (!hashes) {
      throw new Error(
        `french-remediation-batch-input-missing:${item.entryKey}`
      );
    }
    return buildFrenchInternalRemediationProposerInputLink({
      item,
      batchManifestSha256,
      proposerAInputHash: hashes.proposerA,
      proposerBInputHash: hashes.proposerB
    });
  });
  const batchManifestSource = {
    path: resolve(options.batchManifestPath),
    sha256: batchManifestSha256,
    records: proposerInputs.length,
    logicalDigest: hashFrenchInternalJson({
      manifestSha256: batchManifestSha256,
      proposerInputs
    })
  };
  const packets = readFrenchInternalPackets(options.packetsPath).records;
  const previousReviews = readFrenchInternalReviewRecords(
    options.previousReviewsPath
  );
  const attemptedReviews = readFrenchInternalReviewRecords(
    options.attemptedReviewsPath,
    { allowEmpty: plan.keys.length === 0 }
  );
  const entityMentions = options.entityMentionsPath
    ? readFrenchEntityMentions(options.entityMentionsPath)
    : undefined;
  const attemptedReviewsSource = frenchInternalRemediationReviewSource(
    options.attemptedReviewsPath,
    attemptedReviews
  );
  const build = buildFrenchInternalRemediationMerge({
    plan,
    packets,
    previousReviews,
    attemptedReviews,
    requiredEntityMentions: entityMentions?.requiredEntityMentions,
    proposerInputs,
    batchManifestSource,
    attemptedReviewsSource
  });
  const outputText = renderFrenchInternalRemediationReviews(build.records);
  if (sha256(outputText) !== build.merge.outputDigest) {
    throw new Error("french-remediation-merge-output-digest-internal-mismatch");
  }
  const summaryText = `${JSON.stringify(build.merge, null, 2)}\n`;
  writePairContentAddressed(
    options.outputPath,
    outputText,
    options.summaryPath,
    summaryText
  );
  if (
    sha256(readFileSync(options.outputPath)) !== build.merge.outputDigest ||
    readFrenchInternalRemediationMerge(options.summaryPath).mergeHash !==
      build.merge.mergeHash
  ) {
    throw new Error("french-remediation-merge-install-verification-failed");
  }
  return build.merge;
}

export function readFrenchInternalRemediationMerge(
  path: string
): FrenchInternalRemediationMerge {
  if (!existsSync(path)) {
    throw new Error(
      `french-remediation-merge-summary-missing:${resolve(path)}`
    );
  }
  try {
    return JSON.parse(
      readFileSync(path, "utf8")
    ) as FrenchInternalRemediationMerge;
  } catch {
    throw new Error(
      `french-remediation-merge-summary-invalid-json:${resolve(path)}`
    );
  }
}

export function parseMergeLexiconV3FrenchInternalReviewsArgs(
  args: readonly string[]
): MergeLexiconV3FrenchInternalReviewsOptions {
  const values = new Map<string, string>();
  const allowed = new Set([
    "plan",
    "batch-manifest",
    "packets",
    "previous-reviews",
    "attempted-reviews",
    "entity-mentions",
    "output",
    "summary"
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--"))
      throw new Error(`unexpected-argument:${token}`);
    const key = token.slice(2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (values.has(key)) throw new Error(`duplicate-option:${key}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`missing-value:${key}`);
    values.set(key, value);
    index += 1;
  }
  return {
    planPath: resolve(values.get("plan") ?? `${DEFAULT_ROOT}/plan.json`),
    batchManifestPath: resolve(
      values.get("batch-manifest") ??
        `${DEFAULT_ROOT}/agent-batches/manifest.json`
    ),
    packetsPath: resolve(
      values.get("packets") ??
        "outputs/lexicon-v3/fr-internal/french-packets.jsonl"
    ),
    previousReviewsPath: resolve(
      values.get("previous-reviews") ??
        "outputs/lexicon-v3/fr-internal/french-review.jsonl"
    ),
    attemptedReviewsPath: resolve(
      values.get("attempted-reviews") ??
        `${DEFAULT_ROOT}/attempted-review.jsonl`
    ),
    ...(values.has("entity-mentions")
      ? { entityMentionsPath: resolve(values.get("entity-mentions")!) }
      : {}),
    outputPath: resolve(
      values.get("output") ?? `${DEFAULT_ROOT}/merged-review.jsonl`
    ),
    summaryPath: resolve(
      values.get("summary") ?? `${DEFAULT_ROOT}/merge.summary.json`
    )
  };
}

function readFrenchEntityMentions(path: string): FrenchEntityMentionsArtifact {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(
      `french-remediation-entity-mentions-invalid-json:${resolve(path)}`
    );
  }
  assertFrenchEntityMentionsArtifact(value);
  return value;
}

function writePairContentAddressed(
  leftPath: string,
  leftText: string,
  rightPath: string,
  rightText: string
): void {
  const left = resolve(leftPath);
  const right = resolve(rightPath);
  if (left === right)
    throw new Error("french-remediation-output-path-collision");
  const leftExists = existsSync(left);
  const rightExists = existsSync(right);
  if (leftExists || rightExists) {
    if (
      leftExists &&
      rightExists &&
      readFileSync(left, "utf8") === leftText &&
      readFileSync(right, "utf8") === rightText
    ) {
      return;
    }
    throw new Error(`french-remediation-output-pair-stale:${left}:${right}`);
  }
  mkdirSync(dirname(left), { recursive: true });
  mkdirSync(dirname(right), { recursive: true });
  const suffix = `.tmp-${process.pid}-${Date.now()}`;
  const leftTemp = `${left}${suffix}`;
  const rightTemp = `${right}${suffix}`;
  try {
    writeFileSync(leftTemp, leftText, "utf8");
    writeFileSync(rightTemp, rightText, "utf8");
    renameSync(leftTemp, left);
    try {
      renameSync(rightTemp, right);
    } catch (error) {
      rmSync(left, { force: true });
      throw error;
    }
  } catch (error) {
    rmSync(leftTemp, { force: true });
    rmSync(rightTemp, { force: true });
    throw error;
  }
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function readFrenchRemediationBatchManifest(
  path: string
): FrenchCodexBatchManifest {
  if (!existsSync(path)) {
    throw new Error(
      `french-remediation-batch-manifest-missing:${resolve(path)}`
    );
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as FrenchCodexBatchManifest;
  } catch {
    throw new Error(
      `french-remediation-batch-manifest-invalid-json:${resolve(path)}`
    );
  }
}

function assertRemediationManifestViews(
  manifest: FrenchCodexBatchManifest,
  plan: FrenchInternalRemediationPlan
): void {
  const itemByKey = new Map(plan.items.map((item) => [item.entryKey, item]));
  for (const [role, path] of [
    ["proposerA", manifest.sourcePaths.proposerA],
    ["proposerB", manifest.sourcePaths.proposerB]
  ] as const) {
    const records = readFileSync(path, "utf8")
      .split(/\r?\n/u)
      .filter((line) => line.trim())
      .map((line, index) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          throw new Error(
            `french-remediation-manifest-view-invalid-json:${role}:${index + 1}`
          );
        }
      });
    if (
      records.length !== plan.keys.length ||
      records.some((record, index) => record.entryKey !== plan.keys[index])
    ) {
      throw new Error(`french-remediation-manifest-view-coverage:${role}`);
    }
    for (const record of records) {
      const entryKey = String(record.entryKey ?? "");
      const item = itemByKey.get(entryKey);
      const context = record.remediationContext;
      if (!item || !isObject(context)) {
        throw new Error(
          `french-remediation-manifest-view-context-missing:${role}:${entryKey}`
        );
      }
      const expectedKeys = [
        "schemaVersion",
        "round",
        "planHash",
        "planItemHash",
        "parentHash",
        "parentViewHash",
        "parentStatus",
        "parentGateIssues",
        "parentDiagnostics",
        "parentEvaluationHash",
        "previousFrenchProposalExposed",
        "diagnosticFeedbackExposed",
        "instruction"
      ].sort();
      const expectedInstruction =
        role === "proposerA"
          ? "retranslate-from-sealed-english-and-correct-exact-diagnostics-without-copying-prior-proposal"
          : "reassess-from-sealed-english-candidates-and-correct-exact-diagnostics-without-copying-prior-proposal";
      if (
        hashFrenchInternalJson(Object.keys(context).sort()) !==
          hashFrenchInternalJson(expectedKeys) ||
        context.schemaVersion !==
          FRENCH_INTERNAL_REMEDIATION_VIEW_CONTEXT_SCHEMA_VERSION ||
        context.round !== plan.round ||
        context.planHash !== plan.planHash ||
        context.planItemHash !== item.itemHash ||
        context.parentHash !== item.parentHash ||
        context.parentStatus !== item.parentStatus ||
        hashFrenchInternalJson(context.parentGateIssues) !==
          hashFrenchInternalJson(item.parentGateIssues) ||
        hashFrenchInternalJson(context.parentDiagnostics) !==
          hashFrenchInternalJson(item.parentDiagnostics) ||
        context.parentEvaluationHash !== item.parentEvaluationHash ||
        context.previousFrenchProposalExposed !== false ||
        context.diagnosticFeedbackExposed !== true ||
        context.instruction !== expectedInstruction ||
        typeof context.parentViewHash !== "string" ||
        !/^[a-f0-9]{64}$/u.test(context.parentViewHash)
      ) {
        throw new Error(
          `french-remediation-manifest-view-context-invalid:${role}:${entryKey}`
        );
      }
      const {
        remediationContext: _remediationContext,
        viewHash: _viewHash,
        ...parentContent
      } = record;
      void _remediationContext;
      void _viewHash;
      const reconstructedParent = {
        ...parentContent,
        viewHash: context.parentViewHash
      };
      if (
        frenchInternalViewHash(reconstructedParent) !== context.parentViewHash
      ) {
        throw new Error(
          `french-remediation-manifest-parent-view-invalid:${role}:${entryKey}`
        );
      }
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  try {
    const merge = mergeLexiconV3FrenchInternalReviews(
      parseMergeLexiconV3FrenchInternalReviewsArgs(process.argv.slice(2))
    );
    process.stdout.write(
      `${JSON.stringify(
        {
          event: "french-remediation-reviews-merged",
          round: merge.round,
          attempted: merge.counts.attempted,
          replaced: merge.counts.replaced,
          residual: merge.counts.residual,
          mergeHash: merge.mergeHash
        },
        null,
        2
      )}\n`
    );
  } catch (error) {
    process.stderr.write(
      `${basename(process.argv[1] ?? "mergeLexiconV3FrenchInternalReviews")}: ${
        error instanceof Error ? error.message : String(error)
      }\n`
    );
    process.exitCode = 1;
  }
}
