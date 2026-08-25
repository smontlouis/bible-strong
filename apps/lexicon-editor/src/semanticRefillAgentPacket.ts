import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { type StrongLedgerVerse } from "./strongLedger.js";
import {
  readStrongLedgerVersesSqlite,
  strongLedgerSqlitePath
} from "./strongLedgerStore.js";
import {
  buildSemanticRefillLlmBatch,
  SEMANTIC_REFILL_LLM_SYSTEM_PROMPT
} from "./semanticRefillLlm.js";
import {
  type RefillPriority,
  type SemanticRefillAuditItem
} from "./semanticRefill.js";

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
    inputCandidates: number;
    filteredCandidates: number;
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
  minPriority?: RefillPriority;
}): Promise<AgentPacketFile> {
  const scopedCandidates = (
    JSON.parse(
      await readFile(options.candidatesPath, "utf8")
    ) as SemanticRefillAuditItem[]
  ).filter((candidate) => refInScope(candidate.ref, options.scope));
  const candidates = filterCandidatesByPriority(
    scopedCandidates,
    options.minPriority
  );
  if (options.minPriority && candidates.length === 0) {
    throw new Error(
      `no-candidates-at-or-above-priority:${options.minPriority}`
    );
  }
  const verses = await readVerses(
    options.ledgerDir,
    options.bible,
    options.scope
  );
  const batch = buildSemanticRefillLlmBatch({
    bible: options.bible,
    scope: options.scope,
    candidates,
    verses,
    limit: options.limit
  });
  const candidateRefs = new Set(
    batch.candidates.map((candidate) => candidate.ref)
  );
  const packetVerses = verses.filter((verse) => candidateRefs.has(verse.ref));

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
    verses: packetVerses.map((verse) => ({
      ref: verse.ref,
      text: verse.text,
      tokens: verse.tokens
    })),
    summary: {
      inputCandidates: scopedCandidates.length,
      filteredCandidates: candidates.length,
      verses: packetVerses.length,
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
  bible: string,
  scope: string
): Promise<StrongLedgerVerse[]> {
  return readStrongLedgerVersesSqlite({
    sqlitePath: strongLedgerSqlitePath(ledgerDir, bible),
    bible,
    onlyRef: scope
  });
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

function filterCandidatesByPriority(
  candidates: SemanticRefillAuditItem[],
  minPriority: RefillPriority | undefined
): SemanticRefillAuditItem[] {
  if (!minPriority) return candidates;
  const minimumRank = priorityRank(minPriority);
  return candidates.filter(
    (candidate) => priorityRank(candidate.priority) >= minimumRank
  );
}

function priorityRank(priority: RefillPriority): number {
  switch (priority) {
    case "semantic-high":
      return 4;
    case "semantic-medium":
      return 3;
    case "function-low":
      return 2;
    case "technical-skip":
      return 1;
  }
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

function readOptionalPriorityArg(
  args: Map<string, string | boolean>,
  name: string
): RefillPriority | undefined {
  const value = args.get(name);
  if (value === undefined) return undefined;
  if (
    value === "semantic-high" ||
    value === "semantic-medium" ||
    value === "function-low" ||
    value === "technical-skip"
  ) {
    return value;
  }
  throw new Error(`invalid-${name}:${String(value)}`);
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
    limit: readOptionalNumberArg(args, "limit"),
    minPriority: readOptionalPriorityArg(args, "min-priority")
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
