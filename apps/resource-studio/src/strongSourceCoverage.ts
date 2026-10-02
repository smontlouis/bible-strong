import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { STEP_TO_OSIS_BOOK } from "./stepOriginals.js";
import { parseSourceRow } from "./strongSourceUnits.js";

export interface UnparsedSourceRow {
  id: string;
  file: string;
  line: number;
  rawReference: string;
  possibleReferences: string[];
  primaryCodes: string[];
  surface: string;
  gloss: string;
  evidenceSha256: string;
  state: "unresolved-source-notation";
  absenceEstablished: false;
}

/** Inventory raw Strong-bearing records outside the importer's grammar. Brackets
 * and braces can denote different versifications: recognizing their existence
 * does not decide a native verse, occurrence identity, or translation absence. */
export function unparsedSourceRow(
  line: string,
  file: string,
  number: number
): UnparsedSourceRow | undefined {
  const parts = line.split("\t");
  const rawReference = parts[0].replace(/^\uFEFF/u, "");
  const candidate = rawReference.match(
    /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+).*#\d+=/u
  );
  if (!candidate || parseSourceRow(line, file, number)) return;
  const primary = parts[file.includes("TAGNT") ? 3 : 4] ?? "";
  const primaryCodes = [
    ...new Set(primary.match(/[HG]\d{4,5}[A-Za-z]?/gu) ?? [])
  ];
  if (!primaryCodes.length) return;
  const book = STEP_TO_OSIS_BOOK.get(candidate[1]);
  const coordinates = [
    [candidate[2], candidate[3]],
    ...[...rawReference.matchAll(/[([{](\d+)\.(\d+)[)\]}]/gu)].map((m) => [
      m[1],
      m[2]
    ])
  ];
  return {
    id: `unparsed:${file}:${number}`,
    file,
    line: number,
    rawReference,
    possibleReferences: book
      ? [
          ...new Set(
            coordinates.map(([c, v]) => `${book}.${Number(c)}.${Number(v)}`)
          )
        ]
      : [],
    primaryCodes,
    surface: parts[1] ?? "",
    gloss: parts[file.includes("TAGNT") ? 2 : 3] ?? "",
    evidenceSha256: createHash("sha256").update(line).digest("hex"),
    state: "unresolved-source-notation",
    absenceEstablished: false
  };
}

export async function readUnparsedSourceRows(
  files: string[]
): Promise<UnparsedSourceRow[]> {
  const rows: UnparsedSourceRow[] = [];
  for (const file of files) {
    const lines = (await readFile(file, "utf8")).split(/\r?\n/u);
    for (const [i, line] of lines.entries()) {
      const row = unparsedSourceRow(line, file, i + 1);
      if (row) rows.push(row);
    }
  }
  return rows;
}
