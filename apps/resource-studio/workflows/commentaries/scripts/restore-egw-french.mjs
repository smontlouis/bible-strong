#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  correspondenceText,
  decodeText,
  extractLegacyBody,
  hash
} from "./egw-french-recovery.mjs";
import { normalizeEgwMarkup } from "./egw-sources.mjs";
import {
  normalizeCommentaryContent,
  COMMENTARY_LINK_NORMALIZATION_REVISION
} from "./commentary-links.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const escape = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const fileHash = async (file) => {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest("hex");
};
const plain = (html) =>
  decodeText(
    html.replace(/<\/?(?:p|br|div)\b[^>]*>/giu, " ").replace(/<[^>]*>/gu, "")
  )
    .replace(/\s+/gu, " ")
    .trim();
const numeric = (a, b) => a.localeCompare(b, "en", { numeric: true });

export const normalizeRestoredFrench = (rawBody) => {
  const body = rawBody.replace(
    /<(script|style|iframe|object|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/giu,
    ""
  );
  if (!plain(body)) throw new Error("egw-restoration-empty-prose");
  let html = normalizeEgwMarkup(body);
  let plainTextFallback = false;
  if (correspondenceText(html) !== correspondenceText(body)) {
    // Escaped angle brackets can be mistaken for source markup. Preserve the
    // complete visible prose rather than deleting it during legacy cleanup.
    html = `<p>${escape(plain(body))}</p>`;
    plainTextFallback = true;
  }
  const normalized = normalizeCommentaryContent({
    html,
    resourceId: "egw-writings",
    language: "fr",
    passage: null
  });
  if (correspondenceText(normalized.html) !== correspondenceText(body))
    throw new Error("egw-restoration-text-changed");
  if (
    /<(?:script|iframe|object|img)\b|\son\w+\s*=|javascript:/iu.test(
      normalized.html
    )
  )
    throw new Error("egw-restoration-unsafe-html");
  return {
    language: "fr",
    html: normalized.html,
    references: normalized.references,
    sha256: hash(normalized.html),
    plainTextFallback
  };
};

export const selectHistoricalVariant = (variants) => {
  const eligible = [];
  const empty = [];
  for (const variant of variants) {
    let body;
    try {
      body = extractLegacyBody(variant.content_html);
    } catch (error) {
      if (error.message !== "egw-legacy-body-invalid") throw error;
      // Only a structurally present but empty egw_content span is ignorable.
      if (
        !/<span\b[^>]*class=["']egw_content["'][^>]*>\s*<\/span>/iu.test(
          variant.content_html
        )
      )
        throw error;
      empty.push(variant.french_sha256);
      continue;
    }
    eligible.push({ ...variant, body });
  }
  eligible.sort(
    (a, b) =>
      b.occurrences - a.occurrences ||
      a.french_sha256.localeCompare(b.french_sha256)
  );
  return {
    selected: eligible[0] ?? null,
    variants: eligible.length,
    tied:
      eligible.length > 1 &&
      eligible[0].occurrences === eligible[1].occurrences,
    empty
  };
};

export const restoreEgwFrench = async ({ recoveryRoot, output }) => {
  const checksums = JSON.parse(
    await readFile(path.join(recoveryRoot, "checksums.json"), "utf8")
  );
  const paths = ["entries.jsonl", "recovered-paragraphs.sqlite"];
  for (const name of paths) {
    if (
      !checksums[name]?.sha256 ||
      (await fileHash(path.join(recoveryRoot, name))) !== checksums[name].sha256
    )
      throw new Error(`egw-restoration-input-hash:${name}`);
  }
  const database = new DatabaseSync(
    path.join(recoveryRoot, "recovered-paragraphs.sqlite"),
    { readOnly: true }
  );
  const staging = `${output}.tmp-${randomUUID()}`;
  try {
    const usage = new Map(
      database
        .prepare(
          `SELECT paragraph_id,source_sha256,french_sha256,count(*) AS n FROM legacy_associations
      WHERE french_sha256 IS NOT NULL GROUP BY paragraph_id,source_sha256,french_sha256`
        )
        .all()
        .map((x) => [
          `${x.paragraph_id}:${x.source_sha256}:${x.french_sha256}`,
          Number(x.n)
        ])
    );
    const query = database.prepare(
      "SELECT * FROM french_variants WHERE paragraph_id=? AND source_sha256=? ORDER BY french_sha256"
    );
    const documents = new Map();
    const provenance = [];
    const excludedEmpty = [];
    const seenSources = new Set();
    for (const source of database
      .prepare("SELECT * FROM source_paragraphs ORDER BY paragraph_id")
      .iterate()) {
      if (seenSources.has(source.paragraph_id))
        throw new Error(
          `egw-restoration-ambiguous-source:${source.paragraph_id}`
        );
      seenSources.add(source.paragraph_id);
      const variants = query
        .all(source.paragraph_id, source.source_sha256)
        .map((variant) => ({
          ...variant,
          occurrences:
            usage.get(
              `${source.paragraph_id}:${source.source_sha256}:${variant.french_sha256}`
            ) ?? 0
        }));
      if (!variants.length) continue;
      const choice = selectHistoricalVariant(variants);
      if (!choice.selected) {
        excludedEmpty.push(source.paragraph_id);
        continue;
      }
      const translation = normalizeRestoredFrench(choice.selected.body);
      const citation = decodeText(
        /data-refcode=["']([^"']+)["']/u.exec(source.content_html)?.[1] ??
          source.paragraph_id
      );
      documents.set(source.paragraph_id, {
        id: source.paragraph_id,
        sourceReference: citation,
        translation,
        contextUrl: `https://text.egwwritings.org/read/${source.paragraph_id}`
      });
      provenance.push({
        id: source.paragraph_id,
        sourceSha256: source.source_sha256,
        frenchSha256: choice.selected.french_sha256,
        translationSha256: translation.sha256,
        occurrences: choice.selected.occurrences,
        eligibleVariants: choice.variants,
        tied: choice.tied,
        selection: "most-used-existing-variant-then-stable-hash",
        languageHeuristic: choice.selected.probable_language,
        plainTextFallback: translation.plainTextFallback
      });
    }
    const metadata = new Map();
    const passages = new Map();
    let historicalEntries = 0;
    for await (const line of createInterface({
      input: createReadStream(path.join(recoveryRoot, "entries.jsonl")),
      crlfDelay: Infinity
    })) {
      const entry = JSON.parse(line);
      if (hash(entry.content) !== entry.sourceSha256)
        throw new Error(`egw-restoration-source-hash:${entry.id}`);
      if (
        entry.french.exists &&
        hash(entry.french.content) !== entry.french.sha256
      )
        throw new Error(`egw-restoration-french-hash:${entry.id}`);
      if (!/^\d+-\d+-\d+$/u.test(entry.passage) || entry.type !== "egw_comment")
        throw new Error(`egw-restoration-entry:${entry.id}`);
      historicalEntries += 1;
      for (const [position, id] of entry.paragraphIds.entries()) {
        if (!documents.has(id)) continue;
        const rank = [Number(entry.order ?? 0), Number(entry.id), position];
        const meta = metadata.get(id);
        if (!meta || Number(entry.id) < meta.commentId)
          metadata.set(id, {
            commentId: Number(entry.id),
            bookTitle: decodeText(entry.resource.name),
            sectionTitle: decodeText(
              (entry.sectionTitle ?? "").trim() ||
                (entry.chapterTitle ?? "").trim()
            )
          });
        const refs = passages.get(entry.passage) ?? new Map();
        const old = refs.get(id);
        if (!old || compareRank(rank, old) < 0) refs.set(id, rank);
        passages.set(entry.passage, refs);
      }
    }
    const rows = [...documents.values()]
      .sort((a, b) => numeric(a.id, b.id))
      .map((document) => {
        const meta = metadata.get(document.id);
        if (!meta)
          throw new Error(`egw-restoration-metadata-missing:${document.id}`);
        return {
          ...document,
          bookTitle: meta.bookTitle,
          sectionTitle: meta.sectionTitle
        };
      });
    const verses = [...passages]
      .sort(([a], [b]) => numeric(a, b))
      .map(([verseKey, refs]) => ({
        verseKey,
        documentIds: [...refs]
          .sort(([a, ar], [b, br]) => compareRank(ar, br) || numeric(a, b))
          .map(([id]) => id)
      }));
    const corpus = {
      format: "bible-strong-egw-french-restoration",
      schemaVersion: 1,
      language: "fr",
      sourceSnapshotSha256: checksums["entries.jsonl"].sha256,
      recoverySqliteSha256: checksums["recovered-paragraphs.sqlite"].sha256,
      normalizationRevision: COMMENTARY_LINK_NORMALIZATION_REVISION,
      documents: rows,
      verses
    };
    const serialized = JSON.stringify(corpus) + "\n";
    const summary = {
      schemaVersion: 1,
      scope: "existing-french-historical-corpus",
      generatedAt: new Date().toISOString(),
      sourceSnapshotSha256: corpus.sourceSnapshotSha256,
      recoverySqliteSha256: corpus.recoverySqliteSha256,
      corpusSha256: hash(serialized),
      provenanceSha256: hash(JSON.stringify(provenance) + "\n"),
      historicalEntries,
      paragraphs: rows.length,
      verses: verses.length,
      associations: verses.reduce((n, v) => n + v.documentIds.length, 0),
      excludedEmpty,
      paragraphsWithSeveralVariants: provenance.filter(
        (p) => p.eligibleVariants > 1
      ).length,
      tiedSelections: provenance.filter((p) => p.tied).length,
      plainTextFallbacks: provenance.filter((p) => p.plainTextFallback).length,
      newTranslations: 0,
      remoteWrites: false
    };
    // A completed restoration is immutable; reruns use a new explicit directory.
    try {
      await readFile(path.join(output, "manifest.json"));
      throw new Error("egw-restoration-output-exists");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await mkdir(staging, { recursive: true });
    await writeFile(path.join(staging, "corpus.json"), serialized);
    await writeFile(
      path.join(staging, "provenance.json"),
      JSON.stringify(provenance) + "\n"
    );
    await writeFile(
      path.join(staging, "manifest.json"),
      JSON.stringify(summary, null, 2) + "\n"
    );
    await rename(staging, output);
    return summary;
  } finally {
    database.close();
    await rm(staging, { recursive: true, force: true });
  }
};
const compareRank = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

const main = async () => {
  const args = process.argv.slice(2);
  const options = {
    "--recovery-root": path.join(
      root,
      ".local/egw-firestore-recovery-2026-10-01"
    ),
    "--output": path.join(root, ".local/egw-french-restoration")
  };
  if (args.includes("--help")) {
    console.log(
      "Restore existing EGW French paragraphs only. --recovery-root <directory> --output <new directory>"
    );
    return;
  }
  for (let i = 0; i < args.length; i += 2) {
    if (!(args[i] in options) || !args[i + 1] || args[i + 1].startsWith("--"))
      throw new Error(`Invalid option: ${args[i]}`);
    options[args[i]] = path.resolve(args[i + 1]);
  }
  console.log(
    JSON.stringify(
      await restoreEgwFrench({
        recoveryRoot: options["--recovery-root"],
        output: options["--output"]
      }),
      null,
      2
    )
  );
};
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
