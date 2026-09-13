import { DatabaseSync } from "node:sqlite";
import {
  buildCommentaryReadingSections,
  createCommentaryReadingIndex
} from "@bible-strong/resource-domain/contracts/commentarySections";

/** Build once during packaging; full text stays only in the existing source tables. */
export function writeCommentaryReadingIndex(
  database: DatabaseSync,
  identity: { resourceId: string; language: "fr" | "en" }
): void {
  database.exec(`
    CREATE TABLE COMMENTARY_READING_SECTIONS (
      id TEXT PRIMARY KEY NOT NULL,
      book INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      range_start_verse INTEGER NOT NULL,
      range_end_verse INTEGER NOT NULL,
      excerpt TEXT NOT NULL
    );
    CREATE INDEX COMMENTARY_READING_CHAPTER ON COMMENTARY_READING_SECTIONS
      (book, chapter, range_start_verse, range_end_verse, id);
  `);
  const normalized = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'COMMENTARY_DOCUMENTS'"
    )
    .get();
  const chapterKeys = normalized
    ? [
        ...new Set(
          database
            .prepare("SELECT verse_key FROM COMMENTARY_VERSE_DOCUMENTS")
            .all()
            .map((row) =>
              String(row.verse_key).split("-").slice(0, 2).join("-")
            )
        )
      ]
    : database
        .prepare("SELECT id FROM COMMENTAIRES")
        .all()
        .map((row) => String(row.id));
  const insert = database.prepare(
    "INSERT INTO COMMENTARY_READING_SECTIONS VALUES (?, ?, ?, ?, ?, ?)"
  );
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const chapterKey of chapterKeys.sort((a, b) =>
      a.localeCompare(b, "en", { numeric: true })
    )) {
      const [book, chapter] = chapterKey.split("-").map(Number);
      let comments: Record<string, string> = {};
      if (normalized) {
        const prefix = `${chapterKey}-`;
        const rows = database
          .prepare(
            `SELECT links.verse_key, documents.content
          FROM COMMENTARY_VERSE_DOCUMENTS links JOIN COMMENTARY_DOCUMENTS documents ON documents.id = links.document_id
          WHERE links.verse_key LIKE ? ORDER BY links.verse_key, links.ordinal`
          )
          .all(`${prefix}%`);
        for (const row of rows) {
          const verse = String(row.verse_key).slice(prefix.length);
          comments[verse] = comments[verse]
            ? `${comments[verse]}<hr>${row.content}`
            : String(row.content);
        }
      } else {
        const row = database
          .prepare("SELECT commentaires FROM COMMENTAIRES WHERE id = ?")
          .get(chapterKey);
        comments = JSON.parse(String(row?.commentaires ?? "{}"));
      }
      const sections = buildCommentaryReadingSections({
        entry: { id: identity.resourceId, publicationId: identity.resourceId },
        language: identity.language,
        book,
        chapter,
        comments
      });
      const indexes = createCommentaryReadingIndex(sections);
      sections.forEach((section, index) =>
        insert.run(
          section.id,
          book,
          chapter,
          section.rangeStartVerse,
          section.rangeEndVerse,
          indexes[index].excerpt
        )
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
