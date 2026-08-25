import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  REFERENCE_STRONG_SQLITE_SCHEMA_VERSION,
  writeReferenceStrongSqlite
} from "./referenceStrongSqlite.js";

interface ReferenceDefinition {
  id: string;
  inputPath: string;
  version: string;
}

const REFERENCES: ReferenceDefinition[] = [
  {
    id: "darby",
    inputPath: "data/strongs/Darby.csv",
    version: "DARBY"
  },
  {
    id: "darbyr",
    inputPath: "data/strongs/DarbyR.csv",
    version: "DARBYR"
  },
  {
    id: "sg1910",
    inputPath: "data/strongs/Sg1910.csv",
    version: "SG1910"
  }
];

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const selected =
    options.references.length === 0
      ? REFERENCES
      : REFERENCES.filter((reference) =>
          options.references.includes(reference.id)
        );

  if (selected.length === 0) {
    throw new Error(
      `No matching references. Available: ${REFERENCES.map(({ id }) => id).join(", ")}`
    );
  }

  await mkdir(options.outputDir, { recursive: true });
  const artifacts = [];
  for (const reference of selected) {
    const result = await writeReferenceStrongSqlite({
      inputPath: reference.inputPath,
      outputPath: path.join(
        options.outputDir,
        `bible-${reference.id}-strong.sqlite`
      ),
      version: reference.version
    });
    artifacts.push({
      file: path.basename(result.outputPath),
      sha256: result.artifactSha256,
      sizeBytes: result.sizeBytes,
      sourceSha256: result.sourceSha256,
      strongTagCount: result.strongTagCount,
      verseCount: result.verseCount,
      version: result.version
    });
    console.log(
      `Generated ${result.outputPath}: ${result.verseCount} verses, ${result.strongTagCount} Strong tags, ${result.sizeBytes} bytes, sha256 ${result.artifactSha256}`
    );
  }

  const manifestPath = path.join(options.outputDir, "manifest.json");
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        artifactSchemaVersion: REFERENCE_STRONG_SQLITE_SCHEMA_VERSION,
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
  outputDir: string;
  references: string[];
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
    outputDir: args.get("output-dir") ?? "outputs/strong-references",
    references: (args.get("references") ?? "")
      .split(",")
      .map((reference) => reference.trim().toLowerCase())
      .filter(Boolean)
  };
}

await main();
