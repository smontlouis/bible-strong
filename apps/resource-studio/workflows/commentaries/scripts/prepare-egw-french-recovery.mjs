#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  correspondenceText,
  extractLegacyBody,
  hash,
  reconcileParagraph
} from "./egw-french-recovery.mjs";
import { normalizeEgwMarkup } from "./egw-sources.mjs";
import { normalizeCommentaryContent } from "./commentary-links.mjs";

const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const repositoryRoot = path.resolve(workflowRoot, "../../../..");
const fileHash = async (file) => {
  const value = createHash("sha256");
  for await (const chunk of createReadStream(file)) value.update(chunk);
  return value.digest("hex");
};

export const prepareEgwFrenchRecovery = async ({
  sourceSqlite,
  recoveryRoot,
  catalogPath,
  output
}) => {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const entry = catalog.resources["database:egw-writings:en"];
  const checksums = JSON.parse(
    await readFile(path.join(recoveryRoot, "checksums.json"), "utf8")
  );
  const recoverySqlite = path.join(recoveryRoot, "recovered-paragraphs.sqlite");
  const [sourceHash, recoveryHash] = await Promise.all([
    fileHash(sourceSqlite),
    fileHash(recoverySqlite)
  ]);
  if (!entry?.contentSha256 || entry.contentSha256 !== sourceHash)
    throw new Error("egw-source-catalog-sha256-mismatch");
  if (checksums["recovered-paragraphs.sqlite"]?.sha256 !== recoveryHash)
    throw new Error("egw-recovery-sha256-mismatch");
  const source = new DatabaseSync(sourceSqlite, { readOnly: true });
  const recovery = new DatabaseSync(recoverySqlite, { readOnly: true });
  const staging = `${output}.tmp-${randomUUID()}`;
  let candidate;
  const files = [];
  try {
    const metadataRows = source
      .prepare("SELECT * FROM RESOURCE_METADATA")
      .all();
    const metadata = metadataRows[0];
    if (
      metadataRows.length !== 1 ||
      metadata.resource_id !== "egw-writings" ||
      metadata.language !== "en" ||
      metadata.revision !== entry.resourceRevision
    ) {
      throw new Error("egw-source-metadata-mismatch");
    }
    await mkdir(path.dirname(output), { recursive: true });
    // Never replace a completed run or any input snapshot.
    try {
      const existing = await open(output, "r");
      await existing.close();
      throw new Error("egw-output-already-exists");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await mkdir(staging);
    candidate = new DatabaseSync(
      path.join(staging, "egw-french-candidates.sqlite")
    );
    candidate.exec(`
      CREATE TABLE RECOVERY_METADATA(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE PARAGRAPHS(id TEXT PRIMARY KEY, status TEXT NOT NULL, source_sha256 TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE PASSAGE_DOCUMENTS(verse_key TEXT NOT NULL, ordinal INTEGER NOT NULL, document_id TEXT NOT NULL REFERENCES PARAGRAPHS(id), PRIMARY KEY(verse_key,ordinal));
      PRAGMA foreign_keys=ON;
      BEGIN;
    `);
    const insert = candidate.prepare("INSERT INTO PARAGRAPHS VALUES (?,?,?,?)");
    const insertAssociation = candidate.prepare(
      "INSERT INTO PASSAGE_DOCUMENTS VALUES (?,?,?)"
    );
    const history = recovery.prepare(
      "SELECT * FROM source_paragraphs WHERE paragraph_id=?"
    );
    const historicalTextIds = new Map();
    for (const row of recovery
      .prepare(
        "SELECT paragraph_id,content_html FROM source_paragraphs ORDER BY paragraph_id"
      )
      .iterate()) {
      try {
        const fingerprint = hash(
          correspondenceText(extractLegacyBody(row.content_html))
        );
        const ids = historicalTextIds.get(fingerprint) ?? [];
        ids.push(row.paragraph_id);
        historicalTextIds.set(fingerprint, ids);
      } catch {
        // Malformed legacy records remain explicit review tasks on direct matches.
      }
    }
    const variants = recovery.prepare(
      "SELECT * FROM french_variants WHERE paragraph_id=? AND source_sha256=? ORDER BY french_sha256"
    );
    const usage = new Map(
      recovery
        .prepare(
          `SELECT paragraph_id,source_sha256,french_sha256,count(*) AS occurrences
      FROM legacy_associations WHERE french_sha256 IS NOT NULL GROUP BY paragraph_id,source_sha256,french_sha256`
        )
        .all()
        .map((row) => [
          `${row.paragraph_id}:${row.source_sha256}:${row.french_sha256}`,
          Number(row.occurrences)
        ])
    );
    const sinks = {};
    for (const name of ["recovered", "missing", "review"]) {
      const file = await open(path.join(staging, `${name}.jsonl`), "wx");
      files.push(file);
      sinks[name] = file;
    }
    const titles = new Map();
    const stats = {
      total: 0,
      recovered: 0,
      missing: 0,
      review: 0,
      reasons: {},
      variantSelections: {},
      associations: 0
    };
    const snapshot = {
      sourceRevision: metadata.revision,
      sourceSqliteSha256: sourceHash,
      recoverySqliteSha256: recoveryHash
    };
    for (const document of source
      .prepare("SELECT id,content FROM COMMENTARY_DOCUMENTS ORDER BY id")
      .iterate()) {
      const histories = history.all(document.id);
      if (histories.length > 1)
        throw new Error(`egw-ambiguous-historical-source:${document.id}`);
      const historical = histories[0];
      let result = reconcileParagraph({
        document,
        historical,
        variants: historical
          ? variants.all(document.id, historical.source_sha256).map((row) => ({
              ...row,
              occurrences:
                usage.get(
                  `${document.id}:${historical.source_sha256}:${row.french_sha256}`
                ) ?? 0
            }))
          : []
      });
      if (
        result.body &&
        (result.reason === "absent-from-legacy" ||
          result.reason === "source-changed")
      ) {
        const matchingHistoricalIds =
          historicalTextIds.get(hash(correspondenceText(result.body))) ?? [];
        if (matchingHistoricalIds.length)
          result = {
            ...result,
            status: "review",
            reason: "exact-text-other-id",
            matchingHistoricalIds
          };
      }
      if (result.status === "recovered") {
        const translation = normalizeCommentaryContent({
          html: normalizeEgwMarkup(result.translatedBody),
          resourceId: "egw-writings",
          language: "fr",
          passage: null
        });
        const expected = [
          ...document.content.matchAll(/data-osis="([^"]+)"/gu)
        ].map((match) => match[1]);
        const actual = translation.references.map(
          (reference) => reference.osis
        );
        if (
          correspondenceText(translation.html) !==
          correspondenceText(result.translatedBody)
        ) {
          result = {
            ...result,
            status: "review",
            reason: "normalization-changed-text"
          };
        } else if (JSON.stringify(expected) !== JSON.stringify(actual)) {
          result = {
            ...result,
            status: "review",
            reason: "bible-references-changed",
            expectedReferences: expected,
            recoveredReferences: actual
          };
        } else
          result.translation = {
            language: "fr",
            html: translation.html,
            sha256: hash(translation.html),
            references: translation.references,
            provenance: {
              kind: "historical-import",
              ...snapshot,
              historicalSourceSha256: result.historicalSourceSha256,
              selectedFrenchSha256: result.selectedFrenchSha256,
              selection: result.selection
            }
          };
      }
      for (const kind of ["bookTitle", "sectionTitle"]) {
        if (result[kind]) {
          const key = `${kind}:${result[kind]}`;
          const value = titles.get(key) ?? {
            id: hash(key),
            kind,
            sourceText: result[kind],
            sourceSha256: hash(result[kind]),
            occurrences: 0
          };
          value.occurrences += 1;
          titles.set(key, value);
        }
      }
      result = { ...result, sourceSha256: hash(document.content), ...snapshot };
      if (result.status === "missing")
        result.task = {
          kind: "paragraph-translation",
          sourceLanguage: "en",
          targetLanguage: "fr",
          sourceHtml: result.body,
          sourceSha256: hash(result.body)
        };
      const serialized = JSON.stringify(result);
      insert.run(document.id, result.status, result.sourceSha256, serialized);
      await sinks[result.status].write(`${serialized}\n`);
      stats.total += 1;
      stats[result.status] += 1;
      if (result.reason)
        stats.reasons[result.reason] = (stats.reasons[result.reason] ?? 0) + 1;
      if (result.status === "recovered")
        stats.variantSelections[result.selection] =
          (stats.variantSelections[result.selection] ?? 0) + 1;
      if (stats.total % 10000 === 0)
        process.stderr.write(
          `EGW FR: ${stats.total} paragraphs; ${stats.recovered} recovered\n`
        );
    }
    for (const row of source
      .prepare(
        "SELECT verse_key,ordinal,document_id FROM COMMENTARY_VERSE_DOCUMENTS ORDER BY verse_key,ordinal"
      )
      .iterate()) {
      insertAssociation.run(row.verse_key, row.ordinal, row.document_id);
      stats.associations += 1;
    }
    const summary = {
      schemaVersion: 1,
      kind: "egw-french-recovery-candidate",
      publicationReady: false,
      generatedAt: new Date().toISOString(),
      ...snapshot,
      ...stats,
      metadataTranslationTasks: titles.size,
      recoveredPercent: Number(
        ((100 * stats.recovered) / stats.total).toFixed(2)
      ),
      remainingParagraphTasks: stats.missing + stats.review,
      productionWrites: false
    };
    candidate
      .prepare("INSERT INTO RECOVERY_METADATA VALUES (?,?)")
      .run("summary", JSON.stringify(summary));
    candidate.exec("COMMIT");
    const integrity = Object.values(
      candidate.prepare("PRAGMA integrity_check").get()
    )[0];
    if (
      integrity !== "ok" ||
      candidate.prepare("PRAGMA foreign_key_check").all().length
    )
      throw new Error("egw-candidate-integrity-failed");
    candidate.close();
    candidate = null;
    for (const file of files) await file.close();
    await writeFile(
      path.join(staging, "metadata-translation-tasks.json"),
      JSON.stringify([...titles.values()], null, 2) + "\n"
    );
    await writeFile(
      path.join(staging, "summary.json"),
      JSON.stringify(summary, null, 2) + "\n"
    );
    await writeFile(
      path.join(staging, "README.md"),
      `# EGW français — candidat de récupération\n\nCe dossier n’est pas un bundle publiable.\n\n${stats.recovered} paragraphes récupérés sur ${stats.total}. ${stats.missing} à traduire et ${stats.review} à examiner. ${titles.size} titres à localiser.\n\nLes associations aux versets proviennent exclusivement de la révision anglaise ${metadata.revision}. Les sources, les traductions historiques et les références bibliques sont contrôlées. Les choix entre variantes reposent sur leur fréquence historique, pas sur une validation humaine.\n\nLa base SQLite conserve tous les paragraphes et les tâches ; recovered.jsonl contient uniquement les traductions ayant passé les contrôles automatiques. missing.jsonl et review.jsonl constituent le reliquat exact de cette révision. Les titres anglais servent de métadonnées de travail.\n`
    );
    await rename(staging, output);
    return summary;
  } finally {
    source.close();
    recovery.close();
    candidate?.close();
    for (const file of files) await file.close().catch(() => {});
    await rm(staging, { recursive: true, force: true });
  }
};

