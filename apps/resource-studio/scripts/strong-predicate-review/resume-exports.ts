/** Resume auxiliary exports after ENOSPC, only from a complete committed ledger. */
import assert from "node:assert/strict";
import { createWriteStream } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import path from "node:path";
const [rootArg, edition] = process.argv.slice(2),
  root = path.resolve(rootArg);
assert(["s21", "neg79"].includes(edition));
const code = path.join(root, "code");
const frozen = JSON.parse(
  await readFile(path.join(code, "manifest.json"), "utf8")
);
for (const [file, hash] of Object.entries(frozen.files))
  assert.equal(
    createHash("sha256")
      .update(await readFile(path.join(code, file)))
      .digest("hex"),
    hash
  );
const { tsvEscape } = (await import(
  pathToFileURL(path.join(code, "src/render.ts")).href
)) as typeof import("../../src/render.js");
const directory = path.join(root, "generated", edition),
  sqlite = path.join(directory, `bible-${edition}-strong.sqlite`);
const db = new DatabaseSync(sqlite);
try {
  const checkpoint = db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
  assert.equal(
    Object.values(db.prepare("PRAGMA integrity_check").get()!)[0],
    "ok"
  );
  const meta = (key: string) =>
    JSON.parse(
      String(
        db.prepare("SELECT value FROM metadata WHERE key=?").get(key)!.value
      )
    );
  const ledger = meta("ledger"),
    metrics = meta("metrics");
  assert.equal(ledger.bible, edition);
  assert.equal(ledger.generationOptions.concordancePredicates, true);
  const count = Number(
    db.prepare("SELECT count(*) AS n FROM verses WHERE bible=?").get(edition)!.n
  );
  assert.equal(count, 31169);
  assert.equal(ledger.resolutionSummary.verses, count);
  for (const mode of ["reader", "advanced"] as const) {
    const stream = createWriteStream(
      path.join(directory, `bible-${edition}-strong-${mode}.tsv`)
    );
    stream.write("book_id\tnum_chapter\tnum_verse\ttext\n");
    const query = db.prepare(
      `SELECT book_id,chapter,verse,${mode}_html AS html FROM verses WHERE bible=? ORDER BY book_order,chapter,verse`
    );
    let written = 0;
    for (const row of query.iterate(edition)) {
      assert.equal(typeof row.html, "string");
      if (
        !stream.write(
          `${row.book_id}\t${row.chapter}\t${row.verse}\t${tsvEscape(String(row.html))}\n`
        )
      )
        await once(stream, "drain");
      written++;
    }
    query.get(edition);
    assert.equal(written, count);
    stream.end();
    await once(stream, "finish");
  }
  await writeFile(
    path.join(directory, `bible-${edition}-strong-metrics.json`),
    JSON.stringify(metrics, null, 2) + "\n"
  );
  await writeFile(
    path.join(directory, "generation.json"),
    JSON.stringify(
      {
        bible: edition,
        verses: count,
        inputFingerprint: ledger.inputFingerprint,
        references: ledger.references,
        dictionaryCandidates: 0,
        targetAnnotationsRead: false,
        remoteModels: false,
        resolutionSummary: ledger.resolutionSummary,
        display: ledger.concordanceDisplay,
        unassignedCanonicalBlocks: ledger.unassignedCanonicalSource?.length ?? 0
      },
      null,
      2
    ) + "\n"
  );
  await writeFile(
    path.join(directory, "storage-recovery.json"),
    JSON.stringify(
      {
        reason: "ENOSPC after the ledger transaction committed",
        checkpoint,
        integrity: "ok",
        verses: count,
        inputFingerprint: ledger.inputFingerprint,
        predictionsRecomputed: false,
        exportsRestored: [
          "metrics",
          "reader-tsv",
          "advanced-tsv",
          "generation-summary"
        ]
      },
      null,
      2
    ) + "\n"
  );
  console.log(edition, "exports restored from complete verified ledger");
} finally {
  db.close();
}
