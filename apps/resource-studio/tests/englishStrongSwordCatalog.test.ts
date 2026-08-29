import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

interface SwordSourceCatalog {
  format: string;
  schemaVersion: number;
  sources: Array<{
    id: string;
    applicationVersionId: string;
    datasetId: string;
    moduleName: string;
    archiveName: string;
    url: string;
    sha256: string;
  }>;
}

test("pins the approved English Strong source batch without KJVS", async () => {
  const catalog = JSON.parse(
    await readFile("src/englishStrongSwordSources.json", "utf8")
  ) as SwordSourceCatalog;

  assert.equal(catalog.format, "bible-strong-sword-source-catalog");
  assert.equal(catalog.schemaVersion, 1);
  assert.deepEqual(
    catalog.sources.map(({ id }) => id),
    [
      "kjv",
      "nasb2020",
      "nasb1995",
      "bsb",
      "asv",
      "darby-en",
      "rlt",
      "rwebster",
      "rv1895"
    ]
  );
  assert.ok(
    catalog.sources.every(
      (source) =>
        source.applicationVersionId !== "KJVS" &&
        source.datasetId !== "KJVS" &&
        source.url.startsWith("https://") &&
        /^[a-f0-9]{64}$/u.test(source.sha256) &&
        source.archiveName.endsWith(".zip") &&
        source.moduleName.length > 0
    )
  );
  assert.equal(
    new Set(
      catalog.sources.map(({ applicationVersionId }) => applicationVersionId)
    ).size,
    catalog.sources.length
  );
});
