import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  applyLexiconV3ReviewDecisions,
  buildLexiconV3ReviewQueue
} from "../scripts/reviewLexiconV3.js";

import {
  lexiconV3FieldContentHash,
  lexiconV3MissingFieldReviewTargetHash,
  lexiconV3ReviewArtifactHash,
  lexiconV3ReviewDecisionSetFingerprint,
  lexiconV3ReviewTargetHash,
  LEXICON_V3_LEGACY_REVIEW_DECISION_SCHEMA,
  LEXICON_V3_REVIEW_DECISION_SCHEMA,
  type LexiconV3ReviewDecision,
  validateLexiconV3ReviewDecision
} from "../src/lexiconV3/review.js";
import {
  createLexiconV3Schema,
  verifyLexiconV3Schema
} from "../src/lexiconV3/schema.js";

test("binds review decisions to an exact immutable field hash", () => {
  const first = lexiconV3FieldContentHash({
    entryKey: "greek:G1623",
    locale: "en",
    field: "meaning",
    valueText: "Sixth.",
    valueHtml: "<p>Sixth.</p>"
  });
  const changed = lexiconV3FieldContentHash({
    entryKey: "greek:G1623",
    locale: "en",
    field: "meaning",
    valueText: "The sixth in an ordered series.",
    valueHtml: "<p>The sixth in an ordered series.</p>"
  });

  assert.match(first, /^[a-f0-9]{64}$/u);
  assert.notEqual(first, changed);
});

