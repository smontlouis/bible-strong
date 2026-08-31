import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { auditCanonicalCommentaryUnits } from "./audit-canonical-units.mjs";

const fixture = async (entries) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commentary-unit-audit-"));
  await mkdir(path.join(root, "chunks/1/1"), { recursive: true });
  await writeFile(
    path.join(root, "chunks/1/1/example.json"),
    JSON.stringify({ resourceId: "example", entries })
  );
  await writeFile(
    path.join(root, "index.json"),
    JSON.stringify({
      chapters: [
        {
          book: 1,
          chapter: 1,
          resources: { example: { path: "chunks/1/1/example.json" } }
        }
      ]
    })
  );
  return root;
};

test("accepts one canonical unit carrying several source anchors", async () => {
  const root = await fixture([
    {
      id: "one",
      passage: "1-1-3",
      source: { sha256: "same" },
      scope: { kind: "range", start: "1-1-3", end: "1-1-5" },
      sourceAnchors: [
        { id: "one", passage: "1-1-3" },
        { id: "two", passage: "1-1-4" },
        { id: "three", passage: "1-1-5" }
      ]
    }
  ]);
  try {
    const report = await auditCanonicalCommentaryUnits(root);
    assert.equal(report.findingCount, 0);
    assert.equal(report.canonicalSourceAnchorUnitCount, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects adjacent entries that still repeat one source unit", async () => {
  const root = await fixture(
    [3, 4, 5].map((verse) => ({
      id: String(verse),
      passage: `1-1-${verse}`,
      source: { sha256: "same" }
    }))
  );
  try {
    const report = await auditCanonicalCommentaryUnits(root);
    assert.equal(report.findingCount, 1);
    assert.equal(
      report.findings[0].kind,
      "adjacent-identical-source-unresolved"
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
