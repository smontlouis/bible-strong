import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { COMMENTARY_READING_INDEX_VERSION } from "@bible-strong/resource-domain/contracts/commentaryReadingContract";
import type { AnyCanonicalCommentary } from "./packageCommentaryResourcePublications.js";

export type PublishedCommentaryCopy = {
  sqlitePath: string;
  resourceId: string;
  language: "fr" | "en";
  revision: string;
  contentSha256: string;
};
type Passage = `${number}-${number}-${number}`;
const passage = (value: string): Passage => {
  if (!/^[1-9]\d*-(?:0-0|[1-9]\d*-(?:0|[1-9]\d*))$/.test(value))
    throw new Error("PUBLISHED_COMMENTARY_PASSAGE_INVALID");
  return value as Passage;
};
const text = (value: unknown): string => {
  if (typeof value !== "string")
    throw new Error("PUBLISHED_COMMENTARY_STRING_REQUIRED");
  return value;
};
const compareVerseKeys = (a: { verseKey: string }, b: { verseKey: string }) => {
  const left = a.verseKey.split("-").map(Number);
  const right = b.verseKey.split("-").map(Number);
  return left[0]! - right[0]! || left[1]! - right[1]! || left[2]! - right[2]!;
};

/** Lossless source recovery from a checksum-pinned published copy. No scraper or HTML rewriting. */
export async function readPublishedCommentaryCopy(
  input: PublishedCommentaryCopy
): Promise<AnyCanonicalCommentary> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(input.sqlitePath))
    hash.update(chunk);
  if (hash.digest("hex") !== input.contentSha256)
    throw new Error("PUBLISHED_COMMENTARY_CHECKSUM_MISMATCH");
  const database = new DatabaseSync(input.sqlitePath, { readOnly: true });
  try {
    const metadata = database
      .prepare(
        "SELECT resource_id, language, revision, source_version, source_sha256 FROM RESOURCE_METADATA"
      )
      .all();
    const row = metadata[0];
    if (
      metadata.length !== 1 ||
      row?.resource_id !== input.resourceId ||
      row.language !== input.language ||
      row.revision !== input.revision
    ) {
      throw new Error("PUBLISHED_COMMENTARY_IDENTITY_MISMATCH");
    }
    const revisionHash = createHash("sha256")
      .update(
        `${input.contentSha256}\0reading-index:${COMMENTARY_READING_INDEX_VERSION}`
      )
      .digest("hex");
    const base = {
      format: "bible-strong-canonical-commentary" as const,
      resourceId: input.resourceId,
      language: input.language,
      revision: `${input.resourceId.toLowerCase()}-${input.language}-${revisionHash.slice(0, 20)}`,
      sourceVersion: text(row.source_version),
      sourceSha256: text(row.source_sha256),
      readingIndexVersion: COMMENTARY_READING_INDEX_VERSION
    };
    if (
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='COMMENTARY_DOCUMENTS'"
        )
        .get()
    ) {
      const documents = database
        .prepare("SELECT id, content FROM COMMENTARY_DOCUMENTS ORDER BY id")
        .all()
        .map((row) => ({ id: text(row.id), content: text(row.content) }));
      const associations = new Map<Passage, string[]>();
      for (const row of database
        .prepare(
          "SELECT verse_key, document_id FROM COMMENTARY_VERSE_DOCUMENTS ORDER BY verse_key, ordinal"
        )
        .iterate()) {
        const key = passage(text(row.verse_key));
        const ids = associations.get(key) ?? [];
        ids.push(text(row.document_id));
        associations.set(key, ids);
      }
      return {
        ...base,
        schemaVersion: 2,
        documents,
        verses: [...associations]
          .map(([verseKey, documentIds]) => ({ verseKey, documentIds }))
          .sort(compareVerseKeys)
      };
    }
    const verses: { verseKey: Passage; content: string }[] = [];
    for (const row of database
      .prepare("SELECT id, commentaires FROM COMMENTAIRES")
      .iterate()) {
      const chapter = text(row.id);
      const comments: unknown = JSON.parse(text(row.commentaires));
      if (!comments || typeof comments !== "object" || Array.isArray(comments))
        throw new Error("PUBLISHED_COMMENTARY_CHAPTER_INVALID");
      for (const [verse, content] of Object.entries(comments)) {
        const value = text(content);
        if (value.trim())
          verses.push({
            verseKey: passage(`${chapter}-${verse}`),
            content: value
          });
      }
    }
    return { ...base, schemaVersion: 1, verses: verses.sort(compareVerseKeys) };
  } finally {
    database.close();
  }
}
