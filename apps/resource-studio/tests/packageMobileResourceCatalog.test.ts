import { execFile } from "node:child_process";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { promisify } from "node:util";

import {
  buildMobileResourceCatalog,
  parseMobileResourceCliArgs,
  validateMobileResourceInventory
} from "../src/packageMobileResourceCatalog.js";

const execFileAsync = promisify(execFile);

describe("mobile resource catalog", () => {
  test("rejects ambiguous CLI options", () => {
    assert.throws(
      () => parseMobileResourceCliArgs(["--app-rooot", "../app"]),
      /mobile-resource-cli-option-unknown/
    );
    assert.throws(
      () => parseMobileResourceCliArgs(["--app-root"]),
      /mobile-resource-cli-option-value-missing/
    );
  });
  test("accepts a deterministic catalog generation date", () => {
    assert.deepEqual(
      parseMobileResourceCliArgs([
        "--generated-at",
        "2026-08-19T21:00:00.000Z"
      ]),
      { "--generated-at": "2026-08-19T21:00:00.000Z" }
    );
  });
  test("the checked-in inventory covers the complete mobile catalog", async () => {
    const inventory = JSON.parse(
      await readFile(
        path.resolve("config/mobile-resource-inventory.json"),
        "utf8"
      )
    );
    const required = JSON.parse(
      await readFile(
        path.resolve("config/mobile-resource-required-ids.json"),
        "utf8"
      )
    );
    validateMobileResourceInventory(
      inventory,
      required.resourceIds,
      required.bundleRoles
    );
    const catalog = JSON.parse(
      await readFile(
        path.resolve(
          "../../packages/resource-catalog/src/mobile-resource-catalog.json"
        ),
        "utf8"
      )
    );
    assert.deepEqual(
      inventory.map((item: { id: string }) => item.id).sort(),
      Object.keys(catalog.resources).sort()
    );
    assert.equal(inventory.length, required.resourceIds.length);
    assert.equal(
      inventory.filter((item: { id: string }) => item.id.startsWith("bible:"))
        .length,
      47
    );
    assert.ok(
      inventory.some(
        (item: { id: string }) => item.id === "dictionary-directory"
      )
    );
    // Only Bibles not yet republished as self-contained canonical archives
    // still carry pericope and red-word side files (ADR-0066).
    for (const item of inventory as Array<{
      id: string;
      sources: Array<{ role: string }>;
    }>) {
      if (item.sources.length === 1) continue;
      assert.ok(item.id.startsWith("bible:"), item.id);
      assert.deepEqual(
        item.sources
          .map((source) => source.role)
          .filter((role) => role === "canonical"),
        ["canonical"]
      );
    }
    assert.ok(
      inventory.every((item: { artifactUrl: string }) =>
        item.artifactUrl.endsWith(".zip")
      )
    );
    const strongCore = inventory.find(
      (item: { id: string }) => item.id === "strong-lexicon:core"
    );
    assert.match(strongCore.resourceRevision, /^strong-lexicon-core-/);
    for (const moduleId of ["entities", "resources"]) {
      const module = inventory.find(
        (item: { id: string }) => item.id === `strong-lexicon:${moduleId}`
      );
      assert.match(
        module.resourceRevision,
        new RegExp(`^strong-lexicon-${moduleId}-`)
      );
      assert.equal(module.coreRevision, strongCore.resourceRevision);
    }
    for (const language of ["en", "fr"]) {
      const simple = inventory.find(
        (item: { id: string }) =>
          item.id === `strong-lexicon:simple-${language}`
      );
      assert.match(
        simple.resourceRevision,
        new RegExp(`^strong-lexicon-simple-${language}-`)
      );
      assert.equal(simple.coreRevision, undefined);
    }
  });

  test("requires one unique ZIP artifact for every resource", () => {
    assert.throws(
      () =>
        validateMobileResourceInventory([
          {
            id: "bible:LSG",
            artifactUrl: "https://assets.test/bible-lsg.json",
            sources: [
              {
                role: "canonical",
                sourceUrl: "https://assets.test/bible-lsg.json",
                entry: "bible-lsg.json"
              }
            ],
            strategy: "sqlite-import"
          }
        ]),
      /mobile-resource-artifact-must-be-zip:bible:LSG/
    );

    assert.throws(
      () =>
        validateMobileResourceInventory([
          {
            id: "bible:LSG",
            artifactUrl: "https://assets.test/bible-lsg.json.zip",
            sources: [
              {
                role: "canonical",
                sourceUrl: "https://assets.test/bible-lsg.json",
                entry: "bible-lsg.json"
              }
            ],
            strategy: "sqlite-import"
          },
          {
            id: "bible:LSG",
            artifactUrl: "https://assets.test/other.json.zip",
            sources: [
              {
                role: "canonical",
                sourceUrl: "https://assets.test/other.json",
                entry: "other.json"
              }
            ],
            strategy: "sqlite-import"
          }
        ]),
      /mobile-resource-id-duplicate:bible:LSG/
    );

    assert.throws(
      () =>
        validateMobileResourceInventory(
          [
            {
              id: "bible:LSG",
              artifactUrl: "https://assets.test/bible-lsg.json.zip",
              sources: [
                {
                  role: "canonical",
                  sourceUrl: "https://assets.test/bible-lsg.json",
                  entry: "bible-lsg.json"
                }
              ],
              strategy: "sqlite-import"
            }
          ],
          ["bible:LSG", "database:NAVE:fr"]
        ),
      /mobile-resource-required-id-missing:database:NAVE:fr/
    );

    assert.throws(
      () =>
        validateMobileResourceInventory(
          [
            {
              id: "bible:LSG",
              artifactUrl: "https://assets.test/bible-lsg.json.zip",
              sources: [
                {
                  role: "canonical",
                  sourceUrl: "https://assets.test/bible-lsg.json",
                  entry: "bible-lsg.json"
                }
              ],
              strategy: "sqlite-import"
            }
          ],
          ["bible:LSG"],
          { "bible:LSG": ["redWords"] }
        ),
      /mobile-resource-bundle-contract-mismatch/
    );
  });

  test("packages a legacy Bible and its optional files in one ZIP", async () => {
    const temporaryRoot = await mkdtemp(
      path.join(os.tmpdir(), "mobile-resource-catalog-")
    );
    const outputDir = path.join(temporaryRoot, "release");
    const appRoot = path.join(temporaryRoot, "app");
    const content = Buffer.from('{"hello":"world"}\n');
    const pericope = Buffer.from('{"GEN.1":"Creation"}\n');
    const redWords = Buffer.from('{"MAT.3.15":[0,4]}\n');
    const result = await buildMobileResourceCatalog({
      outputDir,
      generatedAt: "2026-08-11T00:00:00.000Z",
      inventory: [
        {
          id: "bible:TEST",
          artifactUrl: "https://assets.test/bibles/bible-test.json.zip",
          sources: [
            {
              role: "canonical",
              sourceUrl: "https://assets.test/bibles/bible-test.json",
              entry: "bible-test.json"
            },
            {
              role: "pericope",
              sourceUrl: "https://assets.test/bibles/bible-test-pericope.json",
              entry: "bible-test-pericope.json"
            },
            {
              role: "redWords",
              sourceUrl: "https://assets.test/bibles/red-words-TEST.json",
              entry: "red-words-TEST.json"
            }
          ],
          strategy: "sqlite-import"
        }
      ],
      requiredIds: ["bible:TEST"],
      appRoot,
      fetcher: async (url) =>
        new Response(
          String(url).includes("pericope")
            ? pericope
            : String(url).includes("red-words")
              ? redWords
              : content
        )
    });

    const catalog = JSON.parse(await readFile(result.catalogPath, "utf8"));
    const artifact = catalog.resources["bible:TEST"];
    assert.equal(catalog.format, "bible-strong-mobile-resource-catalog");
    assert.equal(catalog.resourceCount, 1);
    assert.equal(
      artifact.url,
      `https://api.bible-strong.app/v1/offline-artifacts/bibles/bible-test.json.zip?sha256=${artifact.archiveSha256}`
    );
    assert.equal(artifact.entry, "bible-test.json");
    assert.deepEqual(Object.keys(artifact.entries).sort(), [
      "canonical",
      "pericope",
      "redWords"
    ]);
    assert.equal(artifact.entries.pericope.entry, "bible-test-pericope.json");
    assert.equal(
      artifact.contentBytes,
      content.length + pericope.length + redWords.length
    );
    assert.equal(
      artifact.archiveBytes,
      (await stat(path.join(outputDir, "bibles/bible-test.json.zip"))).size
    );
    assert.match(artifact.archiveSha256, /^[a-f0-9]{64}$/);
    assert.match(artifact.contentSha256, /^[a-f0-9]{64}$/);
    assert.equal(
      path.basename(result.catalogPath),
      "mobile-resource-catalog.json"
    );
    assert.deepEqual(
      (
        await execFileAsync("unzip", [
          "-Z1",
          path.join(outputDir, "bibles/bible-test.json.zip")
        ])
      ).stdout
        .trim()
        .split("\n")
        .sort(),
      ["bible-test-pericope.json", "bible-test.json", "red-words-TEST.json"]
    );
    assert.notDeepEqual(
      await readFile(path.join(outputDir, "bibles/bible-test.json.zip")),
      content
    );
    assert.deepEqual(
      JSON.parse(
        await readFile(
          path.join(
            appRoot,
            "packages/resource-catalog/src/mobile-resource-catalog.json"
          ),
          "utf8"
        )
      ),
      catalog
    );
    await assert.rejects(
      stat(
        path.join(appRoot, "src/assets/offline-resource-size-manifest.json")
      ),
      /ENOENT/
    );

    const secondOutputDir = path.join(temporaryRoot, "release-second");
    const previousUmask = process.umask(0o077);
    try {
      await buildMobileResourceCatalog({
        outputDir: secondOutputDir,
        generatedAt: "2026-08-11T00:00:00.000Z",
        inventory: [
          {
            id: "bible:TEST",
            artifactUrl: "https://assets.test/bibles/bible-test.json.zip",
            sources: [
              {
                role: "canonical",
                sourceUrl: "https://assets.test/bible.json",
                entry: "bible-test.json"
              },
              {
                role: "pericope",
                sourceUrl: "https://assets.test/pericope.json",
                entry: "bible-test-pericope.json"
              },
              {
                role: "redWords",
                sourceUrl: "https://assets.test/red-words.json",
                entry: "red-words-TEST.json"
              }
            ],
            strategy: "sqlite-import"
          }
        ],
        requiredIds: ["bible:TEST"],
        fetcher: async (url) =>
          new Response(
            String(url).includes("pericope")
              ? pericope
              : String(url).includes("red-words")
                ? redWords
                : content
          )
      });
    } finally {
      process.umask(previousUmask);
    }
    assert.deepEqual(
      await readFile(path.join(outputDir, "bibles/bible-test.json.zip")),
      await readFile(path.join(secondOutputDir, "bibles/bible-test.json.zip"))
    );
  });

  test("rejects an invalid direct JSON response", async () => {
    const temporaryRoot = await mkdtemp(
      path.join(os.tmpdir(), "mobile-resource-invalid-")
    );
    await assert.rejects(
      buildMobileResourceCatalog({
        outputDir: path.join(temporaryRoot, "release"),
        inventory: [
          {
            id: "bible:TEST",
            artifactUrl: "https://assets.test/bibles/bible-test.json.zip",
            sources: [
              {
                role: "canonical",
                sourceUrl: "https://assets.test/bibles/bible-test.json",
                entry: "bible-test.json"
              }
            ],
            strategy: "sqlite-import"
          }
        ],
        requiredIds: ["bible:TEST"],
        fetcher: async () => new Response("<html>gateway error</html>")
      }),
      /mobile-resource-json-invalid:bible:TEST:canonical/
    );
  });

  test("packages an exact local producer candidate through source overrides", async () => {
    const temporaryRoot = await mkdtemp(
      path.join(os.tmpdir(), "mobile-resource-local-")
    );
    const candidatePath = path.join(temporaryRoot, "candidate.json");
    await writeFile(candidatePath, '{"local":true}\n');
    const result = await buildMobileResourceCatalog({
      root: temporaryRoot,
      outputDir: "release",
      inventory: [
        {
          id: "bible:TEST",
          artifactUrl: "https://assets.test/bibles/bible-test.json.zip",
          sources: [
            {
              role: "canonical",
              sourceUrl: "https://assets.test/stale.json",
              entry: "bible-test.json"
            }
          ],
          strategy: "sqlite-import"
        }
      ],
      requiredIds: ["bible:TEST"],
      sourceOverrides: { "bible:TEST": { canonical: candidatePath } },
      fetcher: async () => {
        throw new Error("remote source must not be fetched");
      }
    });
    assert.equal(
      JSON.parse(await readFile(result.catalogPath, "utf8")).resources[
        "bible:TEST"
      ].entries.canonical.bytes,
      Buffer.byteLength('{"local":true}\n')
    );
  });
  test("repackages only the overridden entries on top of the delivered catalog", async () => {
    const temporaryRoot = await mkdtemp(
      path.join(os.tmpdir(), "mobile-resource-differential-")
    );
    const candidatePath = path.join(temporaryRoot, "candidate.json");
    await writeFile(candidatePath, '{"corrected":true}\n');
    const unchanged = {
      id: "database:abbott:en",
      url:
        "https://api.bible-strong.app/v1/offline-artifacts/commentaries/commentary-abbott-en.sqlite.zip?sha256=" +
        "c".repeat(64),
      file: "commentaries/commentary-abbott-en.sqlite.zip",
      entry: "commentary-abbott-en.sqlite",
      entries: {
        canonical: {
          entry: "commentary-abbott-en.sqlite",
          sha256: "d".repeat(64),
          bytes: 7
        }
      },
      archiveSha256: "c".repeat(64),
      archiveBytes: 5,
      contentSha256: "d".repeat(64),
      contentBytes: 7,
      installedBytes: 7,
      peakInstallationBytes: 14,
      strategy: "archive-extract",
      resourceRevision: "abbott-en-1",
      encryptedArchive: {
        file: "commentaries/commentary-abbott-en.sqlite.encrypted.zip",
        keyVersion: 1
      }
    };
    const delivered = {
      ...unchanged,
      id: "bible:TEST",
      file: "bibles/bible-hebrew.json.zip",
      entry: "bible-hebrew.json",
      strategy: "sqlite-import",
      resourceRevision: undefined
    };
    const baseCatalogPath = path.join(temporaryRoot, "delivered.json");
    // Delivered order is kept even where it is not sorted.
    await writeFile(
      baseCatalogPath,
      `${JSON.stringify(
        {
          format: "bible-strong-mobile-resource-catalog",
          schemaVersion: 1,
          generatedAt: "2026-11-26T04:11:48.172Z",
          resourceCount: 2,
          resources: {
            "database:abbott:en": unchanged,
            "bible:TEST": delivered
          }
        },
        null,
        2
      )}\n`
    );
    const inventory = [
      {
        id: "database:abbott:en",
        artifactUrl:
          "https://assets.test/commentaries/commentary-abbott-en.sqlite.zip",
        sources: [
          {
            role: "canonical" as const,
            sourceUrl:
              "https://assets.test/commentaries/commentary-abbott-en.sqlite",
            entry: "commentary-abbott-en.sqlite"
          }
        ],
        strategy: "archive-extract" as const,
        resourceRevision: "abbott-en-1"
      },
      {
        id: "bible:TEST",
        artifactUrl: "https://assets.test/bibles/bible-hebrew.json.zip",
        sources: [
          {
            role: "canonical" as const,
            sourceUrl: "https://assets.test/bibles/bible-hebrew.json",
            entry: "bible-hebrew.json"
          }
        ],
        strategy: "sqlite-import" as const
      }
    ];
    const options = {
      root: temporaryRoot,
      inventory,
      requiredIds: ["bible:TEST", "database:abbott:en"],
      requiredBundleRoles: {},
      sourceOverrides: { "bible:TEST": { canonical: candidatePath } },
      baseCatalogPath,
      fetcher: async () => {
        throw new Error("unchanged sources must not be fetched");
      }
    };
    const result = await buildMobileResourceCatalog({
      ...options,
      outputDir: "release",
      generatedAt: "2026-11-27T12:00:00.000Z"
    });
    const catalog = JSON.parse(await readFile(result.catalogPath, "utf8"));
    assert.equal(catalog.resourceCount, 2);
    assert.equal(catalog.generatedAt, "2026-11-27T12:00:00.000Z");
    assert.deepEqual(Object.keys(catalog.resources), [
      "database:abbott:en",
      "bible:TEST"
    ]);
    assert.equal(
      JSON.stringify(catalog.resources["database:abbott:en"]),
      JSON.stringify(unchanged)
    );
    const rebuilt = catalog.resources["bible:TEST"];
    assert.equal(rebuilt.file, "bibles/bible-hebrew.json.zip");
    assert.equal(rebuilt.entry, "bible-hebrew.json");
    assert.equal(rebuilt.encryptedArchive, undefined);
    assert.equal(
      rebuilt.entries.canonical.bytes,
      Buffer.byteLength('{"corrected":true}\n')
    );
    assert.equal(
      rebuilt.url,
      `https://api.bible-strong.app/v1/offline-artifacts/bibles/bible-hebrew.json.zip?sha256=${rebuilt.archiveSha256}`
    );

    await assert.rejects(
      buildMobileResourceCatalog({
        ...options,
        outputDir: "release-older",
        generatedAt: "2026-11-01T00:00:00.000Z"
      }),
      /mobile-resource-base-catalog-newer/
    );
    await assert.rejects(
      buildMobileResourceCatalog({
        ...options,
        outputDir: "release-without-overrides",
        sourceOverrides: {},
        generatedAt: "2026-11-27T12:00:00.000Z"
      }),
      /mobile-resource-base-catalog-overrides-required/
    );
  });
});
