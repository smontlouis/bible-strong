import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import {
  assertSemanticRefillRawDecisionSubsetContract,
  type SemanticRefillLlmCandidatePacket,
  type SemanticRefillLlmRawDecision
} from "./semanticRefillLlm.js";

interface PacketFile {
  bible: string;
  scope: string;
  candidates: SemanticRefillLlmCandidatePacket[];
}

interface ArbiterDecision {
  id: string;
  choiceId: string;
  confidence: number;
  reason: string;
  evidence?: string[];
  classification: "green" | "yellow" | "red";
}

interface ArbiterFile {
  decisions: ArbiterDecision[];
  sourceHashes?: Record<string, string>;
}

interface AuditDecision {
  id: string;
  choiceId: string;
  verdict: "safe" | "hold" | "block";
}

interface AuditorFile {
  audits: AuditDecision[];
}

function requiredArg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing-argument:${name}`);
  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildInternalSafeReview(options: {
  packet: PacketFile;
  arbiter: ArbiterFile;
  auditor: AuditorFile;
  sourcePacket: string;
  sourceHashes?: Record<string, string>;
}): {
  review: {
    bible: string;
    contract: { version: 2 };
    decisions: SemanticRefillLlmRawDecision[];
    generatedAt: string;
    model: string;
    scope: string;
    sourcePacket: string;
    sourceHashes?: Record<string, string>;
  };
  counts: Record<string, number>;
} {
  const candidateById = new Map(
    options.packet.candidates.map((candidate) => [candidate.id, candidate])
  );
  const auditById = new Map(
    options.auditor.audits.map((audit) => [audit.id, audit])
  );
  if (candidateById.size !== options.packet.candidates.length) {
    throw new Error("duplicate-candidate-id");
  }
  if (auditById.size !== options.auditor.audits.length) {
    throw new Error("duplicate-audit-id");
  }

  const decisions: SemanticRefillLlmRawDecision[] = [];
  let green = 0;
  let safe = 0;
  let nonMutating = 0;
  for (const arbiterDecision of options.arbiter.decisions) {
    const candidate = candidateById.get(arbiterDecision.id);
    if (!candidate) throw new Error(`unknown-arbiter-id:${arbiterDecision.id}`);
    const choice = candidate.choices.find(
      (candidateChoice) => candidateChoice.id === arbiterDecision.choiceId
    );
    if (!choice) {
      throw new Error(
        `unbounded-arbiter-choice:${arbiterDecision.id}:${arbiterDecision.choiceId}`
      );
    }
    if (arbiterDecision.classification !== "green") continue;
    green += 1;
    const audit = auditById.get(arbiterDecision.id);
    if (!audit) throw new Error(`missing-audit:${arbiterDecision.id}`);
    if (audit.choiceId !== arbiterDecision.choiceId) {
      throw new Error(`audit-choice-mismatch:${arbiterDecision.id}`);
    }
    if (audit.verdict !== "safe") continue;
    safe += 1;
    if (!(["word", "phrase", "empty"] as string[]).includes(choice.decision)) {
      nonMutating += 1;
      continue;
    }
    decisions.push({
      id: arbiterDecision.id,
      choiceId: choice.id,
      ref: candidate.ref,
      decision: choice.decision,
      strong: [candidate.strong],
      confidence: arbiterDecision.confidence,
      reason: arbiterDecision.reason,
      wordIndex: choice.wordIndex,
      normalized: choice.normalized,
      startWordIndex: choice.startWordIndex,
      endWordIndex: choice.endWordIndex,
      normalizedPhrase: choice.normalizedPhrase,
      evidence: [...(arbiterDecision.evidence ?? []), "internal-auditor:safe"]
    });
  }

  assertSemanticRefillRawDecisionSubsetContract({
    batch: options.packet,
    rawDecisions: decisions
  });
  return {
    review: {
      bible: options.packet.bible,
      contract: { version: 2 },
      decisions,
      generatedAt: new Date().toISOString(),
      model: "internal-consensus-audited",
      scope: options.packet.scope,
      sourcePacket: options.sourcePacket,
      sourceHashes: options.sourceHashes
    },
    counts: {
      packet: options.packet.candidates.length,
      arbiter: options.arbiter.decisions.length,
      audited: options.auditor.audits.length,
      green,
      safe,
      nonMutating,
      emitted: decisions.length
    }
  };
}

async function main(): Promise<void> {
  const packetPath = requiredArg("--packet");
  const arbiterPath = requiredArg("--arbiter");
  const auditorPath = requiredArg("--auditor");
  const outputPath = requiredArg("--output");
  const [packetRaw, arbiterRaw, auditorRaw] = await Promise.all([
    readFile(packetPath, "utf8"),
    readFile(arbiterPath, "utf8"),
    readFile(auditorPath, "utf8")
  ]);
  const packet = JSON.parse(packetRaw) as PacketFile;
  const arbiter = JSON.parse(arbiterRaw) as ArbiterFile;
  const auditor = JSON.parse(auditorRaw) as AuditorFile;
  const sourceHashes = {
    packet: sha256(packetRaw),
    arbiter: sha256(arbiterRaw),
    auditor: sha256(auditorRaw),
    ...(arbiter.sourceHashes
      ? Object.fromEntries(
          Object.entries(arbiter.sourceHashes).map(([key, value]) => [
            `proposer:${key}`,
            value
          ])
        )
      : {})
  };
  const result = buildInternalSafeReview({
    packet,
    arbiter,
    auditor,
    sourcePacket: packetPath,
    sourceHashes
  });
  await writeFile(outputPath, `${JSON.stringify(result.review, null, 2)}\n`);
  process.stdout.write(
    `${JSON.stringify({ output: outputPath, sourceHashes, ...result.counts }, null, 2)}\n`
  );
}

if (process.argv[1]?.endsWith("semanticRefillInternalSafeReview.ts")) {
  await main();
}
