import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { tsvEscape } from "./render.js";
import { readStrongCsv, type StrongRow } from "./strongCsv.js";
import { escapeHtml } from "./tokenize.js";

interface ReferenceExport {
  id: string;
  name: string;
  inputPath: string;
}

const REFERENCES: ReferenceExport[] = [
  {
    id: "darby",
    name: "Darby",
    inputPath: "data/strongs/Darby.csv"
  },
  {
    id: "darbyr",
    name: "DarbyR",
    inputPath: "data/strongs/DarbyR.csv"
  },
  {
    id: "sg1910",
    name: "Sg1910",
    inputPath: "data/strongs/Sg1910.csv"
  }
];

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const selectedReferences =
    options.references.length > 0
      ? REFERENCES.filter((reference) =>
          options.references.includes(reference.id)
        )
      : REFERENCES;

  if (selectedReferences.length === 0) {
    throw new Error(
      `No matching references. Available: ${REFERENCES.map((reference) => reference.id).join(", ")}`
    );
  }

  await mkdir(options.outputDir, { recursive: true });

  for (const reference of selectedReferences) {
    const rows = await readStrongCsv(reference.inputPath);
    const outputPath = path.join(
      options.outputDir,
      `bible-${reference.id}-strong-reference.tsv`
    );
    await writeReferenceTsv({ reference, rows, outputPath });
    console.log(`Generated ${outputPath} (${rows.length} verses)`);
  }
}

async function writeReferenceTsv(options: {
  reference: ReferenceExport;
  rows: StrongRow[];
  outputPath: string;
}): Promise<void> {
  const lines = ["book_id\tnum_chapter\tnum_verse\ttext"];

  for (const row of options.rows) {
    lines.push(
      [
        row.bookId,
        row.chapter,
        row.verse,
        tsvEscape(enrichReferenceTags(row.text, options.reference))
      ].join("\t")
    );
  }

  await writeFile(options.outputPath, `${lines.join("\n")}\n`, "utf8");
}

function enrichReferenceTags(text: string, reference: ReferenceExport): string {
  return text.replace(
    /<w\b([^>]*)>([\s\S]*?)<\/w>/giu,
    (match, attrs, body) => {
      const strong = parseAttribute(String(attrs), "strong");
      if (!strong) return match;

      const empty = stripTags(String(body)).trim().length === 0;
      const dataAttributes = [
        `strong="${escapeHtml(strong)}"`,
        `data-confidence="1.00"`,
        `data-source="${escapeHtml(reference.name)}"`,
        `data-method="reference"`,
        `data-original="true"`,
        empty ? `data-empty="true"` : undefined
      ].filter(Boolean);

      return `<w ${dataAttributes.join(" ")}>${body}</w>`;
    }
  );
}

function parseAttribute(attributes: string, name: string): string | undefined {
  const match = attributes.match(
    new RegExp(`\\b${name}=(["'])([\\s\\S]*?)\\1`, "iu")
  );
  return match?.[2];
}

function stripTags(input: string): string {
  return input.replace(/<[^>]*>/gu, "");
}

function parseCliOptions(argv: string[]): {
  outputDir: string;
  references: string[];
} {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const value = inlineValue ?? argv[index + 1];
    if (!inlineValue) index += 1;
    if (key && value) args.set(key, value);
  }

  return {
    outputDir: args.get("output-dir") ?? "outputs",
    references: (args.get("references") ?? "")
      .split(",")
      .map((reference) => reference.trim().toLowerCase())
      .filter(Boolean)
  };
}

await main();
