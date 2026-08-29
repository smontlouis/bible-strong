import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { finalizeLexiconV3FrenchProposerDrafts } from "./finalizeLexiconV3FrenchProposerDrafts.js";
import { assertFrenchInternalConfigurationMatchesManifest, readFrenchInternalProposerArtifacts } from "./assembleLexiconV3FrenchInternalReview.js";
import { assertFrenchCodexAnyBatchManifest } from "./buildLexiconV3FrenchCodexBatches.js";
import { FRENCH_INTERNAL_PROPOSER_DRAFT_SCHEMA_VERSION, assertFrenchInternalProposerDraft } from "../src/lexiconV3/frenchAgentDrafts.js";
import { FRENCH_INTERNAL_ROLE_PROMPTS, frenchInternalPromptHash } from "../src/lexiconV3/frenchAgentPrompts.js";
import { FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE, hashFrenchInternalJson } from "../src/lexiconV3/frenchInternalReview.js";
import { assertFrenchCodexImmutableBinary, ensureFrenchCodexImmutableBinary, FRENCH_CODEX_IMMUTABLE_BINARY_PATH, prepareFrenchCodexImmutableExecution } from "../src/lexiconV3/frenchCodexImmutableBinary.js";
import { acquireFrenchCodexSqliteLock, FrenchCodexLockBusyError } from "../src/lexiconV3/frenchCodexSqliteLock.js";
import { FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION, FRENCH_INTERNAL_WORK_POLICY_VERSION, assertProposerABlindView, frenchInternalViewHash } from "../src/lexiconV3/frenchInternalWork.js";
import { validateFrenchPacket } from "../src/lexiconV3/frenchPackets.js";
export const FRENCH_CODEX_PROPOSER_RUN_SCHEMA_VERSION = "lexicon-v3-french-codex-proposer-run@2";
export const FRENCH_CODEX_EXECUTOR_POLICY_VERSION = "lexicon-v3-french-codex-executor-policy@3";
const DEFAULT_MANIFEST = "outputs/lexicon-v3/fr-internal/agent-batches/pilot/manifest.json";
const DEFAULT_CONFIGURATION = "outputs/lexicon-v3/fr-internal/configuration.json";
const DEFAULT_CODEX_BINARY = FRENCH_CODEX_IMMUTABLE_BINARY_PATH;
const DEFAULT_CODEX_HOME = "outputs/lexicon-v3/fr-internal/codex-agent-home";
const DEFAULT_MODEL = "gpt-5.6-sol";
const DEFAULT_REASONING_EFFORT = "low";
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_CODEX_VERSION = "codex-cli 0.144.0-alpha.4";
const DEFAULT_CODEX_SHA256 = "e48ce8a0455b97ba25aa6b373f694ad7788f960c4bfc311f68b6d5bf7121f2f4";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const DISABLED_CODEX_FEATURES = [
    "apps",
    "browser_use",
    "browser_use_external",
    "code_mode",
    "code_mode_host",
    "computer_use",
    "goals",
    "hooks",
    "image_generation",
    "in_app_browser",
    "multi_agent",
    "plugins",
    "shell_snapshot",
    "shell_tool",
    "skill_mcp_dependency_install",
    "standalone_web_search",
    "tool_suggest",
    "unified_exec",
    "workspace_dependencies"
];
const SEALED_ENVIRONMENT_KEYS = [
    "CODEX_HOME",
    "HOME",
    "LANG",
    "LC_ALL",
    "LOGNAME",
    "NO_COLOR",
    "PATH",
    "SHELL",
    "TERM",
    "TMPDIR",
    "USER"
];
const SEALED_ENVIRONMENT_POLICY = {
    keys: SEALED_ENVIRONMENT_KEYS,
    fixed: {
        HOME: "<codex-home>",
        CODEX_HOME: "<codex-home>",
        SHELL: "/bin/zsh",
        PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
        TERM: "dumb",
        NO_COLOR: "1"
    },
    inheritedWithSafeFallback: ["USER", "LOGNAME", "TMPDIR"]
};
export function frenchCodexDisabledFeaturesHash() {
    return hashFrenchInternalJson(DISABLED_CODEX_FEATURES);
}
export function frenchCodexEnvironmentPolicyHash() {
    return hashFrenchInternalJson(SEALED_ENVIRONMENT_POLICY);
}
const THREAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
let cachedCodexBinaryIdentity = null;
export async function runLexiconV3FrenchCodexProposerBatch(options) {
    assertOptions(options);
    ensureFrenchCodexImmutableBinary({ requestedPath: options.codexBinary });
    const manifestText = readFileSync(options.manifestPath, "utf8");
    const manifest = JSON.parse(manifestText);
    const manifestContext = assertFrenchCodexAnyBatchManifest(manifest, {
        verifyFiles: !options.manifestPrevalidated,
        expectedEntries: options.expectedEntries
    });
    assertFrenchInternalConfigurationMatchesManifest(manifestContext, options.configurationPath);
    const batch = manifest.batches.find((value) => value.batchId === options.batchId);
    if (!batch)
        throw new Error(`french-codex-batch-not-found:${options.batchId}`);
    assertBatch(batch);
    const paths = rolePaths(batch, options.role);
    const releaseLock = acquireExclusiveRoleLock(paths.lockPath);
    try {
        assertArtifact(paths.inputPath, paths.inputHash, "input");
        assertArtifact(paths.schemaPath, paths.schemaHash, "schema");
        assertArtifact(batch.inputs.packets.path, batch.inputs.packets.sha256, "packets");
        if (!existsSync(options.configurationPath)) {
            throw new Error(`french-codex-configuration-missing:${options.configurationPath}`);
        }
        if (!existsSync(options.codexBinary)) {
            throw new Error(`french-codex-binary-missing:${options.codexBinary}`);
        }
        if (!existsSync(resolve(options.codexHome, "auth.json"))) {
            throw new Error(`french-codex-agent-auth-missing:${options.codexHome}`);
        }
        const views = readViews(paths.inputPath, options.role);
        const packets = readPackets(batch.inputs.packets.path);
        assertInputs(batch, options.role, views, packets);
        const prompt = buildFrenchCodexProposerPrompt(options.role, batch, paths.inputPath);
        const executor = codexBinaryIdentity(options);
        const runPath = resolve(dirname(paths.inputPath), `${paths.prefix}-agent-run.json`);
        if (!options.force && existsSync(runPath)) {
            return assertExistingRun(runPath, options, batch, manifestText, prompt, executor, views, packets, manifestContext);
        }
        if (options.existingOnly) {
            throw new Error(`french-codex-existing-run-missing:${batch.batchId}:${options.role}`);
        }
        const responseTemp = `${paths.responsePath}.tmp-${process.pid}-${Date.now()}`;
        const execution = await executeCodex({
            options,
            prompt,
            schemaPath: paths.schemaPath,
            responsePath: responseTemp
        });
        assertCodexBinaryUnchanged(options, executor);
        let drafts;
        try {
            drafts = parseAndValidateDrafts(execution.responseText, options.role, batch, views, packets);
        }
        catch (error) {
            quarantineRejectedExecution(paths, execution, "invalid-drafts");
            rmSync(responseTemp, { force: true });
            throw error;
        }
        const draftsText = `${drafts.map((draft) => JSON.stringify(draft)).join("\n")}\n`;
        installTextAtomically(paths.responsePath, `${execution.responseText.trim()}\n`);
        installTextAtomically(paths.eventsPath, execution.stdout);
        installTextAtomically(paths.stderrPath, execution.stderr);
        installTextAtomically(paths.draftsPath, draftsText);
        rmSync(responseTemp, { force: true });
        const taskName = frenchCodexProposerTaskName(manifestContext, options.role, batch.batchId);
        const agentId = `codex-agent:${execution.threadId}`;
        const artifactSummary = await finalizeLexiconV3FrenchProposerDrafts({
            role: options.role,
            viewsPath: paths.inputPath,
            draftsPath: paths.draftsPath,
            packetsPath: batch.inputs.packets.path,
            configurationPath: options.configurationPath,
            outputPath: paths.artifactsPath,
            summaryPath: paths.artifactSummaryPath,
            agentId,
            taskName,
            completedAt: execution.completedAt
        });
        const content = {
            schemaVersion: FRENCH_CODEX_PROPOSER_RUN_SCHEMA_VERSION,
            executorPolicyVersion: FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
            batchId: batch.batchId,
            role: options.role,
            taskName,
            agentId,
            threadId: execution.threadId,
            model: options.model,
            reasoningEffort: options.reasoningEffort,
            executor,
            sandbox: "read-only",
            capabilities: {
                localTools: "disabled",
                networkDataTools: "disabled",
                shell: "disabled",
                eventPolicy: "agent-message-only",
                sealedWorkingDirectory: resolve(dirname(paths.inputPath)),
                disabledFeaturesHash: frenchCodexDisabledFeaturesHash(),
                environmentPolicyHash: frenchCodexEnvironmentPolicyHash()
            },
            startedAt: execution.startedAt,
            completedAt: execution.completedAt,
            promptHash: sha256(prompt),
            rolePromptHash: frenchInternalPromptHash(options.role),
            sourceHashes: {
                manifest: sha256(manifestText),
                batch: batch.batchHash,
                input: sha256File(paths.inputPath),
                schema: sha256File(paths.schemaPath),
                packets: sha256File(batch.inputs.packets.path),
                configuration: sha256File(options.configurationPath)
            },
            resultHashes: {
                agentEvents: sha256File(paths.eventsPath),
                agentStderr: sha256File(paths.stderrPath),
                structuredResponse: sha256File(paths.responsePath),
                drafts: sha256File(paths.draftsPath),
                artifacts: sha256File(paths.artifactsPath),
                artifactSummary: sha256File(paths.artifactSummaryPath)
            },
            counts: {
                expected: batch.keys.length,
                drafts: drafts.length,
                artifacts: artifactSummary.counts.artifacts,
                validatorClean: artifactSummary.counts.validatorClean,
                validatorReview: artifactSummary.counts.validatorReview
            },
            usage: execution.usage
        };
        const run = {
            ...content,
            runHash: hashFrenchInternalJson(content)
        };
        installTextAtomically(runPath, `${JSON.stringify(run, null, 2)}\n`);
        return run;
    }
    finally {
        releaseLock();
    }
}
export function buildFrenchCodexProposerPrompt(role, batch, inputPath) {
    const fullViews = readFileSync(inputPath, "utf8")
        .split(/\r?\n/u)
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
    if (fullViews.length !== batch.keys.length) {
        throw new Error("french-codex-agent-prompt-view-cardinality");
    }
    const sharedGuide = fullViews[0]?.guide;
    const sharedGuideHash = fullViews[0]?.guideContentHash;
    if (!sharedGuide ||
        typeof sharedGuideHash !== "string" ||
        fullViews.some((view) => view.guideContentHash !== sharedGuideHash ||
            hashFrenchInternalJson(view.guide) !==
                hashFrenchInternalJson(sharedGuide))) {
        throw new Error("french-codex-agent-shared-guide-mismatch");
    }
    const sealedViews = `${fullViews
        .map((view) => {
        const { guide: _sharedGuide, ...compact } = view;
        void _sharedGuide;
        return JSON.stringify(compact);
    })
        .join("\n")}\n`;
    return `${FRENCH_INTERNAL_ROLE_PROMPTS[role]}

PROTOCOLE D'EXÉCUTION SCELLÉ :
- Tu n'as droit à aucun réseau, aucune recherche et aucune autre source.
- Les ${batch.keys.length} vues ${role} proviennent de ${inputPath}. Leur guide éditorial, strictement identique dans chaque vue logique, est fourni une seule fois dans shared_guide_json pour éviter toute répétition; chaque ligne JSONL contient tous les autres champs de la vue.
- Pour reconstruire une vue logique exacte, combine sa ligne JSONL avec shared_guide_json sous la clé guide. N'utilise que ce contenu scellé.
- Pour chaque ligne, rends exactement un draft avec schemaVersion=${FRENCH_INTERNAL_PROPOSER_DRAFT_SCHEMA_VERSION}, role=${role}, entryKey identique et inputHash égal octet pour octet à viewHash.
- meaningSegmentsFr contient exactement les tokens textuels translatables du htmlTemplate, dans le même ordre, avec le même id. Traduis sourceText sans ajouter de HTML. Ne rends aucun token de balise.
- entityMentionsFr couvre exactement chaque requiredMention de résolution exact avec son mentionId, son segmentId et une chosenFrenchForm autorisée présente dans ce segment; ne rends rien pour non-entity.
- Préserve littéralement tout contenu protégé. Aucun segment ne peut être vide.
- carrierTermsFr contient les termes français réellement porteurs du sens; notesFr reste vide sauf incertitude précise; confidence est prudente et comprise entre 0 et 1.
- Ne modifie aucun fichier. Ta réponse finale est uniquement l'objet JSON demandé par le schéma, sans Markdown ni commentaire.

CLÉS ATTENDUES, DANS CET ORDRE :
${batch.keys.join("\n")}

<shared_guide_json hash="${sharedGuideHash}">
${JSON.stringify(sharedGuide)}
</shared_guide_json>

<sealed_views_jsonl>
${sealedViews}</sealed_views_jsonl>`;
}
async function executeCodex(input) {
    mkdirSync(dirname(input.responsePath), { recursive: true });
    rmSync(input.responsePath, { force: true });
    const startedAt = new Date().toISOString();
    const sealedWorkingDirectory = resolve(dirname(input.schemaPath));
    const args = frenchCodexProposerExecArgs({
        model: input.options.model,
        reasoningEffort: input.options.reasoningEffort,
        schemaPath: input.schemaPath,
        responsePath: input.responsePath,
        cwd: sealedWorkingDirectory
    });
    const executable = prepareFrenchCodexImmutableExecution(input.options.codexBinary);
    let child;
    try {
        child = spawn(executable.executionPath, args, {
            cwd: sealedWorkingDirectory,
            env: buildSealedFrenchCodexProposerEnvironment(input.options.codexHome),
            stdio: ["pipe", "pipe", "pipe"],
            detached: process.platform !== "win32"
        });
    }
    catch (error) {
        executable.dispose();
        throw error;
    }
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
        stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
        stderr += chunk;
    });
    child.stdin.end(input.prompt);
    let timedOut = false;
    let exitCode;
    try {
        exitCode = await new Promise((resolveExit, reject) => {
            let killTimer;
            const timeout = setTimeout(() => {
                timedOut = true;
                signalChildProcessGroup(child.pid, "SIGTERM");
                killTimer = setTimeout(() => signalChildProcessGroup(child.pid, "SIGKILL"), 2_000);
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
    finally {
        try {
            executable.assertUnchanged();
        }
        finally {
            executable.dispose();
        }
    }
    const completedAt = new Date().toISOString();
    if (timedOut || exitCode !== 0 || !existsSync(input.responsePath)) {
        const failureBase = input.responsePath.replace(/\.tmp-[^.]+$/u, "");
        const failureNonce = `${Date.now()}-${process.pid}`;
        installTextAtomically(`${failureBase}.failed-${failureNonce}-events.jsonl`, stdout);
        installTextAtomically(`${failureBase}.failed-${failureNonce}-stderr.log`, stderr);
        throw new Error(timedOut
            ? `french-codex-agent-timeout:${input.options.timeoutMs}`
            : `french-codex-agent-failed:${exitCode}`);
    }
    const responseText = readFileSync(input.responsePath, "utf8");
    let events;
    try {
        events = parseFrenchCodexAgentEvents(stdout, responseText);
    }
    catch (error) {
        const failureBase = input.responsePath.replace(/\.tmp-[^.]+$/u, "");
        const failureNonce = `${Date.now()}-${process.pid}`;
        installTextAtomically(`${failureBase}.rejected-${failureNonce}-events.jsonl`, stdout);
        installTextAtomically(`${failureBase}.rejected-${failureNonce}-stderr.log`, stderr);
        installTextAtomically(`${failureBase}.rejected-${failureNonce}-response.json`, responseText);
        rmSync(input.responsePath, { force: true });
        throw error;
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
export function frenchCodexProposerExecArgs(input) {
    return [
        "exec",
        "--ignore-user-config",
        "--ignore-rules",
        "--ephemeral",
        "-m",
        input.model,
        "-c",
        `model_reasoning_effort=${JSON.stringify(input.reasoningEffort)}`,
        ...DISABLED_CODEX_FEATURES.flatMap((feature) => ["--disable", feature]),
        "--skip-git-repo-check",
        "-s",
        "read-only",
        "--json",
        "--output-schema",
        resolve(input.schemaPath),
        "-o",
        resolve(input.responsePath),
        "-C",
        resolve(input.cwd),
        "-"
    ];
}
export function parseFrenchCodexAgentEvents(stdout, structuredResponse) {
    let threadId = "";
    let usage = null;
    let state = "expect-thread";
    const messages = [];
    for (const [index, line] of stdout.split(/\r?\n/u).entries()) {
        if (!line.trim())
            continue;
        let event;
        try {
            event = JSON.parse(line);
        }
        catch {
            throw new Error(`french-codex-agent-event-invalid-json:${index + 1}`);
        }
        if (event.type === "thread.started") {
            if (state !== "expect-thread" ||
                typeof event.thread_id !== "string" ||
                !THREAD_ID_PATTERN.test(event.thread_id)) {
                throw new Error("french-codex-agent-thread-event-invalid");
            }
            threadId = event.thread_id;
            state = "expect-turn";
            continue;
        }
        if (event.type === "turn.started") {
            if (state !== "expect-turn") {
                throw new Error("french-codex-agent-turn-start-event-invalid");
            }
            state = "expect-message";
            continue;
        }
        if (event.type === "item.completed") {
            if ((state !== "expect-message" && state !== "messages") ||
                !isObject(event.item) ||
                event.item.type !== "agent_message" ||
                typeof event.item.text !== "string") {
                throw new Error("french-codex-agent-item-event-forbidden");
            }
            messages.push(event.item.text);
            state = "messages";
            continue;
        }
        if (event.type === "turn.completed") {
            if (state !== "messages") {
                throw new Error("french-codex-agent-turn-complete-event-invalid");
            }
            if (event.usage !== undefined && !isObject(event.usage)) {
                throw new Error("french-codex-agent-usage-invalid");
            }
            usage = isObject(event.usage) ? event.usage : null;
            state = "complete";
            continue;
        }
        throw new Error(`french-codex-agent-event-forbidden:${String(event.type)}`);
    }
    if (state !== "complete" || !threadId || messages.length < 1) {
        throw new Error("french-codex-agent-event-sequence-incomplete");
    }
    if (normalizeAgentMessage(messages.at(-1) ?? "") !==
        normalizeAgentMessage(structuredResponse)) {
        throw new Error("french-codex-agent-response-message-mismatch");
    }
    return { threadId, usage };
}
function parseAndValidateDrafts(text, role, batch, views, packets) {
    let root;
    try {
        root = JSON.parse(text);
    }
    catch {
        throw new Error("french-codex-agent-response-invalid-json");
    }
    if (!isObject(root) ||
        Object.keys(root).length !== 1 ||
        !Array.isArray(root.drafts)) {
        throw new Error("french-codex-agent-response-invalid-root");
    }
    if (root.drafts.length !== batch.keys.length) {
        throw new Error(`french-codex-agent-draft-cardinality:${root.drafts.length}:${batch.keys.length}`);
    }
    const rawByKey = new Map();
    for (const raw of root.drafts) {
        if (!isObject(raw) || typeof raw.entryKey !== "string") {
            throw new Error("french-codex-agent-draft-key-missing");
        }
        if (rawByKey.has(raw.entryKey)) {
            throw new Error(`french-codex-agent-draft-duplicate:${raw.entryKey}`);
        }
        rawByKey.set(raw.entryKey, raw);
    }
    return batch.keys.map((entryKey) => {
        const view = views.get(entryKey);
        const packet = packets.get(entryKey);
        const raw = rawByKey.get(entryKey);
        if (!raw)
            throw new Error(`french-codex-agent-draft-missing:${entryKey}`);
        return assertFrenchInternalProposerDraft(raw, role, packet, view.viewHash, view.entityConstraints.requiredMentions);
    });
}
export function parseFrenchCodexProposerResponse(input) {
    return parseAndValidateDrafts(input.text, input.role, input.batch, readViews(input.viewsPath, input.role), readPackets(input.packetsPath));
}
function readViews(path, role) {
    const result = new Map();
    const expectedKind = role === "proposerA" ? "proposer_a_blind" : "proposer_b_candidates";
    for (const [index, line] of readFileSync(path, "utf8")
        .split(/\r?\n/u)
        .entries()) {
        if (!line.trim())
            continue;
        const view = JSON.parse(line);
        if (view.schemaVersion !== FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION ||
            view.policyVersion !== FRENCH_INTERNAL_WORK_POLICY_VERSION ||
            view.role !== role ||
            view.viewKind !== expectedKind ||
            !SHA256_PATTERN.test(view.viewHash) ||
            frenchInternalViewHash(view) !== view.viewHash) {
            throw new Error(`french-codex-agent-view-invalid:${index + 1}`);
        }
        if (role === "proposerA") {
            assertProposerABlindView(view);
        }
        if (result.has(view.entryKey)) {
            throw new Error(`french-codex-agent-view-duplicate:${view.entryKey}`);
        }
        result.set(view.entryKey, view);
    }
    return result;
}
function readPackets(path) {
    const result = new Map();
    const stepIds = new Set();
    for (const [index, line] of readFileSync(path, "utf8")
        .split(/\r?\n/u)
        .entries()) {
        if (!line.trim())
            continue;
        const packet = JSON.parse(line);
        const issues = validateFrenchPacket(packet);
        if (issues.length > 0) {
            throw new Error(`french-codex-agent-packet-invalid:${index + 1}:${issues.join(",")}`);
        }
        if (result.has(packet.entryKey) ||
            stepIds.has(packet.identity.stepEntryId)) {
            throw new Error(`french-codex-agent-packet-duplicate:${packet.entryKey}`);
        }
        result.set(packet.entryKey, packet);
        stepIds.add(packet.identity.stepEntryId);
    }
    return result;
}
function assertInputs(batch, role, views, packets) {
    if (views.size !== batch.keys.length || packets.size !== batch.keys.length) {
        throw new Error("french-codex-agent-input-cardinality-mismatch");
    }
    const expectedHashes = role === "proposerA"
        ? batch.proposerAViewHashes
        : batch.proposerBViewHashes;
    for (const [index, entryKey] of batch.keys.entries()) {
        const view = views.get(entryKey);
        const packet = packets.get(entryKey);
        if (!view ||
            !packet ||
            view.viewHash !== expectedHashes[index] ||
            view.lineage.packetHash !== packet.packetHash ||
            view.lineage.englishHash !== packet.english.contentHash) {
            throw new Error(`french-codex-agent-input-lineage-mismatch:${entryKey}`);
        }
    }
}
function assertBatch(batch) {
    const { batchHash, ...content } = batch;
    if (!SHA256_PATTERN.test(batchHash) ||
        hashFrenchInternalJson(content) !== batchHash ||
        batch.keys.length < 1 ||
        batch.proposerAViewHashes.length !== batch.keys.length ||
        batch.proposerBViewHashes.length !== batch.keys.length ||
        new Set(batch.keys).size !== batch.keys.length) {
        throw new Error(`french-codex-agent-batch-invalid:${batch.batchId}`);
    }
}
function rolePaths(batch, role) {
    const isA = role === "proposerA";
    const input = isA ? batch.inputs.proposerA : batch.inputs.proposerB;
    const schema = isA ? batch.schemas.proposerA : batch.schemas.proposerB;
    const prefix = isA ? "proposer-a" : "proposer-b";
    const directory = dirname(input.path);
    return {
        prefix,
        lockPath: resolve(directory, `${prefix}-agent-run.lock`),
        inputPath: input.path,
        inputHash: input.sha256,
        schemaPath: schema.path,
        schemaHash: schema.sha256,
        responsePath: resolve(directory, `${prefix}-structured-response.json`),
        eventsPath: resolve(directory, `${prefix}-agent-events.jsonl`),
        stderrPath: resolve(directory, `${prefix}-agent-stderr.log`),
        draftsPath: resolve(directory, `${prefix}-drafts.jsonl`),
        artifactsPath: resolve(directory, `${prefix}-artifacts.jsonl`),
        artifactSummaryPath: resolve(directory, `${prefix}-artifacts.summary.json`)
    };
}
export function acquireExclusiveRoleLock(path) {
    try {
        return acquireFrenchCodexSqliteLock(path);
    }
    catch (error) {
        if (error instanceof FrenchCodexLockBusyError) {
            throw new Error(`french-codex-role-locked:${path}`);
        }
        throw error;
    }
}
function signalChildProcessGroup(pid, signal) {
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
export function buildSealedFrenchCodexProposerEnvironment(codexHome) {
    const home = resolve(codexHome);
    const user = process.env.USER?.trim() || "codex-agent";
    return {
        HOME: home,
        CODEX_HOME: home,
        USER: user,
        LOGNAME: process.env.LOGNAME?.trim() || user,
        SHELL: "/bin/zsh",
        PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
        TMPDIR: process.env.TMPDIR?.trim() || "/tmp",
        TERM: "dumb",
        NO_COLOR: "1"
    };
}
function codexBinaryIdentity(options) {
    const path = resolve(options.codexBinary);
    const identity = assertFrenchCodexImmutableBinary(path);
    cachedCodexBinaryIdentity = identity;
    if (cachedCodexBinaryIdentity.version !== options.expectedCodexVersion ||
        cachedCodexBinaryIdentity.sha256 !== options.expectedCodexSha256) {
        throw new Error(`french-codex-binary-unpinned:${cachedCodexBinaryIdentity.version}:${cachedCodexBinaryIdentity.sha256}`);
    }
    return cachedCodexBinaryIdentity;
}
function assertCodexBinaryUnchanged(options, before) {
    const after = codexBinaryIdentity(options);
    if (hashFrenchInternalJson(after) !== hashFrenchInternalJson(before)) {
        throw new Error("french-codex-binary-drift-during-execution");
    }
}
export function frenchCodexProposerTaskName(context, role, batchId) {
    if (!/^\/fr-internal\/(?:pilot|full|custom\/[a-z0-9][a-z0-9._-]*)$/u.test(context.namespace) ||
        (role !== "proposerA" && role !== "proposerB") ||
        !/^[a-z0-9][a-z0-9._-]*$/u.test(batchId)) {
        throw new Error("french-codex-task-name-input-invalid");
    }
    return `${context.namespace}/${role}/${batchId}`;
}
function quarantineRejectedExecution(paths, execution, reason) {
    const directory = resolve(dirname(paths.inputPath), "rejected", `${paths.prefix}-${execution.threadId}-${Date.now()}`);
    mkdirSync(directory, { recursive: true });
    installTextAtomically(resolve(directory, "reason.txt"), `${reason}\n`);
    installTextAtomically(resolve(directory, "agent-events.jsonl"), execution.stdout);
    installTextAtomically(resolve(directory, "agent-stderr.log"), execution.stderr);
    installTextAtomically(resolve(directory, "structured-response.json"), execution.responseText);
}
function normalizeAgentMessage(value) {
    return value.replace(/\r\n?/gu, "\n").trim();
}
function assertArtifact(path, expected, label) {
    if (!existsSync(path))
        throw new Error(`french-codex-${label}-missing:${path}`);
    if (sha256File(path) !== expected) {
        throw new Error(`french-codex-${label}-digest-mismatch:${path}`);
    }
}
function assertExistingRun(path, options, batch, manifestText, prompt, executor, views, packets, manifestContext) {
    const run = JSON.parse(readFileSync(path, "utf8"));
    const { runHash, ...content } = run;
    const expectedTaskName = frenchCodexProposerTaskName(manifestContext, options.role, batch.batchId);
    const expectedCapabilities = {
        localTools: "disabled",
        networkDataTools: "disabled",
        shell: "disabled",
        eventPolicy: "agent-message-only",
        sealedWorkingDirectory: resolve(dirname(rolePaths(batch, options.role).inputPath)),
        disabledFeaturesHash: frenchCodexDisabledFeaturesHash(),
        environmentPolicyHash: frenchCodexEnvironmentPolicyHash()
    };
    if (run.schemaVersion !== FRENCH_CODEX_PROPOSER_RUN_SCHEMA_VERSION ||
        run.executorPolicyVersion !== FRENCH_CODEX_EXECUTOR_POLICY_VERSION ||
        run.batchId !== batch.batchId ||
        run.role !== options.role ||
        run.taskName !== expectedTaskName ||
        run.agentId !== `codex-agent:${run.threadId}` ||
        !THREAD_ID_PATTERN.test(run.threadId) ||
        run.model !== options.model ||
        run.reasoningEffort !== options.reasoningEffort ||
        run.sandbox !== "read-only" ||
        hashFrenchInternalJson(run.executor) !== hashFrenchInternalJson(executor) ||
        hashFrenchInternalJson(run.capabilities) !==
            hashFrenchInternalJson(expectedCapabilities) ||
        run.promptHash !== sha256(prompt) ||
        run.rolePromptHash !== frenchInternalPromptHash(options.role) ||
        run.sourceHashes.manifest !== sha256(manifestText) ||
        run.sourceHashes.batch !== batch.batchHash ||
        run.sourceHashes.input !==
            sha256File(rolePaths(batch, options.role).inputPath) ||
        run.sourceHashes.schema !==
            sha256File(rolePaths(batch, options.role).schemaPath) ||
        run.sourceHashes.packets !== sha256File(batch.inputs.packets.path) ||
        run.sourceHashes.configuration !== sha256File(options.configurationPath) ||
        run.counts.expected !== batch.keys.length ||
        run.counts.drafts !== batch.keys.length ||
        run.counts.artifacts !== batch.keys.length ||
        !SHA256_PATTERN.test(runHash) ||
        hashFrenchInternalJson(content) !== runHash) {
        throw new Error(`french-codex-existing-run-stale:${batch.batchId}:${options.role}`);
    }
    const paths = rolePaths(batch, options.role);
    for (const [artifactPath, digest] of [
        [paths.inputPath, run.sourceHashes.input],
        [paths.schemaPath, run.sourceHashes.schema],
        [batch.inputs.packets.path, run.sourceHashes.packets],
        [paths.eventsPath, run.resultHashes.agentEvents],
        [paths.stderrPath, run.resultHashes.agentStderr],
        [paths.responsePath, run.resultHashes.structuredResponse],
        [paths.draftsPath, run.resultHashes.drafts],
        [paths.artifactsPath, run.resultHashes.artifacts],
        [paths.artifactSummaryPath, run.resultHashes.artifactSummary]
    ]) {
        if (!existsSync(artifactPath) || sha256File(artifactPath) !== digest) {
            throw new Error(`french-codex-existing-run-artifact-stale:${artifactPath}`);
        }
    }
    const responseText = readFileSync(paths.responsePath, "utf8");
    const parsedEvents = parseFrenchCodexAgentEvents(readFileSync(paths.eventsPath, "utf8"), responseText);
    if (parsedEvents.threadId !== run.threadId) {
        throw new Error(`french-codex-existing-run-thread-mismatch:${batch.batchId}:${options.role}`);
    }
    const drafts = parseAndValidateDrafts(responseText, options.role, batch, views, packets);
    const expectedDraftsText = `${drafts.map((draft) => JSON.stringify(draft)).join("\n")}\n`;
    if (readFileSync(paths.draftsPath, "utf8") !== expectedDraftsText) {
        throw new Error(`french-codex-existing-run-drafts-mismatch:${batch.batchId}:${options.role}`);
    }
    const artifacts = readFrenchInternalProposerArtifacts(paths.artifactsPath, options.role).records;
    const expectedHashes = options.role === "proposerA"
        ? batch.proposerAViewHashes
        : batch.proposerBViewHashes;
    if (artifacts.length !== batch.keys.length ||
        artifacts.some((artifact) => {
            const index = batch.keys.indexOf(artifact.entryKey);
            return (index < 0 ||
                artifact.inputHash !== expectedHashes[index] ||
                artifact.agentId !== run.agentId ||
                artifact.taskName !== run.taskName ||
                artifact.completedAt !== run.completedAt);
        })) {
        throw new Error(`french-codex-existing-run-artifacts-mismatch:${batch.batchId}:${options.role}`);
    }
    const artifactSummary = JSON.parse(readFileSync(paths.artifactSummaryPath, "utf8"));
    const summaryDigest = artifactSummary.summaryDigest;
    const summaryContent = { ...artifactSummary };
    delete summaryContent.summaryDigest;
    if (typeof summaryDigest !== "string" ||
        summaryDigest !== hashFrenchInternalJson(summaryContent) ||
        artifactSummary.agentId !== run.agentId ||
        artifactSummary.taskName !== run.taskName ||
        artifactSummary.completedAt !== run.completedAt) {
        throw new Error(`french-codex-existing-run-summary-mismatch:${batch.batchId}:${options.role}`);
    }
    return run;
}
function installTextAtomically(path, text) {
    mkdirSync(dirname(path), { recursive: true });
    const temp = `${path}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(temp, text, "utf8");
    renameSync(temp, path);
}
function sha256File(path) {
    return sha256(readFileSync(path));
}
function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}
function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function assertOptions(options) {
    if (!options.batchId.trim())
        throw new Error("french-codex-batch-id-missing");
    if (options.role !== "proposerA" && options.role !== "proposerB") {
        throw new Error(`french-codex-role-invalid:${options.role}`);
    }
    if (!options.model.trim())
        throw new Error("french-codex-model-missing");
    if (!options.reasoningEffort.trim()) {
        throw new Error("french-codex-reasoning-effort-missing");
    }
    if (!options.expectedCodexVersion.trim() ||
        !SHA256_PATTERN.test(options.expectedCodexSha256)) {
        throw new Error("french-codex-binary-pin-invalid");
    }
    if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1) {
        throw new Error("french-codex-timeout-invalid");
    }
    if (options.expectedEntries !== undefined &&
        (!Number.isInteger(options.expectedEntries) || options.expectedEntries < 1)) {
        throw new Error("french-codex-expected-entries-invalid");
    }
    if (options.force && options.existingOnly) {
        throw new Error("french-codex-existing-only-force-conflict");
    }
    const approved = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[options.role];
    if (options.model !== approved.model ||
        options.reasoningEffort !== approved.reasoningEffort ||
        options.expectedCodexVersion !==
            FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexVersion ||
        options.expectedCodexSha256 !==
            FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexSha256) {
        throw new Error("french-codex-proposer-unapproved-execution-profile");
    }
}
export function parseFrenchCodexProposerBatchArgs(args) {
    const allowed = new Set([
        "manifest",
        "configuration",
        "batch",
        "role",
        "codex-binary",
        "codex-home",
        "model",
        "reasoning-effort",
        "timeout-ms",
        "force",
        "expected-entries",
        "existing-only",
        "codex-version",
        "codex-sha256"
    ]);
    const values = new Map();
    const seen = new Set();
    let force = false;
    let existingOnly = false;
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index] ?? "";
        if (!token.startsWith("--"))
            throw new Error(`unexpected-argument:${token}`);
        const key = token.slice(2);
        if (!allowed.has(key))
            throw new Error(`unknown-option:${key}`);
        if (seen.has(key))
            throw new Error(`duplicate-option:${key}`);
        seen.add(key);
        if (key === "force") {
            force = true;
            continue;
        }
        if (key === "existing-only") {
            existingOnly = true;
            continue;
        }
        const value = args[index + 1];
        if (!value || value.startsWith("--"))
            throw new Error(`missing-value:${key}`);
        values.set(key, value);
        index += 1;
    }
    const role = values.get("role");
    if (role !== "proposerA" && role !== "proposerB") {
        throw new Error(`french-codex-role-invalid:${String(role)}`);
    }
    const positiveInteger = (key, fallback) => {
        const raw = values.get(key);
        if (raw === undefined) {
            if (fallback === undefined)
                throw new Error(`missing-value:${key}`);
            return fallback;
        }
        if (!/^[1-9]\d*$/u.test(raw)) {
            throw new Error(`invalid-positive-integer:${key}:${raw}`);
        }
        return Number(raw);
    };
    const timeoutMs = positiveInteger("timeout-ms", DEFAULT_TIMEOUT_MS);
    return {
        manifestPath: resolve(values.get("manifest") ?? DEFAULT_MANIFEST),
        configurationPath: resolve(values.get("configuration") ?? DEFAULT_CONFIGURATION),
        batchId: values.get("batch") ?? "",
        role,
        codexBinary: resolve(values.get("codex-binary") ?? DEFAULT_CODEX_BINARY),
        codexHome: resolve(values.get("codex-home") ?? DEFAULT_CODEX_HOME),
        model: values.get("model") ?? DEFAULT_MODEL,
        reasoningEffort: values.get("reasoning-effort") ?? DEFAULT_REASONING_EFFORT,
        timeoutMs,
        force,
        manifestPrevalidated: false,
        ...(values.has("expected-entries")
            ? { expectedEntries: positiveInteger("expected-entries") }
            : {}),
        existingOnly,
        expectedCodexVersion: values.get("codex-version") ?? DEFAULT_CODEX_VERSION,
        expectedCodexSha256: values.get("codex-sha256") ?? DEFAULT_CODEX_SHA256
    };
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
    runLexiconV3FrenchCodexProposerBatch(parseFrenchCodexProposerBatchArgs(process.argv.slice(2)))
        .then((run) => {
        process.stdout.write(`${JSON.stringify({
            batchId: run.batchId,
            role: run.role,
            agentId: run.agentId,
            counts: run.counts,
            usage: run.usage,
            runHash: run.runHash
        }, null, 2)}\n`);
    })
        .catch((error) => {
        process.stderr.write(`${basename(process.argv[1] ?? "runLexiconV3FrenchCodexProposerBatch")}: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
