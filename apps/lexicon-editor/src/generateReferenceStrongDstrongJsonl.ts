import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  REFERENCE_STRONG_DSTRONG_JSONL_SCHEMA_VERSION,
  writeReferenceStrongDstrongJsonl
} from "./referenceStrongDstrongJsonl.js";
import { readStepLexicalIdentityIndex } from "./stepLexicalIdentity.js";
import { readStepOriginalIndex } from "./stepOriginals.js";

const REFERENCES = [
  { id: "darby", version: "DARBY" },
  { id: "darbyr", version: "DARBYR" },
  { id: "sg1910", version: "SG1910" }
] as const;

const STEP_FILES = [
  "TAHOT Gen-Deu.txt",
  "TAHOT Jos-Est.txt",
  "TAHOT Job-Sng.txt",
  "TAHOT Isa-Mal.txt",
  "TAGNT Mat-Jhn.txt",
  "TAGNT Act-Rev.txt"
] as const;

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const selected =
    options.references.length === 0
      ? REFERENCES
      : REFERENCES.filter(({ id }) => options.references.includes(id));
  if (selected.length === 0) {
    throw new Error(
      `No matching references. Available: ${REFERENCES.map(({ id }) => id).join(", ")}`
    );
  }

  const stepFiles = STEP_FILES.map((file) => path.join(options.stepDir, file));
  const missingStepFile = stepFiles.find((file) => !existsSync(file));
  if (missingStepFile)
    throw new Error(`Missing STEP source: ${missingStepFile}`);

  await mkdir(options.outputDir, { recursive: true });
  const stepIndex = await readStepOriginalIndex(stepFiles);
  const identityFiles = [
    path.join(options.stepLexiconDir, "TBESH.txt"),
    path.join(options.stepLexiconDir, "TBESG.txt")
  ];
  const missingIdentityFile = identityFiles.find((file) => !existsSync(file));
  if (missingIdentityFile) {
    throw new Error(`Missing STEP lexicon source: ${missingIdentityFile}`);
  }
  const identityIndex = await readStepLexicalIdentityIndex(identityFiles);
  const artifacts = [];

  for (const reference of selected) {
    const inputPath = path.join(
      options.inputDir,
      `bible-${reference.id}-strong.jsonl`
    );
    if (!existsSync(inputPath)) {
      throw new Error(
        `Missing JSONL input: ${inputPath}. Run npm run strong:references:jsonl first.`
      );
    }
    const result = await writeReferenceStrongDstrongJsonl({
      inputPath,
      identityIndex,
      outputPath: path.join(
        options.outputDir,
        `bible-${reference.id}-strong.jsonl`
      ),
      stepIndex
    });
    artifacts.push({
      file: path.basename(result.outputPath),
      sha256: result.artifactSha256,
      sizeBytes: result.sizeBytes,
      sourceSha256: result.sourceSha256,
      version: reference.version,
      metrics: result.metrics
    });
    console.log(
      `Generated ${result.outputPath}: ${result.metrics.enrichedTagCount} enriched tags, ${result.metrics.extendedStrongCount} eStrong, ${result.metrics.distinguishedStrongCount} dStrong, ${result.metrics.unifiedStrongCount} uStrong, ${result.metrics.ambiguousTokenCount} ambiguous tags`
    );
  }

  const manifestPath = path.join(options.outputDir, "manifest.json");
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        artifactSchemaVersion: REFERENCE_STRONG_DSTRONG_JSONL_SCHEMA_VERSION,
        format: "jsonl",
        textPolicy: "lossless-inline-markup-with-compact-step-identities",
        compactAttributes: ["estrong", "dstrong", "ustrong"],
        identityPolicy:
          "omit each STEP identity when already represented by strong or a more specific compact attribute",
        resolutionMethods: ["unique-candidate", "occurrence-order"],
        stepSources: stepFiles.map((file) => path.basename(file)),
        stepLexicons: identityFiles.map((file) => path.basename(file)),
        artifacts
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  console.log(`Generated ${manifestPath}`);
}

function parseCliOptions(argv: string[]): {
  inputDir: string;
  outputDir: string;
  references: string[];
  stepDir: string;
  stepLexiconDir: string;
} {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument?.startsWith("--")) continue;
    const [key, inlineValue] = argument.slice(2).split("=", 2);
    const value = inlineValue ?? argv[index + 1];
    if (!inlineValue) index += 1;
    if (key && value) args.set(key, value);
  }
  return {
    inputDir: args.get("input-dir") ?? "outputs/strong-references-jsonl-lemmas",
    outputDir: args.get("output-dir") ?? "outputs/strong-references-jsonl-step",
    references: (args.get("references") ?? "")
      .split(",")
      .map((reference) => reference.trim().toLowerCase())
      .filter(Boolean),
    stepDir: args.get("step-dir") ?? "data/external/stepbible/amalgamated",
    stepLexiconDir: args.get("step-lexicon-dir") ?? "data/external/stepbible"
  };
}

await main();
