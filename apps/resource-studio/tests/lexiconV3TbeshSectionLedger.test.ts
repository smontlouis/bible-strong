import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDITED_TBESH_SECTION_LEDGER_SIZE,
  AUDITED_TBESH_SECTION_SOURCE_DIGEST,
  listAuditedTbeshSectionLedgerEntries,
  resolveTbeshSectionLedger,
  tbeshSectionLedgerProvesSpecificScope,
  type TbeshSectionLedgerCategory
} from "../src/lexiconV3/tbeshSectionLedger.js";

test("seals all 65 audited lexical section-sign records", () => {
  const entries = listAuditedTbeshSectionLedgerEntries();
  const counts = new Map<TbeshSectionLedgerCategory, number>();

  assert.equal(entries.length, AUDITED_TBESH_SECTION_LEDGER_SIZE);
  assert.equal(new Set(entries.map((entry) => entry.entryKey)).size, 65);
  // Shared raw HTML across sibling dStrongs is legitimate; identity remains
  // part of the ledger key, so digest equality never merges records.
  assert.ok(new Set(entries.map((entry) => entry.rawHtmlDigest)).size < 65);
  for (const entry of entries) {
    assert.match(entry.entryKey, /^hebrew:H\d{4,5}[A-Za-z]?$/u);
    assert.match(entry.rawHtmlDigest, /^[a-f0-9]{64}$/u);
    counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  }

  assert.deepEqual(Object.fromEntries(counts), {
    verified_context: 43,
    foreign_sibling: 17,
    source_conflict: 4,
    empty_tail: 1
  });
});

test("resolves every audited record only against the exact TBESH snapshot", () => {
  for (const entry of listAuditedTbeshSectionLedgerEntries()) {
    assert.deepEqual(
      resolveTbeshSectionLedger({
        entryKey: entry.entryKey,
        rawHtmlDigest: entry.rawHtmlDigest,
        tbeshDigest: AUDITED_TBESH_SECTION_SOURCE_DIGEST
      }),
      {
        reviewed: true,
        category: entry.category,
        entryKey: entry.entryKey,
        rawHtmlDigest: entry.rawHtmlDigest
      }
    );
  }
});

test("preserves the four audited categories without encoding a repair", () => {
  const byKey = new Map(
    listAuditedTbeshSectionLedgerEntries().map((entry) => [
      entry.entryKey,
      entry
    ])
  );

  assert.equal(byKey.get("hebrew:H0144")?.category, "verified_context");
  assert.equal(byKey.get("hebrew:H5158G")?.category, "foreign_sibling");
  assert.equal(byKey.get("hebrew:H5451")?.category, "source_conflict");
  assert.equal(byKey.get("hebrew:H5945G")?.category, "empty_tail");
  assert.equal(
    byKey.get("hebrew:H1516K")?.rawHtmlDigest,
    byKey.get("hebrew:H1516M")?.rawHtmlDigest
  );
  assert.equal(
    byKey.get("hebrew:H5158G")?.rawHtmlDigest,
    byKey.get("hebrew:H5158K")?.rawHtmlDigest
  );
  assert.equal(
    byKey.get("hebrew:H5869B")?.rawHtmlDigest,
    byKey.get("hebrew:H5869G")?.rawHtmlDigest
  );
  for (const entry of byKey.values()) {
    assert.deepEqual(Object.keys(entry).sort(), [
      "category",
      "entryKey",
      "rawHtmlDigest"
    ]);
  }
});

test("makes the ledger's exact-prefix proof semantics explicit", () => {
  assert.equal(tbeshSectionLedgerProvesSpecificScope("verified_context"), true);
  assert.equal(tbeshSectionLedgerProvesSpecificScope("foreign_sibling"), true);
  assert.equal(tbeshSectionLedgerProvesSpecificScope("empty_tail"), true);
  assert.equal(tbeshSectionLedgerProvesSpecificScope("source_conflict"), false);
});

test("fails closed when the TBESH source digest changes", () => {
  const entry = listAuditedTbeshSectionLedgerEntries()[0]!;

  assert.deepEqual(
    resolveTbeshSectionLedger({
      entryKey: entry.entryKey,
      rawHtmlDigest: entry.rawHtmlDigest,
      tbeshDigest: "0".repeat(64)
    }),
    {
      reviewed: false,
      category: "unreviewed",
      entryKey: entry.entryKey,
      reason: "tbesh-digest-mismatch"
    }
  );
});

test("fails closed when an audited raw HTML digest changes", () => {
  const entry = listAuditedTbeshSectionLedgerEntries()[0]!;

  assert.deepEqual(
    resolveTbeshSectionLedger({
      entryKey: entry.entryKey,
      rawHtmlDigest: "0".repeat(64),
      tbeshDigest: AUDITED_TBESH_SECTION_SOURCE_DIGEST
    }),
    {
      reviewed: false,
      category: "unreviewed",
      entryKey: entry.entryKey,
      reason: "raw-html-digest-mismatch"
    }
  );
});

test("fails closed for unknown and case-shifted identities", () => {
  const digest = listAuditedTbeshSectionLedgerEntries()[0]!.rawHtmlDigest;

  for (const entryKey of ["hebrew:H9999", "hebrew:H0144A", "Hebrew:H0144"]) {
    assert.deepEqual(
      resolveTbeshSectionLedger({
        entryKey,
        rawHtmlDigest: digest,
        tbeshDigest: AUDITED_TBESH_SECTION_SOURCE_DIGEST
      }),
      {
        reviewed: false,
        category: "unreviewed",
        entryKey,
        reason: "entry-not-reviewed"
      }
    );
  }
});
