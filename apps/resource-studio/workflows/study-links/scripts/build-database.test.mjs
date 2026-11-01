import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { promisify } from "node:util";
import { buildDatabase, databaseSql, graphRevision } from "./build-database.mjs";

const execFileAsync = promisify(execFile);

const graph = {
  nodes: [
    { kind: "nave", key: "love", labelFr: "Amour", labelEn: "Love", detailFr: null, detailEn: null, language: null, position: null },
    { kind: "entity", key: "David@Rut.4.17-Rev", labelFr: "David", labelEn: "David", detailFr: "Roi d'Israël", detailEn: "King", language: null, position: -1040 }
  ],
  edges: [
    {
      left: { kind: "entity", key: "David@Rut.4.17-Rev" },
      right: { kind: "nave", key: "love" },
      role: null
    }
  ]
};

describe("study links database", () => {
  it("escapes French text", () => {
    assert.match(databaseSql(graph), /Roi d''Israël/);
  });

  it("derives one revision from the content, whatever the order", () => {
    assert.equal(
      graphRevision(graph),
      graphRevision({ ...graph, nodes: [...graph.nodes].reverse() })
    );
  });

  it("writes a database the app can read", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "study-links-"));
    try {
      const outputPath = path.join(directory, "study-links.sqlite");
      const { revision } = await buildDatabase({ graph, outputPath });
      const { stdout } = await execFileAsync("sqlite3", [
        "-json",
        outputPath,
        `SELECT n.label_fr, m.revision, m.links_count
         FROM study_links l
         JOIN study_link_nodes n ON n.kind = l.right_kind AND n.key = l.right_key
         CROSS JOIN RESOURCE_METADATA m
         WHERE l.left_kind = 'entity'`
      ]);
      assert.deepEqual(JSON.parse(stdout), [
        { label_fr: "Amour", revision, links_count: 1 }
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
