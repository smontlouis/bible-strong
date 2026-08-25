import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assertFrenchEntityAgentBatchManifest, assertFrenchEntityAgentInputArtifact, frenchEntityAgentArbiterUnitInputHash, frenchEntityAgentArbitrationResponseSchema, frenchEntityAgentAuditorUnitInputHash, frenchEntityAgentAuditResponseSchema, frenchEntityAgentEvidenceConflictCodes, frenchEntityAgentProposalResponseSchema, frenchEntityAgentUnboundAlternateNameEntryKeys, frenchEntityAgentUnboundNameEntryKeys, isFrenchEntityAgentUnboundNameView, isFrenchEntityAgentMixedCanonicalView, parseFrenchEntityAgentArbitrationResponse, parseFrenchEntityAgentAuditResponse, parseFrenchEntityAgentProposalResponse, FRENCH_ENTITY_AGENT_POLICY_VERSION } from "../src/lexiconV3/frenchEntityAgentReview.js";
import { FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS, canonicalFrenchEntityJson, hashFrenchEntityJson } from "../src/lexiconV3/frenchEntityCanonicalization.js";
import { ensureFrenchCodexImmutableBinary, FRENCH_CODEX_IMMUTABLE_BINARY_PATH, prepareFrenchCodexImmutableExecution } from "../src/lexiconV3/frenchCodexImmutableBinary.js";
import { assertFrenchCodexExecutionReceipt, finalizeFrenchCodexExecutionReceipt, FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION } from "../src/lexiconV3/frenchCodexExecutionReceipt.js";
import { FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE } from "../src/lexiconV3/frenchInternalReview.js";
import { acquireExclusiveRoleLock, buildSealedFrenchCodexProposerEnvironment, FRENCH_CODEX_EXECUTOR_POLICY_VERSION, frenchCodexDisabledFeaturesHash, frenchCodexEnvironmentPolicyHash, frenchCodexProposerExecArgs, parseFrenchCodexAgentEvents } from "./runLexiconV3FrenchCodexProposerBatch.js";
export const FRENCH_ENTITY_AGENT_RUN_SCHEMA_VERSION = "lexicon-v3-french-entity-agent-run@1";
export const FRENCH_ENTITY_AGENT_RUNNER_POLICY_VERSION = "lexicon-v3-french-entity-agent-runner-policy@3";
export const FRENCH_ENTITY_AGENT_ARBITER_INPUT_SCHEMA_VERSION = "lexicon-v3-french-entity-agent-arbiter-input@1";
export const FRENCH_ENTITY_AGENT_AUDITOR_INPUT_SCHEMA_VERSION = "lexicon-v3-french-entity-agent-auditor-input@1";
export const FRENCH_ENTITY_AGENT_PARSE_QUARANTINE_SCHEMA_VERSION = "lexicon-v3-french-entity-agent-parse-quarantine@1";
export const FRENCH_ENTITY_AGENT_DEFAULT_MAX_ATTEMPTS = 3;
export const FRENCH_ENTITY_AGENT_MAX_ATTEMPTS_LIMIT = 5;
const DEFAULT_MANIFEST = "outputs/lexicon-v3/french-entities/agent-batches/manifest.json";
const DEFAULT_RESULTS = "outputs/lexicon-v3/french-entities/agent-results";
const DEFAULT_CODEX_HOME = "outputs/lexicon-v3/fr-internal/codex-agent-home";
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const THREAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
export class FrenchEntityAgentChildSupervisor {
    active = new Map();
    shutdownSignal = null;
    forceKillTimer = null;
    track(child) {
        const closed = new Promise((resolveClosed) => {
            const finish = () => {
                child.off("close", finish);
                child.off("error", finish);
                this.active.delete(child);
                resolveClosed();
            };
            child.once("close", finish);
            child.once("error", finish);
        });
        this.active.set(child, closed);
        if (this.shutdownSignal !== null)
            signalChild(child.pid, "SIGTERM");
    }
    requestShutdown(signal) {
        const repeated = this.shutdownSignal !== null;
        this.shutdownSignal ??= signal;
        this.signalAll(repeated ? "SIGKILL" : "SIGTERM");
        if (!repeated && this.forceKillTimer === null) {
            this.forceKillTimer = setTimeout(() => this.signalAll("SIGKILL"), 2_000);
            this.forceKillTimer.unref();
        }
    }
    assertRunning() {
        if (this.shutdownSignal !== null) {
            throw new Error(`french-entity-run-interrupted:${this.shutdownSignal}`);
        }
    }
    async terminateAndWait() {
        if (this.active.size > 0 && this.shutdownSignal === null) {
            this.requestShutdown("SIGTERM");
        }
        while (this.active.size > 0) {
            await Promise.allSettled([...this.active.values()]);
        }
        if (this.forceKillTimer !== null) {
            clearTimeout(this.forceKillTimer);
            this.forceKillTimer = null;
        }
    }
    signalAll(signal) {
        for (const child of this.active.keys())
            signalChild(child.pid, signal);
    }
}
export function installFrenchEntityAgentSignalCleanup(supervisor) {
    const onSigint = () => supervisor.requestShutdown("SIGINT");
    const onSigterm = () => supervisor.requestShutdown("SIGTERM");
    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);
    return () => {
        process.off("SIGINT", onSigint);
        process.off("SIGTERM", onSigterm);
    };
}
class FrenchEntityAgentProcessExecutionError extends Error {
    processExecution;
    constructor(message, processExecution) {
        super(message);
        this.name = "FrenchEntityAgentProcessExecutionError";
        this.processExecution = processExecution;
    }
}
export class FrenchEntityAgentRetryableAttemptError extends Error {
    quarantineDirectory;
    originalError;
    constructor(error, quarantineDirectory) {
        super(errorMessage(error));
        this.name = "FrenchEntityAgentRetryableAttemptError";
        this.originalError = error;
        this.quarantineDirectory = quarantineDirectory;
    }
}
export async function runFrenchEntityAgentAttempts(input) {
    assertMaxAttempts(input.maxAttempts);
    let lastFailure = null;
    for (let attempt = 1; attempt <= input.maxAttempts; attempt += 1) {
        try {
            return await input.execute(attempt);
        }
        catch (error) {
            if (!(error instanceof FrenchEntityAgentRetryableAttemptError)) {
                throw error;
            }
            lastFailure = error;
        }
    }
    throw new Error(`french-entity-run-attempts-exhausted:${input.label}:${input.maxAttempts}:${errorMessage(lastFailure?.originalError)}`);
}
export function parseFrenchEntityAgentRunArgs(args) {
    const valueOptions = new Set([
        "manifest",
        "results-dir",
        "release-key",
        "stage",
        "concurrency",
        "batch",
        "offset-batches",
        "limit-batches",
        "codex-binary",
        "codex-home",
        "timeout-ms",
        "max-attempts"
    ]);
    const flags = new Set(["existing-only"]);
    const values = new Map();
    const seen = new Set();
    let existingOnly = false;
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index] ?? "";
        if (!token.startsWith("--")) {
            throw new Error(`french-entity-run-unexpected-argument:${token}`);
        }
        const key = token.slice(2);
        if (!valueOptions.has(key) && !flags.has(key)) {
            throw new Error(`french-entity-run-unknown-option:${key}`);
        }
        if (seen.has(key))
            throw new Error(`french-entity-run-duplicate-option:${key}`);
        seen.add(key);
        if (key === "existing-only") {
            existingOnly = true;
            continue;
        }
        const value = args[index + 1];
        if (!value || value.startsWith("--")) {
            throw new Error(`french-entity-run-missing-value:${key}`);
        }
        values.set(key, value);
        index += 1;
    }
    const releaseKey = values.get("release-key")?.trim();
    if (!releaseKey)
        throw new Error("french-entity-run-release-key-required");
    const stage = (values.get("stage") ?? "all");
    if (![
        "proposerA",
        "proposerB",
        "proposers",
        "arbiter",
        "auditor",
        "all"
    ].includes(stage)) {
        throw new Error(`french-entity-run-stage-invalid:${stage}`);
    }
    return {
        manifest: resolve(values.get("manifest") ?? DEFAULT_MANIFEST),
        resultsDir: resolve(values.get("results-dir") ?? DEFAULT_RESULTS),
        releaseKey,
        stage,
        concurrency: positiveInteger(values.get("concurrency"), 3, "concurrency"),
        batchIds: (values.get("batch") ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        offsetBatches: nonNegativeInteger(values.get("offset-batches"), 0, "offset-batches"),
        limitBatches: values.has("limit-batches")
            ? positiveInteger(values.get("limit-batches"), 1, "limit-batches")
            : null,
        codexBinary: resolve(values.get("codex-binary") ?? FRENCH_CODEX_IMMUTABLE_BINARY_PATH),
        codexHome: resolve(values.get("codex-home") ?? DEFAULT_CODEX_HOME),
        timeoutMs: positiveInteger(values.get("timeout-ms"), DEFAULT_TIMEOUT_MS, "timeout-ms"),
        maxAttempts: boundedPositiveInteger(values.get("max-attempts"), FRENCH_ENTITY_AGENT_DEFAULT_MAX_ATTEMPTS, FRENCH_ENTITY_AGENT_MAX_ATTEMPTS_LIMIT, "max-attempts"),
        existingOnly
    };
}
export async function runFrenchEntityAgentsCli(options) {
    const manifestText = readFileSync(options.manifest, "utf8");
    const manifest = JSON.parse(manifestText);
    const planText = readFileSync(manifest.plan.path, "utf8");
    const plan = JSON.parse(planText);
    assertFrenchEntityAgentBatchManifest(manifest, plan, FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS);
    if (manifest.plan.releaseKey !== options.releaseKey ||
        sha256(planText) !== manifest.plan.fileDigest) {
        throw new Error(`french-entity-run-release-or-plan-mismatch:${manifest.plan.releaseKey}:${options.releaseKey}`);
    }
    const batches = selectBatches(manifest, options);
    mkdirSync(options.resultsDir, { recursive: true });
    const releaseLock = acquireExclusiveRoleLock(join(options.resultsDir, "entity-agent-run.lock"));
    const childSupervisor = new FrenchEntityAgentChildSupervisor();
    const removeSignalHandlers = installFrenchEntityAgentSignalCleanup(childSupervisor);
    let executed = 0;
    let reused = 0;
    try {
        ensureFrenchCodexImmutableBinary({ requestedPath: options.codexBinary });
        const runTasks = async (tasks) => {
            await mapConcurrent(tasks, options.concurrency, async (task) => {
                const result = await runRole({
                    options,
                    manifest,
                    manifestText,
                    plan,
                    planText,
                    batch: task.batch,
                    role: task.role,
                    childSupervisor
                });
                if (result.reused)
                    reused += 1;
                else
                    executed += 1;
            });
        };
        if (options.stage === "proposerA" ||
            options.stage === "proposers" ||
            options.stage === "all") {
            await runTasks(batches.map((batch) => ({ batch, role: "proposerA" })));
        }
        if (options.stage === "proposerB" ||
            options.stage === "proposers" ||
            options.stage === "all") {
            await runTasks(batches.map((batch) => ({ batch, role: "proposerB" })));
        }
        if (options.stage === "arbiter" || options.stage === "all") {
            await runTasks(batches.map((batch) => ({ batch, role: "arbiter" })));
        }
        if (options.stage === "auditor" || options.stage === "all") {
            await runTasks(batches.map((batch) => ({ batch, role: "auditor" })));
        }
        const roles = rolesForStage(options.stage);
        const runs = batches.flatMap((batch) => roles
            .map((role) => readExistingRun(options.resultsDir, role, batch.batchId))
            .filter((run) => run !== null));
        assertDistinctThreads(runs);
        const summary = {
            releaseKey: options.releaseKey,
            stage: options.stage,
            batches: batches.length,
            runs: runs.length,
            reused,
            executed,
            distinctThreads: new Set(runs.map((run) => run.threadId)).size
        };
        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
        return summary;
    }
    finally {
        try {
            await childSupervisor.terminateAndWait();
        }
        finally {
            removeSignalHandlers();
            releaseLock();
        }
    }
}
async function runRole(input) {
    const finalDir = roleDirectory(input.options.resultsDir, input.role, input.batch.batchId);
    const executionInput = buildFrenchEntityAgentRoleExecutionInput(input);
    if (existsSync(finalDir)) {
        const existing = validateExistingResult(input, finalDir, executionInput);
        return { run: existing, reused: true };
    }
    else if (input.options.existingOnly) {
        throw new Error(`french-entity-run-existing-result-missing:${input.role}:${input.batch.batchId}`);
    }
    const profile = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[input.role];
    const parent = dirname(finalDir);
    mkdirSync(parent, { recursive: true });
    const seenAttemptThreads = new Set();
    const run = await runFrenchEntityAgentAttempts({
        maxAttempts: input.options.maxAttempts,
        label: `${input.role}:${input.batch.batchId}`,
        execute: (attempt) => runRoleAttempt({
            input,
            finalDir,
            executionInput,
            profile,
            attempt,
            seenAttemptThreads
        })
    });
    return { run, reused: false };
}
async function runRoleAttempt(input) {
    const { input: context, finalDir, executionInput } = input;
    const temporary = `${finalDir}.tmp-${process.pid}-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
    mkdirSync(temporary, { recursive: false });
    const paths = {
        sealedInput: join(temporary, "sealed-input.json"),
        prompt: join(temporary, "prompt.txt"),
        outputSchema: join(temporary, "output-schema.json"),
        structuredResponse: join(temporary, "structured-response.json"),
        events: join(temporary, "agent-events.jsonl"),
        stderr: join(temporary, "agent-stderr.log"),
        artifacts: join(temporary, "artifacts.jsonl"),
        runPointer: join(temporary, "run-pointer.json"),
        receipts: join(temporary, "execution-receipts.jsonl"),
        run: join(temporary, "run.json")
    };
    let codexAttemptStarted = false;
    let processResult = null;
    let preserveTemporary = false;
    try {
        writeFileSync(paths.sealedInput, `${executionInput.text.trim()}\n`, "utf8");
        writeFileSync(paths.prompt, executionInput.prompt, "utf8");
        writeFileSync(paths.outputSchema, `${canonicalFrenchEntityJson(executionInput.schema)}\n`, "utf8");
        codexAttemptStarted = true;
        processResult = await executeCodex({
            options: context.options,
            role: context.role,
            profile: input.profile,
            prompt: executionInput.prompt,
            schemaPath: paths.outputSchema,
            responsePath: paths.structuredResponse,
            workingDirectory: temporary,
            childSupervisor: context.childSupervisor
        });
        writeFileSync(paths.events, processResult.stdout, "utf8");
        writeFileSync(paths.stderr, processResult.stderr, "utf8");
        if (input.seenAttemptThreads.has(processResult.threadId)) {
            throw new Error(`french-entity-run-retry-thread-reused:${context.role}:${context.batch.batchId}`);
        }
        input.seenAttemptThreads.add(processResult.threadId);
        for (const dependency of executionInput.dependencies) {
            if (dependency.threadId === processResult.threadId) {
                throw new Error(`french-entity-run-thread-not-independent:${context.role}:${context.batch.batchId}`);
            }
        }
        const artifacts = executionInput.parse(processResult.responseText);
        const artifactsText = `${artifacts
            .map((artifact) => canonicalFrenchEntityJson(artifact))
            .join("\n")}\n`;
        writeFileSync(paths.artifacts, artifactsText, "utf8");
        const executor = ensureFrenchCodexImmutableBinary({
            requestedPath: context.options.codexBinary
        });
        const capabilities = {
            localTools: "disabled",
            networkDataTools: "disabled",
            shell: "disabled",
            eventPolicy: "agent-message-only",
            sealedWorkingDirectory: finalDir,
            disabledFeaturesHash: frenchCodexDisabledFeaturesHash(),
            environmentPolicyHash: frenchCodexEnvironmentPolicyHash()
        };
        const sourceHashes = {
            manifest: sha256(context.manifestText),
            plan: sha256(context.planText),
            sealedInput: sha256(readFileSync(paths.sealedInput)),
            prompt: sha256(readFileSync(paths.prompt)),
            outputSchema: sha256(readFileSync(paths.outputSchema))
        };
        const resultHashes = {
            agentEvents: sha256(readFileSync(paths.events)),
            agentStderr: sha256(readFileSync(paths.stderr)),
            structuredResponse: sha256(readFileSync(paths.structuredResponse)),
            artifacts: sha256(readFileSync(paths.artifacts))
        };
        const unitArtifactHashes = Object.fromEntries(artifacts.map((artifact) => [artifact.unitId, artifactHash(artifact)]));
        const taskName = `${context.manifest.namespace}/${context.role}/${context.batch.batchId}`;
        const runContent = {
            schemaVersion: FRENCH_ENTITY_AGENT_RUN_SCHEMA_VERSION,
            policyVersion: FRENCH_ENTITY_AGENT_RUNNER_POLICY_VERSION,
            entityPolicyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
            executorPolicyVersion: FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
            role: context.role,
            batchId: context.batch.batchId,
            taskName,
            agentId: `codex-agent:${processResult.threadId}`,
            threadId: processResult.threadId,
            model: input.profile.model,
            reasoningEffort: input.profile.reasoningEffort,
            executor,
            capabilities,
            manifestHash: context.manifest.manifestHash,
            planHash: context.plan.planHash,
            releaseKey: context.plan.sourceLineage.releaseKey,
            releaseSnapshotFingerprint: context.plan.sourceLineage.releaseSnapshotFingerprint,
            batchHash: context.batch.batchHash,
            inputHash: executionInput.logicalHash,
            promptHash: hashFrenchEntityJson(executionInput.prompt),
            outputSchemaHash: hashFrenchEntityJson(executionInput.schema),
            sourceHashes,
            resultHashes,
            unitArtifactHashes,
            startedAt: processResult.startedAt,
            completedAt: processResult.completedAt,
            usage: processResult.usage
        };
        const run = {
            ...runContent,
            runHash: hashFrenchEntityJson(runContent)
        };
        writeFileSync(paths.runPointer, `${canonicalFrenchEntityJson({
            schemaVersion: "lexicon-v3-french-entity-agent-run-pointer@1",
            role: context.role,
            batchId: context.batch.batchId,
            manifestHash: context.manifest.manifestHash,
            runHash: run.runHash
        })}\n`, "utf8");
        const finalPaths = Object.fromEntries(Object.entries(paths).map(([key, path]) => [
            key,
            join(finalDir, basename(path))
        ]));
        const receipts = buildReceipts({
            input: context,
            executionInput,
            run,
            artifacts,
            temporaryPaths: paths,
            finalPaths
        });
        writeFileSync(paths.receipts, `${receipts.map((receipt) => canonicalFrenchEntityJson(receipt)).join("\n")}\n`, "utf8");
        writeFileSync(paths.run, `${canonicalFrenchEntityJson(run)}\n`, "utf8");
        validateTemporaryResult(context, temporary, run);
        renameSync(temporary, finalDir);
        return run;
    }
    catch (error) {
        if (!codexAttemptStarted) {
            throw error;
        }
        const nonRetryable = isNonRetryableAgentAttemptError(error);
        materializeFailedProcessEvidence(paths, error);
        let quarantineDirectory = null;
        preserveTemporary = true;
        try {
            quarantineDirectory = quarantineFrenchEntityAgentAttemptFailure({
                resultsDir: context.options.resultsDir,
                temporaryDirectory: temporary,
                role: context.role,
                batchId: context.batch.batchId,
                attempt: input.attempt,
                manifestHash: context.manifest.manifestHash,
                planHash: context.plan.planHash,
                batchHash: context.batch.batchHash,
                inputHash: executionInput.logicalHash,
                promptHash: hashFrenchEntityJson(executionInput.prompt),
                threadId: processResult?.threadId ?? null,
                error
            });
            preserveTemporary = false;
        }
        catch (quarantineError) {
            if (error instanceof Error) {
                Object.defineProperty(error, "quarantineFailure", {
                    value: quarantineError,
                    enumerable: false
                });
            }
        }
        if (nonRetryable)
            throw error;
        throw new FrenchEntityAgentRetryableAttemptError(error, quarantineDirectory);
    }
    finally {
        if (!preserveTemporary && existsSync(temporary)) {
            rmSync(temporary, { recursive: true, force: true });
        }
    }
}
export function buildFrenchEntityAgentRoleExecutionInput(input) {
    if (input.role === "proposerA" || input.role === "proposerB") {
        const { artifact, text } = loadProposerInputArtifact(input, input.role);
        const outputContracts = artifact.views.map((view) => {
            const unboundNameEntryKeys = frenchEntityAgentUnboundNameEntryKeys(view);
            return {
                role: input.role,
                unitId: view.unitId,
                inputHash: view.viewHash,
                ownerEntityIds: [...view.ownerEntityIds],
                reviewEntryKeys: [...view.reviewUnit.reviewEntryKeys],
                ...(unboundNameEntryKeys.length > 0 ? { unboundNameEntryKeys } : {})
            };
        });
        const schema = frenchEntityAgentProposalResponseSchema(input.role, outputContracts);
        return {
            text,
            logicalHash: artifact.inputHash,
            unitInputHashes: new Map(artifact.views.map((view) => [view.unitId, view.viewHash])),
            schema,
            prompt: proposerPrompt(input.role, artifact, outputContracts),
            parse: (response) => parseFrenchEntityAgentProposalResponse({
                text: response,
                role: input.role,
                artifact,
                plan: input.plan,
                owners: input.manifest.owners
            }),
            dependencies: []
        };
    }
    const proposalA = loadArtifacts(input.options.resultsDir, "proposerA", input.batch, input);
    const proposalB = loadArtifacts(input.options.resultsDir, "proposerB", input.batch, input);
    const runA = requiredExistingRun(input.options.resultsDir, "proposerA", input.batch.batchId);
    const runB = requiredExistingRun(input.options.resultsDir, "proposerB", input.batch.batchId);
    if (runA.threadId === runB.threadId) {
        throw new Error(`french-entity-run-proposer-thread-collision:${input.batch.batchId}`);
    }
    const proposalAByUnit = new Map(proposalA.map((value) => [value.unitId, value]));
    const proposalBByUnit = new Map(proposalB.map((value) => [value.unitId, value]));
    const sourceArtifact = selectFrenchEntityAgentReviewSourceArtifact(loadProposerInputArtifact(input, "proposerA").artifact, loadProposerInputArtifact(input, "proposerB").artifact);
    const sourceViewByUnit = new Map(sourceArtifact.views.map((view) => [view.unitId, view]));
    if (input.role === "arbiter") {
        const records = input.batch.unitIds.map((unitId) => {
            const content = {
                unitId,
                sourceView: requiredMap(sourceViewByUnit, unitId),
                proposalA: requiredMap(proposalAByUnit, unitId),
                proposalB: requiredMap(proposalBByUnit, unitId)
            };
            return {
                ...content,
                viewHash: frenchEntityAgentArbiterUnitInputHash(content)
            };
        });
        const content = {
            schemaVersion: FRENCH_ENTITY_AGENT_ARBITER_INPUT_SCHEMA_VERSION,
            policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
            planHash: input.plan.planHash,
            releaseKey: input.plan.sourceLineage.releaseKey,
            batchId: input.batch.batchId,
            records
        };
        const logicalHash = hashFrenchEntityJson(content);
        const text = `${canonicalFrenchEntityJson({ ...content, inputHash: logicalHash })}\n`;
        const unitInputHashes = new Map(records.map((record) => [record.unitId, record.viewHash]));
        const outputContracts = records.map((record) => ({
            unitId: record.unitId,
            inputHash: record.viewHash,
            proposalAHash: record.proposalA.proposalHash,
            proposalBHash: record.proposalB.proposalHash
        }));
        return {
            text,
            logicalHash,
            unitInputHashes,
            schema: frenchEntityAgentArbitrationResponseSchema(outputContracts),
            prompt: arbiterPrompt(text, input.batch, outputContracts),
            parse: (response) => parseFrenchEntityAgentArbitrationResponse({
                text: response,
                unitIds: input.batch.unitIds,
                inputHashes: unitInputHashes,
                proposalA: proposalAByUnit,
                proposalB: proposalBByUnit
            }),
            dependencies: [runA, runB]
        };
    }
    const arbitrations = loadArtifacts(input.options.resultsDir, "arbiter", input.batch, input);
    const arbiterRun = requiredExistingRun(input.options.resultsDir, "arbiter", input.batch.batchId);
    const arbitrationByUnit = new Map(arbitrations.map((value) => [value.unitId, value]));
    const records = input.batch.unitIds.map((unitId) => {
        const arbitration = requiredMap(arbitrationByUnit, unitId);
        if (arbitration.selectedProposal !== "proposalA" &&
            arbitration.selectedProposal !== "proposalB") {
            throw new Error(`french-entity-run-arbitration-selection-invalid:${unitId}`);
        }
        const selectedProposal = arbitration.selectedProposal === "proposalA"
            ? requiredMap(proposalAByUnit, unitId)
            : requiredMap(proposalBByUnit, unitId);
        const content = {
            unitId,
            sourceView: requiredMap(sourceViewByUnit, unitId),
            arbitration,
            selectedProposal
        };
        return {
            ...content,
            viewHash: frenchEntityAgentAuditorUnitInputHash(content)
        };
    });
    const content = {
        schemaVersion: FRENCH_ENTITY_AGENT_AUDITOR_INPUT_SCHEMA_VERSION,
        policyVersion: FRENCH_ENTITY_AGENT_POLICY_VERSION,
        planHash: input.plan.planHash,
        releaseKey: input.plan.sourceLineage.releaseKey,
        batchId: input.batch.batchId,
        records
    };
    const logicalHash = hashFrenchEntityJson(content);
    const text = `${canonicalFrenchEntityJson({ ...content, inputHash: logicalHash })}\n`;
    const unitInputHashes = new Map(records.map((record) => [record.unitId, record.viewHash]));
    const outputContracts = records.map((record) => ({
        unitId: record.unitId,
        inputHash: record.viewHash,
        auditedProposalHash: record.selectedProposal.proposalHash,
        selectedProposalRole: record.selectedProposal.role,
        evidenceConflictCodes: frenchEntityAgentEvidenceConflictCodes({
            sourceView: record.sourceView,
            selectedProposal: record.selectedProposal
        })
    }));
    const selectedProposalRoles = new Map(records.map((record) => [record.unitId, record.selectedProposal.role]));
    return {
        text,
        logicalHash,
        unitInputHashes,
        schema: frenchEntityAgentAuditResponseSchema(outputContracts),
        prompt: auditorPrompt(text, input.batch, outputContracts),
        parse: (response) => parseFrenchEntityAgentAuditResponse({
            text: response,
            unitIds: input.batch.unitIds,
            inputHashes: unitInputHashes,
            arbitrations: arbitrationByUnit,
            selectedProposalRoles,
            sourceViews: sourceViewByUnit,
            selectedProposals: new Map(records.map((record) => [record.unitId, record.selectedProposal]))
        }),
        dependencies: [runA, runB, arbiterRun]
    };
}
/**
 * Arbitration and audit must see the controlled French witness view. Only
 * proposer A remains blind; using its view here silently discards the local
 * concordance evidence and can make a weaker spelling look safe.
 */
export function selectFrenchEntityAgentReviewSourceArtifact(proposerA, proposerB) {
    if (proposerA.role !== "proposerA" ||
        proposerB.role !== "proposerB" ||
        proposerA.planHash !== proposerB.planHash ||
        proposerA.releaseKey !== proposerB.releaseKey ||
        proposerA.releaseSnapshotFingerprint !==
            proposerB.releaseSnapshotFingerprint ||
        canonicalFrenchEntityJson(proposerA.unitIds) !==
            canonicalFrenchEntityJson(proposerB.unitIds)) {
        throw new Error("french-entity-run-review-source-view-mismatch");
    }
    return proposerB;
}
function loadProposerInputArtifact(input, role) {
    const proof = role === "proposerA" ? input.batch.proposerA : input.batch.proposerB;
    const path = resolve(dirname(input.options.manifest), proof.relativePath);
    const text = readFileSync(path, "utf8");
    if (sha256(text) !== proof.sha256) {
        throw new Error(`french-entity-run-proposer-input-drift:${input.batch.batchId}:${role}`);
    }
    const artifact = JSON.parse(text);
    assertFrenchEntityAgentInputArtifact(artifact, role, input.batch, input.plan);
    return { artifact, text };
}
function proposerPrompt(role, artifact, outputContracts) {
    const evidenceRule = role === "proposerA"
        ? "Tu es aveugle à tout français historique. N'invente aucune information absente de la vue."
        : "Les frenchWitnesses sont des témoins non autoritaires : challenge-les et ne les utilise jamais comme seule preuve. Les concordanceForms conservent surface, fréquence, familles de témoins et sources; distingue strictement nom, variante et gentilé.";
    const hasUnboundNames = artifact.views.some(isFrenchEntityAgentUnboundNameView);
    const hasMixedCanonicalNames = artifact.views.some(isFrenchEntityAgentMixedCanonicalView);
    const hasUnboundAlternateNames = artifact.views.some((view) => frenchEntityAgentUnboundAlternateNameEntryKeys(view).length > 0);
    const structuralExceptions = [
        ...(hasUnboundNames
            ? [
                "- Exception scellée pour les seuls unboundNameEntryKeys du contrat : l'absence d'entité TIPNR ne transforme jamais automatiquement un nom en gloss commun. Pour un vrai nom de personne ou de lieu sans entité, utilise treatment=unregistered-proper-name, constraint=proper-name-without-entity, entityBindings=[], primaryFr=null, derivedFr=lemme français et englishForms=[englishGloss exact]. Pour un gentilé, titre ou nom composé sans entité, conserve respectivement treatment=gentilic, title-or-epithet ou compound-name avec entityBindings=[] et constraint=derived. Seul un sens réellement lexical peut utiliser etymological-or-common-gloss. Les entrées LXX G:N-PRI doivent rester une de ces formes nominales sans liaison et ne peuvent jamais devenir un gloss commun."
            ]
            : []),
        ...(hasUnboundAlternateNames
            ? [
                "- Exception scellée supplémentaire pour une entrée sans entité dont dStrong porte exactement 'a Spelling of' : conserve cette sémantique avec treatment=alternate-name, constraint=derived, entityBindings=[] et englishForms=[englishGloss exact]; ne la dégrade ni en gloss commun ni en nom propre autonome."
            ]
            : []),
        ...(hasMixedCanonicalNames
            ? [
                "- Exception scellée pour toute entrée multi-entités : toute politique nominale doit couvrir exactement tous les entityIds du membre, sans omission ni ajout. Pour canonical-name, s'il existe exactement un englishEntityMatch significance=Named dont entityEn ou aliasEn égale exactement englishGloss, ce match est obligatoirement le binding primary; sinon le primary doit appartenir aux ownerEntityIds. Chaque autre entityId est compound lorsque son match porte significance=NameCombined, alias sinon. Cette règle vaut aussi lorsque ownerEntityIds=[] : le match Named exact reste alors la preuve primaire. Pour un autre treatment, fournis tous les entityIds; le code normalisera leur relation selon le treatment."
            ]
            : [])
    ].join("\n");
    return `Tu es ${role}, spécialiste des noms bibliques et du français éditorial.

PROTOCOLE SCELLÉ :
- Aucun outil, shell, réseau, fichier, plugin, application ou sous-agent.
- Utilise uniquement sealed_input_json ci-dessous.
- ${evidenceRule}
- Chaque ownerEntityId reçoit exactement un primaryFr naturel et stable.
- Chaque primaryFr et derivedFr est un lemme éditorial français au singulier, jamais une forme de citation plurielle. Si la preuve ne permet pas de singulariser proprement un gentilé attesté au pluriel, ne fabrique pas de forme.
- Chaque reviewEntryKey reçoit exactement une politique résolue; unresolved et blocked sont interdits.
- canonicalEntities contient exactement les ownerEntityIds du contrat de l'unité; si ownerEntityIds=[], canonicalEntities doit être [].
- memberPolicies contient exactement les reviewEntryKeys du contrat de l'unité, une seule fois chacun.
- treatment porte la décision; le code dérive ensuite constraint et les relations. Pour canonical-name, renseigne primaryFr et derivedFr=null. Pour tous les autres traitements, renseigne derivedFr et primaryFr=null.
- allowedFrenchForms doit contenir exactement une valeur : la forme choisie dans primaryFr ou derivedFr. Pour etymological-or-common-gloss, englishForms=[] et constraint=lexical-translation.
- Ne recopie aucune variante historique, orthographique ou flexionnelle dans allowedFrenchForms. Les flexions grammaticales autorisées sont calculées localement après validation ; les autres graphies témoins restent uniquement dans frenchWitnesses.
- Le contrat par unité ci-dessous est impératif : recopie exactement son role, son unitId et son inputHash.
- Pour une proposition, inputHash est toujours le viewHash de l'unité correspondante.
- Le inputHash global du lot (${artifact.inputHash}) est réservé au scellement du lot : il est absolument interdit dans proposals[].inputHash.
- Les relations primary, alias, gentilic, title, compound et etymological doivent rester explicites.
- Ne rabats jamais plusieurs dStrong/sous-STEP sur un même gloss : chaque reviewEntryKey conserve son sens exact.
- Pour un gentilé, utilise les formes de concordance explicites et la morphologie; le simple passage d'un pluriel attesté au singulier est permis, mais n'invente jamais un gentilé par suffixation automatique du nom-parent.
- Un gloss commun ou étymologique utilise treatment=etymological-or-common-gloss, constraint=lexical-translation et englishForms=[]; il ne devient jamais un nom.
${structuralExceptions ? `${structuralExceptions}\n` : ""}- Si mustRemainNonEntity=true, toute proposition de nom est interdite.
- Recopie exactement entryKey, entityId, hashes de preuve et suffixes STEP; ne calcule aucun hash.
- primaryFr/derivedFr sont des lemmes singuliers en français soigné; allowedFrenchForms ne contient que ce lemme brut. Les raisons sont brèves.
- Réponds uniquement avec l'objet JSON imposé, sans Markdown.

<per_unit_output_contract>
${canonicalFrenchEntityJson(outputContracts)}
</per_unit_output_contract>

<sealed_input_json>
${canonicalFrenchEntityJson(artifact)}
</sealed_input_json>`;
}
function arbiterPrompt(text, batch, outputContracts) {
    return `Tu es l'arbitre indépendant de ${batch.unitIds.length} unités de noms bibliques.

PROTOCOLE SCELLÉ :
- Aucun outil, shell, réseau, fichier, plugin, application ou sous-agent.
- Pour chaque unité, choisis proposalA ou proposalB seulement.
- Interdiction absolue de fusionner, corriger, synthétiser ou réécrire les propositions.
- Pour chaque unité, recopie exactement unitId et inputHash depuis per_unit_output_contract; aucun hash global du lot n'est valide à leur place.
- selectedProposalHash doit être le hash exact associé au selectedProposal choisi dans ce même contrat.
- Privilégie précision biblique, français naturel, cohérence de groupe et relations explicites.
- Les frenchWitnesses de sourceView sont des témoins contrôlés, non des autorités. Compare familles, fréquences, morphologie et distinction nom/gentilé; ne dérive pas automatiquement un gentilé et ne fusionne aucun sous-STEP.
- Réponds uniquement avec le JSON imposé.

<per_unit_output_contract>
${canonicalFrenchEntityJson(outputContracts)}
</per_unit_output_contract>

<sealed_input_json>
${text.trim()}
</sealed_input_json>`;
}
function auditorPrompt(text, batch, outputContracts) {
    return `Tu es l'auditeur adversarial indépendant de ${batch.unitIds.length} unités.

PROTOCOLE SCELLÉ :
- Aucun outil, shell, réseau, fichier, plugin, application ou sous-agent.
- Tu n'as pas le droit de proposer ou réécrire une solution.
- Audite strictement la proposition sélectionnée : identité STEP, parent anglais, primaryFr, relations, lemme éditorial singulier, naturalité française, preuves et non-autorité des témoins historiques.
- sourceView contient les témoins français contrôlés vus par proposerB. Vérifie leur convergence sans les traiter comme autorité et sans fusionner les sous-STEP; un gentilé doit être attesté ou linguistiquement justifié, jamais suffixé mécaniquement.
- Une graphie témoin concurrente dans allowedFrenchForms est une contamination normative; seules la forme primaryFr/derivedFr et ses flexions grammaticales dérivées localement sont admissibles.
- singularEditorialLemma=pass exige que chaque primaryFr/derivedFr soit une forme de dictionnaire réellement singulière, y compris pour les gentilés; une forme source plurielle doit avoir été singularisée avec une justification linguistique. Au moindre doute, rends hold.
- Vérifie spécialement qu'aucun gloss commun ou étymologique n'est forcé comme nom.
- Le code a déjà prouvé exactStepIdentity, exactEnglishLineage et explicitMemberRelations : ces trois checks sont obligatoirement pass.
- Seuls reviewEntryKeys sont soumis à une politique. Les autres memberEntryKeys sont du contexte de groupe et leur absence de memberPolicies n'est jamais une omission.
- Même si selectedProposalRole=proposerA, l'arbitre a vu les témoins contrôlés : historicalWitnessNotSoleAuthority doit donc vérifier que son choix n'est pas fondé sur eux seuls.
- Les concordances sont rattachées au Strong classique : elles attestent une graphie française, jamais à elles seules le rattachement exact d'un sous-STEP ambigu à une entité.
- Chaque evidenceConflictCode du contrat est une contradiction calculée localement. S'il y en a au moins un, canonicalPrimaryCoherence doit être fail et le verdict doit être hold ou block; il est interdit de déclarer safe. Une assertion d'« attestation exacte », de convergence ou de tradition doit être directement visible dans les témoins scellés.
- safe exige les huit checks=pass et reasons=[]; toute incertitude donne hold, toute violation nette block.
- Pour chaque unité, unitId, inputHash et auditedProposalHash sont recopiés exactement depuis per_unit_output_contract; aucun hash global du lot n'est valide à leur place.
- Réponds uniquement avec le JSON imposé.

<per_unit_output_contract>
${canonicalFrenchEntityJson(outputContracts)}
</per_unit_output_contract>

<sealed_input_json>
${text.trim()}
</sealed_input_json>`;
}
async function executeCodex(input) {
    input.childSupervisor.assertRunning();
    const startedAt = new Date().toISOString();
    const snapshot = prepareFrenchCodexImmutableExecution(input.options.codexBinary);
    const args = frenchCodexProposerExecArgs({
        model: input.profile.model,
        reasoningEffort: input.profile.reasoningEffort,
        schemaPath: input.schemaPath,
        responsePath: input.responsePath,
        cwd: input.workingDirectory
    });
    let child;
    try {
        child = spawn(snapshot.executionPath, args, {
            cwd: input.workingDirectory,
            env: buildSealedFrenchCodexProposerEnvironment(input.options.codexHome),
            stdio: ["pipe", "pipe", "pipe"],
            detached: process.platform !== "win32"
        });
        input.childSupervisor.track(child);
    }
    catch (error) {
        snapshot.dispose();
        throw error;
    }
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.stdin.end(input.prompt);
    let timedOut = false;
    let exitCode = -1;
    let executionError = null;
    let snapshotError = null;
    try {
        exitCode = await new Promise((resolveExit, reject) => {
            let killTimer;
            const timeout = setTimeout(() => {
                timedOut = true;
                signalChild(child.pid, "SIGTERM");
                killTimer = setTimeout(() => signalChild(child.pid, "SIGKILL"), 2_000);
            }, input.options.timeoutMs);
            child.on("error", (error) => {
                clearTimeout(timeout);
                if (killTimer)
                    clearTimeout(killTimer);
                reject(error);
            });
            child.on("close", (code) => {
                clearTimeout(timeout);
                if (killTimer)
                    clearTimeout(killTimer);
                resolveExit(code ?? -1);
            });
        });
    }
    catch (error) {
        executionError = error;
    }
    finally {
        try {
            snapshot.assertUnchanged();
        }
        catch (error) {
            snapshotError = error;
        }
        finally {
            snapshot.dispose();
        }
    }
    const completedAt = new Date().toISOString();
    input.childSupervisor.assertRunning();
    const responseText = existsSync(input.responsePath)
        ? readFileSync(input.responsePath, "utf8")
        : "";
    const failedProcess = {
        stdout,
        stderr,
        responseText,
        startedAt,
        completedAt
    };
    if (snapshotError !== null) {
        throw new FrenchEntityAgentProcessExecutionError(errorMessage(snapshotError), failedProcess);
    }
    if (executionError !== null) {
        throw new FrenchEntityAgentProcessExecutionError(`french-entity-run-process-error:${input.role}:${errorMessage(executionError)}`, failedProcess);
    }
    if (timedOut || exitCode !== 0 || !existsSync(input.responsePath)) {
        throw new FrenchEntityAgentProcessExecutionError(timedOut
            ? `french-entity-run-timeout:${input.role}:${input.options.timeoutMs}`
            : `french-entity-run-process-failed:${input.role}:${exitCode}`, failedProcess);
    }
    let events;
    try {
        events = parseFrenchCodexAgentEvents(stdout, responseText);
    }
    catch (error) {
        throw new FrenchEntityAgentProcessExecutionError(`french-entity-run-event-parse-failed:${input.role}:${errorMessage(error)}`, failedProcess);
    }
    return {
        threadId: events.threadId,
        stdout,
        stderr,
        responseText,
        usage: events.usage,
        startedAt,
        completedAt
    };
}
export function quarantineFrenchEntityAgentAttemptFailure(input) {
    assertMaxAttempts(input.attempt);
    for (const [label, hash] of Object.entries({
        manifest: input.manifestHash,
        plan: input.planHash,
        batch: input.batchHash,
        input: input.inputHash,
        prompt: input.promptHash
    })) {
        if (!SHA256_PATTERN.test(hash)) {
            throw new Error(`french-entity-run-quarantine-hash-invalid:${label}`);
        }
    }
    const paths = {
        sealedInput: join(input.temporaryDirectory, "sealed-input.json"),
        prompt: join(input.temporaryDirectory, "prompt.txt"),
        outputSchema: join(input.temporaryDirectory, "output-schema.json"),
        structuredResponse: join(input.temporaryDirectory, "structured-response.json"),
        agentEvents: join(input.temporaryDirectory, "agent-events.jsonl"),
        agentStderr: join(input.temporaryDirectory, "agent-stderr.log")
    };
    for (const [label, path] of Object.entries(paths)) {
        if (!existsSync(path)) {
            throw new Error(`french-entity-run-quarantine-file-missing:${label}`);
        }
    }
    const rawError = {
        name: input.error instanceof Error ? input.error.name : "NonErrorFailure",
        message: errorMessage(input.error),
        stack: input.error instanceof Error ? (input.error.stack ?? "") : ""
    };
    const errorRecord = {
        ...rawError,
        errorHash: hashFrenchEntityJson(rawError)
    };
    const fileHashes = {
        sealedInput: sha256(readFileSync(paths.sealedInput)),
        prompt: sha256(readFileSync(paths.prompt)),
        outputSchema: sha256(readFileSync(paths.outputSchema)),
        structuredResponse: sha256(readFileSync(paths.structuredResponse)),
        agentEvents: sha256(readFileSync(paths.agentEvents)),
        agentStderr: sha256(readFileSync(paths.agentStderr))
    };
    const failureContent = {
        role: input.role,
        batchId: input.batchId,
        attempt: input.attempt,
        threadId: input.threadId,
        manifestHash: input.manifestHash,
        planHash: input.planHash,
        batchHash: input.batchHash,
        inputHash: input.inputHash,
        promptHash: input.promptHash,
        error: errorRecord,
        fileHashes
    };
    const failureHash = hashFrenchEntityJson(failureContent);
    const quarantinedAt = new Date().toISOString();
    const content = {
        schemaVersion: FRENCH_ENTITY_AGENT_PARSE_QUARANTINE_SCHEMA_VERSION,
        policyVersion: FRENCH_ENTITY_AGENT_RUNNER_POLICY_VERSION,
        status: "quarantined-non-reusable-non-attestable",
        reusable: false,
        attestable: false,
        ...failureContent,
        failureHash,
        quarantinedAt
    };
    const record = {
        ...content,
        quarantineHash: hashFrenchEntityJson(content)
    };
    writeFileSync(join(input.temporaryDirectory, "quarantine.json"), `${canonicalFrenchEntityJson(record)}\n`, "utf8");
    const quarantineRoot = join(resolve(input.resultsDir), "quarantine", input.role, input.batchId);
    mkdirSync(quarantineRoot, { recursive: true });
    let quarantineDirectory;
    do {
        quarantineDirectory = join(quarantineRoot, `${failureHash}-${randomBytes(8).toString("hex")}`);
    } while (existsSync(quarantineDirectory));
    renameSync(input.temporaryDirectory, quarantineDirectory);
    return quarantineDirectory;
}
function materializeFailedProcessEvidence(paths, error) {
    if (error instanceof FrenchEntityAgentProcessExecutionError) {
        writeFileSync(paths.events, error.processExecution.stdout, "utf8");
        writeFileSync(paths.stderr, error.processExecution.stderr, "utf8");
        if (!existsSync(paths.structuredResponse)) {
            writeFileSync(paths.structuredResponse, error.processExecution.responseText, "utf8");
        }
    }
    for (const path of [paths.structuredResponse, paths.events, paths.stderr]) {
        if (!existsSync(path))
            writeFileSync(path, "", "utf8");
    }
}
function buildReceipts(input) {
    const unitById = new Map(input.input.plan.reviewUnits.map((unit) => [unit.unitId, unit]));
    return input.artifacts.map((artifact) => {
        const unit = requiredMap(unitById, artifact.unitId);
        const sourcePaths = {
            manifest: resolve(input.input.options.manifest),
            plan: resolve(input.input.manifest.plan.path),
            sealedInput: input.finalPaths.sealedInput,
            prompt: input.finalPaths.prompt,
            outputSchema: input.finalPaths.outputSchema,
            runPointer: input.finalPaths.runPointer
        };
        const resultPaths = {
            agentEvents: input.finalPaths.events,
            agentStderr: input.finalPaths.stderr,
            structuredResponse: input.finalPaths.structuredResponse,
            artifacts: input.finalPaths.artifacts
        };
        const receipt = finalizeFrenchCodexExecutionReceipt({
            schemaVersion: FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
            role: input.input.role,
            entryKey: artifact.unitId,
            batchId: input.input.batch.batchId,
            namespace: input.input.manifest.namespace,
            manifestHash: input.input.manifest.manifestHash,
            selectionHash: unit.unitHash,
            inputHash: requiredMap(input.executionInput.unitInputHashes, artifact.unitId),
            artifactHash: artifactHash(artifact),
            agentId: input.run.agentId,
            taskName: input.run.taskName,
            threadId: input.run.threadId,
            model: input.run.model,
            reasoningEffort: input.run.reasoningEffort,
            executorPolicyVersion: input.run.executorPolicyVersion,
            executor: input.run.executor,
            capabilities: input.run.capabilities,
            sourcePaths,
            sourceHashes: {
                manifest: sha256(readFileSync(sourcePaths.manifest)),
                plan: sha256(readFileSync(sourcePaths.plan)),
                sealedInput: sha256(readFileSync(input.temporaryPaths.sealedInput)),
                prompt: sha256(readFileSync(input.temporaryPaths.prompt)),
                outputSchema: sha256(readFileSync(input.temporaryPaths.outputSchema)),
                runPointer: sha256(readFileSync(input.temporaryPaths.runPointer))
            },
            resultPaths,
            resultHashes: {
                agentEvents: sha256(readFileSync(input.temporaryPaths.events)),
                agentStderr: sha256(readFileSync(input.temporaryPaths.stderr)),
                structuredResponse: sha256(readFileSync(input.temporaryPaths.structuredResponse)),
                artifacts: sha256(readFileSync(input.temporaryPaths.artifacts))
            },
            startedAt: input.run.startedAt,
            completedAt: input.run.completedAt,
            runHash: input.run.runHash
        });
        assertFrenchCodexExecutionReceipt(receipt, {
            expectedRole: input.input.role
        });
        return receipt;
    });
}
function validateExistingResult(input, directory, expectedExecution) {
    const run = requiredExistingRun(input.options.resultsDir, input.role, input.batch.batchId);
    if (run.manifestHash !== input.manifest.manifestHash ||
        run.planHash !== input.plan.planHash ||
        run.releaseKey !== input.options.releaseKey ||
        run.releaseSnapshotFingerprint !==
            input.plan.sourceLineage.releaseSnapshotFingerprint ||
        run.batchHash !== input.batch.batchHash ||
        (expectedExecution !== undefined &&
            (run.inputHash !== expectedExecution.logicalHash ||
                run.promptHash !== hashFrenchEntityJson(expectedExecution.prompt) ||
                run.outputSchemaHash !==
                    hashFrenchEntityJson(expectedExecution.schema)))) {
        throw new Error(`french-entity-run-existing-release-or-plan-mismatch:${input.role}:${input.batch.batchId}`);
    }
    if (expectedExecution) {
        const expectedFiles = {
            "sealed-input.json": `${expectedExecution.text.trim()}\n`,
            "prompt.txt": expectedExecution.prompt,
            "output-schema.json": `${canonicalFrenchEntityJson(expectedExecution.schema)}\n`
        };
        for (const [file, expectedText] of Object.entries(expectedFiles)) {
            const path = join(directory, file);
            if (!existsSync(path) || readFileSync(path, "utf8") !== expectedText) {
                throw new Error(`french-entity-run-existing-input-drift:${input.role}:${input.batch.batchId}:${file}`);
            }
        }
        if (run.sourceHashes.manifest !== sha256(input.manifestText) ||
            run.sourceHashes.plan !== sha256(input.planText) ||
            run.sourceHashes.sealedInput !==
                sha256(expectedFiles["sealed-input.json"]) ||
            run.sourceHashes.prompt !== sha256(expectedFiles["prompt.txt"]) ||
            run.sourceHashes.outputSchema !==
                sha256(expectedFiles["output-schema.json"])) {
            throw new Error(`french-entity-run-existing-source-binding:${input.role}:${input.batch.batchId}`);
        }
    }
    validateResultFiles(directory, run, input.batch.unitIds, input.role);
    return run;
}
/** Rebuilds and replays one stored role without executing Codex. */
export function replayFrenchEntityAgentStoredRole(input) {
    const executionInput = buildFrenchEntityAgentRoleExecutionInput(input);
    const directory = roleDirectory(input.options.resultsDir, input.role, input.batch.batchId);
    return validateExistingResult(input, directory, executionInput);
}
function validateTemporaryResult(input, directory, run) {
    assertFrenchEntityAgentRun(run);
    validateResultFiles(directory, run, input.batch.unitIds, input.role);
}
function validateResultFiles(directory, run, expectedUnitIds, role) {
    assertFrenchEntityAgentRun(run);
    const storedRun = JSON.parse(readFileSync(join(directory, "run.json"), "utf8"));
    if (canonicalFrenchEntityJson(storedRun) !== canonicalFrenchEntityJson(run)) {
        throw new Error(`french-entity-run-file-drift:${role}:${run.batchId}`);
    }
    const resultFileNames = {
        agentEvents: "agent-events.jsonl",
        agentStderr: "agent-stderr.log",
        structuredResponse: "structured-response.json",
        artifacts: "artifacts.jsonl"
    };
    for (const [key, file] of Object.entries(resultFileNames)) {
        const path = join(directory, file);
        if (!existsSync(path) ||
            sha256(readFileSync(path)) !== run.resultHashes[key]) {
            throw new Error(`french-entity-run-result-drift:${role}:${run.batchId}:${key}`);
        }
    }
    const artifacts = readJsonl(join(directory, "artifacts.jsonl"));
    const receipts = readJsonl(join(directory, "execution-receipts.jsonl"));
    if (artifacts.length !== expectedUnitIds.length ||
        receipts.length !== expectedUnitIds.length) {
        throw new Error(`french-entity-run-result-coverage:${role}:${run.batchId}`);
    }
    const expectedUnits = new Set(expectedUnitIds);
    const artifactByUnit = new Map(artifacts.map((artifact) => [artifact.unitId, artifact]));
    const receiptUnits = new Set(receipts.map((receipt) => receipt.entryKey));
    if (artifactByUnit.size !== expectedUnits.size ||
        receiptUnits.size !== expectedUnits.size ||
        Object.keys(run.unitArtifactHashes).length !== expectedUnits.size ||
        [...expectedUnits].some((unitId) => !artifactByUnit.has(unitId) ||
            !receiptUnits.has(unitId) ||
            !(unitId in run.unitArtifactHashes))) {
        throw new Error(`french-entity-run-result-unit-set:${role}:${run.batchId}`);
    }
    for (const receipt of receipts) {
        assertFrenchCodexExecutionReceipt(receipt, { expectedRole: role });
        const artifact = artifactByUnit.get(receipt.entryKey);
        if (!artifact ||
            receipt.runHash !== run.runHash ||
            receipt.threadId !== run.threadId ||
            receipt.batchId !== run.batchId ||
            receipt.manifestHash !== run.manifestHash ||
            receipt.agentId !== run.agentId ||
            receipt.taskName !== run.taskName ||
            receipt.model !== run.model ||
            receipt.reasoningEffort !== run.reasoningEffort ||
            canonicalFrenchEntityJson(receipt.executor) !==
                canonicalFrenchEntityJson(run.executor) ||
            canonicalFrenchEntityJson(receipt.capabilities) !==
                canonicalFrenchEntityJson(run.capabilities) ||
            run.unitArtifactHashes[receipt.entryKey] !== receipt.artifactHash ||
            receipt.artifactHash !== artifactHash(artifact)) {
            throw new Error(`french-entity-run-receipt-drift:${role}:${run.batchId}`);
        }
        assertReceiptFiles(directory, receipt, run);
    }
}
/** Replays every run, artifact and per-unit receipt hash without executing Codex. */
export function assertFrenchEntityAgentResultDirectory(input) {
    validateResultFiles(resolve(input.directory), input.run, input.expectedUnitIds, input.role);
}
function assertReceiptFiles(directory, receipt, run) {
    for (const [key, declaredPath] of Object.entries(receipt.sourcePaths)) {
        const path = existingReceiptPath(directory, declaredPath);
        const hash = sha256(readFileSync(path));
        if (hash !== receipt.sourceHashes[key]) {
            throw new Error(`french-entity-run-receipt-source-drift:${receipt.role}:${receipt.batchId}:${key}`);
        }
        if (key in run.sourceHashes && hash !== run.sourceHashes[key]) {
            throw new Error(`french-entity-run-receipt-source-run-drift:${receipt.role}:${receipt.batchId}:${key}`);
        }
    }
    for (const [key, declaredPath] of Object.entries(receipt.resultPaths)) {
        const path = existingReceiptPath(directory, declaredPath);
        const hash = sha256(readFileSync(path));
        if (hash !== receipt.resultHashes[key] || hash !== run.resultHashes[key]) {
            throw new Error(`french-entity-run-receipt-result-drift:${receipt.role}:${receipt.batchId}:${key}`);
        }
    }
}
function existingReceiptPath(directory, declaredPath) {
    if (existsSync(declaredPath))
        return declaredPath;
    const stagedPath = join(directory, basename(declaredPath));
    if (existsSync(stagedPath))
        return stagedPath;
    throw new Error(`french-entity-run-receipt-file-missing:${declaredPath}`);
}
function loadArtifacts(resultsDir, role, batch, context) {
    const directory = roleDirectory(resultsDir, role, batch.batchId);
    validateExistingResult({ ...context, batch, role }, directory);
    return readJsonl(join(directory, "artifacts.jsonl"));
}
export function assertFrenchEntityAgentRun(run) {
    const { runHash, ...content } = run;
    const profile = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[run.role];
    if (run.schemaVersion !== FRENCH_ENTITY_AGENT_RUN_SCHEMA_VERSION ||
        run.policyVersion !== FRENCH_ENTITY_AGENT_RUNNER_POLICY_VERSION ||
        run.entityPolicyVersion !== FRENCH_ENTITY_AGENT_POLICY_VERSION ||
        run.executorPolicyVersion !== FRENCH_CODEX_EXECUTOR_POLICY_VERSION ||
        !THREAD_ID_PATTERN.test(run.threadId) ||
        run.agentId !== `codex-agent:${run.threadId}` ||
        run.model !== profile.model ||
        run.reasoningEffort !== profile.reasoningEffort ||
        run.executor.version !==
            FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexVersion ||
        run.executor.sha256 !==
            FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexSha256 ||
        hashFrenchEntityJson(content) !== runHash) {
        throw new Error(`french-entity-run-invalid:${run.role}:${run.batchId}`);
    }
    for (const hash of [
        run.manifestHash,
        run.planHash,
        run.batchHash,
        run.inputHash,
        run.promptHash,
        run.outputSchemaHash,
        run.runHash,
        ...Object.values(run.sourceHashes),
        ...Object.values(run.resultHashes),
        ...Object.values(run.unitArtifactHashes)
    ]) {
        if (!SHA256_PATTERN.test(hash)) {
            throw new Error(`french-entity-run-hash-invalid:${run.role}:${run.batchId}`);
        }
    }
}
function readExistingRun(resultsDir, role, batchId) {
    const path = join(roleDirectory(resultsDir, role, batchId), "run.json");
    if (!existsSync(path))
        return null;
    return JSON.parse(readFileSync(path, "utf8"));
}
function requiredExistingRun(resultsDir, role, batchId) {
    const run = readExistingRun(resultsDir, role, batchId);
    if (!run) {
        throw new Error(`french-entity-run-dependency-missing:${role}:${batchId}`);
    }
    assertFrenchEntityAgentRun(run);
    return run;
}
function selectBatches(manifest, options) {
    let batches = manifest.batches;
    if (options.batchIds.length > 0) {
        const requested = new Set(options.batchIds);
        batches = batches.filter((batch) => requested.has(batch.batchId));
        if (batches.length !== requested.size) {
            throw new Error("french-entity-run-batch-not-found");
        }
    }
    batches = batches.slice(options.offsetBatches);
    if (options.limitBatches !== null) {
        batches = batches.slice(0, options.limitBatches);
    }
    if (batches.length === 0)
        throw new Error("french-entity-run-empty-selection");
    return batches;
}
function rolesForStage(stage) {
    if (stage === "all")
        return ["proposerA", "proposerB", "arbiter", "auditor"];
    if (stage === "proposers")
        return ["proposerA", "proposerB"];
    return [stage];
}
function assertDistinctThreads(runs) {
    const threads = runs.map((run) => run.threadId);
    if (new Set(threads).size !== threads.length) {
        throw new Error("french-entity-run-thread-reuse-detected");
    }
}
function artifactHash(artifact) {
    if ("proposalHash" in artifact)
        return artifact.proposalHash;
    if ("arbitrationHash" in artifact)
        return artifact.arbitrationHash;
    return artifact.auditHash;
}
function roleDirectory(resultsDir, role, batchId) {
    return resolve(resultsDir, role, batchId);
}
function readJsonl(path) {
    return readFileSync(path, "utf8")
        .split(/\r?\n/u)
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
}
export async function mapConcurrent(values, concurrency, worker) {
    let cursor = 0;
    const noFailure = Symbol("no-french-entity-agent-worker-failure");
    let firstFailure = noFailure;
    const run = async () => {
        while (true) {
            if (firstFailure !== noFailure)
                return;
            const index = cursor;
            cursor += 1;
            if (index >= values.length)
                return;
            try {
                await worker(values[index]);
            }
            catch (error) {
                if (firstFailure === noFailure)
                    firstFailure = error;
                throw error;
            }
        }
    };
    await Promise.allSettled(Array.from({ length: Math.min(concurrency, values.length) }, () => run()));
    if (firstFailure !== noFailure)
        throw firstFailure;
}
function signalChild(pid, signal) {
    if (!pid)
        return;
    try {
        process.kill(process.platform === "win32" ? pid : -pid, signal);
    }
    catch (error) {
        if (error.code !== "ESRCH")
            throw error;
    }
}
function positiveInteger(value, fallback, label) {
    const raw = value ?? String(fallback);
    if (!/^[1-9]\d*$/u.test(raw)) {
        throw new Error(`french-entity-run-invalid-${label}:${raw}`);
    }
    return Number(raw);
}
function boundedPositiveInteger(value, fallback, maximum, label) {
    const parsed = positiveInteger(value, fallback, label);
    if (parsed > maximum) {
        throw new Error(`french-entity-run-invalid-${label}:${parsed}:maximum-${maximum}`);
    }
    return parsed;
}
function assertMaxAttempts(value) {
    if (!Number.isInteger(value) ||
        value < 1 ||
        value > FRENCH_ENTITY_AGENT_MAX_ATTEMPTS_LIMIT) {
        throw new Error(`french-entity-run-invalid-max-attempts:${value}`);
    }
}
function nonNegativeInteger(value, fallback, label) {
    const raw = value ?? String(fallback);
    if (!/^\d+$/u.test(raw)) {
        throw new Error(`french-entity-run-invalid-${label}:${raw}`);
    }
    return Number(raw);
}
function requiredMap(map, key) {
    const value = map.get(key);
    if (value === undefined) {
        throw new Error(`french-entity-run-map-missing:${String(key)}`);
    }
    return value;
}
function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function isNonRetryableAgentAttemptError(error) {
    const message = errorMessage(error);
    return (message.startsWith("french-codex-") ||
        message.startsWith("french-entity-run-interrupted:") ||
        message.startsWith("immutable-executable-") ||
        message.includes("source-drift") ||
        message.includes("existing-result-drift"));
}
const invokedPath = process.argv[1]
    ? pathToFileURL(resolve(process.argv[1])).href
    : "";
if (import.meta.url === invokedPath) {
    runFrenchEntityAgentsCli(parseFrenchEntityAgentRunArgs(process.argv.slice(2))).catch((error) => {
        process.stderr.write(`${basename(process.argv[1] ?? "runLexiconV3FrenchEntityAgents")}: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
