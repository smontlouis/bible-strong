import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { packageStrongJsonlRelease } from "../src/packageStrongJsonlRelease";

const GENERATED = [
  ["ost", "OST"],
  ["nvs78p", "NVS78P"],
  ["neg79", "NEG79"],
  ["fmar", "FMAR"],
  ["nbs", "NBS"]
] as const;
const REFERENCES = [
  ["darby", "DARBY"],
  ["darbyr", "DARBYR"],
  ["sg1910", "SG1910"]
] as const;

test("packages all validated Strong JSONL artifacts into one atomic release", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "strong-jsonl-release-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  await writeFixtureSources(root);

  const result = await packageStrongJsonlRelease({
    root,
    outputDir: "release",
    generatedAt: "2026-07-20T00:00:00.000Z"
  });
  assert.equal(result.artifactCount, 8);
  const catalog = JSON.parse(
    await readFile(path.join(root, "release", "catalog.json"), "utf8")
  ) as {
    generatedAt: string;
    artifactCount: number;
    artifacts: Array<{
      id: string;
      file: string;
      manifest: string;
      sha256: string;
    }>;
  };
  assert.equal(catalog.generatedAt, "2026-07-20T00:00:00.000Z");
  assert.equal(catalog.artifactCount, 8);
  assert.deepEqual(
    catalog.artifacts.map((artifact) => artifact.id),
    [...GENERATED, ...REFERENCES].map(([id]) => id)
  );
  for (const artifact of catalog.artifacts) {
    const bytes = await readFile(path.join(root, "release", artifact.file));
    assert.equal(sha256(bytes), artifact.sha256);
    const manifest = JSON.parse(
      await readFile(path.join(root, "release", artifact.manifest), "utf8")
    ) as { id: string; sha256: string };
    assert.equal(manifest.id, artifact.id);
    assert.equal(manifest.sha256, artifact.sha256);
  }

  await assert.rejects(
    packageStrongJsonlRelease({ root, outputDir: "release" }),
    /strong-jsonl-release-already-exists/u
  );

  await appendFile(
    path.join(root, "outputs", "strong-jsonl", "ost", "bible-ost-strong.jsonl"),
    "tampered"
  );
  await assert.rejects(
    packageStrongJsonlRelease({ root, outputDir: "tampered-release" }),
    /strong-jsonl-release-artifact-(?:hash|size)-mismatch:ost/u
  );
});

test("packages only generated Bibles in the permissive release", async (t) => {
  const root = await mkdtemp(
    path.join(tmpdir(), "strong-jsonl-permissive-release-")
  );
  t.after(async () => rm(root, { recursive: true, force: true }));
  await writeFixtureSources(root);

  const result = await packageStrongJsonlRelease({
    root,
    outputDir: "permissive-release",
    generatedAt: "2026-07-20T00:00:00.000Z",
    view: "permissive"
  });
  assert.equal(result.artifactCount, 5);
  const catalog = JSON.parse(
    await readFile(
      path.join(root, "permissive-release", "catalog.json"),
      "utf8"
    )
  ) as {
    view: string;
    artifactCount: number;
    artifacts: Array<{ id: string; view: string }>;
  };
  assert.equal(catalog.view, "permissive");
  assert.equal(catalog.artifactCount, 5);
  assert.deepEqual(
    catalog.artifacts.map((artifact) => artifact.id),
    GENERATED.map(([id]) => id)
  );
  assert.ok(
    catalog.artifacts.every((artifact) => artifact.view === "permissive")
  );
});

async function writeFixtureSources(root: string): Promise<void> {
  for (const [id, version] of GENERATED) {
    const directory = path.join(root, "outputs", "strong-jsonl", id);
    await mkdir(directory, { recursive: true });
    const artifact = `${JSON.stringify({
      ref: "Gen.1.1",
      version,
      text: '<w strong="H1254">créa</w>'
    })}\n`;
    const artifactPath = path.join(directory, `bible-${id}-strong.jsonl`);
    await writeFile(artifactPath, artifact);
    await writeJson(path.join(directory, "manifest.json"), {
      bible: id,
      version,
      status: "validated-full-artifact",
      scope: "all",
      view: "reader",
      artifact: {
        sha256: sha256(Buffer.from(artifact)),
        sizeBytes: Buffer.byteLength(artifact)
      },
      metrics: { verseCount: 1 }
    });

    const permissiveDirectory = path.join(
      root,
      "outputs",
      "strong-jsonl-permissive",
      id
    );
    await mkdir(permissiveDirectory, { recursive: true });
    const permissiveArtifactPath = path.join(
      permissiveDirectory,
      `bible-${id}-strong.jsonl`
    );
    await writeFile(permissiveArtifactPath, artifact);
    await writeJson(path.join(permissiveDirectory, "manifest.json"), {
      bible: id,
      version,
      status: "validated-full-artifact",
      scope: "all",
      view: "permissive",
      artifact: {
        sha256: sha256(Buffer.from(artifact)),
        sizeBytes: Buffer.byteLength(artifact)
      },
      metrics: { verseCount: 1 }
    });
  }

  const referenceDirectory = path.join(
    root,
    "outputs",
    "strong-references-jsonl-step"
  );
  await mkdir(referenceDirectory, { recursive: true });
  const artifacts = [];
  for (const [id, version] of REFERENCES) {
    const file = `bible-${id}-strong.jsonl`;
    const content = `${JSON.stringify({
      ref: "Gen.1.1",
      version,
      text: '<w strong="H1254">créa</w>'
    })}\n`;
    await writeFile(path.join(referenceDirectory, file), content);
    artifacts.push({
      file,
      version,
      sha256: sha256(Buffer.from(content)),
      sizeBytes: Buffer.byteLength(content),
      metrics: { verseCount: 1 }
    });
  }
  await writeJson(path.join(referenceDirectory, "manifest.json"), {
    format: "jsonl",
    artifacts
  });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
