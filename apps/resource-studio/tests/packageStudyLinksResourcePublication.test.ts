import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { promisify } from "node:util";

import {
  buildStudyLinksResourcePublication,
  validateStudyLinksResourcePublication
} from "../src/packageStudyLinksResourcePublication.js";

const execFileAsync = promisify(execFile);

describe("study links publication", () => {
  it("builds a bundle that validates", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "study-links-bundle-"));
    try {
      const sqlitePath = path.join(directory, "study-links.sqlite");
      await execFileAsync("sqlite3", [
        sqlitePath,
        `CREATE TABLE study_link_nodes (kind TEXT, key TEXT);
         CREATE TABLE study_links (left_kind TEXT);
         INSERT INTO study_link_nodes VALUES ('nave', 'love');
         INSERT INTO study_links VALUES ('nave');
         CREATE TABLE RESOURCE_METADATA (revision TEXT, nodes_count INTEGER, links_count INTEGER);
         INSERT INTO RESOURCE_METADATA VALUES ('study-links-test', 1, 1);`
      ]);
      const { manifest } = await buildStudyLinksResourcePublication({
        sqlitePath,
        outputDir: path.join(directory, "bundle"),
        generatedAt: "2026-10-31T00:00:00.000Z"
      });
      assert.equal(manifest.identity.kind, "study-links");
      assert.equal(manifest.offlineArtifact.entry, "study-links.sqlite");
      await validateStudyLinksResourcePublication(path.join(directory, "bundle"));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