const main = async () => {
  const defaults = {
    "--source-sqlite": path.join(
      repositoryRoot,
      "apps/resource-studio/outputs/published-commentaries/sqlite/commentary-egw-writings-en.sqlite"
    ),
    "--recovery-root": path.join(
      workflowRoot,
      ".local/egw-firestore-recovery-2026-10-01"
    ),
    "--catalog": path.join(
      repositoryRoot,
      "packages/resource-catalog/src/mobile-resource-catalog.json"
    ),
    "--output": path.join(workflowRoot, ".local/egw-french-current-candidate")
  };
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      `Prepare a local, source-bound EGW French recovery candidate. No publication.\n${Object.keys(defaults).join("\n")}\nNode 22+ required.`
    );
    return;
  }
  for (let i = 0; i < args.length; i += 2) {
    if (!(args[i] in defaults) || !args[i + 1] || args[i + 1].startsWith("--"))
      throw new Error(`Invalid argument: ${args[i]}`);
    defaults[args[i]] = path.resolve(args[i + 1]);
  }
  console.log(
    JSON.stringify(
      await prepareEgwFrenchRecovery({
        sourceSqlite: defaults["--source-sqlite"],
        recoveryRoot: defaults["--recovery-root"],
        catalogPath: defaults["--catalog"],
        output: defaults["--output"]
      }),
      null,
      2
    )
  );
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
