#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultSourcesRoot } from "./export-sources.mjs";

const outputRoot = path.resolve(defaultSourcesRoot, "..");

const quote = (value) =>
  value === null || value === undefined
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : `'${String(value).replaceAll("'", "''")}'`;

export const databaseSql = ({ nodes, edges }) => {
  const sortedNodes = [...nodes].sort(
    (left, right) =>
      left.kind.localeCompare(right.kind) || left.key.localeCompare(right.key)
  );
  const sortedEdges = [...edges].sort((left, right) =>
    edgeId(left).localeCompare(edgeId(right))
  );
  return [
    "PRAGMA journal_mode=DELETE;",
    "BEGIN;",
    `CREATE TABLE study_link_nodes (
       kind TEXT NOT NULL,
       key TEXT NOT NULL,
       label_fr TEXT NOT NULL,
       label_en TEXT NOT NULL,
       detail_fr TEXT,
       detail_en TEXT,
       language TEXT,
       position INTEGER,
       PRIMARY KEY (kind, key)
     ) WITHOUT ROWID;`,
    `CREATE TABLE study_links (
       left_kind TEXT NOT NULL,
       left_key TEXT NOT NULL,
       right_kind TEXT NOT NULL,
       right_key TEXT NOT NULL,
       role TEXT,
       PRIMARY KEY (left_kind, left_key, right_kind, right_key)
     ) WITHOUT ROWID;`,
    ...sortedNodes.map(
      (node) =>
        `INSERT INTO study_link_nodes VALUES (${[
          node.kind,
          node.key,
          node.labelFr,
          node.labelEn,
          node.detailFr,
          node.detailEn,
          node.language,
          node.position
        ]
          .map(quote)
          .join(",")});`
    ),
    ...sortedEdges.map(
      ({ left, right, role }) =>
        `INSERT INTO study_links VALUES (${[
          left.kind,
          left.key,
          right.kind,
          right.key,
          role
        ]
          .map(quote)
          .join(",")});`
    ),
    "CREATE INDEX study_links_right ON study_links (right_kind, right_key);",
    "COMMIT;"
  ].join("\n");
};

const edgeId = ({ left, right }) =>
  `${left.kind}|${left.key}|${right.kind}|${right.key}`;

export const graphRevision = ({ nodes, edges }) => {
  const canonical = databaseSql({ nodes, edges });
  return `study-links-${createHash("sha256").update(canonical).digest("hex").slice(0, 20)}`;
};

const runSqlite = (databasePath, sql) =>
  new Promise((resolve, reject) => {
    const child = spawn("sqlite3", [databasePath], {
      stdio: ["pipe", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`sqlite3-exit-${code}:${stderr.trim()}`))
    );
    child.stdin.end(`${sql}\n`);
  });

export const buildDatabase = async ({ graph, outputPath }) => {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await rm(outputPath, { force: true });
  const revision = graphRevision(graph);
  await runSqlite(
    outputPath,
    `${databaseSql(graph)}
     CREATE TABLE RESOURCE_METADATA (
       resource_id TEXT NOT NULL,
       revision TEXT NOT NULL,
       schema_version INTEGER NOT NULL,
       nodes_count INTEGER NOT NULL,
       links_count INTEGER NOT NULL
     );
     INSERT INTO RESOURCE_METADATA VALUES (
       'study-links', ${quote(revision)}, 1, ${graph.nodes.length}, ${graph.edges.length}
     );
     VACUUM;`
  );
  return { outputPath, revision };
};

const main = async () => {
  const graph = JSON.parse(await readFile(path.join(outputRoot, "graph.json"), "utf8"));
  const result = await buildDatabase({
    graph,
    outputPath: path.join(outputRoot, "study-links.sqlite")
  });
  console.log(JSON.stringify({ ...result, nodes: graph.nodes.length, links: graph.edges.length }));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
