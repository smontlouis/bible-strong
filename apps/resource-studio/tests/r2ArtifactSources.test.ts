import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { promisify } from "node:util";

import {
  findInterlinearTextMismatches,
  validateMobileResourceInventory
} from "../src/packageMobileResourceCatalog.js";
import {
  findBuiltArchives,
  patchMobileCatalog
} from "../src/r2ArtifactSources.js";

const execFileAsync = promisify(execFile);
const sha256 = (value: Buffer | string) =>
  createHash("sha256").update(value).digest("hex");

const PUBLISHED_TEXT = {
  textRevision: "bhg-803c482ed06005693547",
  textSha256: "803c482ed06005693547f9ea04a2dcbec4718c1d97ab0c531d60600e4c3a9d8f"
};
const NEXT_TEXT = {
  textRevision: "bhg-e15bd9f0f1a91140579c",
  textSha256: "e15bd9f0f1a91140579c9eb9c8f4e173b8a4df361859758e0fe252ef55edc107"
};

const RESOURCES = [
  {
    id: "bible:BHG",
    file: "bibles/bible-step.json.zip",
    entry: "bible-step.json"
  },
  {
    id: "bible-interlinear:BHG:fr",
    file: "bibles/bible-step-interlinear-fr.sqlite.zip",
    entry: "bible-step-interlinear-fr.sqlite"
  },
  {
    id: "bible-interlinear:BHG:en",
    file: "bibles/bible-step-interlinear-en.sqlite.zip",
    entry: "bible-step-interlinear-en.sqlite"
  }
] as const;

/** A workspace holding the delivered catalog, its inventory and rebuilt bundles. */
async function createWorkspace() {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "catalog-patch-"));
  const root = path.join(workspace, "apps/resource-studio");
  const catalogPath = path.join(
    workspace,
    "packages/resource-catalog/src/mobile-resource-catalog.json"
  );
  await mkdir(path.join(root, "config"), { recursive: true });
  await mkdir(path.dirname(catalogPath), { recursive: true });
  await writeFile(
    path.join(root, "config/mobile-resource-inventory.json"),
    JSON.stringify(
      RESOURCES.map((resource) => ({
        id: resource.id,
        artifactUrl: `https://assets.bible-strong.app/${resource.file}`,
        sources: [
          {
            role: "canonical",
            sourceUrl: `https://assets.bible-strong.app/${resource.file}`,
            entry: resource.entry
          }
        ],
        strategy: resource.entry.endsWith(".json")
          ? "sqlite-import"
          : "archive-extract",
        ...PUBLISHED_TEXT
      }))
    )
  );
  const catalog = {
    format: "bible-strong-mobile-resource-catalog",
    schemaVersion: 1,
    generatedAt: "2026-10-08T17:23:43.000Z",
    resourceCount: RESOURCES.length,
    resources: Object.fromEntries(
      RESOURCES.map((resource, index) => [
        resource.id,
        {
          id: resource.id,
          file: resource.file,
          entry: resource.entry,
          archiveSha256: String(index).repeat(64),
          ...PUBLISHED_TEXT,
          encryptedArchive: { file: `${resource.file}.encrypted` }
        }
      ])
    )
  };
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  const writeBundle = async (
    bundleDir: string,
    resource: (typeof RESOURCES)[number],
    manifest: Record<string, unknown>,
    canonical: Record<string, unknown>
  ) => {
    await mkdir(path.join(bundleDir, "canonical"), { recursive: true });
    await mkdir(path.join(bundleDir, "offline"), { recursive: true });
    const entryPath = path.join(bundleDir, "offline", resource.entry);
    await writeFile(
      entryPath,
      resource.entry.endsWith(".json")
        ? JSON.stringify({ 1: { 1: { 1: "בְּרֵאשִׁית" } } })
        : Buffer.concat([
            Buffer.from("SQLite format 3\0"),
            Buffer.from(resource.id)
          ])
    );
    const archivePath = path.join(
      bundleDir,
      "offline",
      `${resource.entry}.zip`
    );
    await execFileAsync("zip", ["-X", "-q", "-j", archivePath, entryPath]);
    await rm(entryPath);
    await writeFile(
      path.join(bundleDir, "canonical/publication.json"),
      JSON.stringify(canonical)
    );
    await writeFile(
      path.join(bundleDir, "manifest.json"),
      JSON.stringify({
        ...manifest,
        canonical: { path: "canonical/publication.json" },
        offlineArtifact: {
          path: `offline/${resource.entry}.zip`,
          entry: resource.entry,
          sha256: sha256(await readFile(archivePath))
        }
      })
    );
  };

  const textBundles = path.join(workspace, "bundles/text");
  const indexBundles = path.join(workspace, "bundles/indexes");
  await writeBundle(
    path.join(textBundles, "bhg"),
    RESOURCES[0],
    {
      identity: { kind: "bible-text", versionId: "BHG", language: "he-grc" },
      revision: NEXT_TEXT.textRevision
    },
    NEXT_TEXT
  );
  for (const [language, resource] of [
    ["fr", RESOURCES[1]],
    ["en", RESOURCES[2]]
  ] as const) {
    await writeBundle(
      path.join(indexBundles, language),
      resource,
      {
        identity: {
          kind: "interlinear-index",
          versionId: "BHG",
          datasetId: "STEP",
          language
        },
        revision: `bhg-interlinear-${language}-next`,
        dependencies: {
          bible: {
            resourceIdentity: "bible-text:BHG",
            revision: NEXT_TEXT.textRevision,
            textSha256: NEXT_TEXT.textSha256
          }
        }
      },
      {}
    );
  }
  const readCatalog = async () =>
    JSON.parse(await readFile(catalogPath, "utf8")) as {
      generatedAt: string;
      resources: Record<string, Record<string, unknown>>;
    };
  return { workspace, root, textBundles, indexBundles, readCatalog };
}

