import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  bindRevision,
  createZip,
  deriveStrongLexiconModuleRevision,
  readTables,
  validateStrongLexiconResourcePublication
} from "./packageStrongLexiconResourcePublications.js";
import { sha256ResourcePublicationFile } from "./resourcePublicationEnvelope.js";
import { commitResourcePublicationBundle } from "./resourcePublicationCommit.js";

/** A self-contained identity projection lets simple definitions work without the detailed lexicon. */
export async function packageSimpleStrongLexicon(options: {
  locale: "fr" | "en";
  corePath: string;
  legacyPath: string;
  outputDir: string;
}) {
  const moduleId = `simple-${options.locale}` as const;
  const entry = `strong_lexicon.${moduleId}.sqlite`;
  return commitResourcePublicationBundle({
    outputDir: path.resolve(options.outputDir),
    build: async (staging) => {
      mkdirSync(path.join(staging, "offline"), { recursive: true });
      mkdirSync(path.join(staging, "canonical"), { recursive: true });
      const sqlitePath = path.join(staging, "offline", entry);
      copyFileSync(options.corePath, sqlitePath);
      const legacy = new DatabaseSync(options.legacyPath, { readOnly: true });
      const db = new DatabaseSync(sqlitePath);
      try {
        const localizedGlosses = new Map(
          db
            .prepare(
              "SELECT stepEntryId, gloss FROM LexiconTranslations WHERE language=?"
            )
            .all(options.locale)
            .map((row) => [row.stepEntryId, row.gloss])
        );
        db.exec(
          "BEGIN; DELETE FROM LexiconNameMeanings; DELETE FROM LexiconRelations; DELETE FROM LexiconTranslations; DELETE FROM DictionaryMeta;"
        );
        const entries = db
          .prepare(
            "SELECT id, language, baseCode, gloss FROM StepEntries ORDER BY id"
          )
          .all();
        const lookup = legacy.prepare(
          "SELECT * FROM SimpleStrongEntries WHERE language=? AND code=?"
        );
        const update = db.prepare(
          "UPDATE StepEntries SET meaning=?, gloss=? WHERE id=?"
        );
        const translation = db.prepare(
          "INSERT INTO LexiconTranslations(stepEntryId,language,gloss,meaning,meaningHtml) VALUES (?,?,?,?,?)"
        );
        for (const row of entries) {
          const historical = lookup.get(row.language, row.baseCode);
          const definition = String(historical?.definitionHtml ?? "");
          const gloss = String(localizedGlosses.get(row.id) || row.gloss);
          update.run(definition, gloss, row.id);
          translation.run(
            row.id,
            options.locale,
            gloss,
            definition,
            definition
          );
        }
        db.exec("COMMIT; VACUUM;");
      } finally {
        legacy.close();
        db.close();
      }
      const tables = readTables(sqlitePath, moduleId);
      const revision = deriveStrongLexiconModuleRevision(moduleId, tables, []);
      const counts = Object.fromEntries(
        Object.entries(tables).map(([table, rows]) => [table, rows.length])
      );
      const canonical = {
        format: "bible-strong-canonical-strong-lexicon-module",
        schemaVersion: 2,
        moduleId,
        revision,
        dependencies: [],
        tables,
        counts
      };
      const canonicalPath = path.join(staging, "canonical", `${moduleId}.json`);
      writeFileSync(canonicalPath, JSON.stringify(canonical) + "\n");
      bindRevision(sqlitePath, moduleId, revision, "");
      const archivePath = `${sqlitePath}.zip`;
      createZip(sqlitePath, archivePath);
      const manifest = {
        format: "bible-strong-resource-publication",
        schemaVersion: 1,
        identity: {
          kind: "strong-lexicon-module",
          moduleId,
          resourceId: `strong-lexicon:${moduleId}`,
          language: "mul"
        },
        revision,
        canonical: {
          path: `canonical/${moduleId}.json`,
          mediaType: "application/json",
          schemaVersion: 2,
          sha256: await sha256ResourcePublicationFile(canonicalPath),
          bytes: statSync(canonicalPath).size
        },
        offlineArtifact: {
          path: `offline/${entry}.zip`,
          mediaType: "application/zip",
          entry,
          sha256: await sha256ResourcePublicationFile(archivePath),
          bytes: statSync(archivePath).size,
          contentSha256: await sha256ResourcePublicationFile(sqlitePath)
        },
        provenance: {
          generator: "bible-lexicon-maker",
          sourceVersion: `firebase-legacy-${options.locale}-step-identities-v1`,
          sourceSha256: await sha256ResourcePublicationFile(options.legacyPath),
          generatedAt: new Date().toISOString()
        },
        rights: {
          holder:
            "Bible Strong historical lexicon contributors / STEP Bible identity data",
          termsReference: "docs/legacy-strong-simple-lexicons.md",
          attribution:
            "Historical Bible Strong definitions; STEP Bible lexical identities",
          reviewedAt: "2026-09-28",
          online: true,
          offline: true
        },
        deliveryCapabilities: {
          onlineAccess: true,
          offlineDownload: true,
          localDevelopmentAccess: true
        },
        dependencies: [],
        counts
      };
      writeFileSync(
        path.join(staging, "manifest.json"),
        JSON.stringify(manifest, null, 2) + "\n"
      );
      // Retain independent source fingerprints alongside the operator's bundle.
      writeFileSync(
        path.join(staging, "source-evidence.json"),
        JSON.stringify(
          {
            locale: options.locale,
            coreSha256: await sha256ResourcePublicationFile(options.corePath),
            legacySha256: manifest.provenance.sourceSha256
          },
          null,
          2
        ) + "\n"
      );
    },
    validate: validateStrongLexiconResourcePublication
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [locale, corePath, legacyPath, outputDir] = process.argv.slice(2);
  if (
    (locale !== "fr" && locale !== "en") ||
    !corePath ||
    !legacyPath ||
    !outputDir
  )
    throw new Error(
      "Usage: packageSimpleStrongLexicons.ts <fr|en> <core.sqlite> <legacy-simple.sqlite> <new-bundle-dir>"
    );
  await packageSimpleStrongLexicon({ locale, corePath, legacyPath, outputDir });
  console.log(readFileSync(path.join(outputDir, "manifest.json"), "utf8"));
}