test("validates replacements and rejects replacement payloads on simple verdicts", () => {
  const base: LexiconV3ReviewDecision = {
    schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
    entryKey: "greek:G1623",
    locale: "fr",
    field: "meaning",
    fieldVersionId: 12,
    expectedContentHash: "a".repeat(64),
    verdict: "replace",
    reviewer: "lexicographe",
    reason: "Correction contrôlée contre TFLSJ et TAGNT.",
    replacement: {
      valueText: "Le sixième dans une série ordonnée.",
      valueHtml: "<p>Le sixième dans une série ordonnée.</p>",
      confidence: 1,
      evidenceMode: "inherit"
    },
    resolveIssueCodes: ["english-source-review-needed"],
    decidedAt: "2026-07-12T10:00:00.000Z"
  };

  assert.deepEqual(validateLexiconV3ReviewDecision(base), {
    valid: true,
    issues: []
  });
  const invalid = validateLexiconV3ReviewDecision({
    ...base,
    verdict: "accept"
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.issues.includes("unexpected-replacement"));

  const missingSourceNote = validateLexiconV3ReviewDecision({
    ...base,
    replacement: {
      ...base.replacement!,
      evidenceMode: "editorial_replacement"
    }
  });
  assert.equal(missingSourceNote.valid, false);
  assert.ok(missingSourceNote.issues.includes("missing-editorial-source-note"));

  const invalidMode = validateLexiconV3ReviewDecision({
    ...base,
    replacement: {
      ...base.replacement!,
      evidenceMode: "editorial_replacment" as never
    }
  });
  assert.equal(invalidMode.valid, false);
  assert.ok(invalidMode.issues.includes("invalid-evidence-mode"));
});

test("requires explicit v3 editorial evidence to create a missing English field", () => {
  const creation: LexiconV3ReviewDecision = {
    schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
    entryKey: "greek:G1623",
    locale: "en",
    field: "meaning",
    expectedContentHash: lexiconV3MissingFieldReviewTargetHash({
      entryKey: "greek:G1623",
      locale: "en",
      field: "meaning"
    }),
    verdict: "create",
    reviewer: "lexicographe",
    reason: "Notice anglaise originale ajoutée après revue des témoins.",
    replacement: {
      valueText: "The sixth member of an ordered series.",
      valueHtml: "<p>The sixth member of an ordered series.</p>",
      confidence: 1,
      evidenceMode: "editorial_replacement",
      sourceNote: "Rédaction originale contrôlée contre TFLSJ et TAGNT."
    },
    resolveIssueCodes: ["missing-english-meaning"],
    decidedAt: "2026-07-12T10:00:00.000Z"
  };

  assert.deepEqual(validateLexiconV3ReviewDecision(creation), {
    valid: true,
    issues: []
  });
  const inherited = validateLexiconV3ReviewDecision({
    ...creation,
    replacement: {
      ...creation.replacement!,
      evidenceMode: "inherit"
    }
  });
  assert.ok(inherited.issues.includes("create-requires-editorial-evidence"));
  const french = validateLexiconV3ReviewDecision({
    ...creation,
    locale: "fr"
  });
  assert.ok(french.issues.includes("create-requires-english-locale"));
  const legacy = validateLexiconV3ReviewDecision({
    ...creation,
    schemaVersion: LEXICON_V3_LEGACY_REVIEW_DECISION_SCHEMA
  });
  assert.ok(legacy.issues.includes("create-requires-schema-v3"));
});

test("exports and creates a missing English field with durable evidence", () => {
  const db = reviewDatabase(false);
  try {
    db.prepare(
      `INSERT INTO LexiconIssues (
         entryKey, code, severity, status, detailsJson, createdAt
       ) VALUES (
         'greek:G1623', 'missing-english-meaning', 'blocker', 'open', '{}', ?
       ), (
         'greek:G1623', 'english-source-quarantined', 'blocker', 'open', '{}', ?
       )`
    ).run("2026-07-12T09:00:00.000Z", "2026-07-12T09:00:00.000Z");
    const queue = buildLexiconV3ReviewQueue(db, {
      database: "fixture.sqlite",
      generatedAt: "2026-07-12T09:30:00.000Z",
      includeAutoGlosses: false,
      limit: 10,
      only: "G1623"
    });
    const missing = queue.fields.find(
      (field) => field.entryKey === "greek:G1623" && field.field === "meaning"
    );
    assert.equal(queue.schemaVersion, "lexicon-v3-review-queue@3");
    assert.ok(missing);
    assert.equal(missing.id, null);
    assert.equal(missing.missing, true);
    assert.equal(missing.state, "missing");
    assert.equal(
      missing.reviewTargetHash,
      lexiconV3MissingFieldReviewTargetHash({
        entryKey: "greek:G1623",
        locale: "en",
        field: "meaning"
      })
    );
    assert.deepEqual(missing.issues.map((issue) => issue.code).sort(), [
      "english-source-quarantined",
      "missing-english-meaning"
    ]);

    const decision: LexiconV3ReviewDecision = {
      schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
      entryKey: "greek:G1623",
      locale: "en",
      field: "meaning",
      expectedContentHash: missing.reviewTargetHash,
      verdict: "create",
      reviewer: "lexicographe",
      reason: "Notice anglaise rédigée et vérifiée indépendamment.",
      replacement: {
        valueText: "The sixth member of an ordered series.",
        valueHtml: "<p>The sixth member of an ordered series.</p>",
        confidence: 1,
        evidenceMode: "editorial_replacement",
        sourceNote: "Rédaction originale contrôlée contre TFLSJ et TAGNT."
      },
      resolveIssueCodes: [
        "missing-english-meaning",
        "english-source-quarantined"
      ],
      decidedAt: "2026-07-12T10:00:00.000Z"
    };
    assert.deepEqual(applyLexiconV3ReviewDecisions(db, [decision]), {
      decisions: 1,
      applied: 1,
      replacements: 0,
      creations: 1
    });

    const created = db
      .prepare(
        `SELECT id, valueText, valueHtml, state, method, supersedesId
         FROM LexiconFieldVersions
         WHERE entryKey = 'greek:G1623' AND locale = 'en'
           AND field = 'meaning'`
      )
      .get() as {
      id: number;
      valueText: string;
      valueHtml: string;
      state: string;
      method: string;
      supersedesId: number | null;
    };
    assert.deepEqual(
      {
        valueText: created.valueText,
        valueHtml: created.valueHtml,
        state: created.state,
        method: created.method,
        supersedesId: created.supersedesId
      },
      {
        valueText: "The sixth member of an ordered series.",
        valueHtml: "<p>The sixth member of an ordered series.</p>",
        state: "human_validated",
        method: "editorial",
        supersedesId: null
      }
    );
    const evidence = db
      .prepare(
        `SELECT source.sourceKey, source.rightsStatus, source.allowDisplay,
                source.allowTranslation, fieldEvidence.stance
         FROM LexiconFieldEvidence fieldEvidence
         JOIN LexiconSourceAssertions assertion
           ON assertion.id = fieldEvidence.sourceAssertionId
         JOIN LexiconSources source ON source.id = assertion.sourceId
         WHERE fieldEvidence.fieldVersionId = ?`
      )
      .get(created.id) as {
      sourceKey: string;
      rightsStatus: string;
      allowDisplay: number;
      allowTranslation: number;
      stance: string;
    };
    assert.deepEqual(
      { ...evidence },
      {
        sourceKey: "project-editorial-review",
        rightsStatus: "cleared",
        allowDisplay: 1,
        allowTranslation: 1,
        stance: "supports"
      }
    );
    assert.equal(
      Number(
        (
          db
            .prepare(
              `SELECT count(*) AS count FROM LexiconFieldReviews
               WHERE fieldVersionId = ? AND reviewerType = 'human'
                 AND verdict = 'accept'`
            )
            .get(created.id) as { count: number }
        ).count
      ),
      1
    );
    assert.equal(
      Number(
        (
          db
            .prepare(
              `SELECT count(*) AS count FROM LexiconIssues
               WHERE entryKey = 'greek:G1623' AND status = 'open'`
            )
            .get() as { count: number }
        ).count
      ),
      0
    );
  } finally {
    db.close();
  }
});

test("keeps informational issues out of the actionable queue by default", () => {
  const db = reviewDatabase(false);
  try {
    const field = db
      .prepare(
        `SELECT id FROM LexiconFieldVersions
         WHERE entryKey = 'greek:G1623' AND locale = 'en' AND field = 'gloss'`
      )
      .get() as { id: number };
    db.prepare(
      "UPDATE LexiconFieldVersions SET state = 'auto_validated' WHERE id = ?"
    ).run(field.id);
    db.prepare(
      `INSERT INTO LexiconIssues (
         entryKey, fieldVersionId, code, severity, status, detailsJson
       ) VALUES ('greek:G1623', NULL, 'audit-context', 'info', 'open', '{}')`
    ).run();

    const actionable = buildLexiconV3ReviewQueue(db, {
      database: "fixture.sqlite",
      generatedAt: "2026-07-12T09:30:00.000Z",
      includeAutoGlosses: false,
      limit: 10,
      only: "G1623"
    });
    assert.equal(actionable.total, 0);

    const withInfo = buildLexiconV3ReviewQueue(db, {
      database: "fixture.sqlite",
      generatedAt: "2026-07-12T09:30:00.000Z",
      includeAutoGlosses: false,
      includeInfoIssues: true,
      limit: 10,
      only: "G1623"
    });
    assert.equal(withInfo.total, 1);
    assert.equal(withInfo.includeInfoIssues, true);
    assert.deepEqual(
      withInfo.fields[0]?.issues.map((issue) => issue.code),
      ["audit-context"]
    );

    db.prepare(
      "UPDATE LexiconIssues SET severity = 'warning' WHERE code = 'audit-context'"
    ).run();
    const warningQueue = buildLexiconV3ReviewQueue(db, {
      database: "fixture.sqlite",
      generatedAt: "2026-07-12T09:30:00.000Z",
      includeAutoGlosses: false,
      limit: 10,
      only: "G1623"
    });
    assert.equal(warningQueue.total, 1);
  } finally {
    db.close();
  }
});

test("fails closed when a missing-field creation target is stale", () => {
  const db = reviewDatabase(false);
  try {
    db.prepare(
      `INSERT INTO LexiconIssues (entryKey, code, severity, status)
       VALUES ('greek:G1623', 'missing-english-meaning', 'blocker', 'open')`
    ).run();
    db.prepare(
      `INSERT INTO LexiconFieldVersions (
         entryKey, locale, field, valueText, valueHtml, state, confidence,
         method, generator, contentHash
       ) VALUES (
         'greek:G1623', 'en', 'meaning', 'Upstream content.',
         '<p>Upstream content.</p>', 'candidate', 0.7, 'source', 'fixture', ?
       )`
    ).run(
      lexiconV3FieldContentHash({
        entryKey: "greek:G1623",
        locale: "en",
        field: "meaning",
        valueText: "Upstream content.",
        valueHtml: "<p>Upstream content.</p>"
      })
    );
    const decision: LexiconV3ReviewDecision = {
      schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
      entryKey: "greek:G1623",
      locale: "en",
      field: "meaning",
      expectedContentHash: lexiconV3MissingFieldReviewTargetHash({
        entryKey: "greek:G1623",
        locale: "en",
        field: "meaning"
      }),
      verdict: "create",
      reviewer: "lexicographe",
      reason: "Cette décision a été préparée avant l'arrivée de la source.",
      replacement: {
        valueText: "Editorial content.",
        valueHtml: "<p>Editorial content.</p>",
        confidence: 1,
        evidenceMode: "editorial_replacement",
        sourceNote: "Rédaction originale."
      },
      resolveIssueCodes: ["missing-english-meaning"],
      decidedAt: "2026-07-12T10:00:00.000Z"
    };
    assert.throws(
      () => applyLexiconV3ReviewDecisions(db, [decision]),
      /stale-review-decision:greek:G1623:en:meaning/u
    );
    assert.equal(
      Number(
        (
          db
            .prepare(
              `SELECT count(*) AS count FROM LexiconFieldVersions
               WHERE entryKey = 'greek:G1623' AND locale = 'en'
                 AND field = 'meaning'`
            )
            .get() as { count: number }
        ).count
      ),
      1
    );
  } finally {
    db.close();
  }
});

test("fingerprints semantic decisions independently of SQLite ids and issue order", () => {
  const decision: LexiconV3ReviewDecision = {
    schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
    entryKey: "greek:G1623",
    locale: "en",
    field: "meaning",
    fieldVersionId: 12,
    expectedContentHash: "a".repeat(64),
    verdict: "accept",
    reviewer: "lexicographe",
    reason: "Relecture terminée.",
    resolveIssueCodes: ["issue-b", "issue-a"],
    decidedAt: "2026-07-12T10:00:00.000Z"
  };
  const shifted = {
    ...decision,
    fieldVersionId: 987,
    resolveIssueCodes: ["issue-a", "issue-b"]
  };
  assert.equal(
    lexiconV3ReviewArtifactHash(decision),
    lexiconV3ReviewArtifactHash(shifted)
  );
  assert.equal(
    lexiconV3ReviewDecisionSetFingerprint([decision], "en"),
    lexiconV3ReviewDecisionSetFingerprint([shifted], "en")
  );
});

test("clears restricted source support for a documented editorial replacement", () => {
  const db = reviewDatabase(false);
  try {
    const field = db
      .prepare(
        `SELECT id FROM LexiconFieldVersions
         WHERE entryKey = 'greek:G1623' AND locale = 'en' AND field = 'gloss'`
      )
      .get() as { id: number };
    const sourceId = Number(
      db
        .prepare(
          `INSERT INTO LexiconSources (
             sourceKey, name, version, witnessFamily, locale, sha256, license,
             rightsStatus, allowDisplay, allowTranslation, allowCarrier
           ) VALUES (
             'restricted-source', 'Restricted source', '1', 'restricted',
             'en', ?, 'Unknown', 'pending', 0, 0, 0
           )`
        )
        .run("b".repeat(64)).lastInsertRowid
    );
    const assertionId = Number(
      db
        .prepare(
          `INSERT INTO LexiconSourceAssertions (
             sourceId, entryKey, scope, field, locale, valueText, locator,
             sha256
           ) VALUES (?, 'greek:G1623', 'entry', 'gloss', 'en', 'sixth',
                     'fixture:restricted', ?)`
        )
        .run(sourceId, "c".repeat(64)).lastInsertRowid
    );
    db.prepare(
      `INSERT INTO LexiconFieldEvidence (
         fieldVersionId, sourceAssertionId, evidenceKind, stance,
         witnessFamily, weight
       ) VALUES (?, ?, 'direct_source', 'supports', 'restricted', 1)`
    ).run(field.id, assertionId);

    const decision: LexiconV3ReviewDecision = {
      schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
      entryKey: "greek:G1623",
      locale: "en",
      field: "gloss",
      expectedContentHash: lexiconV3ReviewTargetHash({
        entryKey: "greek:G1623",
        locale: "en",
        field: "gloss",
        valueText: "sixth"
      }),
      verdict: "replace",
      reviewer: "lexicographe",
      reason: "Réécriture originale du projet.",
      replacement: {
        valueText: "sixième rang ordinal",
        confidence: 1,
        evidenceMode: "editorial_replacement",
        sourceNote:
          "Réécriture indépendante vérifiée contre les formes grecques."
      },
      decidedAt: "2026-07-12T10:00:00.000Z"
    };

    applyLexiconV3ReviewDecisions(db, [decision]);
    const replacement = db
      .prepare(
        `SELECT id, state FROM LexiconFieldVersions
         WHERE entryKey = 'greek:G1623' AND locale = 'en' AND field = 'gloss'
           AND state = 'human_validated'`
      )
      .get() as { id: number; state: string };
    assert.equal(replacement.state, "human_validated");
    const evidence = db
      .prepare(
        `SELECT source.sourceKey, source.rightsStatus, source.allowDisplay,
                fieldEvidence.stance
         FROM LexiconFieldEvidence fieldEvidence
         JOIN LexiconSourceAssertions assertion
           ON assertion.id = fieldEvidence.sourceAssertionId
         JOIN LexiconSources source ON source.id = assertion.sourceId
         WHERE fieldEvidence.fieldVersionId = ?
         ORDER BY source.sourceKey`
      )
      .all(replacement.id) as unknown as Array<{
      sourceKey: string;
      rightsStatus: string;
      allowDisplay: number;
      stance: string;
    }>;
    assert.deepEqual(
      evidence.map((row) => ({ ...row })),
      [
        {
          sourceKey: "project-editorial-review",
          rightsStatus: "cleared",
          allowDisplay: 1,
          stance: "supports"
        },
        {
          sourceKey: "restricted-source",
          rightsStatus: "pending",
          allowDisplay: 0,
          stance: "context"
        }
      ]
    );
  } finally {
    db.close();
  }
});

for (const verdict of [
  "replace",
  "reject",
  "source_issue",
  "needs_review"
] as const) {
  test(`invalidates active French descendants and carriers after an English ${verdict} verdict`, () => {
    const db = reviewDatabase(false);
    try {
      const english = db
        .prepare(
          `SELECT id FROM LexiconFieldVersions
           WHERE entryKey = 'greek:G1623' AND locale = 'en'
             AND field = 'gloss'`
        )
        .get() as { id: number };
      const descendants = seedFrenchDescendants(db, english.id);
      const decision: LexiconV3ReviewDecision = {
        schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
        entryKey: "greek:G1623",
        locale: "en",
        field: "gloss",
        expectedContentHash: lexiconV3ReviewTargetHash({
          entryKey: "greek:G1623",
          locale: "en",
          field: "gloss",
          valueText: "sixth"
        }),
        verdict,
        reviewer: "lexicographe",
        reason: "La filiation française doit être invalidée atomiquement.",
        decidedAt: "2026-07-12T10:00:00.000Z"
      };
      if (verdict === "replace") {
        decision.replacement = {
          valueText: "sixth ordinal",
          confidence: 1,
          evidenceMode: "inherit"
        };
      }

      applyLexiconV3ReviewDecisions(db, [decision]);

      const french = db
        .prepare(
          `SELECT id, state FROM LexiconFieldVersions
           WHERE id IN (?, ?) ORDER BY id`
        )
        .all(
          descendants.activeFrenchId,
          descendants.rejectedFrenchId
        ) as unknown as Array<{ id: number; state: string }>;
      assert.deepEqual(
        french.map((row) => ({ ...row })),
        [
          { id: descendants.activeFrenchId, state: "superseded" },
          { id: descendants.rejectedFrenchId, state: "rejected" }
        ]
      );
      const carriers = db
        .prepare(
          `SELECT id, state, policy FROM LexiconCarrierTerms
           WHERE id IN (?, ?, ?) ORDER BY id`
        )
        .all(
          descendants.autoSafeCarrierId,
          descendants.reviewOnlyCarrierId,
          descendants.rejectedCarrierId
        ) as unknown as Array<{
        id: number;
        state: string;
        policy: string;
      }>;
      assert.deepEqual(
        carriers.map((row) => ({ ...row })),
        [
          {
            id: descendants.autoSafeCarrierId,
            state: "superseded",
            policy: "review_only"
          },
          {
            id: descendants.reviewOnlyCarrierId,
            state: "superseded",
            policy: "review_only"
          },
          {
            id: descendants.rejectedCarrierId,
            state: "rejected",
            policy: "blocked"
          }
        ]
      );
    } finally {
      db.close();
    }
  });
}

test("supersedes carriers when a reviewed French gloss is replaced", () => {
  const db = reviewDatabase(false);
  try {
    const english = db
      .prepare(
        `SELECT id, contentHash FROM LexiconFieldVersions
         WHERE entryKey = 'greek:G1623' AND locale = 'en'
           AND field = 'gloss'`
      )
      .get() as { id: number; contentHash: string };
    db.prepare(
      "UPDATE LexiconFieldVersions SET state = 'auto_validated' WHERE id = ?"
    ).run(english.id);
    const descendants = seedFrenchDescendants(db, english.id, "auto_validated");

    applyLexiconV3ReviewDecisions(db, [
      {
        schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
        entryKey: "greek:G1623",
        locale: "fr",
        field: "gloss",
        expectedContentHash: lexiconV3ReviewTargetHash({
          entryKey: "greek:G1623",
          locale: "fr",
          field: "gloss",
          valueText: "sixième",
          derivedFromContentHash: english.contentHash
        }),
        verdict: "replace",
        reviewer: "lexicographe",
        reason:
          "Le gloss français doit être corrigé sans conserver ses carriers.",
        replacement: {
          valueText: "sixième rang",
          confidence: 1,
          evidenceMode: "inherit"
        },
        decidedAt: "2026-07-12T10:00:00.000Z"
      }
    ]);

    const fields = db
      .prepare(
        `SELECT id, valueText, state, supersedesId
         FROM LexiconFieldVersions
         WHERE entryKey = 'greek:G1623' AND locale = 'fr'
           AND field = 'gloss' AND id <> ?
         ORDER BY id`
      )
      .all(descendants.rejectedFrenchId) as unknown as Array<{
      id: number;
      valueText: string;
      state: string;
      supersedesId: number | null;
    }>;
    assert.deepEqual(
      fields.map((row) => ({ ...row })),
      [
        {
          id: descendants.activeFrenchId,
          valueText: "sixième",
          state: "superseded",
          supersedesId: null
        },
        {
          id: fields[1]!.id,
          valueText: "sixième rang",
          state: "human_validated",
          supersedesId: descendants.activeFrenchId
        }
      ]
    );
    const carriers = db
      .prepare(
        `SELECT id, state, policy FROM LexiconCarrierTerms
         WHERE id IN (?, ?, ?) ORDER BY id`
      )
      .all(
        descendants.autoSafeCarrierId,
        descendants.reviewOnlyCarrierId,
        descendants.rejectedCarrierId
      ) as unknown as Array<{ id: number; state: string; policy: string }>;
    assert.deepEqual(
      carriers.map((row) => ({ ...row })),
      [
        {
          id: descendants.autoSafeCarrierId,
          state: "superseded",
          policy: "review_only"
        },
        {
          id: descendants.reviewOnlyCarrierId,
          state: "superseded",
          policy: "review_only"
        },
        {
          id: descendants.rejectedCarrierId,
          state: "rejected",
          policy: "blocked"
        }
      ]
    );
    assert.equal(verifyLexiconV3Schema(db).ok, true);
  } finally {
    db.close();
  }
});

for (const [verdict, expectedState] of [
  ["needs_review", "candidate"],
  ["reject", "rejected"],
  ["source_issue", "blocked_source_issue"]
] as const) {
  test(`supersedes carriers after a French gloss ${verdict} verdict`, () => {
    const db = reviewDatabase(false);
    try {
      const english = db
        .prepare(
          `SELECT id, contentHash FROM LexiconFieldVersions
           WHERE entryKey = 'greek:G1623' AND locale = 'en'
             AND field = 'gloss'`
        )
        .get() as { id: number; contentHash: string };
      db.prepare(
        "UPDATE LexiconFieldVersions SET state = 'auto_validated' WHERE id = ?"
      ).run(english.id);
      const descendants = seedFrenchDescendants(
        db,
        english.id,
        "auto_validated"
      );
      applyLexiconV3ReviewDecisions(db, [
        {
          schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
          entryKey: "greek:G1623",
          locale: "fr",
          field: "gloss",
          expectedContentHash: lexiconV3ReviewTargetHash({
            entryKey: "greek:G1623",
            locale: "fr",
            field: "gloss",
            valueText: "sixième",
            derivedFromContentHash: english.contentHash
          }),
          verdict,
          reviewer: "lexicographe",
          reason: "Le gloss n'est plus une source valide pour ses carriers.",
          decidedAt: "2026-07-12T10:00:00.000Z"
        }
      ]);

      const french = db
        .prepare("SELECT state FROM LexiconFieldVersions WHERE id = ?")
        .get(descendants.activeFrenchId) as { state: string };
      const carriers = db
        .prepare(
          `SELECT state, policy FROM LexiconCarrierTerms
           WHERE id IN (?, ?) ORDER BY id`
        )
        .all(
          descendants.autoSafeCarrierId,
          descendants.reviewOnlyCarrierId
        ) as unknown as Array<{ state: string; policy: string }>;
      assert.equal(french.state, expectedState);
      assert.deepEqual(
        carriers.map((row) => ({ ...row })),
        [
          { state: "superseded", policy: "review_only" },
          { state: "superseded", policy: "review_only" }
        ]
      );
      assert.equal(verifyLexiconV3Schema(db).ok, true);
    } finally {
      db.close();
    }
  });
}

test("keeps carriers active when a French gloss is accepted unchanged", () => {
  const db = reviewDatabase(false);
  try {
    const english = db
      .prepare(
        `SELECT id, contentHash FROM LexiconFieldVersions
         WHERE entryKey = 'greek:G1623' AND locale = 'en'
           AND field = 'gloss'`
      )
      .get() as { id: number; contentHash: string };
    db.prepare(
      "UPDATE LexiconFieldVersions SET state = 'auto_validated' WHERE id = ?"
    ).run(english.id);
    const descendants = seedFrenchDescendants(db, english.id, "auto_validated");

    applyLexiconV3ReviewDecisions(db, [
      {
        schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
        entryKey: "greek:G1623",
        locale: "fr",
        field: "gloss",
        expectedContentHash: lexiconV3ReviewTargetHash({
          entryKey: "greek:G1623",
          locale: "fr",
          field: "gloss",
          valueText: "sixième",
          derivedFromContentHash: english.contentHash
        }),
        verdict: "accept",
        reviewer: "lexicographe",
        reason: "Le gloss et ses carriers sont acceptés sans modification.",
        decidedAt: "2026-07-12T10:00:00.000Z"
      }
    ]);

    const french = db
      .prepare("SELECT state FROM LexiconFieldVersions WHERE id = ?")
      .get(descendants.activeFrenchId) as { state: string };
    const carriers = db
      .prepare(
        `SELECT state, policy FROM LexiconCarrierTerms
         WHERE id IN (?, ?) ORDER BY id`
      )
      .all(
        descendants.autoSafeCarrierId,
        descendants.reviewOnlyCarrierId
      ) as unknown as Array<{ state: string; policy: string }>;
    assert.equal(french.state, "human_validated");
    assert.deepEqual(
      carriers.map((row) => ({ ...row })),
      [
        { state: "auto_validated", policy: "auto_safe" },
        { state: "human_validated", policy: "review_only" }
      ]
    );
    assert.equal(verifyLexiconV3Schema(db).ok, true);
  } finally {
    db.close();
  }
});

test("rolls back review mutations when post-decision invariants fail", () => {
  const db = reviewDatabase(false);
  try {
    db.exec(`
      CREATE TRIGGER fixture_inject_invalid_carrier
      AFTER UPDATE OF state ON LexiconFieldVersions
      WHEN NEW.entryKey = 'greek:G1623' AND NEW.locale = 'en'
      BEGIN
        INSERT INTO LexiconCarrierTerms (
          entryKey, strong, stepStrong, locale, surface, normalized, termKind,
          state, policy, confidence, derivedFromVersionId, contentHash
        ) VALUES (
          'greek:G1623', 'G1623', 'G1623', 'fr', 'invalide', 'invalide',
          'word', 'auto_validated', 'auto_safe', 1, NULL, '${"a".repeat(64)}'
        );
      END;
    `);
    const decision: LexiconV3ReviewDecision = {
      schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
      entryKey: "greek:G1623",
      locale: "en",
      field: "gloss",
      expectedContentHash: lexiconV3ReviewTargetHash({
        entryKey: "greek:G1623",
        locale: "en",
        field: "gloss",
        valueText: "sixth"
      }),
      verdict: "accept",
      reviewer: "lexicographe",
      reason: "La transaction doit être annulée si un invariant échoue.",
      decidedAt: "2026-07-12T10:00:00.000Z"
    };

    assert.throws(
      () => applyLexiconV3ReviewDecisions(db, [decision]),
      /post-review-verification-failed:.*active-carrier-parent-invalid/u
    );
    const english = db
      .prepare(
        `SELECT state FROM LexiconFieldVersions
         WHERE entryKey = 'greek:G1623' AND locale = 'en' AND field = 'gloss'`
      )
      .get() as { state: string };
    assert.equal(english.state, "candidate");
    assert.equal(
      Number(
        (
          db
            .prepare("SELECT count(*) AS count FROM LexiconCarrierTerms")
            .get() as { count: number }
        ).count
      ),
      0
    );
    assert.equal(
      Number(
        (
          db
            .prepare("SELECT count(*) AS count FROM LexiconFieldReviews")
            .get() as { count: number }
        ).count
      ),
      0
    );
    assert.equal(verifyLexiconV3Schema(db).ok, true);
  } finally {
    db.close();
  }
});

test("keeps French descendants active when English content is accepted unchanged", () => {
  const db = reviewDatabase(false);
  try {
    const english = db
      .prepare(
        `SELECT id FROM LexiconFieldVersions
         WHERE entryKey = 'greek:G1623' AND locale = 'en'
           AND field = 'gloss'`
      )
      .get() as { id: number };
    const descendants = seedFrenchDescendants(db, english.id);
    applyLexiconV3ReviewDecisions(db, [
      {
        schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
        entryKey: "greek:G1623",
        locale: "en",
        field: "gloss",
        expectedContentHash: lexiconV3ReviewTargetHash({
          entryKey: "greek:G1623",
          locale: "en",
          field: "gloss",
          valueText: "sixth"
        }),
        verdict: "accept",
        reviewer: "lexicographe",
        reason: "Le contenu anglais est accepté sans modification.",
        decidedAt: "2026-07-12T10:00:00.000Z"
      }
    ]);

    const french = db
      .prepare("SELECT state FROM LexiconFieldVersions WHERE id = ?")
      .get(descendants.activeFrenchId) as { state: string };
    const carrier = db
      .prepare("SELECT state, policy FROM LexiconCarrierTerms WHERE id = ?")
      .get(descendants.autoSafeCarrierId) as {
      state: string;
      policy: string;
    };
    assert.equal(french.state, "human_validated");
    assert.deepEqual(
      { ...carrier },
      {
        state: "auto_validated",
        policy: "auto_safe"
      }
    );
  } finally {
    db.close();
  }
});

test("rejects an incoherent project editorial source collision and rolls back descendants", () => {
  const db = reviewDatabase(false);
  try {
    const english = db
      .prepare(
        `SELECT id FROM LexiconFieldVersions
         WHERE entryKey = 'greek:G1623' AND locale = 'en'
           AND field = 'gloss'`
      )
      .get() as { id: number };
    const descendants = seedFrenchDescendants(db, english.id);
    const sourceDigest = createHash("sha256")
      .update("lexicon-v3-project-editorial-review@1")
      .digest("hex");
    db.prepare(
      `INSERT INTO LexiconSources (
         sourceKey, name, version, witnessFamily, locale, sha256, license,
         rightsStatus, allowDisplay, allowTranslation, allowCarrier,
         metadataJson
       ) VALUES (
         'project-editorial-review', 'Project editorial review', '1',
         'project-editorial-review', 'mul', ?,
         'Project-authored editorial content', 'cleared', 1, 0, 0, ?
       )`
    ).run(
      sourceDigest,
      JSON.stringify({ policy: "human-editorial-replacement@1" })
    );
    const decision: LexiconV3ReviewDecision = {
      schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
      entryKey: "greek:G1623",
      locale: "en",
      field: "gloss",
      expectedContentHash: lexiconV3ReviewTargetHash({
        entryKey: "greek:G1623",
        locale: "en",
        field: "gloss",
        valueText: "sixth"
      }),
      verdict: "replace",
      reviewer: "lexicographe",
      reason: "Réécriture indépendante du projet.",
      replacement: {
        valueText: "sixth ordinal",
        confidence: 1,
        evidenceMode: "editorial_replacement",
        sourceNote: "Réécriture originale vérifiée par le projet."
      },
      decidedAt: "2026-07-12T10:00:00.000Z"
    };

    assert.throws(
      () => applyLexiconV3ReviewDecisions(db, [decision]),
      /project-editorial-source-collision/u
    );
    const englishAfter = db
      .prepare("SELECT state FROM LexiconFieldVersions WHERE id = ?")
      .get(english.id) as { state: string };
    const frenchAfter = db
      .prepare("SELECT state FROM LexiconFieldVersions WHERE id = ?")
      .get(descendants.activeFrenchId) as { state: string };
    const carrierAfter = db
      .prepare("SELECT state, policy FROM LexiconCarrierTerms WHERE id = ?")
      .get(descendants.autoSafeCarrierId) as {
      state: string;
      policy: string;
    };
    assert.equal(englishAfter.state, "candidate");
    assert.equal(frenchAfter.state, "human_validated");
    assert.deepEqual(
      { ...carrierAfter },
      {
        state: "auto_validated",
        policy: "auto_safe"
      }
    );
    assert.equal(
      Number(
        (
          db
            .prepare(
              `SELECT count(*) AS count FROM LexiconFieldVersions
               WHERE entryKey = 'greek:G1623' AND locale = 'en'
                 AND field = 'gloss'`
            )
            .get() as { count: number }
        ).count
      ),
      1
    );
  } finally {
    db.close();
  }
});

test("replays a stable decision after unrelated rows shift SQLite ids", () => {
  const decision: LexiconV3ReviewDecision = {
    schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
    entryKey: "greek:G1623",
    locale: "en",
    field: "gloss",
    fieldVersionId: 1,
    expectedContentHash: lexiconV3ReviewTargetHash({
      entryKey: "greek:G1623",
      locale: "en",
      field: "gloss",
      valueText: "sixth"
    }),
    verdict: "accept",
    reviewer: "lexicographe",
    reason: "La cible stable doit survivre au décalage des identifiants.",
    decidedAt: "2026-07-12T10:00:00.000Z"
  };
  const db = reviewDatabase(true);
  try {
    const result = applyLexiconV3ReviewDecisions(db, [decision]);
    assert.equal(result.applied, 1);
    const row = db
      .prepare(
        `SELECT id, state FROM LexiconFieldVersions
         WHERE entryKey = 'greek:G1623' AND locale = 'en' AND field = 'gloss'`
      )
      .get() as { id: number; state: string };
    assert.notEqual(row.id, decision.fieldVersionId);
    assert.equal(row.state, "human_validated");
  } finally {
    db.close();
  }
});

function reviewDatabase(withLeadingRow: boolean): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  createLexiconV3Schema(db);
  for (const [key, strong] of [
    ["greek:G0001", "G0001"],
    ["greek:G1623", "G1623"]
  ] as const) {
    db.prepare(
      `INSERT INTO LexiconEntries (
         entryKey, language, baseCode, eStrong, primaryDStrong, dStrong,
         uStrong, original, transliteration, morph
       ) VALUES (?, 'greek', ?, ?, ?, ?, ?, 'λέξις', 'lexis', 'G:N')`
    ).run(key, Number(strong.slice(1)), strong, strong, `${strong} =`, strong);
  }
  const insert = (entryKey: string, valueText: string): void => {
    db.prepare(
      `INSERT INTO LexiconFieldVersions (
         entryKey, locale, field, valueText, state, confidence, method,
         generator, contentHash
       ) VALUES (?, 'en', 'gloss', ?, 'candidate', 0.9, 'editorial',
                 'fixture', ?)`
    ).run(
      entryKey,
      valueText,
      lexiconV3FieldContentHash({
        entryKey,
        locale: "en",
        field: "gloss",
        valueText
      })
    );
  };
  if (withLeadingRow) insert("greek:G0001", "first");
  insert("greek:G1623", "sixth");
  return db;
}

