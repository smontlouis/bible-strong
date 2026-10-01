import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { COMMENTARY_READING_INDEX_VERSION } from "@bible-strong/resource-domain/contracts/commentaryReadingContract";
import {
  materializeCommentaryBibleLinks,
  sanitizeCommentaryPublicationHtml
} from "./commentaryPublicationHtml.js";
import type { AnyCanonicalCommentary } from "./packageCommentaryResourcePublications.js";

export type RestoredEgwCorpus = {
  format: "bible-strong-egw-french-restoration";
  schemaVersion: 1;
  language: "fr";
  sourceSnapshotSha256: string;
  recoverySqliteSha256: string;
  documents: Array<{
    id: string;
    bookTitle: string;
    sectionTitle: string;
    sourceReference: string;
    contextUrl: string;
    translation: {
      language: "fr";
      html: string;
      sha256: string;
      references: Array<{ id: string; kind: "bible"; osis: string }>;
    };
  }>;
  verses: Array<{
    verseKey: `${number}-${number}-${number}`;
    documentIds: string[];
  }>;
};
const sha256 = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");
const escape = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function buildRestoredEgwFrenchCanonical(
  corpus: RestoredEgwCorpus,
  provenanceSha256: string
): Extract<AnyCanonicalCommentary, { schemaVersion: 2 }> {
  if (
    corpus.format !== "bible-strong-egw-french-restoration" ||
    corpus.schemaVersion !== 1 ||
    corpus.language !== "fr" ||
    !/^[a-f0-9]{64}$/u.test(corpus.sourceSnapshotSha256) ||
    !/^[a-f0-9]{64}$/u.test(provenanceSha256)
  )
    throw new Error("egw-restoration-format-invalid");
  const ids = new Set<string>();
  const documents = corpus.documents.map((document) => {
    if (!/^\d+\.\d+$/u.test(document.id) || ids.has(document.id))
      throw new Error(`egw-restoration-document-identity:${document.id}`);
    ids.add(document.id);
    if (
      document.translation.language !== "fr" ||
      !document.translation.html.trim() ||
      sha256(document.translation.html) !== document.translation.sha256
    )
      throw new Error(`egw-restoration-translation-invalid:${document.id}`);
    if (
      document.contextUrl !== `https://text.egwwritings.org/read/${document.id}`
    )
      throw new Error(`egw-restoration-context-invalid:${document.id}`);
    const prose = sanitizeCommentaryPublicationHtml(
      materializeCommentaryBibleLinks(document.translation)
    );
    return {
      id: document.id,
      content: `<h3>${escape(document.bookTitle)}</h3><h4>${escape(document.sectionTitle)}</h4><p><strong>${escape(document.sourceReference)}</strong></p>${prose}<p><a class="external-source" href="${document.contextUrl}">Lire dans le contexte original ↗</a></p>`
    };
  });
  const verseKeys = new Set<string>();
  const referenced = new Set<string>();
  for (const verse of corpus.verses) {
    if (
      !/^[1-9]\d*-[1-9]\d*-[1-9]\d*$/u.test(verse.verseKey) ||
      verseKeys.has(verse.verseKey) ||
      !verse.documentIds.length ||
      new Set(verse.documentIds).size !== verse.documentIds.length
    )
      throw new Error(`egw-restoration-verse-invalid:${verse.verseKey}`);
    verseKeys.add(verse.verseKey);
    for (const id of verse.documentIds) {
      if (!ids.has(id))
        throw new Error(`egw-restoration-reference-missing:${id}`);
      referenced.add(id);
    }
  }
  if (!documents.length || referenced.size !== ids.size)
    throw new Error("egw-restoration-document-unreferenced");
  const sourceSha256 = sha256(JSON.stringify({ corpus, provenanceSha256 }));
  const contentHash = sha256(
    JSON.stringify({
      readingIndexVersion: COMMENTARY_READING_INDEX_VERSION,
      documents,
      verses: corpus.verses
    })
  );
  return {
    format: "bible-strong-canonical-commentary",
    schemaVersion: 2,
    resourceId: "egw-writings",
    language: "fr",
    revision: `egw-writings-fr-${contentHash.slice(0, 20)}`,
    sourceVersion: `firestore-egw-fr-${corpus.sourceSnapshotSha256}:${provenanceSha256}`,
    sourceSha256,
    readingIndexVersion: COMMENTARY_READING_INDEX_VERSION,
    documents,
    verses: corpus.verses
  };
}

export async function loadRestoredEgwFrenchCanonical(root: string) {
  const [raw, provenance, manifestRaw] = await Promise.all([
    readFile(path.join(root, "corpus.json")),
    readFile(path.join(root, "provenance.json")),
    readFile(path.join(root, "manifest.json"), "utf8")
  ]);
  const manifest = JSON.parse(manifestRaw) as {
    corpusSha256: string;
    provenanceSha256: string;
    paragraphs: number;
    verses: number;
    newTranslations: number;
    scope: string;
  };
  if (
    sha256(raw) !== manifest.corpusSha256 ||
    sha256(provenance) !== manifest.provenanceSha256 ||
    manifest.scope !== "existing-french-historical-corpus" ||
    manifest.newTranslations !== 0
  )
    throw new Error("egw-restoration-manifest-mismatch");
  const canonical = buildRestoredEgwFrenchCanonical(
    JSON.parse(raw.toString("utf8")) as RestoredEgwCorpus,
    manifest.provenanceSha256
  );
  if (
    canonical.documents.length !== manifest.paragraphs ||
    canonical.verses.length !== manifest.verses
  )
    throw new Error("egw-restoration-count-mismatch");
  return canonical;
}
