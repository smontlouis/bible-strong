import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  applyReviewDecisionPayload,
  prepareReview,
  type ReviewOptions
} from "../src/llmReview.js";

test("prepares and applies phrase review decisions without forcing a head word", async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), "llm-review-phrase-"));

  try {
    const diagnosticsPath = path.join(tmp, "diagnostics.json");
    const reviewPath = path.join(tmp, "review.json");
    const decisionsPath = path.join(tmp, "decisions.json");
    const overridesPath = path.join(tmp, "curated-overrides.json");

    await writeFile(
      diagnosticsPath,
      `${JSON.stringify(
        [
          {
            ref: "Heb.1.4",
            reasons: ["test-phrase-review"],
            llmSuggestions: [
              {
                target: "phrase",
                wordIndex: 13,
                startWordIndex: 13,
                endWordIndex: 16,
                normalizedPhrase: ["dans", "la", "mesure", "ou"],
                strong: ["G9999"],
                confidence: 0.91,
                reason: "Test phrase suggestion should stay phrase-scoped."
              }
            ]
          }
        ],
        null,
        2
      )}\n`,
      "utf8"
    );

    const options: ReviewOptions = {
      command: "prepare",
      bible: "bds",
      diagnosticsPath,
      reviewPath,
      decisionsPath,
      outputDir: tmp,
      overridesPath,
      autoAccept: true,
      autoAcceptThreshold: 0.84
    };

    const review = await prepareReview(options);

    assert.equal(review.items.length, 1);
    assert.equal(review.items[0]?.target, "phrase");
    assert.equal(review.items[0]?.decision, "pending");
    assert.equal(review.items[0]?.word, "dans la mesure où");
    assert.equal(review.items[0]?.normalized, "dans la mesure ou");
    assert.deepEqual(review.items[0]?.normalizedPhrase, [
      "dans",
      "la",
      "mesure",
      "ou"
    ]);

    review.items[0]!.decision = "accept";
    const applied = await applyReviewDecisionPayload({
      bible: "bds",
      decisions: { bible: "bds", items: review.items },
      overridesPath
    });

    assert.equal(applied.accepted, 1);
    const overrides = JSON.parse(
      await readFile(overridesPath, "utf8")
    ) as Array<Record<string, unknown>>;
    assert.equal(overrides.length, 1);
    assert.equal(overrides[0]?.target, "phrase");
    assert.equal(overrides[0]?.wordIndex, 13);
    assert.equal(overrides[0]?.startWordIndex, 13);
    assert.equal(overrides[0]?.endWordIndex, 16);
    assert.deepEqual(overrides[0]?.normalizedPhrase, [
      "dans",
      "la",
      "mesure",
      "ou"
    ]);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("applies accepted empty review decisions as durable empty overrides", async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), "llm-review-empty-"));

  try {
    const overridesPath = path.join(tmp, "curated-overrides.json");
    const applied = await applyReviewDecisionPayload({
      bible: "bds",
      decisions: {
        bible: "bds",
        approvedOverrides: [
          {
            bible: "bds",
            ref: "Heb.1.4",
            target: "empty",
            wordIndex: -1,
            normalized: "",
            strong: ["G9998"],
            confidence: 0.72,
            source: "test",
            reason: "Test empty target persistence."
          }
        ]
      },
      overridesPath
    });

    assert.equal(applied.accepted, 1);
    const overrides = JSON.parse(
      await readFile(overridesPath, "utf8")
    ) as Array<Record<string, unknown>>;
    assert.equal(overrides.length, 1);
    assert.equal(overrides[0]?.target, "empty");
    assert.equal(overrides[0]?.wordIndex, -1);
    assert.deepEqual(overrides[0]?.strong, ["G9998"]);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("human approval replaces an identical quarantined semantic refill", async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), "llm-review-promote-"));
  try {
    const overridesPath = path.join(tmp, "curated-overrides.json");
    const legacy = {
      bible: "bds",
      ref: "Heb.1.4",
      target: "empty" as const,
      wordIndex: -1,
      normalized: "",
      strong: ["G9996"],
      confidence: 0.9,
      source: "semantic-refill:llm",
      reason: "consensus claimed in free-form text"
    };
    await writeFile(overridesPath, `${JSON.stringify([legacy])}\n`, "utf8");

    const applied = await applyReviewDecisionPayload({
      bible: "bds",
      decisions: {
        bible: "bds",
        approvedOverrides: [
          {
            ...legacy,
            source: "llm-review:human-approved-empty",
            reason: "Explicit human approval."
          }
        ]
      },
      overridesPath
    });

    assert.equal(applied.accepted, 1);
    const overrides = JSON.parse(
      await readFile(overridesPath, "utf8")
    ) as Array<Record<string, unknown>>;
    assert.equal(overrides.length, 1);
    assert.equal(overrides[0]?.source, "llm-review:human-approved-empty");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("labels explicit single-model auto-accepts without claiming human review", async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), "llm-review-auto-source-"));

  try {
    const diagnosticsPath = path.join(tmp, "diagnostics.json");
    const reviewPath = path.join(tmp, "review.json");
    const decisionsPath = path.join(tmp, "decisions.json");
    const overridesPath = path.join(tmp, "curated-overrides.json");
    await writeFile(
      diagnosticsPath,
      `${JSON.stringify([
        {
          ref: "Heb.1.4",
          llmSuggestions: [
            {
              target: "word",
              wordIndex: 5,
              strong: ["G9997"],
              confidence: 0.91,
              reason: "Single-model fixture."
            }
          ]
        }
      ])}\n`,
      "utf8"
    );
    const review = await prepareReview({
      command: "prepare",
      bible: "bds",
      diagnosticsPath,
      reviewPath,
      decisionsPath,
      outputDir: tmp,
      overridesPath,
      autoAccept: true,
      autoAcceptThreshold: 0.84
    });

    assert.equal(review.items[0]?.decision, "accept");
    await applyReviewDecisionPayload({
      bible: "bds",
      decisions: { bible: "bds", items: review.items },
      overridesPath
    });
    const overrides = JSON.parse(
      await readFile(overridesPath, "utf8")
    ) as Array<Record<string, unknown>>;
    assert.equal(overrides[0]?.source, "llm-review:single-model-auto");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
