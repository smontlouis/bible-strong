import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_INPUT_ROOT = "outputs/lexicon-greek-reorganization";
const DEFAULT_OUTPUT_ROOT = "outputs/lexicon-greek-french-translation/batches";
const DEFAULT_TARGET_CHARACTERS = 12_000;

type TranslationKind = "meaning" | "abbott_smith";

interface MeaningInput {
  stepEntryId: number;
  entryKey: string;
  englishMeaning: string;
  englishMeaningHtml: string;
  englishMeaningHash: string;
}

interface AbbottSmithInput {
  resourceId: number;
  stepEntryId: number;
  entryKey: string;
  contentHtml: string;
  contentText: string;
  sourceHash: string;
}

interface TranslationParent {
  schema: "greek-french-translation-parent@1";
  kind: TranslationKind;
  parentHash: string;
  englishText: string;
  englishHtml: string;
  targetStepEntryIds: number[];
  targetEntryKeys: string[];
  targetResourceIds: number[];
}

interface BatchDescriptor {
  batchId: string;
  kind: TranslationKind;
  input: string;
  records: number;
  englishCharacters: number;
  firstParentHash: string;
  lastParentHash: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const inputRoot = path.resolve(args.inputRoot);
  const outputRoot = path.resolve(args.outputRoot);
  const inputDirectory = path.join(outputRoot, "input");
  const translationsDirectory = path.join(outputRoot, "translations");

  if (existsSync(outputRoot)) {
    if (!args.force) throw new Error(`output-exists:${outputRoot}`);
    await rm(outputRoot, { recursive: true, force: true });
  }
  await Promise.all([
    mkdir(inputDirectory, { recursive: true }),
    mkdir(translationsDirectory, { recursive: true })
  ]);

  const meaningPath = path.join(inputRoot, "missing-french-meanings.jsonl");
  const abbottSmithPath = path.join(
    inputRoot,
    "missing-french-as-resources.jsonl"
  );
  const [meaningRows, abbottSmithRows] = await Promise.all([
    readJsonl<MeaningInput>(meaningPath),
    readJsonl<AbbottSmithInput>(abbottSmithPath)
  ]);

  const meaningParents = deduplicateParents(
    meaningRows.map((row) => ({
      schema: "greek-french-translation-parent@1" as const,
      kind: "meaning" as const,
      parentHash: row.englishMeaningHash,
      englishText: row.englishMeaning,
      englishHtml: row.englishMeaningHtml,
      targetStepEntryIds: [row.stepEntryId],
      targetEntryKeys: [row.entryKey],
      targetResourceIds: []
    }))
  );
  const abbottSmithParents = deduplicateParents(
    abbottSmithRows.map((row) => ({
      schema: "greek-french-translation-parent@1" as const,
      kind: "abbott_smith" as const,
      parentHash: row.sourceHash,
      englishText: row.contentText,
      englishHtml: row.contentHtml,
      targetStepEntryIds: [row.stepEntryId],
      targetEntryKeys: [row.entryKey],
      targetResourceIds: [row.resourceId]
    }))
  );

  const descriptors: BatchDescriptor[] = [];
  for (const [kind, parents] of [
    ["meaning", meaningParents],
    ["abbott_smith", abbottSmithParents]
  ] as const) {
    const batches = partitionByCharacters(parents, args.targetCharacters);
    for (let index = 0; index < batches.length; index += 1) {
      const records = batches[index]!;
      const batchId = `${kind}-${String(index + 1).padStart(3, "0")}`;
      const outputPath = path.join(inputDirectory, `${batchId}.jsonl`);
      await writeJsonl(outputPath, records);
      descriptors.push({
        batchId,
        kind,
        input: path.resolve(outputPath),
        records: records.length,
        englishCharacters: records.reduce(
          (total, record) => total + record.englishHtml.length,
          0
        ),
        firstParentHash: records[0]!.parentHash,
        lastParentHash: records.at(-1)!.parentHash
      });
    }
  }

