import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  normalizeOriginalStrong,
  readOriginalSourceTsv
} from "../src/originalSource.js";
import { referenceKey } from "../src/strongCsv.js";

test("parses original-language source TSV by encoded token id", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "original-source-"));
  const file = path.join(directory, "source.tsv");

  await writeFile(
    file,
    [
      "id\taltId\ttext\tstrongs\tgloss\tgloss2\tlemma\tpos\tmorph",
      "o010010010011\tבְּ-1\tבְּ\tH0871a\tin\t\tבְּ\tprep\tPp",
      "n40001001001\tΒίβλος-1\tΒίβλος\tG0976\tbook\tbook\tβίβλος\tnoun\tN-NSF"
    ].join("\n"),
    "utf8"
  );

  const map = await readOriginalSourceTsv(file);

  assert.equal(
    map.get(referenceKey("Gen", 1, 1))?.strongSet.has("H0871"),
    true
  );
  assert.equal(
    map.get(referenceKey("Matt", 1, 1))?.strongSet.has("G0976"),
    true
  );

  await rm(directory, { recursive: true, force: true });
});

test("normalizes extended original Strong subcodes to classical reference codes", () => {
  assert.equal(normalizeOriginalStrong("H4723a"), "H4723");
  assert.equal(normalizeOriginalStrong("H0776_G"), "H0776");
  assert.equal(normalizeOriginalStrong("G0976"), "G0976");
});
