#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { comparePassages, parsePassage } from "./commentary-scope.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultLibraryRoot = path.resolve(
  scriptDirectory,
  "..",
  ".local",
  "library"
);
const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));

const adjacent = (left, right) => {
  const a = parsePassage(left);
  const b = parsePassage(right);
  return (
    a &&
    b &&
    a.book === b.book &&
    a.chapter === b.chapter &&
    b.verse === a.verse + 1
  );
};

export const auditCanonicalCommentaryUnits = async (
  libraryRoot = defaultLibraryRoot
) => {
  const index = await readJson(path.join(libraryRoot, "index.json"));
  const descriptors = new Map();
  for (const chapter of index.chapters) {
    for (const [resourceId, descriptor] of Object.entries(
      chapter.resources ?? {}
    )) {
      descriptors.set(descriptor.path, { resourceId, ...descriptor });
    }
  }

  const resources = new Map();
  for (const descriptor of descriptors.values()) {
    const chunk = await readJson(path.join(libraryRoot, descriptor.path));
    const entries = resources.get(descriptor.resourceId) ?? [];
    entries.push(...chunk.entries);
    resources.set(descriptor.resourceId, entries);
  }

  const findings = [];
  const summaries = [];
  for (const [resourceId, entries] of [...resources.entries()].sort(
    ([left], [right]) => left.localeCompare(right)
  )) {
    const sorted = [...entries].sort(
      (left, right) =>
        comparePassages(left.passage, right.passage) ||
        left.id.localeCompare(right.id)
    );
    const ids = new Set();
    let rangedUnits = 0;
    let canonicalSourceAnchorUnits = 0;
    for (const entry of sorted) {
      if (ids.has(entry.id))
        findings.push({
          resourceId,
          kind: "duplicate-entry-id",
          entryIds: [entry.id]
        });
      ids.add(entry.id);
      if (
        entry.scope?.end &&
        comparePassages(entry.scope.end, entry.scope.start) > 0
      )
        rangedUnits += 1;
      if (entry.sourceAnchors?.length > 1) canonicalSourceAnchorUnits += 1;
    }

    let unresolvedRepeatedUnits = 0;
    for (let start = 0; start < sorted.length;) {
      const sourceSha256 = sorted[start]?.source?.sha256;
      let end = start + 1;
      while (
        sourceSha256 &&
        end < sorted.length &&
        sorted[end]?.source?.sha256 === sourceSha256 &&
        adjacent(sorted[end - 1].passage, sorted[end].passage)
      )
        end += 1;
      const run = sorted.slice(start, end);
      if (
        run.length > 1 &&
        run.every((entry) => !entry.sourceAnchors?.length)
      ) {
        unresolvedRepeatedUnits += 1;
        findings.push({
          resourceId,
          kind: "adjacent-identical-source-unresolved",
          sourceSha256,
          entryIds: run.map((entry) => entry.id),
          passages: run.map((entry) => entry.passage)
        });
      }
      start = end;
    }
    summaries.push({
      resourceId,
      entries: entries.length,
      rangedUnits,
      canonicalSourceAnchorUnits,
      unresolvedRepeatedUnits
    });
  }

  return {
    resourceCount: resources.size,
    entryCount: summaries.reduce(
      (total, resource) => total + resource.entries,
      0
    ),
    rangedUnitCount: summaries.reduce(
      (total, resource) => total + resource.rangedUnits,
      0
    ),
    canonicalSourceAnchorUnitCount: summaries.reduce(
      (total, resource) => total + resource.canonicalSourceAnchorUnits,
      0
    ),
    findingCount: findings.length,
    findings,
    resources: summaries
  };
};

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const libraryRoot = path.resolve(process.argv[2] ?? defaultLibraryRoot);
  auditCanonicalCommentaryUnits(libraryRoot)
    .then((report) => {
      process.stdout.write(
        `${JSON.stringify({ libraryRoot, ...report }, null, 2)}\n`
      );
      if (report.findingCount > 0) process.exitCode = 1;
    })
    .catch((error) => {
      process.stderr.write(`${error.stack ?? error.message}\n`);
      process.exitCode = 1;
    });
}
