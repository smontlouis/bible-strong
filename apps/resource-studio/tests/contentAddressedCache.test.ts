import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  cacheRecordIsCurrent,
  cacheRecordMatches,
  contentFingerprint,
  writeCacheRecord
} from "../src/contentAddressedCache.js";

test("invalidates fingerprints when content or configuration changes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "strong-cache-test-"));
  const input = path.join(directory, "input.json");
  const output = path.join(directory, "output.json");
  const metadata = path.join(directory, "cache.json");
  await writeFile(input, "one", "utf8");
  await writeFile(output, "result-one", "utf8");
  const first = contentFingerprint({
    namespace: "fixture-v1",
    inputPaths: [input],
    values: { model: "a", nested: { b: 2, a: 1 } }
  });
  const reordered = contentFingerprint({
    namespace: "fixture-v1",
    inputPaths: [input],
    values: { nested: { a: 1, b: 2 }, model: "a" }
  });
  assert.equal(first, reordered);

  await writeCacheRecord(metadata, first, output);
  assert.equal(cacheRecordMatches(metadata, first, output), true);
  assert.equal(cacheRecordIsCurrent(metadata, output), true);

  await writeFile(input, "two", "utf8");
  const changed = contentFingerprint({
    namespace: "fixture-v1",
    inputPaths: [input],
    values: { model: "a", nested: { a: 1, b: 2 } }
  });
  assert.notEqual(changed, first);
  assert.equal(cacheRecordMatches(metadata, changed, output), false);
});

test("does not trust a restored mtime for same-size rewritten input", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "strong-cache-mtime-"));
  const input = path.join(directory, "input.json");
  await writeFile(input, "one", "utf8");
  const originalStat = await stat(input);
  const first = contentFingerprint({
    namespace: "same-size-rewrite",
    inputPaths: [input]
  });

  await writeFile(input, "two", "utf8");
  await utimes(input, originalStat.atime, originalStat.mtime);
  const rewrittenStat = await stat(input);
  assert.equal(rewrittenStat.size, originalStat.size);

  const second = contentFingerprint({
    namespace: "same-size-rewrite",
    inputPaths: [input]
  });
  assert.notEqual(second, first);
});

test("invalidates a sidecar when an output is altered", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "strong-cache-output-"));
  const firstOutput = path.join(directory, "first.json");
  const secondOutput = path.join(directory, "second.json");
  const metadata = path.join(directory, "cache.json");
  await writeFile(firstOutput, "one", "utf8");
  await writeFile(secondOutput, "stable", "utf8");

  await writeCacheRecord(metadata, "input-fingerprint", [
    firstOutput,
    secondOutput
  ]);
  assert.equal(
    cacheRecordMatches(metadata, "input-fingerprint", [
      firstOutput,
      secondOutput
    ]),
    true
  );

  // Deliberately keep the same byte length to catch metadata-only hash caches.
  await writeFile(firstOutput, "two", "utf8");
  assert.equal(
    cacheRecordIsCurrent(metadata, [firstOutput, secondOutput]),
    false
  );
  assert.equal(
    cacheRecordMatches(metadata, "input-fingerprint", [
      firstOutput,
      secondOutput
    ]),
    false
  );
});

test("requires the exact output set recorded in the sidecar", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "strong-cache-set-"));
  const firstOutput = path.join(directory, "first.json");
  const secondOutput = path.join(directory, "second.json");
  const metadata = path.join(directory, "cache.json");
  await writeFile(firstOutput, "first", "utf8");
  await writeFile(secondOutput, "second", "utf8");
  await writeCacheRecord(metadata, "fingerprint", [firstOutput, secondOutput]);

  assert.equal(cacheRecordIsCurrent(metadata, firstOutput), false);
  assert.equal(
    cacheRecordIsCurrent(metadata, [secondOutput, firstOutput]),
    true
  );
});
