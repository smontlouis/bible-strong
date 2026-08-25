import { createHash } from "node:crypto";

export const ENGLISH_CANONICAL_RESOURCE_REPAIR_SCHEMA_VERSION =
  "lexicon-v3-english-canonical-resource-repair@1" as const;

export interface EnglishCanonicalResourceRepairInput {
  entryKey: string;
  databaseDigest: string;
  sourceSnapshotDigest: string;
  source: string;
  kind: string;
  contentHtml: string;
}

export interface EnglishCanonicalResourceRepairResult {
  schemaVersion: typeof ENGLISH_CANONICAL_RESOURCE_REPAIR_SCHEMA_VERSION;
  ruleId: string;
  entryKey: string;
  source: "TFLSJ";
  kind: "classical_full";
  sourceContentDigest: string;
  repairedContentDigest: string;
  replacementCount: number;
  contentHtml: string;
}

interface EnglishCanonicalResourceRepairRule {
  ruleId: string;
  entryKey: string;
  databaseDigest: string;
  sourceSnapshotDigest: string;
  source: "TFLSJ";
  kind: "classical_full";
  sourceContentDigest: string;
  repairedContentDigest: string;
  sourceToken: string;
  repairedToken: string;
  replacementCount: number;
}

const RULES = new Map<string, EnglishCanonicalResourceRepairRule>([
  [
    "greek:G2046",
    Object.freeze({
      ruleId: "english-canonical-resource-repair:greek:G2046@1",
      entryKey: "greek:G2046",
      databaseDigest:
        "48a023568f83ebbc37de2e811dcefa54ba422f92d0cbb66c25f2b8245c79d9d8",
      sourceSnapshotDigest:
        "fcc2845412132a7bb91fc3dbb5a544c807daf57e4791c4d9af61efe209e97691",
      source: "TFLSJ",
      kind: "classical_full",
      sourceContentDigest:
        "6b7c7f9c2333eda1eeada281fd4222641e5dfd7cb1283c97653dcd2b50d6f764",
      repairedContentDigest:
        "9d4a6dd162e44bf5645bd129d5b0459478296b6f5107ae28216e9bbc92591694",
      sourceToken: "Illiad",
      repairedToken: "Iliad",
      replacementCount: 6
    })
  ]
]);

export const ENGLISH_CANONICAL_RESOURCE_REPAIR_RULES: ReadonlyMap<
  string,
  Readonly<EnglishCanonicalResourceRepairRule>
> = RULES;

/**
 * Applies only exact, snapshot-pinned corrections to a selected canonical
 * resource. Registered rows fail closed on any source, content, or count
 * drift; unrelated resources are returned untouched by returning `null`.
 */
export function applyEnglishCanonicalResourceRepairs(
  input: EnglishCanonicalResourceRepairInput
): EnglishCanonicalResourceRepairResult | null {
  const repairRule = RULES.get(input.entryKey);
  if (!repairRule) return null;
  if (input.databaseDigest !== repairRule.databaseDigest) {
    throw new Error(
      `english-canonical-resource-repair-database-drift:${input.entryKey}`
    );
  }
  if (input.sourceSnapshotDigest !== repairRule.sourceSnapshotDigest) {
    throw new Error(
      `english-canonical-resource-repair-source-snapshot-drift:${input.entryKey}`
    );
  }
  if (input.source !== repairRule.source || input.kind !== repairRule.kind) {
    throw new Error(
      `english-canonical-resource-repair-resource-drift:${input.entryKey}`
    );
  }
  const sourceContentDigest = sha256(input.contentHtml);
  if (sourceContentDigest !== repairRule.sourceContentDigest) {
    throw new Error(
      `english-canonical-resource-repair-content-drift:${input.entryKey}`
    );
  }
  const replacementCount = countOccurrences(
    input.contentHtml,
    repairRule.sourceToken
  );
  if (replacementCount !== repairRule.replacementCount) {
    throw new Error(
      `english-canonical-resource-repair-count-drift:${input.entryKey}`
    );
  }
  const contentHtml = input.contentHtml.replaceAll(
    repairRule.sourceToken,
    repairRule.repairedToken
  );
  const repairedContentDigest = sha256(contentHtml);
  if (repairedContentDigest !== repairRule.repairedContentDigest) {
    throw new Error(
      `english-canonical-resource-repair-result-drift:${input.entryKey}`
    );
  }
  return {
    schemaVersion: ENGLISH_CANONICAL_RESOURCE_REPAIR_SCHEMA_VERSION,
    ruleId: repairRule.ruleId,
    entryKey: input.entryKey,
    source: repairRule.source,
    kind: repairRule.kind,
    sourceContentDigest,
    repairedContentDigest,
    replacementCount,
    contentHtml
  };
}

function countOccurrences(value: string, token: string): number {
  if (!token) return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const index = value.indexOf(token, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + token.length;
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
