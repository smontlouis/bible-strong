import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assertFrenchCodexAnyBatchManifest } from "./buildLexiconV3FrenchCodexBatches.js";
import { buildFrenchHtmlTemplate, FRENCH_HTML_RENDERER_VERSION, renderFrenchHtmlTemplate } from "../src/lexiconV3/frenchHtmlRenderer.js";
import { FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE, FRENCH_INTERNAL_EXECUTION_ATTESTATION_SCHEMA_VERSION, FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION, assertFrenchInternalReviewRecord, buildFrenchInternalAgentProof, buildFrenchInternalCarrierTerms, evaluateFrenchInternalReview, finalizeFrenchInternalExecutionAttestation, finalizeFrenchInternalReviewRecord, finalizeFrenchInternalSiblingConsistencyProof, FRENCH_INTERNAL_PROMPT_VERSION, FRENCH_INTERNAL_REVIEW_POLICY_VERSION, FRENCH_INTERNAL_REVIEW_SCHEMA_VERSION, frenchInternalArbiterDependencies, frenchInternalArbiterResponsePayload, frenchInternalAuditorDependencies, frenchInternalExecutionReceiptHash, frenchInternalGenerationConfigHash, frenchInternalSiblingFamilyKey, hashFrenchInternalJson } from "../src/lexiconV3/frenchInternalReview.js";
import { FRENCH_PROPOSAL_SCHEMA_VERSION, validateFrenchProposal } from "../src/lexiconV3/frenchValidation.js";
import { validateFrenchPacket } from "../src/lexiconV3/frenchPackets.js";
import { assertFrenchCodexExecutionReceipt } from "../src/lexiconV3/frenchCodexExecutionReceipt.js";
import { assertFrenchEntityMentionsArtifact, assertFrenchEntityMentionsPublishable } from "../src/lexiconV3/frenchEntityMentions.js";
import { assertFrenchEntityPipelineArtifacts } from "../src/lexiconV3/frenchEntityPipeline.js";
import { assertFrenchEntityMergeAttestationAtPath } from "../src/lexiconV3/frenchEntityMergeAttestation.js";
export const FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION = "lexicon-v3-french-internal-proposer@3";
export const FRENCH_INTERNAL_ARBITER_ARTIFACT_SCHEMA_VERSION = "lexicon-v3-french-internal-arbiter@2";
export const FRENCH_INTERNAL_AUDITOR_ARTIFACT_SCHEMA_VERSION = "lexicon-v3-french-internal-auditor@2";
export const FRENCH_INTERNAL_ASSEMBLY_CONFIG_SCHEMA_VERSION = "lexicon-v3-french-internal-assembly-config@2";
export const FRENCH_INTERNAL_ASSEMBLY_SUMMARY_SCHEMA_VERSION = "lexicon-v3-french-internal-assembly-summary@4";
const DEFAULT_BATCH_MANIFEST = "outputs/lexicon-v3/fr-internal/agent-batches/full/manifest.json";
const DEFAULT_PROPOSER_A = "outputs/lexicon-v3/fr-internal/proposer-a.jsonl";
const DEFAULT_PROPOSER_B = "outputs/lexicon-v3/fr-internal/proposer-b.jsonl";
const DEFAULT_ARBITER = "outputs/lexicon-v3/fr-internal/arbiter.jsonl";
const DEFAULT_AUDITOR = "outputs/lexicon-v3/fr-internal/auditor.jsonl";
const DEFAULT_CONFIGURATION = "outputs/lexicon-v3/fr-internal/configuration.json";
const DEFAULT_ENTITY_ROOT = "outputs/lexicon-v3/french-entities";
const DEFAULT_ENTITY_RESOLVED = `${DEFAULT_ENTITY_ROOT}/resolved`;
const DEFAULT_CANONICAL_ENTITIES = `${DEFAULT_ENTITY_RESOLVED}/canonical-entities.jsonl`;
const DEFAULT_CANONICAL_ENTRY_POLICIES = `${DEFAULT_ENTITY_RESOLVED}/canonical-entry-name-policies.jsonl`;
const DEFAULT_ENTITY_MERGE_ATTESTATION = `${DEFAULT_ENTITY_RESOLVED}/entity-merge-attestation.json`;
const DEFAULT_ENTITY_GATE = `${DEFAULT_ENTITY_RESOLVED}/entity-gate.json`;
const DEFAULT_ENTITY_MENTIONS = `${DEFAULT_ENTITY_RESOLVED}/required-entity-mentions.json`;
const DEFAULT_ENTITY_PACKETS = "outputs/lexicon-v3/fr-internal/french-packets.jsonl";
const DEFAULT_EXECUTION_RECEIPTS = "outputs/lexicon-v3/fr-internal/full/execution-receipts.jsonl";
const DEFAULT_EXECUTION_RECEIPTS_SUMMARY = "outputs/lexicon-v3/fr-internal/full/execution-receipts.summary.json";
const DEFAULT_ADJUDICATION_SUMMARY = "outputs/lexicon-v3/fr-internal/full/adjudication-summary.json";
const DEFAULT_OUTPUT = "outputs/lexicon-v3/fr-internal/french-review.jsonl";
const DEFAULT_SUMMARY = "outputs/lexicon-v3/fr-internal/french-review.summary.json";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
async function main() {
    const args = parseFrenchInternalAssemblyArgs(process.argv.slice(2));
    const batchManifestPath = resolve(args.manifest ?? DEFAULT_BATCH_MANIFEST);
    const manifest = readFrenchCodexBatchManifest(batchManifestPath);
    const manifestContext = assertFrenchCodexAnyBatchManifest(manifest, {
        verifyFiles: true
    });
    const summary = assembleLexiconV3FrenchInternalReview({
        batchManifestPath,
        packetsPath: resolve(args.packets ?? manifestContext.selectedPackets.path),
        proposerAPath: resolve(args["proposer-a"] ?? DEFAULT_PROPOSER_A),
        proposerBPath: resolve(args["proposer-b"] ?? DEFAULT_PROPOSER_B),
        arbiterPath: resolve(args.arbiter ?? DEFAULT_ARBITER),
        auditorPath: resolve(args.auditor ?? DEFAULT_AUDITOR),
        configurationPath: resolve(args.configuration ?? DEFAULT_CONFIGURATION),
        canonicalEntitiesPath: resolve(args["canonical-entities"] ?? DEFAULT_CANONICAL_ENTITIES),
        canonicalEntryPoliciesPath: resolve(args["canonical-entry-policies"] ?? DEFAULT_CANONICAL_ENTRY_POLICIES),
        entityMergeAttestationPath: resolve(args["entity-merge-attestation"] ?? DEFAULT_ENTITY_MERGE_ATTESTATION),
        entityGatePath: resolve(args["entity-gate"] ?? DEFAULT_ENTITY_GATE),
        entityMentionsPath: resolve(args["entity-mentions"] ?? DEFAULT_ENTITY_MENTIONS),
        entityPacketsPath: resolve(args["entity-packets"] ?? DEFAULT_ENTITY_PACKETS),
        executionReceiptsPath: resolve(args["execution-receipts"] ?? DEFAULT_EXECUTION_RECEIPTS),
        executionReceiptsSummaryPath: resolve(args["execution-receipts-summary"] ?? DEFAULT_EXECUTION_RECEIPTS_SUMMARY),
        adjudicationSummaryPath: resolve(args["adjudication-summary"] ?? DEFAULT_ADJUDICATION_SUMMARY),
        outputPath: resolve(args.output ?? DEFAULT_OUTPUT),
        summaryPath: resolve(args.summary ?? DEFAULT_SUMMARY),
        generatedAt: args["generated-at"]
    });
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
export function assembleLexiconV3FrenchInternalReview(options) {
    assertRequiredFiles([
        options.packetsPath,
        options.proposerAPath,
        options.proposerBPath,
        options.arbiterPath,
        options.auditorPath,
        options.configurationPath,
        options.canonicalEntitiesPath,
        options.canonicalEntryPoliciesPath,
        options.entityMergeAttestationPath,
        options.entityGatePath,
        options.entityMentionsPath,
        options.entityPacketsPath,
        options.executionReceiptsPath,
        options.executionReceiptsSummaryPath,
        options.adjudicationSummaryPath
    ]);
    if (resolve(options.outputPath) === resolve(options.summaryPath)) {
        throw new Error("french-internal-output-summary-must-differ");
    }
    let batchManifestDigest;
    let batchManifestContext;
    if (options.batchManifestPath) {
        const manifest = readFrenchCodexBatchManifest(options.batchManifestPath);
        const context = assertFrenchCodexAnyBatchManifest(manifest, {
            verifyFiles: true
        });
        if (resolve(options.packetsPath) !== resolve(context.selectedPackets.path)) {
            throw new Error("french-internal-selected-packets-manifest-mismatch");
        }
        batchManifestContext = context;
        batchManifestDigest = sha256File(options.batchManifestPath);
    }
    const inputPaths = new Set([
        ...(options.batchManifestPath ? [options.batchManifestPath] : []),
        options.packetsPath,
        options.proposerAPath,
        options.proposerBPath,
        options.arbiterPath,
        options.auditorPath,
        options.configurationPath,
        options.canonicalEntitiesPath,
        options.canonicalEntryPoliciesPath,
        options.entityMergeAttestationPath,
        options.entityGatePath,
        options.entityMentionsPath,
        options.entityPacketsPath,
        options.executionReceiptsPath,
        options.executionReceiptsSummaryPath,
        options.adjudicationSummaryPath
    ].map((path) => resolve(path)));
    if (inputPaths.has(resolve(options.outputPath))) {
        throw new Error("french-internal-output-must-differ-from-inputs");
    }
    if (inputPaths.has(resolve(options.summaryPath))) {
        throw new Error("french-internal-summary-must-differ-from-inputs");
    }
    const packets = readFrenchInternalPackets(options.packetsPath);
    const proposerA = readFrenchInternalProposerArtifacts(options.proposerAPath, "proposerA");
    const proposerB = readFrenchInternalProposerArtifacts(options.proposerBPath, "proposerB");
    const arbiters = readFrenchInternalArbiterArtifacts(options.arbiterPath);
    const auditors = readFrenchInternalAuditorArtifacts(options.auditorPath);
    const configuration = readFrenchInternalAssemblyConfiguration(options.configurationPath);
    const canonicalEntities = readRawJsonl(options.canonicalEntitiesPath, "canonical-entities");
    const canonicalEntryPolicies = readRawJsonl(options.canonicalEntryPoliciesPath, "canonical-entry-policies");
    const entityGate = readJsonFile(options.entityGatePath, "french-internal-entity-gate");
    const entityMentions = readJsonFile(options.entityMentionsPath, "french-internal-entity-mentions");
    const entityPackets = readFrenchInternalPackets(options.entityPacketsPath);
    const entityPacketByKey = new Map(entityPackets.records.map((packet) => [packet.entryKey, packet]));
    for (const packet of packets.records) {
        if (entityPacketByKey.get(packet.entryKey)?.packetHash !== packet.packetHash) {
            throw new Error(`french-internal-entity-packet-selection-drift:${packet.entryKey}`);
        }
    }
    assertEntityArtifactsMatchConfiguration({
        configuration,
        packets: entityPackets.records,
        canonicalEntities: canonicalEntities.records,
        canonicalEntryPolicies: canonicalEntryPolicies.records,
        entityGate,
        entityMentions,
        paths: {
            canonicalEntities: options.canonicalEntitiesPath,
            canonicalEntryPolicies: options.canonicalEntryPoliciesPath,
            entityMergeAttestation: options.entityMergeAttestationPath,
            entityGate: options.entityGatePath,
            entityMentions: options.entityMentionsPath
        }
    });
    if (batchManifestContext) {
        assertFrenchInternalConfigurationMatchesManifest(batchManifestContext, options.configurationPath);
    }
    const execution = readFrenchInternalVerifiedExecution({
        batchManifestPath: options.batchManifestPath,
        packets: packets.records,
        roleArtifacts: {
            proposerA: proposerA.records,
            proposerB: proposerB.records,
            arbiter: arbiters.records,
            auditor: auditors.records
        },
        receiptsPath: options.executionReceiptsPath,
        receiptsSummaryPath: options.executionReceiptsSummaryPath,
        adjudicationSummaryPath: options.adjudicationSummaryPath
    });
    const existingPair = readExistingFrenchInternalAssemblyPair(options.outputPath, options.summaryPath);
    const requestedGeneratedAt = options.generatedAt === undefined
        ? undefined
        : frenchInternalAssemblyGeneratedAt(execution, options.generatedAt);
    if (existingPair &&
        requestedGeneratedAt !== undefined &&
        requestedGeneratedAt !== existingPair.summary.generatedAt) {
        throw new Error("french-internal-existing-output-pair-generated-at-mismatch");
    }
    const build = assembleFrenchInternalReviewRecords({
        packets: packets.records,
        proposerA: proposerA.records,
        proposerB: proposerB.records,
        arbiters: arbiters.records,
        auditors: auditors.records,
        configuration,
        entityMentions,
        execution,
        generatedAt: existingPair?.summary.generatedAt ?? requestedGeneratedAt
    });
    const outputText = `${build.records
        .map((record) => JSON.stringify(record))
        .join("\n")}\n`;
    const outputDigest = sha256(outputText);
    const summaryWithoutDigest = {
        schemaVersion: FRENCH_INTERNAL_ASSEMBLY_SUMMARY_SCHEMA_VERSION,
        policyVersion: FRENCH_INTERNAL_REVIEW_POLICY_VERSION,
        generatedAt: build.generatedAt,
        sourcePaths: {
            ...(options.batchManifestPath
                ? { batchManifest: resolve(options.batchManifestPath) }
                : {}),
            packets: resolve(options.packetsPath),
            proposerA: resolve(options.proposerAPath),
            proposerB: resolve(options.proposerBPath),
            arbiter: resolve(options.arbiterPath),
            auditor: resolve(options.auditorPath),
            configuration: resolve(options.configurationPath),
            canonicalEntities: resolve(options.canonicalEntitiesPath),
            canonicalEntryPolicies: resolve(options.canonicalEntryPoliciesPath),
            entityMergeAttestation: resolve(options.entityMergeAttestationPath),
            entityGate: resolve(options.entityGatePath),
            entityMentions: resolve(options.entityMentionsPath),
            entityPackets: resolve(options.entityPacketsPath),
            executionReceipts: resolve(options.executionReceiptsPath),
            executionReceiptsSummary: resolve(options.executionReceiptsSummaryPath),
            adjudicationSummary: resolve(options.adjudicationSummaryPath),
            output: resolve(options.outputPath)
        },
        sourceDigests: {
            ...(batchManifestDigest ? { batchManifest: batchManifestDigest } : {}),
            packets: packets.digest,
            proposerA: proposerA.digest,
            proposerB: proposerB.digest,
            arbiter: arbiters.digest,
            auditor: auditors.digest,
            configuration: sha256File(options.configurationPath),
            canonicalEntities: canonicalEntities.digest,
            canonicalEntryPolicies: canonicalEntryPolicies.digest,
            entityMergeAttestation: sha256File(options.entityMergeAttestationPath),
            entityGate: sha256File(options.entityGatePath),
            entityMentions: sha256File(options.entityMentionsPath),
            entityPackets: entityPackets.digest,
            executionReceipts: sha256File(options.executionReceiptsPath),
            executionReceiptsSummary: sha256File(options.executionReceiptsSummaryPath),
            adjudicationSummary: sha256File(options.adjudicationSummaryPath)
        },
        executionAttestation: {
            namespace: execution.namespace,
            selectionHash: execution.selectionHash,
            executionReceiptsDigest: execution.executionReceiptsDigest,
            adjudicationSummaryHash: execution.adjudicationSummaryHash
        },
        generationConfigHash: build.generationConfigHash,
        counts: {
            packets: packets.records.length,
            proposerA: proposerA.records.length,
            proposerB: proposerB.records.length,
            arbiters: arbiters.records.length,
            auditors: auditors.records.length,
            outputRecords: build.records.length,
            statuses: build.statusCounts
        },
        recordsLogicalDigest: hashFrenchInternalJson(build.records.map((record) => ({
            entryKey: record.entryKey,
            artifactHash: record.artifactHash
        }))),
        outputDigest
    };
    const summary = {
        ...summaryWithoutDigest,
        summaryDigest: hashFrenchInternalJson(summaryWithoutDigest)
    };
    const summaryText = `${JSON.stringify(summary, null, 2)}\n`;
    const replay = resolveFrenchInternalAssemblyPairForReplay({
        expectedOutputText: outputText,
        expectedSummary: summary,
        ...(existingPair
            ? {
                existingOutputText: existingPair.outputText,
                existingSummaryText: existingPair.summaryText
            }
            : {})
    });
    if (replay.reused)
        return replay.summary;
    writeOutputPairAtomic(options.outputPath, outputText, options.summaryPath, summaryText);
    return replay.summary;
}
export function frenchInternalAssemblyGeneratedAt(execution, requested) {
    if (requested !== undefined) {
        if (!isCanonicalIsoTimestamp(requested)) {
            throw new Error(`invalid-french-internal-generated-at:${requested}`);
        }
        return requested;
    }
    const completedAt = [];
    for (const [entryKey, receipts] of execution.receiptsByEntry) {
        for (const role of [
            "proposerA",
            "proposerB",
            "arbiter",
            "auditor"
        ]) {
            const value = receipts[role]?.completedAt;
            if (!isCanonicalIsoTimestamp(value)) {
                throw new Error(`invalid-french-internal-receipt-completed-at:${entryKey}:${role}:${String(value)}`);
            }
            completedAt.push(value);
        }
    }
    if (completedAt.length === 0) {
        throw new Error("missing-french-internal-receipt-completed-at");
    }
    return completedAt.sort((left, right) => {
        const timeDifference = Date.parse(left) - Date.parse(right);
        return timeDifference === 0 ? left.localeCompare(right) : timeDifference;
    })[completedAt.length - 1];
}
export function resolveFrenchInternalAssemblyPairForReplay(input) {
    const outputExists = input.existingOutputText !== undefined;
    const summaryExists = input.existingSummaryText !== undefined;
    if (outputExists !== summaryExists) {
        throw new Error("french-internal-existing-output-pair-incomplete");
    }
    assertFrenchInternalAssemblySummarySelfHash(input.expectedSummary, "french-internal-expected-output-pair-invalid");
    if (!outputExists) {
        return { summary: input.expectedSummary, reused: false };
    }
    const existingSummary = parseFrenchInternalAssemblySummary(input.existingSummaryText, "french-internal-existing-output-pair-stale");
    const expectedSummaryText = `${JSON.stringify(input.expectedSummary, null, 2)}\n`;
    if (input.existingOutputText !== input.expectedOutputText ||
        input.existingSummaryText !== expectedSummaryText ||
        existingSummary.summaryDigest !== input.expectedSummary.summaryDigest) {
        throw new Error("french-internal-existing-output-pair-stale");
    }
    return { summary: existingSummary, reused: true };
}
export function assembleFrenchInternalReviewRecords(input) {
    validateFrenchInternalAssemblyConfiguration(input.configuration);
    assertFrenchEntityMentionsArtifact(input.entityMentions);
    assertFrenchEntityMentionsPublishable(input.entityMentions);
    for (const [index, packet] of input.packets.entries()) {
        const issues = validateFrenchPacket(packet);
        if (issues.length > 0) {
            throw new Error(`invalid-french-internal-packet:memory:${index + 1}:${issues.join(",")}`);
        }
    }
    assertUniquePacketIdentities(input.packets, "memory");
    input.proposerA.forEach((artifact, index) => validateProposerArtifact(artifact, "proposerA", `memory:${index + 1}`));
    input.proposerB.forEach((artifact, index) => validateProposerArtifact(artifact, "proposerB", `memory:${index + 1}`));
    input.arbiters.forEach((artifact, index) => validateArbiterArtifact(artifact, `memory:${index + 1}`));
    input.auditors.forEach((artifact, index) => validateAuditorArtifact(artifact, `memory:${index + 1}`));
    const packets = uniqueByEntry(input.packets, "packets");
    const proposerA = uniqueByEntry(input.proposerA, "proposerA");
    const proposerB = uniqueByEntry(input.proposerB, "proposerB");
    const arbiters = uniqueByEntry(input.arbiters, "arbiter");
    const auditors = uniqueByEntry(input.auditors, "auditor");
    assertExactCoverage(packets, proposerA, "proposerA");
    assertExactCoverage(packets, proposerB, "proposerB");
    assertExactCoverage(packets, arbiters, "arbiter");
    assertExactCoverage(packets, auditors, "auditor");
    assertExactCoverage(packets, input.execution.receiptsByEntry, "execution");
    const generatedAt = frenchInternalAssemblyGeneratedAt(input.execution, input.generatedAt);
    const siblingProofs = buildFrenchInternalSiblingProofs({
        packets,
        proposerA,
        proposerB,
        arbiters
    });
    const entityMentionsByEntry = groupRequiredEntityMentions(input.entityMentions.requiredEntityMentions);
    const records = [];
    for (const entryKey of [...packets.keys()].sort((left, right) => left.localeCompare(right))) {
        const packet = packets.get(entryKey);
        const roleA = proposerA.get(entryKey);
        const roleB = proposerB.get(entryKey);
        const roleArbiter = arbiters.get(entryKey);
        const roleAuditor = auditors.get(entryKey);
        const roleReceipts = input.execution.receiptsByEntry.get(entryKey);
        const siblingConsistency = siblingProofs.get(entryKey);
        const requiredEntityMentions = entityMentionsByEntry.get(entryKey) ?? [];
        if (hashFrenchInternalJson(roleA.requiredEntityMentions) !==
            hashFrenchInternalJson(requiredEntityMentions) ||
            hashFrenchInternalJson(roleB.requiredEntityMentions) !==
                hashFrenchInternalJson(requiredEntityMentions)) {
            throw new Error(`french-internal-proposer-entity-lineage-drift:${entryKey}`);
        }
        assertRoleLineage(roleA, packet, input.configuration.generationConfigHash);
        assertRoleLineage(roleB, packet, input.configuration.generationConfigHash);
        assertRoleLineage(roleArbiter, packet, input.configuration.generationConfigHash);
        assertRoleLineage(roleAuditor, packet, input.configuration.generationConfigHash);
        records.push(assembleFrenchInternalEntry({
            packet,
            proposerA: roleA,
            proposerB: roleB,
            arbiter: roleArbiter,
            auditor: roleAuditor,
            executionAttestation: finalizeFrenchInternalExecutionAttestation({
                schemaVersion: FRENCH_INTERNAL_EXECUTION_ATTESTATION_SCHEMA_VERSION,
                namespace: input.execution.namespace,
                releaseKey: input.execution.releaseKey,
                releaseSnapshotFingerprint: input.execution.releaseSnapshotFingerprint,
                selectionHash: input.execution.selectionHash,
                keyOrderHash: input.execution.keyOrderHash,
                proposerManifestHash: input.execution.proposerManifestHash,
                proposerSummaryHash: input.execution.proposerSummaryHash,
                arbiterManifestHash: input.execution.arbiterManifestHash,
                arbiterSummaryHash: input.execution.arbiterSummaryHash,
                auditorManifestHash: input.execution.auditorManifestHash,
                auditorSummaryHash: input.execution.auditorSummaryHash,
                executionReceiptsDigest: input.execution.executionReceiptsDigest,
                adjudicationSummaryHash: input.execution.adjudicationSummaryHash,
                roleReceipts
            }),
            siblingConsistency,
            requiredEntityMentions,
            configuration: input.configuration,
            generatedAt
        }));
    }
    const statusCounts = emptyStatusCounts();
    for (const record of records)
        statusCounts[record.status] += 1;
    return {
        records,
        statusCounts,
        generationConfigHash: input.configuration.generationConfigHash,
        generatedAt
    };
}
export function readFrenchInternalPackets(path) {
    const result = readJsonl(path, (value, lineNumber) => {
        const packet = value;
        let issues;
        try {
            issues = validateFrenchPacket(packet);
        }
        catch {
            issues = ["invalid-packet-structure"];
        }
        if (issues.length > 0) {
            throw new Error(`invalid-french-internal-packet:${lineNumber}:${issues.join(",")}`);
        }
        return packet;
    });
    assertUniquePacketIdentities(result.records, path);
    return result;
}
export function readFrenchInternalProposerArtifacts(path, expectedRole) {
    return readJsonl(path, (value, lineNumber) => validateProposerArtifact(value, expectedRole, `${path}:${lineNumber}`));
}
export function readFrenchInternalArbiterArtifacts(path) {
    return readJsonl(path, (value, lineNumber) => validateArbiterArtifact(value, `${path}:${lineNumber}`));
}
export function readFrenchInternalAuditorArtifacts(path) {
    return readJsonl(path, (value, lineNumber) => validateAuditorArtifact(value, `${path}:${lineNumber}`));
}
export function readFrenchInternalAssemblyConfiguration(path) {
    let value;
    try {
        value = JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        throw new Error(`invalid-french-internal-configuration-json:${path}`);
    }
    const configuration = value;
    validateFrenchInternalAssemblyConfiguration(configuration);
    return configuration;
}
/**
 * Replays the sealed configuration and, for a full run, binds it to the
 * generation profile that passed the pilot gate. This check belongs at every
 * execution boundary, not only in the final assembler: otherwise a valid gate
 * could authorize a different (typically cheaper) full-run configuration.
 */
export function assertFrenchInternalConfigurationMatchesManifest(context, configurationPath) {
    const configuration = readFrenchInternalAssemblyConfiguration(configurationPath);
    if (context.runKind === "full" &&
        context.pilotQualityGate?.generationConfigHash !==
            configuration.generationConfigHash) {
        throw new Error("french-internal-pilot-gate-configuration-mismatch");
    }
    return configuration;
}
export function validateFrenchInternalAssemblyConfiguration(value) {
    assertObject(value, "invalid-french-internal-configuration");
    assertExactKeys(value, ["schemaVersion", "configuration", "generationConfigHash"], "invalid-french-internal-configuration-keys");
    if (value.schemaVersion !== FRENCH_INTERNAL_ASSEMBLY_CONFIG_SCHEMA_VERSION) {
        throw new Error("invalid-french-internal-configuration-schema");
    }
    const configuration = value.configuration;
    assertObject(configuration, "missing-french-internal-review-configuration");
    assertExactKeys(configuration, [
        "promptVersion",
        "proposerAPromptHash",
        "proposerBPromptHash",
        "arbiterPromptHash",
        "auditorPromptHash",
        "styleGuideHash",
        "termbaseHash",
        "canonicalNamesHash",
        "canonicalEntitiesHash",
        "canonicalEntryPoliciesHash",
        "entityMergeAttestationHash",
        "entityGateHash",
        "entityMentionsHash",
        "htmlRendererVersion",
        "approvedExecutionProfile"
    ], "invalid-french-internal-review-configuration-keys");
    if (configuration.promptVersion !== FRENCH_INTERNAL_PROMPT_VERSION) {
        throw new Error("invalid-french-internal-prompt-version");
    }
    if (configuration.htmlRendererVersion !== FRENCH_HTML_RENDERER_VERSION) {
        throw new Error("invalid-french-internal-html-renderer-version");
    }
    for (const [key, hash] of Object.entries(configuration)) {
        if (key === "promptVersion" ||
            key === "htmlRendererVersion" ||
            key === "approvedExecutionProfile") {
            continue;
        }
        assertSha256(hash, `invalid-french-internal-config-hash:${key}`);
    }
    if (hashFrenchInternalJson(configuration.approvedExecutionProfile) !==
        hashFrenchInternalJson(FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE)) {
        throw new Error("french-internal-unapproved-execution-profile");
    }
    const expected = frenchInternalGenerationConfigHash(configuration);
    if (value.generationConfigHash !== expected) {
        throw new Error("french-internal-generation-config-hash-mismatch");
    }
}
export function readFrenchInternalVerifiedExecution(input) {
    if (!input.batchManifestPath) {
        throw new Error("french-internal-execution-requires-batch-manifest");
    }
    const manifestText = readFileSync(input.batchManifestPath, "utf8");
    const manifest = JSON.parse(manifestText);
    const manifestContext = assertFrenchCodexAnyBatchManifest(manifest, {
        verifyFiles: true,
        expectedEntries: input.packets.length
    });
    const summary = readJsonObject(input.receiptsSummaryPath, "french-internal-execution-summary-invalid-json");
    const summaryHash = summary.summaryHash;
    const summaryContent = { ...summary };
    delete summaryContent.summaryHash;
    if (summary.schemaVersion !==
        "lexicon-v3-french-codex-execution-receipts-summary@1" ||
        typeof summaryHash !== "string" ||
        !SHA256_PATTERN.test(summaryHash) ||
        hashFrenchInternalJson(summaryContent) !== summaryHash ||
        summary.namespace !== manifestContext.namespace ||
        summary.releaseKey !== manifestContext.lineage.releaseKey ||
        summary.releaseSnapshotFingerprint !==
            manifestContext.lineage.releaseSnapshotFingerprint ||
        summary.selectionHash !== manifestContext.selectionHash ||
        summary.keyOrderHash !== manifestContext.keyOrderHash ||
        summary.coverage !== "exact" ||
        hashFrenchInternalJson(summary.profiles) !==
            hashFrenchInternalJson(FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE)) {
        throw new Error("french-internal-execution-summary-invalid");
    }
    const sourcePaths = assertStringRecord(summary.sourcePaths, "french-internal-execution-source-paths-invalid");
    const sourceDigests = assertStringRecord(summary.sourceDigests, "french-internal-execution-source-digests-invalid");
    const requiredSourceKeys = [
        "proposerManifest",
        "proposerSummary",
        "proposerRuns",
        "proposerAttestationLinks",
        "arbiterManifest",
        "arbiterSummary",
        "arbiterAttestationLinks",
        "auditorManifest",
        "auditorSummary",
        "auditorAttestationLinks"
    ];
    if (JSON.stringify(Object.keys(sourcePaths).sort()) !==
        JSON.stringify([...requiredSourceKeys].sort()) ||
        JSON.stringify(Object.keys(sourceDigests).sort()) !==
            JSON.stringify([...requiredSourceKeys].sort())) {
        throw new Error("french-internal-execution-source-set-invalid");
    }
    for (const key of requiredSourceKeys) {
        const path = sourcePaths[key];
        const digest = sourceDigests[key];
        if (!existsSync(path) ||
            !SHA256_PATTERN.test(digest) ||
            sha256File(path) !== digest) {
            throw new Error(`french-internal-execution-source-stale:${key}`);
        }
    }
    if (resolve(sourcePaths.proposerManifest) !==
        resolve(input.batchManifestPath) ||
        sha256(manifestText) !== sourceDigests.proposerManifest) {
        throw new Error("french-internal-execution-proposer-manifest-mismatch");
    }
    const proposerSummary = verifySelfHashedJson(sourcePaths.proposerSummary, "summaryHash", "french-internal-execution-proposer-summary-invalid");
    const arbiterManifest = verifySelfHashedJson(sourcePaths.arbiterManifest, "manifestHash", "french-internal-execution-arbiter-manifest-invalid");
    const auditorManifest = verifySelfHashedJson(sourcePaths.auditorManifest, "manifestHash", "french-internal-execution-auditor-manifest-invalid");
    const arbiterSummary = verifySelfHashedJson(sourcePaths.arbiterSummary, "summaryHash", "french-internal-execution-arbiter-summary-invalid");
    const auditorSummary = verifySelfHashedJson(sourcePaths.auditorSummary, "summaryHash", "french-internal-execution-auditor-summary-invalid");
    if (proposerSummary.manifestHash !== manifest.manifestHash ||
        arbiterManifest.namespace !== manifestContext.namespace ||
        auditorManifest.namespace !== manifestContext.namespace ||
        arbiterSummary.manifestHash !== arbiterManifest.manifestHash ||
        auditorSummary.manifestHash !== auditorManifest.manifestHash ||
        hashFrenchInternalJson(arbiterSummary.profile) !==
            hashFrenchInternalJson(FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.arbiter) ||
        hashFrenchInternalJson(auditorSummary.profile) !==
            hashFrenchInternalJson(FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor)) {
        throw new Error("french-internal-execution-role-summary-lineage-mismatch");
    }
    const output = assertObjectValue(summary.output, "french-internal-execution-output-invalid");
    if (resolve(String(output.path ?? "")) !== resolve(input.receiptsPath) ||
        output.sha256 !== sha256File(input.receiptsPath) ||
        output.bytes !== readFileSync(input.receiptsPath).byteLength ||
        output.records !== input.packets.length * 4 ||
        typeof output.logicalDigest !== "string" ||
        !SHA256_PATTERN.test(output.logicalDigest)) {
        throw new Error("french-internal-execution-output-stale");
    }
    const receipts = readExecutionReceipts(input.receiptsPath);
    if (receipts.length !== input.packets.length * 4) {
        throw new Error("french-internal-execution-receipt-cardinality");
    }
    if (output.logicalDigest !==
        hashFrenchInternalJson(receipts.map((receipt) => ({
            entryKey: receipt.entryKey,
            role: receipt.role,
            receiptHash: receipt.receiptHash
        })))) {
        throw new Error("french-internal-execution-receipt-logical-digest");
    }
    const packetsByEntry = new Map(input.packets.map((packet) => [packet.entryKey, packet]));
    const artifactsByRole = {
        proposerA: new Map(input.roleArtifacts.proposerA.map((artifact) => [
            artifact.entryKey,
            artifact
        ])),
        proposerB: new Map(input.roleArtifacts.proposerB.map((artifact) => [
            artifact.entryKey,
            artifact
        ])),
        arbiter: new Map(input.roleArtifacts.arbiter.map((artifact) => [
            artifact.entryKey,
            artifact
        ])),
        auditor: new Map(input.roleArtifacts.auditor.map((artifact) => [
            artifact.entryKey,
            artifact
        ]))
    };
    const receiptsByEntry = new Map();
    for (const packet of input.packets) {
        const values = receipts.filter((receipt) => receipt.entryKey === packet.entryKey);
        const byRole = new Map(values.map((receipt) => [receipt.role, receipt]));
        if (values.length !== 4 || byRole.size !== 4) {
            throw new Error(`french-internal-execution-entry-coverage:${packet.entryKey}`);
        }
        const record = {};
        for (const role of [
            "proposerA",
            "proposerB",
            "arbiter",
            "auditor"
        ]) {
            const receipt = byRole.get(role);
            const artifact = artifactsByRole[role].get(packet.entryKey);
            if (!artifact ||
                receipt.schemaVersion !==
                    FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION ||
                receipt.receiptHash !== frenchInternalExecutionReceiptHash(receipt) ||
                receipt.namespace !== manifestContext.namespace ||
                receipt.selectionHash !== manifestContext.selectionHash ||
                receipt.manifestHash !==
                    (role === "proposerA" || role === "proposerB"
                        ? manifest.manifestHash
                        : role === "arbiter"
                            ? String(arbiterManifest.manifestHash)
                            : String(auditorManifest.manifestHash)) ||
                receipt.inputHash !== artifact.inputHash ||
                receipt.artifactHash !== artifact.artifactHash ||
                receipt.agentId !== artifact.agentId ||
                receipt.taskName !== artifact.taskName ||
                receipt.completedAt !== artifact.completedAt ||
                receipt.model !==
                    FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[role].model ||
                receipt.reasoningEffort !==
                    FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[role].reasoningEffort ||
                receipt.executorPolicyVersion !==
                    FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.executorPolicyVersion ||
                receipt.executor.version !==
                    FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexVersion ||
                receipt.executor.sha256 !==
                    FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexSha256 ||
                receipt.capabilities.eventPolicy !== "agent-message-only" ||
                receipt.capabilities.localTools !== "disabled" ||
                receipt.capabilities.networkDataTools !== "disabled" ||
                receipt.capabilities.shell !== "disabled") {
                throw new Error(`french-internal-execution-receipt-lineage:${packet.entryKey}:${role}`);
            }
            record[role] = receipt;
        }
        if (new Set(Object.values(record).map((receipt) => receipt.threadId)).size !==
            4) {
            throw new Error(`french-internal-execution-thread-collision:${packet.entryKey}`);
        }
        receiptsByEntry.set(packet.entryKey, record);
    }
    const orphan = receipts.find((receipt) => !packetsByEntry.has(receipt.entryKey));
    if (orphan) {
        throw new Error(`french-internal-execution-orphan:${orphan.entryKey}`);
    }
    const adjudication = verifySelfHashedJson(input.adjudicationSummaryPath, "summaryHash", "french-internal-adjudication-summary-invalid");
    const adjudicationOutputs = assertObjectValue(adjudication.outputs, "french-internal-adjudication-summary-outputs-invalid");
    const adjudicationReceipts = assertObjectValue(adjudicationOutputs.executionReceipts, "french-internal-adjudication-receipts-missing");
    const adjudicationOutput = assertObjectValue(adjudicationReceipts.output, "french-internal-adjudication-receipts-output-invalid");
    if (adjudication.schemaVersion !==
        "lexicon-v3-french-codex-pilot-adjudication-summary@2" ||
        adjudication.namespace !== manifestContext.namespace ||
        adjudicationReceipts.summaryHash !== summaryHash ||
        adjudicationOutput.path !== output.path ||
        adjudicationOutput.sha256 !== output.sha256 ||
        adjudicationOutput.logicalDigest !== output.logicalDigest) {
        throw new Error("french-internal-adjudication-receipts-lineage-mismatch");
    }
    return {
        namespace: manifestContext.namespace,
        releaseKey: manifestContext.lineage.releaseKey,
        releaseSnapshotFingerprint: manifestContext.lineage.releaseSnapshotFingerprint,
        selectionHash: manifestContext.selectionHash,
        keyOrderHash: manifestContext.keyOrderHash,
        proposerManifestHash: manifest.manifestHash,
        proposerSummaryHash: String(proposerSummary.summaryHash),
        arbiterManifestHash: String(arbiterManifest.manifestHash),
        arbiterSummaryHash: String(arbiterSummary.summaryHash),
        auditorManifestHash: String(auditorManifest.manifestHash),
        auditorSummaryHash: String(auditorSummary.summaryHash),
        executionReceiptsDigest: String(output.logicalDigest),
        adjudicationSummaryHash: String(adjudication.summaryHash),
        receiptsByEntry
    };
}
function readExecutionReceipts(path) {
    const result = [];
    for (const [index, line] of readFileSync(path, "utf8")
        .split(/\r?\n/u)
        .entries()) {
        if (!line.trim())
            continue;
        let value;
        try {
            value = JSON.parse(line);
        }
        catch {
            throw new Error(`french-internal-execution-receipt-invalid-json:${index + 1}`);
        }
        try {
            assertFrenchCodexExecutionReceipt(value);
            verifyExecutionReceiptFiles(value);
        }
        catch {
            throw new Error(`french-internal-execution-receipt-invalid:${index + 1}`);
        }
        result.push(value);
    }
    return result;
}
function verifyExecutionReceiptFiles(receipt) {
    for (const [paths, hashes] of [
        [receipt.sourcePaths, receipt.sourceHashes],
        [receipt.resultPaths, receipt.resultHashes]
    ]) {
        for (const [key, path] of Object.entries(paths)) {
            if (resolve(path) !== path ||
                !existsSync(path) ||
                sha256File(path) !== hashes[key]) {
                throw new Error(`french-internal-execution-receipt-file:${key}`);
            }
        }
    }
    const run = readJsonObject(receipt.sourcePaths.runPointer, "french-internal-execution-run-pointer-invalid");
    const runHash = run.runHash;
    const runContent = { ...run };
    delete runContent.runHash;
    const runSourceHashes = assertStringRecord(run.sourceHashes, "french-internal-execution-run-source-hashes-invalid");
    const runResultHashes = assertStringRecord(run.resultHashes, "french-internal-execution-run-result-hashes-invalid");
    const receiptSourceHashes = { ...receipt.sourceHashes };
    delete receiptSourceHashes.runPointer;
    if (runHash !== receipt.runHash ||
        typeof runHash !== "string" ||
        hashFrenchInternalJson(runContent) !== runHash ||
        run.role !== receipt.role ||
        run.batchId !== receipt.batchId ||
        run.agentId !== receipt.agentId ||
        run.taskName !== receipt.taskName ||
        run.threadId !== receipt.threadId ||
        run.model !== receipt.model ||
        run.reasoningEffort !== receipt.reasoningEffort ||
        run.executorPolicyVersion !== receipt.executorPolicyVersion ||
        run.startedAt !== receipt.startedAt ||
        run.completedAt !== receipt.completedAt ||
        hashFrenchInternalJson(runSourceHashes) !==
            hashFrenchInternalJson(receiptSourceHashes) ||
        hashFrenchInternalJson(runResultHashes) !==
            hashFrenchInternalJson(receipt.resultHashes)) {
        throw new Error("french-internal-execution-run-pointer-mismatch");
    }
    const replay = replayFrenchCodexAgentEvents(readFileSync(receipt.resultPaths.agentEvents, "utf8"), readFileSync(receipt.resultPaths.structuredResponse, "utf8"));
    if (replay.threadId !== receipt.threadId) {
        throw new Error("french-internal-execution-event-thread-mismatch");
    }
}
function replayFrenchCodexAgentEvents(eventsText, structuredResponse) {
    let state = "expect-thread";
    let threadId = "";
    const messages = [];
    for (const line of eventsText.split(/\r?\n/u)) {
        if (!line.trim())
            continue;
        const event = JSON.parse(line);
        if (event.type === "thread.started") {
            if (state !== "expect-thread" || typeof event.thread_id !== "string") {
                throw new Error("french-internal-execution-event-thread-invalid");
            }
            threadId = event.thread_id;
            state = "expect-turn";
            continue;
        }
        if (event.type === "turn.started") {
            if (state !== "expect-turn") {
                throw new Error("french-internal-execution-event-turn-invalid");
            }
            state = "expect-message";
            continue;
        }
        if (event.type === "item.completed") {
            const item = assertObjectValue(event.item, "french-internal-execution-event-item-invalid");
            if ((state !== "expect-message" && state !== "messages") ||
                item.type !== "agent_message" ||
                typeof item.text !== "string") {
                throw new Error("french-internal-execution-event-item-forbidden");
            }
            messages.push(item.text);
            state = "messages";
            continue;
        }
        if (event.type === "turn.completed") {
            if (state !== "messages") {
                throw new Error("french-internal-execution-event-complete-invalid");
            }
            state = "complete";
            continue;
        }
        throw new Error("french-internal-execution-event-forbidden");
    }
    if (state !== "complete" ||
        !threadId ||
        normalizeExecutionMessage(messages.at(-1) ?? "") !==
            normalizeExecutionMessage(structuredResponse)) {
        throw new Error("french-internal-execution-event-sequence-invalid");
    }
    return { threadId };
}
function normalizeExecutionMessage(value) {
    return value
        .trim()
        .replace(/^```(?:json)?\s*/u, "")
        .replace(/\s*```$/u, "")
        .trim();
}
function verifySelfHashedJson(path, hashKey, error) {
    const value = readJsonObject(path, error);
    const hash = value[hashKey];
    const content = { ...value };
    delete content[hashKey];
    if (typeof hash !== "string" ||
        !SHA256_PATTERN.test(hash) ||
        hashFrenchInternalJson(content) !== hash) {
        throw new Error(error);
    }
    return value;
}
function readJsonObject(path, error) {
    let value;
    try {
        value = JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        throw new Error(error);
    }
    return assertObjectValue(value, error);
}
function assertObjectValue(value, error) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(error);
    }
    return value;
}
function assertStringRecord(value, error) {
    const record = assertObjectValue(value, error);
    if (Object.values(record).some((item) => typeof item !== "string" || !item)) {
        throw new Error(error);
    }
    return record;
}
export function frenchInternalRoleArtifactHash(artifact) {
    const { artifactHash: _artifactHash, ...content } = artifact;
    void _artifactHash;
    return hashFrenchInternalJson(content);
}
export function finalizeFrenchInternalProposerArtifact(artifact) {
    return {
        ...artifact,
        artifactHash: frenchInternalRoleArtifactHash(artifact)
    };
}
export function finalizeFrenchInternalArbiterArtifact(artifact) {
    return {
        ...artifact,
        artifactHash: frenchInternalRoleArtifactHash(artifact)
    };
}
export function finalizeFrenchInternalAuditorArtifact(artifact) {
    return {
        ...artifact,
        artifactHash: frenchInternalRoleArtifactHash(artifact)
    };
}
function buildFrenchInternalSiblingProofs(input) {
    const families = new Map();
    for (const packet of input.packets.values()) {
        const key = frenchInternalSiblingFamilyKey(packet);
        const members = families.get(key) ?? [];
        members.push(packet);
        families.set(key, members);
    }
    const result = new Map();
    for (const [familyKey, membersUnsorted] of families) {
        const members = [...membersUnsorted].sort((left, right) => left.entryKey.localeCompare(right.entryKey));
        const translations = members.map((packet) => {
            const arbiter = input.arbiters.get(packet.entryKey);
            const selected = arbiter.selectedProposal === "proposalA"
                ? input.proposerA.get(packet.entryKey)
                : input.proposerB.get(packet.entryKey);
            const proposal = renderProposerArtifact(selected, packet, buildFrenchHtmlTemplate(packet.english.meaningHtml));
            return { packet, proposal, selectedArtifactHash: selected.artifactHash };
        });
        const familyInput = translations.map(({ packet, proposal, selectedArtifactHash }) => ({
            entryKey: packet.entryKey,
            eStrong: packet.identity.eStrong,
            dStrong: packet.identity.dStrong,
            englishGloss: packet.english.gloss,
            englishMeaning: packet.english.meaning,
            selectedArtifactHash,
            glossFr: proposal.glossFr,
            meaningFr: proposal.meaningFr
        }));
        const familyInputDigest = hashFrenchInternalJson(familyInput);
        const issuesByEntry = new Map();
        for (const member of members)
            issuesByEntry.set(member.entryKey, []);
        for (let leftIndex = 0; leftIndex < translations.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < translations.length; rightIndex += 1) {
                const left = translations[leftIndex];
                const right = translations[rightIndex];
                const pair = `${left.packet.entryKey}:${right.packet.entryKey}`;
                if (normalizeSiblingText(left.packet.english.gloss) ===
                    normalizeSiblingText(right.packet.english.gloss) &&
                    normalizeSiblingText(left.proposal.glossFr) !==
                        normalizeSiblingText(right.proposal.glossFr)) {
                    issuesByEntry
                        .get(left.packet.entryKey)
                        .push(`sibling-gloss-divergence:${pair}`);
                    issuesByEntry
                        .get(right.packet.entryKey)
                        .push(`sibling-gloss-divergence:${pair}`);
                }
                if (normalizeSiblingText(left.packet.english.meaning) ===
                    normalizeSiblingText(right.packet.english.meaning) &&
                    normalizeSiblingText(left.proposal.meaningFr) !==
                        normalizeSiblingText(right.proposal.meaningFr)) {
                    issuesByEntry
                        .get(left.packet.entryKey)
                        .push(`sibling-meaning-divergence:${pair}`);
                    issuesByEntry
                        .get(right.packet.entryKey)
                        .push(`sibling-meaning-divergence:${pair}`);
                }
            }
        }
        const memberEntryKeys = members.map((packet) => packet.entryKey);
        for (const packet of members) {
            const issues = uniqueSortedStrings(issuesByEntry.get(packet.entryKey));
            result.set(packet.entryKey, finalizeFrenchInternalSiblingConsistencyProof({
                schemaVersion: "lexicon-v3-french-sibling-consistency-proof@1",
                familyKey,
                entryKey: packet.entryKey,
                memberEntryKeys,
                familyInputDigest,
                verdict: issues.length === 0 ? "consistent" : "divergent",
                issues
            }));
        }
    }
    return result;
}
function normalizeSiblingText(value) {
    return value
        .normalize("NFKC")
        .toLocaleLowerCase("fr")
        .replace(/\s+/gu, " ")
        .trim();
}
function assembleFrenchInternalEntry(input) {
    const template = buildFrenchHtmlTemplate(input.packet.english.meaningHtml);
    const proposalA = renderProposerArtifact(input.proposerA, input.packet, template);
    const proposalB = renderProposerArtifact(input.proposerB, input.packet, template);
    const context = frenchValidationContext(input.packet, input.requiredEntityMentions);
    const validationA = validateFrenchProposal(proposalA, context);
    const validationB = validateFrenchProposal(proposalB, context);
    const selectedProposal = input.arbiter.selectedProposal === "proposalA" ? proposalA : proposalB;
    const selectedValidation = input.arbiter.selectedProposal === "proposalA" ? validationA : validationB;
    const arbitration = {
        verdict: input.arbiter.verdict,
        selectedProposal: input.arbiter.selectedProposal,
        reasons: [...input.arbiter.reasons],
        proposal: selectedProposal,
        validation: selectedValidation
    };
    const audit = {
        verdict: input.auditor.verdict,
        reasons: [...input.auditor.reasons],
        confidence: input.auditor.confidence,
        checks: { ...input.auditor.checks }
    };
    const common = {
        entryKey: input.packet.entryKey,
        packetHash: input.packet.packetHash,
        englishHash: input.packet.english.contentHash,
        generationConfigHash: input.configuration.generationConfigHash
    };
    const proofA = buildFrenchInternalAgentProof({
        role: "proposerA",
        ...common,
        inputHash: input.proposerA.inputHash,
        agentId: input.proposerA.agentId,
        taskName: input.proposerA.taskName,
        executionReceiptHash: input.executionAttestation.roleReceipts.proposerA.receiptHash,
        response: proposalA,
        completedAt: input.proposerA.completedAt
    });
    const proofB = buildFrenchInternalAgentProof({
        role: "proposerB",
        ...common,
        inputHash: input.proposerB.inputHash,
        agentId: input.proposerB.agentId,
        taskName: input.proposerB.taskName,
        executionReceiptHash: input.executionAttestation.roleReceipts.proposerB.receiptHash,
        response: proposalB,
        completedAt: input.proposerB.completedAt
    });
    const proofArbiter = buildFrenchInternalAgentProof({
        role: "arbiter",
        ...common,
        inputHash: input.arbiter.inputHash,
        agentId: input.arbiter.agentId,
        taskName: input.arbiter.taskName,
        executionReceiptHash: input.executionAttestation.roleReceipts.arbiter.receiptHash,
        dependencies: frenchInternalArbiterDependencies(proofA, proofB),
        response: frenchInternalArbiterResponsePayload(arbitration),
        completedAt: input.arbiter.completedAt
    });
    const proofAuditor = buildFrenchInternalAgentProof({
        role: "auditor",
        ...common,
        inputHash: input.auditor.inputHash,
        agentId: input.auditor.agentId,
        taskName: input.auditor.taskName,
        executionReceiptHash: input.executionAttestation.roleReceipts.auditor.receiptHash,
        dependencies: frenchInternalAuditorDependencies({
            proposerA: proofA,
            proposerB: proofB,
            arbiter: proofArbiter,
            arbitration
        }),
        response: audit,
        completedAt: input.auditor.completedAt
    });
    const agentProofs = {
        proposerA: proofA,
        proposerB: proofB,
        arbiter: proofArbiter,
        auditor: proofAuditor
    };
    const carrierTerms = buildFrenchInternalCarrierTerms(proposalA, proposalB, selectedProposal, context);
    const provisional = finalizeFrenchInternalReviewRecord({
        schemaVersion: FRENCH_INTERNAL_REVIEW_SCHEMA_VERSION,
        reviewMode: "internal_agents",
        policyVersion: FRENCH_INTERNAL_REVIEW_POLICY_VERSION,
        entryKey: input.packet.entryKey,
        packetHash: input.packet.packetHash,
        englishHash: input.packet.english.contentHash,
        generationConfigHash: input.configuration.generationConfigHash,
        configuration: input.configuration.configuration,
        status: "review_needed",
        proposalA,
        proposalB,
        validationA,
        validationB,
        arbiter: arbitration,
        auditor: audit,
        agentProofs,
        executionAttestation: input.executionAttestation,
        siblingConsistency: input.siblingConsistency,
        carrierTerms,
        issues: [...input.siblingConsistency.issues],
        generatedAt: input.generatedAt
    });
    const evaluation = evaluateFrenchInternalReview({
        record: provisional,
        packet: input.packet,
        expectedGenerationConfigHash: input.configuration.generationConfigHash,
        requiredEntityMentions: input.requiredEntityMentions
    });
    if (!evaluation.structurallyValid) {
        throw new Error(`invalid-assembled-french-internal-review:${input.packet.entryKey}:${evaluation.structuralIssues.join(",")}`);
    }
    const status = evaluation.autoEligible
        ? "auto_validated"
        : input.packet.english.status === "source_issue"
            ? "blocked_source_issue"
            : "review_needed";
    const record = finalizeFrenchInternalReviewRecord({
        ...withoutReviewArtifactHash(provisional),
        status,
        issues: evaluation.autoEligible
            ? []
            : uniqueSortedStrings([
                ...input.siblingConsistency.issues,
                ...evaluation.autoEligibilityIssues
            ])
    });
    assertFrenchInternalReviewRecord({
        record,
        packet: input.packet,
        expectedGenerationConfigHash: input.configuration.generationConfigHash,
        requiredEntityMentions: input.requiredEntityMentions
    });
    return record;
}
function renderProposerArtifact(artifact, packet, template) {
    const rendered = renderFrenchHtmlTemplate(template, artifact.meaningSegmentsFr);
    return {
        schemaVersion: FRENCH_PROPOSAL_SCHEMA_VERSION,
        entryKey: packet.entryKey,
        derivedFromEnglishHash: packet.english.contentHash,
        model: `internal-agent/${artifact.agentId}`,
        glossFr: artifact.glossFr.trim(),
        meaningSegmentsFr: artifact.meaningSegmentsFr.map((segment) => ({
            id: segment.id,
            text: segment.text
        })),
        entityMentionsFr: artifact.entityMentionsFr.map((mention) => ({
            mentionId: mention.mentionId,
            segmentId: mention.segmentId,
            chosenFrenchForm: mention.chosenFrenchForm.trim()
        })),
        meaningFr: rendered.meaningFr,
        meaningHtmlFr: rendered.meaningHtmlFr,
        notesFr: artifact.notesFr.trim(),
        carrierTermsFr: artifact.carrierTermsFr.map((term) => term.trim()),
        confidence: artifact.confidence
    };
}
function validateProposerArtifact(value, expectedRole, locator) {
    assertObject(value, `invalid-french-internal-proposer:${locator}`);
    assertExactKeys(value, [
        "schemaVersion",
        "role",
        "entryKey",
        "packetHash",
        "englishHash",
        "generationConfigHash",
        "inputHash",
        "agentId",
        "taskName",
        "completedAt",
        "glossFr",
        "meaningSegmentsFr",
        "requiredEntityMentions",
        "entityMentionsFr",
        "notesFr",
        "carrierTermsFr",
        "confidence",
        "artifactHash"
    ], `invalid-french-internal-proposer-keys:${locator}`);
    const artifact = value;
    if (artifact.schemaVersion !== FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION) {
        throw new Error(`invalid-french-internal-proposer-schema:${locator}`);
    }
    if (artifact.role !== expectedRole) {
        throw new Error(`french-internal-proposer-role-mismatch:${locator}`);
    }
    validateRoleBase(artifact, locator);
    if (typeof artifact.glossFr !== "string" || !artifact.glossFr.trim()) {
        throw new Error(`empty-french-internal-gloss:${locator}`);
    }
    if (typeof artifact.notesFr !== "string") {
        throw new Error(`invalid-french-internal-notes:${locator}`);
    }
    if (!Array.isArray(artifact.meaningSegmentsFr)) {
        throw new Error(`invalid-french-internal-segments:${locator}`);
    }
    for (const segment of artifact.meaningSegmentsFr) {
        assertObject(segment, `invalid-french-internal-segment:${locator}`);
        assertExactKeys(segment, ["id", "text"], `invalid-french-internal-segment-keys:${locator}`);
        if (typeof segment.id !== "string" ||
            !segment.id.trim() ||
            typeof segment.text !== "string" ||
            !segment.text.trim()) {
            throw new Error(`invalid-french-internal-segment:${locator}`);
        }
    }
    if (!Array.isArray(artifact.entityMentionsFr)) {
        throw new Error(`invalid-french-internal-entity-mentions:${locator}`);
    }
    if (!Array.isArray(artifact.requiredEntityMentions)) {
        throw new Error(`invalid-french-internal-required-entity-mentions:${locator}`);
    }
    const mentionIds = new Set();
    for (const mention of artifact.entityMentionsFr) {
        assertObject(mention, `invalid-french-internal-entity-mention:${locator}`);
        assertExactKeys(mention, ["mentionId", "segmentId", "chosenFrenchForm"], `invalid-french-internal-entity-mention-keys:${locator}`);
        if (typeof mention.mentionId !== "string" ||
            !mention.mentionId.trim() ||
            typeof mention.segmentId !== "string" ||
            !mention.segmentId.trim() ||
            typeof mention.chosenFrenchForm !== "string" ||
            !mention.chosenFrenchForm.trim() ||
            mentionIds.has(mention.mentionId)) {
            throw new Error(`invalid-french-internal-entity-mention:${locator}`);
        }
        mentionIds.add(mention.mentionId);
    }
    if (!Array.isArray(artifact.carrierTermsFr) ||
        artifact.carrierTermsFr.some((term) => typeof term !== "string" || !term.trim())) {
        throw new Error(`invalid-french-internal-carriers:${locator}`);
    }
    if (!Number.isFinite(artifact.confidence) ||
        artifact.confidence < 0 ||
        artifact.confidence > 1) {
        throw new Error(`invalid-french-internal-confidence:${locator}`);
    }
    assertRoleArtifactHash(artifact, locator);
    return artifact;
}
function validateArbiterArtifact(value, locator) {
    assertObject(value, `invalid-french-internal-arbiter:${locator}`);
    assertExactKeys(value, [
        "schemaVersion",
        "role",
        "entryKey",
        "packetHash",
        "englishHash",
        "generationConfigHash",
        "inputHash",
        "agentId",
        "taskName",
        "completedAt",
        "verdict",
        "selectedProposal",
        "reasons",
        "artifactHash"
    ], `invalid-french-internal-arbiter-keys:${locator}`);
    const artifact = value;
    if (artifact.schemaVersion !== FRENCH_INTERNAL_ARBITER_ARTIFACT_SCHEMA_VERSION) {
        throw new Error(`invalid-french-internal-arbiter-schema:${locator}`);
    }
    if (artifact.role !== "arbiter") {
        throw new Error(`invalid-french-internal-arbiter-role:${locator}`);
    }
    validateRoleBase(artifact, locator);
    if (!["accept", "review_needed"].includes(artifact.verdict)) {
        throw new Error(`invalid-french-internal-arbiter-verdict:${locator}`);
    }
    if (!["proposalA", "proposalB"].includes(artifact.selectedProposal)) {
        throw new Error(`invalid-french-internal-arbiter-selection:${locator}`);
    }
    validateReasons(artifact.reasons, `invalid-french-internal-arbiter-reasons:${locator}`);
    assertRoleArtifactHash(artifact, locator);
    return artifact;
}
function validateAuditorArtifact(value, locator) {
    assertObject(value, `invalid-french-internal-auditor:${locator}`);
    assertExactKeys(value, [
        "schemaVersion",
        "role",
        "entryKey",
        "packetHash",
        "englishHash",
        "generationConfigHash",
        "inputHash",
        "agentId",
        "taskName",
        "completedAt",
        "verdict",
        "reasons",
        "confidence",
        "checks",
        "artifactHash"
    ], `invalid-french-internal-auditor-keys:${locator}`);
    const artifact = value;
    if (artifact.schemaVersion !== FRENCH_INTERNAL_AUDITOR_ARTIFACT_SCHEMA_VERSION) {
        throw new Error(`invalid-french-internal-auditor-schema:${locator}`);
    }
    if (artifact.role !== "auditor") {
        throw new Error(`invalid-french-internal-auditor-role:${locator}`);
    }
    validateRoleBase(artifact, locator);
    if (!["safe", "hold", "block"].includes(artifact.verdict)) {
        throw new Error(`invalid-french-internal-auditor-verdict:${locator}`);
    }
    validateReasons(artifact.reasons, `invalid-french-internal-auditor-reasons:${locator}`);
    if (!Number.isFinite(artifact.confidence) ||
        artifact.confidence < 0 ||
        artifact.confidence > 1) {
        throw new Error(`invalid-french-internal-auditor-confidence:${locator}`);
    }
    assertObject(artifact.checks, `invalid-french-internal-auditor-checks:${locator}`);
    assertExactKeys(artifact.checks, [
        "identityExact",
        "semanticCoverage",
        "noSemanticAddition",
        "noSemanticOmission",
        "polarityModalityUncertaintyPreserved",
        "glossMorphologyConform",
        "properNamesAndTermsConform",
        "entityMentionsConform",
        "protectedContentPreserved",
        "htmlStructurePreserved",
        "naturalFrench",
        "siblingStepConsistency"
    ], `invalid-french-internal-auditor-check-keys:${locator}`);
    if (Object.values(artifact.checks).some((check) => !["pass", "fail"].includes(check))) {
        throw new Error(`invalid-french-internal-auditor-check:${locator}`);
    }
    assertRoleArtifactHash(artifact, locator);
    return artifact;
}
function validateRoleBase(artifact, locator) {
    if (typeof artifact.entryKey !== "string" || !artifact.entryKey.trim())
        throw new Error(`missing-role-entry:${locator}`);
    assertSha256(artifact.packetHash, `invalid-role-packet-hash:${locator}`);
    assertSha256(artifact.englishHash, `invalid-role-english-hash:${locator}`);
    assertSha256(artifact.generationConfigHash, `invalid-role-generation-config-hash:${locator}`);
    assertSha256(artifact.inputHash, `invalid-role-input-hash:${locator}`);
    if (typeof artifact.agentId !== "string" || !artifact.agentId.trim())
        throw new Error(`missing-role-agent-id:${locator}`);
    if (typeof artifact.taskName !== "string" || !artifact.taskName.trim())
        throw new Error(`missing-role-task-name:${locator}`);
    if (typeof artifact.completedAt !== "string" ||
        !Number.isFinite(Date.parse(artifact.completedAt))) {
        throw new Error(`invalid-role-completed-at:${locator}`);
    }
}
function assertRoleArtifactHash(artifact, locator) {
    if (!SHA256_PATTERN.test(artifact.artifactHash) ||
        artifact.artifactHash !== frenchInternalRoleArtifactHash(artifact)) {
        throw new Error(`french-internal-role-artifact-hash-mismatch:${locator}`);
    }
}
function assertRoleLineage(role, packet, generationConfigHash) {
    if (role.entryKey !== packet.entryKey) {
        throw new Error(`french-internal-role-entry-mismatch:${packet.entryKey}`);
    }
    if (role.packetHash !== packet.packetHash) {
        throw new Error(`french-internal-role-packet-stale:${packet.entryKey}:${role.role}`);
    }
    if (role.englishHash !== packet.english.contentHash) {
        throw new Error(`french-internal-role-english-stale:${packet.entryKey}:${role.role}`);
    }
    if (role.generationConfigHash !== generationConfigHash) {
        throw new Error(`french-internal-role-config-stale:${packet.entryKey}:${role.role}`);
    }
}
function frenchValidationContext(packet, requiredEntityMentions = []) {
    return {
        entryKey: packet.entryKey,
        englishHash: packet.english.contentHash,
        englishStatus: packet.english.status,
        englishGloss: packet.english.gloss,
        englishMeaning: packet.english.meaning,
        original: packet.identity.original,
        sourceStrongCodes: packet.protectedContent.strongCodes,
        sourceReferences: packet.protectedContent.references,
        legacyGloss: packet.evidence.legacy?.gloss,
        legacyMeaning: packet.evidence.legacy?.meaning,
        concordanceForms: packet.evidence.concordanceForms,
        requiredEntityMentions: [...requiredEntityMentions]
    };
}
function assertEntityArtifactsMatchConfiguration(input) {
    const expected = input.configuration.configuration;
    const actual = {
        canonicalEntitiesHash: sha256File(input.paths.canonicalEntities),
        canonicalEntryPoliciesHash: sha256File(input.paths.canonicalEntryPolicies),
        entityMergeAttestationHash: sha256File(input.paths.entityMergeAttestation),
        entityGateHash: sha256File(input.paths.entityGate),
        entityMentionsHash: sha256File(input.paths.entityMentions)
    };
    for (const [key, hash] of Object.entries(actual)) {
        if (expected[key] !== hash) {
            throw new Error(`french-internal-entity-artifact-drift:${key}`);
        }
    }
    assertFrenchEntityMergeAttestationAtPath({
        attestationPath: input.paths.entityMergeAttestation,
        canonicalEntitiesPath: input.paths.canonicalEntities,
        canonicalEntryPoliciesPath: input.paths.canonicalEntryPolicies,
        expectedReleaseKey: input.packets[0]?.englishRelease.releaseKey
    });
    assertFrenchEntityPipelineArtifacts({
        entityGate: input.entityGate,
        entityMentions: input.entityMentions,
        canonicalEntities: input.canonicalEntities,
        canonicalEntryPolicies: input.canonicalEntryPolicies,
        packets: input.packets,
        allowConfigurationPinnedResolution: true
    });
}
function groupRequiredEntityMentions(mentions) {
    const result = new Map();
    for (const mention of mentions) {
        const values = result.get(mention.sourceEntryKey) ?? [];
        values.push(mention);
        result.set(mention.sourceEntryKey, values);
    }
    for (const values of result.values()) {
        values.sort((left, right) => left.mentionId.localeCompare(right.mentionId));
    }
    return result;
}
function readJsonFile(path, label) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        throw new Error(`${label}-invalid-json:${path}`);
    }
}
function readRawJsonl(path, label) {
    const bytes = readFileSync(path);
    const records = [];
    for (const [index, line] of bytes
        .toString("utf8")
        .split(/\r?\n/u)
        .entries()) {
        if (!line.trim())
            continue;
        try {
            records.push(JSON.parse(line));
        }
        catch {
            throw new Error(`french-internal-${label}-invalid-json:${index + 1}`);
        }
    }
    if (records.length === 0) {
        throw new Error(`french-internal-${label}-empty`);
    }
    return { records, digest: sha256(bytes) };
}
function readJsonl(path, validate) {
    const bytes = readFileSync(path);
    const records = [];
    const entryKeys = new Set();
    for (const [index, line] of bytes
        .toString("utf8")
        .split(/\r?\n/u)
        .entries()) {
        if (!line.trim())
            continue;
        const lineNumber = index + 1;
        let value;
        try {
            value = JSON.parse(line);
        }
        catch {
            throw new Error(`invalid-french-internal-json:${path}:${lineNumber}`);
        }
        const record = validate(value, lineNumber);
        const entryKey = record.entryKey;
        if (typeof entryKey !== "string" || !entryKey.trim()) {
            throw new Error(`missing-french-internal-entry-key:${path}:${lineNumber}`);
        }
        if (entryKeys.has(entryKey)) {
            throw new Error(`duplicate-french-internal-entry:${path}:${entryKey}`);
        }
        entryKeys.add(entryKey);
        records.push(record);
    }
    if (records.length === 0)
        throw new Error(`empty-french-internal-input:${path}`);
    return { records, digest: sha256(bytes) };
}
function uniqueByEntry(values, label) {
    const result = new Map();
    for (const value of values) {
        if (result.has(value.entryKey)) {
            throw new Error(`duplicate-french-internal-entry:${label}:${value.entryKey}`);
        }
        result.set(value.entryKey, value);
    }
    return result;
}
function assertUniquePacketIdentities(packets, locator) {
    const stepEntryIds = new Set();
    const packetHashes = new Set();
    for (const packet of packets) {
        if (stepEntryIds.has(packet.identity.stepEntryId)) {
            throw new Error(`duplicate-french-internal-step-entry-id:${locator}:${packet.identity.stepEntryId}`);
        }
        if (packetHashes.has(packet.packetHash)) {
            throw new Error(`duplicate-french-internal-packet-hash:${locator}:${packet.packetHash}`);
        }
        stepEntryIds.add(packet.identity.stepEntryId);
        packetHashes.add(packet.packetHash);
    }
}
function assertExactCoverage(packets, roles, label) {
    const missing = [...packets.keys()].filter((entryKey) => !roles.has(entryKey));
    const orphan = [...roles.keys()].filter((entryKey) => !packets.has(entryKey));
    if (missing.length > 0) {
        throw new Error(`missing-french-internal-role:${label}:${missing.sort().join(",")}`);
    }
    if (orphan.length > 0) {
        throw new Error(`orphan-french-internal-role:${label}:${orphan.sort().join(",")}`);
    }
}
function validateReasons(value, error) {
    if (!Array.isArray(value) ||
        value.some((reason) => typeof reason !== "string" || !reason.trim())) {
        throw new Error(error);
    }
}
function uniqueSortedStrings(values) {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
function assertObject(value, error) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(error);
    }
}
function assertExactKeys(value, expected, error) {
    const actual = Object.keys(value).sort();
    const required = [...expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(required)) {
        throw new Error(`${error}:${actual.join(",")}`);
    }
}
function assertSha256(value, error) {
    if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
        throw new Error(error);
    }
}
function assertRequiredFiles(paths) {
    const missing = paths.filter((path) => !existsSync(path));
    if (missing.length > 0) {
        throw new Error(`missing-french-internal-inputs:${missing.join(",")}`);
    }
}
function readExistingFrenchInternalAssemblyPair(outputPath, summaryPath) {
    const outputExists = existsSync(outputPath);
    const summaryExists = existsSync(summaryPath);
    if (outputExists !== summaryExists) {
        throw new Error("french-internal-existing-output-pair-incomplete");
    }
    if (!outputExists)
        return undefined;
    const outputText = readFileSync(outputPath, "utf8");
    const summaryText = readFileSync(summaryPath, "utf8");
    return {
        outputText,
        summaryText,
        summary: parseFrenchInternalAssemblySummary(summaryText, "french-internal-existing-output-pair-stale")
    };
}
function parseFrenchInternalAssemblySummary(text, error) {
    let value;
    try {
        value = JSON.parse(text);
    }
    catch {
        throw new Error(error);
    }
    assertFrenchInternalAssemblySummarySelfHash(value, error);
    return value;
}
function assertFrenchInternalAssemblySummarySelfHash(value, error) {
    try {
        assertObject(value, error);
        if (value.schemaVersion !== FRENCH_INTERNAL_ASSEMBLY_SUMMARY_SCHEMA_VERSION ||
            value.policyVersion !== FRENCH_INTERNAL_REVIEW_POLICY_VERSION ||
            !isCanonicalIsoTimestamp(value.generatedAt) ||
            typeof value.summaryDigest !== "string" ||
            !SHA256_PATTERN.test(value.summaryDigest)) {
            throw new Error(error);
        }
        const { summaryDigest, ...content } = value;
        if (summaryDigest !== hashFrenchInternalJson(content)) {
            throw new Error(error);
        }
    }
    catch {
        throw new Error(error);
    }
}
function isCanonicalIsoTimestamp(value) {
    if (typeof value !== "string")
        return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}
