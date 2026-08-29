import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  analyzeEnglishSpan,
  isCapitalizedLemmaHead
} from "./englishPosResolver.js";

export function diagnoseEnglishLexemeCanaries(options: {
  releaseDir: string;
  bibleId: string;
}): Array<Record<string, unknown>> {
  const releaseDir = path.resolve(options.releaseDir);
  const catalog = JSON.parse(
    readFileSync(path.join(releaseDir, "catalog.json"), "utf8")
  ) as {
    bibles: Array<{
      applicationVersionId: string;
      canonical: { file: string; entry: string };
      strong: { file: string; entry: string };
    }>;
  };
  const bible = catalog.bibles.find(
    ({ applicationVersionId }) => applicationVersionId === options.bibleId
  );
  if (!bible) {
    throw new Error(`english-lexeme-diagnostic-bible:${options.bibleId}`);
  }
  const canonical = JSON.parse(
    execFileSync(
      "unzip",
      [
        "-p",
        path.join(releaseDir, bible.canonical.file),
        bible.canonical.entry
      ],
      { maxBuffer: 64 * 1024 * 1024 }
    ).toString("utf8")
  ) as {
    verses: Record<string, Record<string, Record<string, { text: string }>>>;
  };
  const temporaryDir = mkdtempSync(
    path.join(tmpdir(), "english-lexeme-canaries-")
  );
  try {
    execFileSync("unzip", [
      "-q",
      path.join(releaseDir, bible.strong.file),
      "-d",
      temporaryDir
    ]);
    const database = new DatabaseSync(
      path.join(temporaryDir, bible.strong.entry),
      { readOnly: true }
    );
    try {
      const results: Array<Record<string, unknown>> = [];
      for (const row of database
        .prepare(
          `SELECT v.bookOrder,v.chapter,v.verse,w.ordinal,w.startOffset,w.length,
                  w.stepTokenId,l.lemma,l.partOfSpeech,
                  GROUP_CONCAT(c.kind || ':' || c.code,'|') AS identities
             FROM WordSpans w
             JOIN Verses v ON v.id=w.verseId
             JOIN FrenchLexemes l ON l.id=w.lexemeId
             LEFT JOIN WordStrongCodes x
               ON x.verseId=w.verseId AND x.ordinal=w.ordinal
             LEFT JOIN StrongCodes c ON c.id=x.codeId
            WHERE l.partOfSpeech='name'
            GROUP BY v.bookOrder,v.chapter,v.verse,w.ordinal,w.startOffset,
                     w.length,w.stepTokenId,l.lemma,l.partOfSpeech
            ORDER BY v.bookOrder,v.chapter,v.verse,w.ordinal`
        )
        .iterate() as Iterable<{
        bookOrder: number;
        chapter: number;
        verse: number;
        ordinal: number;
        startOffset: number;
        length: number;
        stepTokenId: number | null;
        lemma: string;
        partOfSpeech: string;
        identities: string | null;
      }>) {
        const lemma = row.lemma.trim().toLowerCase();
        const verseText =
          canonical.verses[String(row.bookOrder)]?.[String(row.chapter)]?.[
            String(row.verse)
          ]?.text ?? "";
        const analysis = analyzeEnglishSpan({
          verseText,
          startOffset: row.startOffset,
          length: row.length,
          lemma
        });
        if (isCapitalizedLemmaHead(analysis, lemma)) continue;
        results.push({
          bookOrder: row.bookOrder,
          chapter: row.chapter,
          verse: row.verse,
          ordinal: row.ordinal,
          surface: analysis.surface,
          head: analysis.head?.value ?? null,
          lemma,
          stepTokenId: row.stepTokenId,
          identities: (row.identities ?? "").split("|").filter(Boolean),
          candidates: analysis.candidates
        });
      }
      return results;
    } finally {
      database.close();
    }
  } finally {
    rmSync(temporaryDir, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
const valueAfter = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
if (process.argv[1]?.endsWith("diagnoseEnglishLexemeCanaries.ts")) {
  const result = diagnoseEnglishLexemeCanaries({
    releaseDir:
      valueAfter("--release") ??
      "outputs/releases/bible-strong-reverse-interlinear-v18-wordnet-context-candidate",
    bibleId: valueAfter("--bible") ?? "KJV"
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
