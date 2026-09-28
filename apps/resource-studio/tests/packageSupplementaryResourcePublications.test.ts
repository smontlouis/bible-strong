import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  buildSupplementaryResourcePublication,
  type SupplementaryResourceId
} from "../src/packageSupplementaryResourcePublications.js";

for (const resourceId of ["MHY", "TRESOR"] as const) {
  for (const extraTables of [false, true]) {
    test(`${resourceId} packages with extra tables: ${extraTables}`, async () => {
      await withFixture(resourceId, async (options, database) => {
        database.exec(
          "CREATE TABLE COMMENTAIRES(id TEXT PRIMARY KEY, commentaires TEXT)"
        );
        database
          .prepare("INSERT INTO COMMENTAIRES VALUES (?, ?)")
          .run(
            resourceId === "MHY" ? "1-1" : "1-1-1",
            JSON.stringify(
              resourceId === "MHY" ? { 1: "<p>Comment</p>" } : ["Jean 1:1"]
            )
          );
        if (extraTables) {
          database.exec(
            "CREATE TABLE FUTURE_METADATA(value TEXT); ALTER TABLE COMMENTAIRES ADD COLUMN extra TEXT"
          );
        }
        database.close();
        const { manifest } =
          await buildSupplementaryResourcePublication(options);
        const canonical = JSON.parse(
          await readFile(
            path.join(options.outputDir, manifest.canonical.path),
            "utf8"
          )
        );
        if (resourceId === "MHY") {
          assert.deepEqual(canonical.verses, [
            { verseKey: "1-1-1", content: "<p>Comment</p>" }
          ]);
        } else {
          assert.deepEqual(canonical.verseAnchors, [
            { verseKey: "1-1-1", references: ["Jean 1:1"] }
          ]);
        }
      });
    });
  }
  test(`${resourceId} rejects a database without COMMENTAIRES`, async () => {
    await withFixture(resourceId, async (options, database) => {
      database.exec("CREATE TABLE EXTRA(value TEXT)");
      database.close();
      await assert.rejects(
        buildSupplementaryResourcePublication(options),
        /supplementary-publication-sqlite-tables-invalid/
      );
    });
  });
}

async function withFixture(
  resourceId: SupplementaryResourceId,
  run: (
    options: Parameters<typeof buildSupplementaryResourcePublication>[0],
    database: DatabaseSync
  ) => Promise<void>
) {
  const root = await mkdtemp(path.join(tmpdir(), "supplementary-schema-"));
  const sqlitePath = path.join(root, "source.sqlite");
  const database = new DatabaseSync(sqlitePath);
  try {
    await run(
      {
        resourceId,
        sqlitePath,
        outputDir: path.join(root, "bundle"),
        sourceVersion: "fixture-v1",
        rights: {
          holder: "Fixture",
          termsReference: "https://example.com/terms",
          attribution: "Fixture",
          online: true,
          offline: true
        },
        deliveryCapabilities: { onlineAccess: true, offlineDownload: true }
      },
      database
    );
  } finally {
    if (database.isOpen) database.close();
    await rm(root, { recursive: true, force: true });
  }
}