function emptyStatusCounts() {
    return {
        auto_validated: 0,
        review_needed: 0,
        blocked_source_issue: 0,
        failed: 0
    };
}
function withoutReviewArtifactHash(record) {
    const { artifactHash: _artifactHash, ...content } = record;
    void _artifactHash;
    return content;
}
function writeOutputPairAtomic(outputPath, output, summaryPath, summary) {
    const resolvedOutput = resolve(outputPath);
    const resolvedSummary = resolve(summaryPath);
    mkdirSync(dirname(resolvedOutput), { recursive: true });
    mkdirSync(dirname(resolvedSummary), { recursive: true });
    const suffix = `.tmp-${process.pid}-${Date.now()}`;
    const temporaryOutput = `${resolvedOutput}${suffix}`;
    const temporarySummary = `${resolvedSummary}${suffix}`;
    const backupOutput = `${resolvedOutput}.bak-${process.pid}-${Date.now()}`;
    const backupSummary = `${resolvedSummary}.bak-${process.pid}-${Date.now()}`;
    rmSync(temporaryOutput, { force: true });
    rmSync(temporarySummary, { force: true });
    rmSync(backupOutput, { force: true });
    rmSync(backupSummary, { force: true });
    let outputBackedUp = false;
    let summaryBackedUp = false;
    let outputInstalled = false;
    let summaryInstalled = false;
    try {
        writeFileSync(temporaryOutput, output, "utf8");
        writeFileSync(temporarySummary, summary, "utf8");
        if (existsSync(resolvedOutput)) {
            renameSync(resolvedOutput, backupOutput);
            outputBackedUp = true;
        }
        if (existsSync(resolvedSummary)) {
            renameSync(resolvedSummary, backupSummary);
            summaryBackedUp = true;
        }
        renameSync(temporaryOutput, resolvedOutput);
        outputInstalled = true;
        renameSync(temporarySummary, resolvedSummary);
        summaryInstalled = true;
    }
    catch (error) {
        rmSync(temporaryOutput, { force: true });
        rmSync(temporarySummary, { force: true });
        if (outputInstalled)
            rmSync(resolvedOutput, { force: true });
        if (outputBackedUp && existsSync(backupOutput)) {
            renameSync(backupOutput, resolvedOutput);
        }
        if (summaryInstalled)
            rmSync(resolvedSummary, { force: true });
        if (summaryBackedUp && existsSync(backupSummary)) {
            renameSync(backupSummary, resolvedSummary);
        }
        throw error;
    }
    rmSync(backupOutput, { force: true });
    rmSync(backupSummary, { force: true });
}
function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}
function sha256File(path) {
    return sha256(readFileSync(path));
}
function readFrenchCodexBatchManifest(path) {
    if (!existsSync(path)) {
        throw new Error(`french-internal-batch-manifest-missing:${path}`);
    }
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        throw new Error(`french-internal-batch-manifest-invalid-json:${path}`);
    }
}
export function parseFrenchInternalAssemblyArgs(args) {
    const allowed = new Set([
        "manifest",
        "packets",
        "proposer-a",
        "proposer-b",
        "arbiter",
        "auditor",
        "configuration",
        "canonical-entities",
        "canonical-entry-policies",
        "entity-merge-attestation",
        "entity-gate",
        "entity-mentions",
        "entity-packets",
        "execution-receipts",
        "execution-receipts-summary",
        "adjudication-summary",
        "output",
        "summary",
        "generated-at"
    ]);
    const values = {};
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index] ?? "";
        if (!argument.startsWith("--")) {
            throw new Error(`unexpected-argument:${argument}`);
        }
        const [key, inline] = argument.slice(2).split("=", 2);
        if (!key || !allowed.has(key))
            throw new Error(`unknown-option:${key}`);
        if (Object.hasOwn(values, key))
            throw new Error(`duplicate-option:${key}`);
        const next = args[index + 1];
        if (inline !== undefined) {
            if (!inline)
                throw new Error(`missing-value:${key}`);
            values[key] = inline;
        }
        else if (next && !next.startsWith("--")) {
            values[key] = next;
            index += 1;
        }
        else
            throw new Error(`missing-value:${key}`);
    }
    return values;
}
const isMain = process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    main().catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
        process.exitCode = 1;
    });
}