function seedFrenchDescendants(
  db: DatabaseSync,
  englishFieldId: number,
  activeFrenchState: "auto_validated" | "human_validated" = "human_validated"
): {
  activeFrenchId: number;
  rejectedFrenchId: number;
  autoSafeCarrierId: number;
  reviewOnlyCarrierId: number;
  rejectedCarrierId: number;
} {
  const insertFrench = db.prepare(
    `INSERT INTO LexiconFieldVersions (
       entryKey, locale, field, valueText, state, confidence, method,
       generator, derivedFromVersionId, contentHash
     ) VALUES (
       'greek:G1623', 'fr', 'gloss', ?, ?, 0.9, 'translation',
       'fixture', ?, ?
     )`
  );
  const activeFrenchId = Number(
    insertFrench.run(
      "sixième",
      activeFrenchState,
      englishFieldId,
      lexiconV3FieldContentHash({
        entryKey: "greek:G1623",
        locale: "fr",
        field: "gloss",
        valueText: "sixième",
        derivedFromVersionId: englishFieldId
      })
    ).lastInsertRowid
  );
  const rejectedFrenchId = Number(
    insertFrench.run(
      "sixiesme",
      "rejected",
      englishFieldId,
      lexiconV3FieldContentHash({
        entryKey: "greek:G1623",
        locale: "fr",
        field: "gloss",
        valueText: "sixiesme",
        derivedFromVersionId: englishFieldId
      })
    ).lastInsertRowid
  );
  const insertCarrier = db.prepare(
    `INSERT INTO LexiconCarrierTerms (
       entryKey, strong, stepStrong, locale, surface, normalized, termKind,
       state, policy, confidence, derivedFromVersionId, contentHash
     ) VALUES (
       'greek:G1623', 'G1623', 'G1623', 'fr', ?, ?, 'word', ?, ?, 0.9, ?, ?
     )`
  );
  const autoSafeCarrierId = Number(
    insertCarrier.run(
      "sixième",
      "sixieme",
      "auto_validated",
      "auto_safe",
      activeFrenchId,
      "d".repeat(64)
    ).lastInsertRowid
  );
  const reviewOnlyCarrierId = Number(
    insertCarrier.run(
      "sixième rang",
      "sixieme-rang",
      "human_validated",
      "review_only",
      activeFrenchId,
      "e".repeat(64)
    ).lastInsertRowid
  );
  const rejectedCarrierId = Number(
    insertCarrier.run(
      "sixiesme",
      "sixiesme",
      "rejected",
      "blocked",
      rejectedFrenchId,
      "f".repeat(64)
    ).lastInsertRowid
  );
  return {
    activeFrenchId,
    rejectedFrenchId,
    autoSafeCarrierId,
    reviewOnlyCarrierId,
    rejectedCarrierId
  };
}
