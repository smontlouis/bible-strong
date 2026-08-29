import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

import {
  assertPinnedStepLexicon,
  STEP_GREEK_LEXICON_SHA256,
  STEP_GREEK_LEXICON_URL,
  STEP_HEBREW_LEXICON_SHA256,
  STEP_HEBREW_LEXICON_URL
} from "../src/stepRelatedNumbers.js";

const SOURCES = [
  {
    label: "greek",
    output: "data/external/stepbible/lexicon_greek.txt",
    url: STEP_GREEK_LEXICON_URL,
    sha256: STEP_GREEK_LEXICON_SHA256
  },
  {
    label: "hebrew",
    output: "data/external/stepbible/lexicon_hebrew.txt",
    url: STEP_HEBREW_LEXICON_URL,
    sha256: STEP_HEBREW_LEXICON_SHA256
  }
] as const;

async function main(): Promise<void> {
  for (const source of SOURCES) {
    const outputPath = path.resolve(source.output);
    if (existsSync(outputPath)) {
      assertPinnedStepLexicon(
        readFileSync(outputPath),
        source.sha256,
        source.label
      );
      process.stdout.write(`verified ${source.label}: ${outputPath}\n`);
      continue;
    }

    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(
        `step-compiled-lexicon-download-failed:${source.label}:${response.status}`
      );
    }
    const content = new Uint8Array(await response.arrayBuffer());
    assertPinnedStepLexicon(content, source.sha256, source.label);

    mkdirSync(path.dirname(outputPath), { recursive: true });
    const temporary = `${outputPath}.tmp-${process.pid}`;
    rmSync(temporary, { force: true });
    writeFileSync(temporary, content);
    renameSync(temporary, outputPath);
    process.stdout.write(`downloaded ${source.label}: ${outputPath}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