describe("catalog text declarations", () => {
  test("reads the text a bundle carries or requires", async () => {
    const { workspace, textBundles, indexBundles } = await createWorkspace();
    try {
      const archives = await findBuiltArchives([textBundles, indexBundles]);

      assert.deepEqual(
        archives.map(({ catalogId, kind, text }) => ({
          catalogId,
          kind,
          text
        })),
        [
          { catalogId: "bible:BHG", kind: "bible-text", text: NEXT_TEXT },
          {
            catalogId: "bible-interlinear:BHG:en",
            kind: "interlinear-index",
            text: NEXT_TEXT
          },
          {
            catalogId: "bible-interlinear:BHG:fr",
            kind: "interlinear-index",
            text: NEXT_TEXT
          }
        ]
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  test("patches a text and its indexes with the text the bundles declare", async () => {
    const { workspace, root, textBundles, indexBundles, readCatalog } =
      await createWorkspace();
    try {
      const patched = await patchMobileCatalog({
        root,
        bundleRoots: [textBundles, indexBundles],
        generatedAt: "2026-10-09T08:00:00.000Z"
      });

      assert.deepEqual(
        [...patched].sort(),
        RESOURCES.map(({ id }) => id).sort()
      );
      const catalog = await readCatalog();
      assert.equal(catalog.generatedAt, "2026-10-09T08:00:00.000Z");
      for (const { id, entry } of RESOURCES) {
        const resource = catalog.resources[id]!;
        assert.equal(resource.entry, entry);
        assert.equal(resource.textRevision, NEXT_TEXT.textRevision);
        assert.equal(resource.textSha256, NEXT_TEXT.textSha256);
        assert.match(
          String(resource.url),
          new RegExp(`\\?sha256=${String(resource.archiveSha256)}$`, "u")
        );
        // A rebuilt archive loses its encrypted copy until it is recreated.
        assert.equal(resource.encryptedArchive, undefined);
      }
      assert.deepEqual(findInterlinearTextMismatches(catalog.resources), []);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  test("refuses a text patched without the indexes rebuilt for it", async () => {
    const { workspace, root, textBundles, readCatalog } =
      await createWorkspace();
    try {
      const before = await readCatalog();
      await assert.rejects(
        patchMobileCatalog({
          root,
          bundleRoots: [textBundles],
          generatedAt: "2026-10-09T08:00:00.000Z"
        }),
        /mobile-catalog-interlinear-text-mismatch:bible-interlinear:BHG:en,bible-interlinear:BHG:fr/
      );
      assert.deepEqual(await readCatalog(), before);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  test("refuses indexes patched without the text they were rebuilt for", async () => {
    const { workspace, root, indexBundles, readCatalog } =
      await createWorkspace();
    try {
      const before = await readCatalog();
      await assert.rejects(
        patchMobileCatalog({
          root,
          bundleRoots: [indexBundles],
          generatedAt: "2026-10-09T08:00:00.000Z"
        }),
        /mobile-catalog-interlinear-text-mismatch/
      );
      assert.deepEqual(await readCatalog(), before);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  const inventoryEntry = (
    id: string,
    file: string,
    text?: { textRevision?: string; textSha256?: string }
  ) => ({
    id,
    artifactUrl: `https://assets.test/${file}.zip`,
    sources: [
      {
        role: "canonical" as const,
        sourceUrl: `https://assets.test/${file}.zip`,
        entry: file
      }
    ],
    strategy: "archive-extract" as const,
    ...text
  });

  test("an inventory never lists an index without the text it was built for", () => {
    const bible = inventoryEntry(
      "bible:BHG",
      "bible-step.json",
      PUBLISHED_TEXT
    );
    const index = (text?: { textRevision?: string; textSha256?: string }) =>
      inventoryEntry(
        "bible-interlinear:BHG:fr",
        "bible-step-interlinear-fr.sqlite",
        text
      );

    validateMobileResourceInventory([bible, index(PUBLISHED_TEXT)]);
    assert.throws(
      () => validateMobileResourceInventory([bible, index()]),
      /mobile-resource-text-identity-missing:bible-interlinear:BHG:fr/
    );
    assert.throws(
      () =>
        validateMobileResourceInventory([
          bible,
          index({ textRevision: PUBLISHED_TEXT.textRevision })
        ]),
      /mobile-resource-text-identity-invalid:bible-interlinear:BHG:fr/
    );
    assert.throws(
      () => validateMobileResourceInventory([bible, index(NEXT_TEXT)]),
      /mobile-resource-interlinear-text-mismatch:bible-interlinear:BHG:fr/
    );
  });

  test("the checked-in catalog declares what the checked-in inventory declares", async () => {
    const inventory = JSON.parse(
      await readFile(
        path.resolve("config/mobile-resource-inventory.json"),
        "utf8"
      )
    ) as Array<{ id: string; textRevision?: string; textSha256?: string }>;
    const catalog = JSON.parse(
      await readFile(
        path.resolve(
          "../../packages/resource-catalog/src/mobile-resource-catalog.json"
        ),
        "utf8"
      )
    ) as {
      resources: Record<string, { textRevision?: string; textSha256?: string }>;
    };

    const declared = inventory.filter((entry) => entry.textRevision);
    assert.deepEqual(declared.map((entry) => entry.id).sort(), [
      "bible-interlinear:BHG:en",
      "bible-interlinear:BHG:fr",
      "bible:BHG"
    ]);
    for (const entry of inventory) {
      assert.equal(
        catalog.resources[entry.id]!.textRevision,
        entry.textRevision,
        entry.id
      );
      assert.equal(
        catalog.resources[entry.id]!.textSha256,
        entry.textSha256,
        entry.id
      );
    }
    assert.deepEqual(findInterlinearTextMismatches(catalog.resources), []);
  });
});