  const manifest = {
    schema: "greek-french-translation-batches@1",
    status: "awaiting-translations",
    inputs: {
      meanings: {
        path: path.resolve(meaningPath),
        sha256: sha256(await readFile(meaningPath)),
        records: meaningRows.length,
        uniqueParents: meaningParents.length
      },
      abbottSmith: {
        path: path.resolve(abbottSmithPath),
        sha256: sha256(await readFile(abbottSmithPath)),
        records: abbottSmithRows.length,
        uniqueParents: abbottSmithParents.length
      }
    },
    targetCharactersPerBatch: args.targetCharacters,
    translationsDirectory: path.resolve(translationsDirectory),
    batches: descriptors
  };
  await writeFile(
    path.join(outputRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );

  console.log(
    JSON.stringify(
      {
        outputRoot,
        meaningParents: meaningParents.length,
        abbottSmithParents: abbottSmithParents.length,
        batches: descriptors.length
      },
      null,
      2
    )
  );
}

function deduplicateParents(records: TranslationParent[]): TranslationParent[] {
  const parents = new Map<string, TranslationParent>();
  for (const record of records) {
    const existing = parents.get(record.parentHash);
    if (!existing) {
      parents.set(record.parentHash, structuredClone(record));
      continue;
    }
    if (
      existing.kind !== record.kind ||
      existing.englishText !== record.englishText ||
      existing.englishHtml !== record.englishHtml
    ) {
      throw new Error(`parent-hash-collision:${record.parentHash}`);
    }
    existing.targetStepEntryIds.push(...record.targetStepEntryIds);
    existing.targetEntryKeys.push(...record.targetEntryKeys);
    existing.targetResourceIds.push(...record.targetResourceIds);
  }
  return [...parents.values()].map((record) => {
    if (record.kind === "meaning") {
      const targets = record.targetStepEntryIds
        .map((stepEntryId, index) => ({
          stepEntryId,
          entryKey: record.targetEntryKeys[index]!
        }))
        .sort((left, right) => left.stepEntryId - right.stepEntryId);
      return {
        ...record,
        targetStepEntryIds: targets.map((target) => target.stepEntryId),
        targetEntryKeys: targets.map((target) => target.entryKey),
        targetResourceIds: []
      };
    }
    const targets = record.targetResourceIds
      .map((resourceId, index) => ({
        resourceId,
        stepEntryId: record.targetStepEntryIds[index]!,
        entryKey: record.targetEntryKeys[index]!
      }))
      .sort((left, right) => left.resourceId - right.resourceId);
    return {
      ...record,
      targetStepEntryIds: targets.map((target) => target.stepEntryId),
      targetEntryKeys: targets.map((target) => target.entryKey),
      targetResourceIds: targets.map((target) => target.resourceId)
    };
  });
}

function partitionByCharacters(
  records: TranslationParent[],
  targetCharacters: number
): TranslationParent[][] {
  const batches: TranslationParent[][] = [];
  let current: TranslationParent[] = [];
  let currentCharacters = 0;
  for (const record of records) {
    if (
      current.length > 0 &&
      currentCharacters + record.englishHtml.length > targetCharacters
    ) {
      batches.push(current);
      current = [];
      currentCharacters = 0;
    }
    current.push(record);
    currentCharacters += record.englishHtml.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  return (await readFile(filePath, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

async function writeJsonl(
  filePath: string,
  records: TranslationParent[]
): Promise<void> {
  await writeFile(
    filePath,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`
  );
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseArgs(rawArgs: string[]): {
  inputRoot: string;
  outputRoot: string;
  targetCharacters: number;
  force: boolean;
} {
  const values = new Map<string, string>();
  for (let index = 0; index < rawArgs.length; index += 1) {
    const argument = rawArgs[index]!;
    if (!argument.startsWith("--")) continue;
    const [key, inlineValue] = argument.slice(2).split("=", 2);
    const next = rawArgs[index + 1];
    if (inlineValue !== undefined) values.set(key!, inlineValue);
    else if (next && !next.startsWith("--")) {
      values.set(key!, next);
      index += 1;
    } else values.set(key!, "true");
  }
  return {
    inputRoot: values.get("input-root") ?? DEFAULT_INPUT_ROOT,
    outputRoot: values.get("output-root") ?? DEFAULT_OUTPUT_ROOT,
    targetCharacters: Number(
      values.get("target-characters") ?? DEFAULT_TARGET_CHARACTERS
    ),
    force: values.get("force") === "true"
  };
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error
  );
  process.exitCode = 1;
});
