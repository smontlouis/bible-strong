import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { type StrongLedger, type StrongLedgerVerse } from "./strongLedger.js";
import {
  buildSemanticRefillLlmBatch,
  SEMANTIC_REFILL_LLM_SYSTEM_PROMPT
} from "./semanticRefillLlm.js";
import { type SemanticRefillAuditItem } from "./semanticRefill.js";

interface AgentPacketFile {
  generatedAt: string;
  bible: string;
  scope: string;
  instructions: string;
  promptPolicy: string;
  verses: Array<{
    ref: string;
    text: string;
    tokens: StrongLedgerVerse["tokens"];
  }>;
  summary: {
    verses: number;
    candidates: number;
    usable: number;
    occupiedAware: number;
    withBlockedTargets: number;
    withOpenContentTargets: number;
    withNearbyOpenTargets: number;
    withPlacementWarnings: number;
    topStrong: Array<[string, number]>;
  };
  candidates: ReturnType<typeof buildSemanticRefillLlmBatch>["candidates"];
}

async function buildAgentPacket(options: {
  bible: string;
  scope: string;
  candidatesPath: string;
  ledgerDir: string;
  outputPath: string;
  limit?: number;
}): Promise<AgentPacketFile> {
  const candidates = (
    JSON.parse(
      await readFile(options.candidatesPath, "utf8")
    ) as SemanticRefillAuditItem[]
  ).filter((candidate) => refInScope(candidate.ref, options.scope));
  const verses = (await readVerses(options.ledgerDir, options.bible)).filter(
    (verse) => refInScope(verse.ref, options.scope)
  );
  const batch = buildSemanticRefillLlmBatch({
    bible: options.bible,
    scope: options.scope,
    candidates,
    verses,
    limit: options.limit
  });

  const packet: AgentPacketFile = {
    generatedAt: new Date().toISOString(),
    bible: options.bible,
    scope: options.scope,
    instructions: [
      "Procedural semantic-refill agent packet.",
      "Agents must inspect sourcePlacement, nearbyOpenTargets, blockedTargets, openContentTargets, occupiedTargets, availableTargets, and placementWarnings before choosing word/phrase/empty/reject/pending-human.",
      "blockedTargets are forbidden for decision=word when a semantically plausible open target exists.",
      "When sourcePlacement.insertAfterWordIndex exists, nearbyOpenTargets are the first visible targets to consider."
    ].join(" "),
    promptPolicy: SEMANTIC_REFILL_LLM_SYSTEM_PROMPT,
    verses: verses.map((verse) => ({
      ref: verse.ref,
      text: verse.text,
      tokens: verse.tokens
    })),
    summary: {
      verses: verses.length,
      candidates: batch.candidates.length,
      usable: batch.candidates.length,
      occupiedAware: batch.candidates.filter(
        (candidate) => candidate.occupiedTargets.length > 0
      ).length,
      withBlockedTargets: batch.candidates.filter(
        (candidate) => candidate.blockedTargets.length > 0
      ).length,
      withOpenContentTargets: batch.candidates.filter(
        (candidate) => candidate.openContentTargets.length > 0
      ).length,
      withNearbyOpenTargets: batch.candidates.filter(
        (candidate) => candidate.nearbyOpenTargets.length > 0
      ).length,
      withPlacementWarnings: batch.candidates.filter(
        (candidate) => candidate.placementWarnings.length > 0
      ).length,
      topStrong: topStrong(
        batch.candidates.map((candidate) => candidate.strong)
      )
    },
    candidates: batch.candidates
  };

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(
    options.outputPath,
    `${JSON.stringify(packet, null, 2)}\n`,
    "utf8"
  );
  return packet;
}

async function readVerses(
  ledgerDir: string,
  bible: string
): Promise<StrongLedgerVerse[]> {
  const canonicalPath = path.join(
    ledgerDir,
    `bible-${bible}-strong-ledger.json`
  );
  const canonical = JSON.parse(
    await readFile(canonicalPath, "utf8")
  ) as StrongLedger;

  if (!canonical.split) return canonical.verses;

  return (
    await Promise.all(
      (canonical.verseFiles ?? []).map(async (file) => {
        const content = await readFile(file.path, "utf8");
        return JSON.parse(content) as StrongLedgerVerse[];
      })
    )
  ).flat();
}

function refInScope(ref: string, scope: string): boolean {
  if (scope === "all") return true;
  if (ref === scope) return true;
  return ref.startsWith(`${scope}.`);
}

function topStrong(strong: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const code of strong) {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )
    .slice(0, 30);
}

function parseArgs(argv: string[]): Map<string, string | boolean> {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
      continue;
    }
    args.set(key, next);
    index += 1;
  }
  return args;
}

function readStringArg(
  args: Map<string, string | boolean>,
  name: string,
  fallback: string
): string {
  const value = args.get(name);
  return typeof value === "string" ? value : fallback;
}

function readOptionalNumberArg(
  args: Map<string, string | boolean>,
  name: string
): number | undefined {
  const value = args.get(name);
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function defaultOutputPath(bible: string, scope: string): string {
  const safeScope = scope.replace(/[^0-9A-Za-z]+/gu, "-");
  return `outputs/gap-review/${bible}/agent-packets/agent-packet-${bible}-${safeScope}.json`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const bible = readStringArg(args, "bible", "nbs").toLowerCase();
  const scope = readStringArg(args, "only", "Gen");
  const outputPath = readStringArg(
    args,
    "output",
    defaultOutputPath(bible, scope)
  );
  const packet = await buildAgentPacket({
    bible,
    scope,
    candidatesPath: readStringArg(
      args,
      "candidates",
      `outputs/gap-review/${bible}/${scope}/gap-review-candidates.json`
    ),
    ledgerDir: readStringArg(args, "ledger-dir", `outputs/strong/${bible}`),
    outputPath,
    limit: readOptionalNumberArg(args, "limit")
  });

  console.log(
    JSON.stringify(
      {
        output: outputPath,
        summary: packet.summary
      },
      null,
      2
    )
  );
}

if (process.argv[1]?.endsWith("semanticRefillAgentPacket.ts")) {
  await main();
}
