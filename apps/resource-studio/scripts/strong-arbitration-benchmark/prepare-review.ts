import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { sha } from "../strong-alignment-benchmark/shared.js";
import type { EvalVerse } from "../strong-alignment-benchmark/shared.js";
import { validateReview, type SemanticReview } from "./review.js";

const input = process.argv[2],
  output = process.argv[3];
if (!input || !output) throw new Error("input-and-new-output-required");
const text = await readFile(input, "utf8");
const initial: Array<{
  id: string;
  gold: string;
  ref: string;
  text: string;
  words: Array<{ index: number; text: string }>;
  source: EvalVerse["source"];
}> = JSON.parse(text);
const cleanRoot = process.argv[4];
const cleanInputs: Record<string, string> = {};
if (cleanRoot) {
  const plan = JSON.parse(
    await readFile(path.join(cleanRoot, "plan.json"), "utf8")
  );
  assert.equal(plan.textPolicy, "exclude-publisher-notes-v1");
  for (const gold of new Set(initial.map((p) => p.gold))) {
    const content = await readFile(
      path.join(cleanRoot, gold, "eval-input.json"),
      "utf8"
    );
    cleanInputs[gold] = sha(content);
    assert.equal(
      cleanInputs[gold],
      plan.manifests.find((m: { gold: string }) => m.gold === gold).inputs[
        "eval-input.json"
      ]
    );
    const verses: EvalVerse[] = JSON.parse(content);
    for (const p of initial.filter((p) => p.gold === gold)) {
      const v = verses.find((v) => v.ref === p.ref);
      assert(v);
      assert.deepEqual(v.source, p.source);
      p.text = v.text;
      p.words = v.words.map((text, index) => ({ index, text }));
    }
  }
}
const passages = initial.map((p) => {
  const review: SemanticReview = {
    status: "unreviewed",
    reviewer: null,
    sourcesConsulted: [],
    groups: [],
    absent: [],
    uncertain: [],
    problems: []
  };
  validateReview(
    p.source.map((s) => s.occurrenceId),
    p.words.length,
    review
  );
  return {
    id: p.id,
    gold: p.gold,
    ref: p.ref,
    text: p.text,
    words: p.words,
    source: p.source,
    physicalSourceGroups: [...new Set(p.source.map((s) => s.tokenId))].map(
      (tokenId) => {
        const members = p.source.filter((s) => s.tokenId === tokenId);
        return {
          tokenId,
          text: members[0].text,
          gloss: members[0].gloss,
          occurrenceIds: members.map((s) => s.occurrenceId),
          stepSourceCodes: [...new Set(members.map((s) => s.sourceStrong))],
          strongIdentities: [...new Set(members.map((s) => s.strong))]
        };
      }
    ),
    review
  };
});
await writeFile(
  output,
  JSON.stringify(
    {
      schemaVersion: "semantic-review-v2",
      sourceSha256: sha(text),
      cleanInputs,
      charter: "docs/strong-semantic-review-charter-2026-10-01.md",
      passages
    },
    null,
    2
  ) + "\n",
  { flag: "wx" }
);
console.log(
  JSON.stringify({ output, passages: passages.length, status: "unreviewed" })
);
