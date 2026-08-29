import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { writeJsonFileImmutable } from "../src/immutableFile";

test("immutable JSON publish is complete and refuses replacement", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "immutable-json-"));
  const outputPath = path.join(directory, "nested", "frozen.json");
  try {
    await writeJsonFileImmutable(outputPath, { version: 1, value: "first" });
    assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), {
      version: 1,
      value: "first"
    });
    await assert.rejects(
      writeJsonFileImmutable(outputPath, { version: 2, value: "second" }),
      /immutable-file-already-exists/u
    );
    assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), {
      version: 1,
      value: "first"
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
