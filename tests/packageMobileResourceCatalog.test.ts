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
    assert.equal(inventory.length, 72);
    assert.equal(
      inventory.filter((item: { id: string }) => item.id.startsWith("bible:"))
        .length,
      47
    );
    assert.equal(
      inventory.filter((item: { id: string }) =>
        item.id.startsWith("database:")
      ).length,
      8
    );
    assert.equal(
      inventory.filter(
        (item: { sources: unknown[] }) => item.sources.length > 1
      ).length,
      25
    );
    const nbs = inventory.find(
      (item: { id: string }) => item.id === "bible:NBS"
    );
    assert.deepEqual(
      nbs.sources.map((source: { role: string }) => source.role).sort(),
      ["canonical", "pericope", "redWords"]
    );
    assert.ok(
      inventory.every((item: { artifactUrl: string }) =>
        item.artifactUrl.endsWith(".zip")
      )
    );
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
      "https://assets.test/bibles/bible-test.json.zip"
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
          path.join(appRoot, "src/assets/mobile-resource-catalog.json"),
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
});
