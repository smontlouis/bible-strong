/** Post-generation warning audit; does not rewrite a frozen correspondence. */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readBibleJson } from "../../src/bibleJson.js";
import { readStrongCsv } from "../../src/strongCsv.js";
import {
  normalizeVerseText,
  validateVerseCorrespondenceManifest,
  type VerseCorrespondenceManifest
} from "../../src/verseCorrespondence.js";
import { refineExactCorrespondence } from "../../src/strongCorrespondenceRefinement.js";

const [rootArg, edition, refinedOutput] = process.argv.slice(2);
assert(rootArg && ["s21", "neg79"].includes(edition));
const root = path.resolve(rootArg),
  env = path.join(root, "environment");
const target = await readBibleJson(
  path.join(env, `data/bibles/bible-${edition}.json`)
);
const manifest: VerseCorrespondenceManifest = JSON.parse(
  await readFile(path.join(root, `correspondence/${edition}.json`), "utf8")
);
const indexes = await Promise.all(
  ["Sg1910", "Darby", "DarbyR"].map(async (name) => {
    const rows = await readStrongCsv(
      path.join(env, `data/strongs/${name}.csv`)
    );
    const byText = new Map<string, string[]>(),
      byRef = new Map<string, string>();
    for (const v of rows) {
      const ref = `${v.bookId}.${v.chapter}.${v.verse}`,
        text = normalizeVerseText(v.text);
      const key = `${v.bookId}:${text}`;
      byText.set(key, [...(byText.get(key) ?? []), ref]);
      byRef.set(ref, text);
    }
    return { name, byText, byRef };
  })
);
const byTarget = new Map(
  manifest.blocks.flatMap((b) => b.targetRefs.map((ref) => [ref, b] as const))
);
const conflicts = [];
const exactMatches = new Map<
  string,
  { canonicalRef: string; witnesses: string[] }
>();
for (const t of target) {
  const ref = `${t.bookId}.${t.chapter}.${t.verse}`,
    text = normalizeVerseText(t.text);
  if (text.split(" ").length < 8) continue;
  const witnesses = indexes.flatMap((w) => {
    const refs = w.byText.get(`${t.bookId}:${text}`) ?? [];
    return refs.length === 1 ? [{ name: w.name, ref: refs[0] }] : [];
  });
  const exact = [...new Set(witnesses.map((w) => w.ref))];
  if (exact.length !== 1) continue;
  exactMatches.set(ref, {
    canonicalRef: exact[0],
    witnesses: witnesses.map((w) => w.name)
  });
  const block = byTarget.get(ref)!;
  const extra = block.canonicalRefs.filter(
    (r) =>
      r !== exact[0] && indexes.some((w) => (w.byRef.get(r) ?? "").length > 0)
  );
  if (block.canonicalRefs.includes(exact[0]) && !extra.length) continue;
  conflicts.push({
    nativeRef: ref,
    text: t.text,
    block,
    exactTextWitnesses: witnesses,
    reason: block.canonicalRefs.includes(exact[0])
      ? "source-span-exceeds-unique-exact-text-witness"
      : "source-span-conflicts-with-unique-exact-text-witness",
    status: "requires-correspondence-review",
    quarantined:
      block.reason?.includes("unresolved-exact-text-witness-correspondence") ??
      false,
    absenceEstablished: false
  });
}
const dir = path.join(root, "audit", edition);
await mkdir(dir, { recursive: true });
if (refinedOutput) {
  const result = refineExactCorrespondence(
    manifest.blocks,
    exactMatches,
    new Set(conflicts.map((c) => c.nativeRef))
  );
  const refined =
    JSON.stringify(result.blocks) === JSON.stringify(manifest.blocks)
      ? manifest
      : { ...manifest, blocks: result.blocks, detection: undefined };
  validateVerseCorrespondenceManifest(refined, {
    targetRefs: manifest.blocks.flatMap((b) => b.targetRefs),
    canonicalRefs: manifest.blocks.flatMap((b) => b.canonicalRefs)
  });
  await mkdir(path.dirname(path.resolve(refinedOutput)), { recursive: true });
  await writeFile(refinedOutput, JSON.stringify(refined, null, 2) + "\n", {
    flag: "wx"
  });
  await writeFile(
    path.join(dir, "correspondence-repairs.json"),
    JSON.stringify(
      {
        edition,
        policy: "unique-normalized-exact-witness-text-bijection-v1",
        targetAnnotationsRead: false,
        originalDetection: manifest.detection,
        repairs: result.repairs
      },
      null,
      2
    ) + "\n"
  );
  console.log(
    JSON.stringify({
      edition,
      repairedGroups: result.repairs.length,
      repairedVerses: result.repairs.reduce((n, r) => n + r.after.length, 0)
    })
  );
}
await writeFile(
  path.join(dir, "correspondence-conflicts.json"),
  JSON.stringify(
    {
      edition,
      warnings: conflicts.length,
      conflicts,
      method:
        "Unique normalized full verse in each allowed witness, within its book, minimum eight tokens; correlated witnesses remain one family. Diagnostic only, no target Strong labels or prediction edits."
    },
    null,
    2
  ) + "\n"
);
console.log(
  JSON.stringify({
    edition,
    warnings: conflicts.length,
    refs: conflicts.map((c) => c.nativeRef)
  })
);
