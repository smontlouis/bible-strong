import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsensusCarrierTerms,
  evaluateFrenchAutoEligibility,
  FRENCH_PROPOSAL_SCHEMA_VERSION,
  type FrenchLexiconProposal,
  type FrenchValidationContext,
  validateFrenchEntityMentions,
  validateFrenchProposal,
  validateLexiconHtmlPair
} from "../src/lexiconV3/frenchValidation.js";
import type { RequiredFrenchEntityMention } from "../src/lexiconV3/frenchEntityMentions.js";

const context: FrenchValidationContext = {
  entryKey: "greek:G2777",
  englishHash: "english-hash",
  englishStatus: "validated",
  englishGloss: "scroll",
  englishMeaning: "A roll of parchment.",
  original: "κεφαλίς",
  concordanceForms: [
    {
      surface: "rouleau",
      normalized: "rouleau",
      count: 3,
      strongCount: 1,
      witnessFamilies: ["darby", "segond"],
      sources: ["Darby", "DarbyR", "Sg1910"]
    }
  ]
};

test("rejects known lexical false friends and stale English derivations", () => {
  const proposal = makeProposal({
    glossFr: "défiler",
    derivedFromEnglishHash: "old-hash"
  });

  const result = validateFrenchProposal(proposal, context);

  assert.equal(result.canPublishDisplay, false);
  assert.ok(
    result.issues.some((issue) => issue.code === "false-friend-scroll")
  );
  assert.ok(
    result.issues.some((issue) => issue.code === "stale-english-version")
  );
});

test("accepts coherent French display content derived from current English", () => {
  const result = validateFrenchProposal(makeProposal(), context);

  assert.equal(result.canPublishDisplay, true);
  assert.equal(result.requiresHumanReview, false);
  assert.deepEqual(result.issues, []);
});

test("requires exact entity coverage, canonical spelling and the source segment", () => {
  const israel = requiredEntityMention({
    mentionId: `entity-mention:${"1".repeat(64)}`,
    segmentId: "t0",
    sourceSurface: "Israel",
    targetEntryKey: "hebrew:H3478",
    targetEntityIds: [1],
    allowedFrenchForms: ["Israël"],
    resolution: "exact"
  });
  const israelite = requiredEntityMention({
    mentionId: `entity-mention:${"2".repeat(64)}`,
    segmentId: "t1",
    sourceSurface: "Israelite",
    targetEntryKey: "hebrew:H3481",
    targetEntityIds: [1],
    allowedFrenchForms: ["Israélite"],
    resolution: "exact"
  });
  const segments = [
    { id: "t0", text: "Israël est cité." },
    { id: "t1", text: "Un Israélite est aussi cité." }
  ];
  assert.deepEqual(
    validateFrenchEntityMentions(
      {
        meaningSegmentsFr: segments,
        entityMentionsFr: [
          {
            mentionId: israel.mentionId,
            segmentId: "t0",
            chosenFrenchForm: "Israël"
          },
          {
            mentionId: israelite.mentionId,
            segmentId: "t1",
            chosenFrenchForm: "Israélite"
          }
        ]
      },
      [israel, israelite]
    ),
    []
  );

  const missing = validateFrenchEntityMentions(
    {
      meaningSegmentsFr: segments,
      entityMentionsFr: [
        {
          mentionId: israel.mentionId,
          segmentId: "t0",
          chosenFrenchForm: "Israël"
        }
      ]
    },
    [israel, israelite]
  );
  assert.ok(
    missing.some((issue) => issue.code === "missing-entity-mention-output")
  );

  const misspelled = validateFrenchEntityMentions(
    {
      meaningSegmentsFr: [
        { id: "t0", text: "Israel est cité." },
        { id: "t1", text: "Un Israélite est aussi cité." }
      ],
      entityMentionsFr: [
        {
          mentionId: israel.mentionId,
          segmentId: "t0",
          chosenFrenchForm: "Israel"
        },
        {
          mentionId: israelite.mentionId,
          segmentId: "t1",
          chosenFrenchForm: "Israélite"
        }
      ]
    },
    [israel, israelite]
  );
  assert.ok(
    misspelled.some((issue) => issue.code === "entity-mention-form-not-allowed")
  );

  const neighborSubstitution = validateFrenchEntityMentions(
    {
      meaningSegmentsFr: [
        { id: "t0", text: "Israël est cité." },
        { id: "t1", text: "Israël et un Israélite sont aussi cités." }
      ],
      entityMentionsFr: [
        {
          mentionId: israel.mentionId,
          segmentId: "t1",
          chosenFrenchForm: "Israël"
        },
        {
          mentionId: israelite.mentionId,
          segmentId: "t1",
          chosenFrenchForm: "Israélite"
        }
      ]
    },
    [israel, israelite]
  );
  assert.ok(
    neighborSubstitution.some(
      (issue) => issue.code === "entity-mention-segment-mismatch"
    )
  );
});

test("forbids output for non-entities and blocks ambiguous source mentions", () => {
  const nonEntity = requiredEntityMention({
    mentionId: `entity-mention:${"3".repeat(64)}`,
    segmentId: "t0",
    sourceSurface: "G9048",
    citedStrong: "G9048",
    targetEntryKey: "greek:G9048",
    targetEntityIds: [],
    allowedFrenchForms: [],
    resolution: "non-entity"
  });
  const ambiguous = requiredEntityMention({
    mentionId: `entity-mention:${"4".repeat(64)}`,
    segmentId: "t1",
    sourceSurface: "Jordan",
    targetEntryKey: null,
    targetEntityIds: [60, 61],
    allowedFrenchForms: ["Jordan", "Jourdain"],
    resolution: "ambiguous"
  });
  const issues = validateFrenchEntityMentions(
    {
      meaningSegmentsFr: [
        { id: "t0", text: "Voir G9048." },
        { id: "t1", text: "Le Jourdain est cité." }
      ],
      entityMentionsFr: [
        {
          mentionId: nonEntity.mentionId,
          segmentId: "t0",
          chosenFrenchForm: "plaine"
        }
      ]
    },
    [nonEntity, ambiguous]
  );
  assert.ok(
    issues.some((issue) => issue.code === "unexpected-entity-mention-output")
  );
  assert.ok(
    issues.some((issue) => issue.code === "ambiguous-entity-mention-source")
  );
});

test("treats human-validated English as ready for French validation", () => {
  const result = validateFrenchProposal(makeProposal(), {
    ...context,
    englishStatus: "human_validated"
  });

  assert.equal(result.canPublishDisplay, true);
  assert.equal(result.requiresHumanReview, false);
});

test("routes non-blocking validator warnings to human review", () => {
  const result = validateFrenchProposal(
    makeProposal({ glossFr: "rouleau." }),
    context
  );

  assert.equal(result.canPublishDisplay, true);
  assert.equal(result.requiresHumanReview, true);
  assert.ok(
    result.issues.some((issue) => issue.code === "gloss-terminal-punctuation")
  );
});

test("recognizes semantically identical French Bible references", () => {
  const result = validateFrenchProposal(
    makeProposal({
      meaningFr: "Voir Luc 4.16 et Actes 7:20-21.",
      meaningHtmlFr: "<p>Voir Luc 4.16 et Actes 7:20-21.</p>"
    }),
    {
      ...context,
      sourceReferences: ["Luke.4.16", "Acts.7.20"]
    }
  );

  assert.equal(
    result.issues.some((issue) => issue.code === "missing-source-reference"),
    false
  );
});

test("recognizes STEP aliases and compact chapter or verse continuations", () => {
  const meaning =
    "Voir Lc.2:11, 26; Jhn.1:41; Mt.2:4; Mc.8:29; 1Co.14:5; Ac.2:36 4:26; 2Ma.1:10; 1Ki.2:10; 2 Ch.21:17; Psa.2:2; Rut.4:17; 1Ti.1:8; 1Pi.2:12; 1Th.5:21; Php.3:9; Ex.23:7.";
  const result = validateFrenchProposal(
    makeProposal({
      meaningFr: meaning,
      meaningHtmlFr: `<p>${meaning}</p>`
    }),
    {
      ...context,
      sourceReferences: [
        "1Cor.14.5",
        "1Kgs.2.10",
        "2Macc.1.10",
        "2Chr.21.17",
        "Acts.2.36",
        "Acts.4.26",
        "John.1.41",
        "Luke.2.11",
        "Luke.2.26",
        "Mark.8.29",
        "Matt.2.4",
        "Ps.2.2",
        "Ruth.4.17",
        "1Tim.1.8",
        "1Pet.2.12",
        "1Thess.5.21",
        "Phil.3.9",
        "Exod.23.7"
      ]
    }
  );

  assert.deepEqual(
    result.issues.filter((issue) => issue.code === "missing-source-reference"),
    []
  );
});

test("recognizes natural French Bible abbreviations and STEP edition markers", () => {
  const meaning =
    "Apo.9:11; Sag.5:22; Jac.4:13; Nom.6:5; Os.5:2; Est.8:13; Mar.10:27; Ésa.1:22; 1 Ro.24:12; 2 R. 23:33; 4 Rois 21:18; Jg.4:6; Jug.5:17; 1 Chr 5:23; Esd.3:1; Da TH 7:19; 4 Maccabées 3:1; 1 Ti 6:18; 1Co.7:8, 32 ; fém., ib. 11; Act.25:13 ; puis ib. 27:9.";
  const result = validateFrenchProposal(
    makeProposal({ meaningFr: meaning, meaningHtmlFr: `<p>${meaning}</p>` }),
    {
      ...context,
      sourceReferences: [
        "Rev.9.11",
        "Wis.5.22",
        "Jas.4.13",
        "Num.6.5",
        "Hos.5.2",
        "Esth.8.13",
        "Mark.10.27",
        "Isa.1.22",
        "1Kgs.24.12",
        "2Kgs.23.33",
        "4Kgs.21.18",
        "Judg.4.6",
        "Judg.5.17",
        "1Chr.5.23",
        "Ezra.3.1",
        "Dan.7.19",
        "4Macc.3.1",
        "1Tim.6.18",
        "1Cor.7.11",
        "Acts.27.9"
      ]
    }
  );
  assert.deepEqual(
    result.issues.filter((issue) => issue.code === "missing-source-reference"),
    []
  );
});

test("recognizes STEP Song, John and French Ezekiel abbreviations", () => {
  const meaning = "Sng.2:15 ; Ézéch. 30:18 ; Ezk.27.6 ; 1Jo.3:18.";
  const result = validateFrenchProposal(
    makeProposal({ meaningFr: meaning, meaningHtmlFr: `<p>${meaning}</p>` }),
    {
      ...context,
      sourceReferences: [
        "Song.2.15",
        "Ezek.30.18",
        "Ezek.27.6",
        "1John.3.18"
      ]
    }
  );

  assert.deepEqual(
    result.issues.filter((issue) => issue.code === "missing-source-reference"),
    []
  );
});

test("uses Unicode word boundaries for residual English", () => {
  for (const frenchWord of ["excepté", "excepte\u0301"]) {
    const french = validateFrenchProposal(
      makeProposal({
        meaningFr: `Tout autre cas est ${frenchWord}.`,
        meaningHtmlFr: `<p>Tout autre cas est ${frenchWord}.</p>`
      }),
      context
    );
    assert.equal(
      french.issues.some((issue) => issue.code === "residual-english"),
      false,
      frenchWord
    );
  }

  const english = validateFrenchProposal(
    makeProposal({
      meaningFr: "Tout autre cas est except.",
      meaningHtmlFr: "<p>Tout autre cas est except.</p>"
    }),
    context
  );
  assert.equal(
    english.issues.some((issue) => issue.code === "residual-english"),
    true
  );
});

test("rejects every attribute and slash-obfuscated event handler in French HTML", () => {
  for (const html of [
    "<span/onmouseover=alert(1)>texte</span>",
    "<b/onclick=alert(1)>texte</b>",
    '<span style="position:fixed;inset:0">texte</span>',
    '<span style="background:url(https://evil/track)">texte</span>'
  ]) {
    const issues = validateLexiconHtmlPair("texte", html);
    assert.ok(
      issues.some((issue) => issue.code === "unsafe-html-attribute"),
      html
    );
  }
});

test("rejects unclosed, crossed, and invalid self-closing French HTML", () => {
  for (const html of [
    "<p>Texte français.",
    "<p><strong>Texte</p> français.</strong>",
    "<p/>Texte français.",
    "</br>Texte français."
  ]) {
    const issues = validateLexiconHtmlPair("Texte français.", html);
    assert.ok(
      issues.some((issue) => issue.code === "malformed-html-nesting"),
      html
    );
  }
});

test("accepts balanced inline tags and canonical void tags", () => {
  const issues = validateLexiconHtmlPair(
    "Texte français avec retour.",
    "<p><strong>Texte français</strong><br>avec retour.</p>"
  );

  assert.equal(
    issues.some((issue) => issue.code === "malformed-html-nesting"),
    false
  );
});

test("accepts punctuation-only differences at HTML paragraph boundaries", () => {
  const issues = validateLexiconHtmlPair(
    "Sens STEP : rouge. Catégorie grammaticale : adjectif.",
    "<p><strong>Sens STEP :</strong> rouge</p><p><strong>Catégorie grammaticale :</strong> adjectif</p>"
  );

  assert.equal(
    issues.some((issue) => issue.code === "meaning-text-html-divergence"),
    false
  );
});

test("still rejects a substantive text and HTML divergence", () => {
  const issues = validateLexiconHtmlPair(
    "Sens STEP : rouge.",
    "<p><strong>Sens STEP :</strong> bleu</p>"
  );

  assert.ok(
    issues.some((issue) => issue.code === "meaning-text-html-divergence")
  );
});

test("requires exact three-model and independent-witness consensus for auto-safe carriers", () => {
  const left = makeProposal({ model: "model-a" });
  const right = makeProposal({ model: "model-b" });
  const arbiter = makeProposal({ model: "model-c" });

  const terms = buildConsensusCarrierTerms(left, right, arbiter, context);

  assert.deepEqual(terms, [
    {
      surface: "rouleau",
      normalized: "rouleau",
      state: "auto_validated",
      policy: "auto_safe",
      confidence: 0.92,
      witnessFamilies: ["darby", "segond"],
      sources: ["Darby", "DarbyR", "Sg1910"],
      reason: "three-model-consensus-and-two-witness-families"
    }
  ]);
});

test("blocks carriers without exact concordance evidence", () => {
  const left = makeProposal({
    model: "model-a",
    carrierTermsFr: ["manuscrit"]
  });
  const right = makeProposal({
    model: "model-b",
    carrierTermsFr: ["manuscrit"]
  });
  const arbiter = makeProposal({
    model: "model-c",
    carrierTermsFr: ["manuscrit"]
  });

  const terms = buildConsensusCarrierTerms(left, right, arbiter, context);

  assert.equal(terms[0]?.state, "blocked");
  assert.equal(terms[0]?.reason, "no-exact-french-witness");
});

test("keeps corpus-ambiguous concordance forms review-only", () => {
  const terms = buildConsensusCarrierTerms(
    makeProposal({ model: "model-a" }),
    makeProposal({ model: "model-b" }),
    makeProposal({ model: "model-c" }),
    {
      ...context,
      concordanceForms: [
        {
          ...context.concordanceForms[0]!,
          strongCount: 27
        }
      ]
    }
  );

  assert.equal(terms[0]?.state, "candidate");
  assert.equal(terms[0]?.policy, "review_only");
  assert.equal(terms[0]?.reason, "ambiguous-across-27-strongs");
});

test("keeps a proposer carrier review-only when the arbiter omits it", () => {
  const terms = buildConsensusCarrierTerms(
    makeProposal({ model: "model-a" }),
    makeProposal({ model: "model-b" }),
    makeProposal({ model: "model-c", carrierTermsFr: [] }),
    context
  );

  assert.equal(terms[0]?.state, "candidate");
  assert.equal(terms[0]?.policy, "review_only");
  assert.equal(terms[0]?.reason, "arbiter-did-not-confirm");
});

test("never auto-validates display meanings that only agree on the gloss", () => {
  const proposalA = makeProposal({
    model: "provider-a/model-a",
    meaningFr: "Une haine profonde.",
    meaningHtmlFr: "<p>Une haine profonde.</p>"
  });
  const proposalB = makeProposal({
    model: "provider-b/model-b",
    meaningFr: "Une violence hostile.",
    meaningHtmlFr: "<p>Une violence hostile.</p>"
  });
  const arbiterProposal = makeProposal({
    model: "provider-c/model-c",
    meaningFr: "Une colère destructrice.",
    meaningHtmlFr: "<p>Une colère destructrice.</p>"
  });
  const eligibility = evaluateFrenchAutoEligibility({
    proposalA,
    proposalB,
    arbiterProposal,
    validationA: validateFrenchProposal(proposalA, context),
    validationB: validateFrenchProposal(proposalB, context),
    arbiterValidation: validateFrenchProposal(arbiterProposal, context),
    models: {
      proposerA: "provider-a/model-a",
      proposerB: "provider-b/model-b",
      arbiter: "provider-c/model-c"
    },
    modelProofs: executionProofs({
      proposerA: "provider-a/model-a",
      proposerB: "provider-b/model-b",
      arbiter: "provider-c/model-c"
    }),
    arbiterVerdict: "accept",
    arbiterReasons: [],
    englishStatus: "validated"
  });

  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasons.includes("meaning-disagreement"));
});

test("binds auto validation to three distinct actual proposal models", () => {
  const proposalA = makeProposal({ model: "provider-a/same-model" });
  const proposalB = makeProposal({ model: "provider-a/same-model" });
  const arbiterProposal = makeProposal({ model: "provider-c/arbiter-model" });
  const clean = {
    issues: [],
    canPublishDisplay: true,
    requiresHumanReview: false
  };
  const eligibility = evaluateFrenchAutoEligibility({
    proposalA,
    proposalB,
    arbiterProposal,
    validationA: clean,
    validationB: clean,
    arbiterValidation: clean,
    models: {
      proposerA: "provider-a/declared-a",
      proposerB: "provider-b/declared-b",
      arbiter: "provider-c/arbiter-model"
    },
    modelProofs: executionProofs({
      proposerA: "provider-a/declared-a",
      proposerB: "provider-b/declared-b",
      arbiter: "provider-c/arbiter-model"
    }),
    arbiterVerdict: "accept",
    arbiterReasons: [],
    englishStatus: "validated"
  });

  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasons.includes("model-identity-mismatch"));
  assert.ok(eligibility.reasons.includes("model-identity-not-independent"));
});

test("requires verified gateway execution proofs for automatic validation", () => {
  const models = {
    proposerA: "provider-a/model-a",
    proposerB: "provider-b/model-b",
    arbiter: "provider-c/model-c"
  };
  const proposalA = makeProposal({ model: models.proposerA });
  const proposalB = makeProposal({ model: models.proposerB });
  const arbiterProposal = makeProposal({ model: models.arbiter });
  const clean = {
    issues: [],
    canPublishDisplay: true,
    requiresHumanReview: false
  };
  const proofs = executionProofs(models);
  proofs.proposerB = { ...proofs.proposerB, verified: false };
  const eligibility = evaluateFrenchAutoEligibility({
    proposalA,
    proposalB,
    arbiterProposal,
    validationA: clean,
    validationB: clean,
    arbiterValidation: clean,
    models,
    modelProofs: proofs,
    arbiterVerdict: "accept",
    arbiterReasons: [],
    englishStatus: "validated"
  });

  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasons.includes("model-execution-unverified"));
});

function requiredEntityMention(input: {
  mentionId: string;
  segmentId: string;
  sourceSurface: string;
  citedStrong?: string | null;
  targetEntryKey: string | null;
  targetEntityIds: number[];
  allowedFrenchForms: string[];
  resolution: RequiredFrenchEntityMention["resolution"];
}): RequiredFrenchEntityMention {
  return {
    mentionId: input.mentionId,
    sourceEntryKey: "greek:G2777",
    segmentId: input.segmentId,
    sourceSurface: input.sourceSurface,
    citedStrong: input.citedStrong ?? null,
    targetEntryKey: input.targetEntryKey,
    targetEntityIds: input.targetEntityIds,
    allowedFrenchForms: input.allowedFrenchForms,
    resolution: input.resolution,
    contentHash: "f".repeat(64)
  };
}

function makeProposal(
  overrides: Partial<FrenchLexiconProposal> = {}
): FrenchLexiconProposal {
  return {
    schemaVersion: FRENCH_PROPOSAL_SCHEMA_VERSION,
    entryKey: "greek:G2777",
    derivedFromEnglishHash: "english-hash",
    model: "model-a",
    glossFr: "rouleau",
    meaningSegmentsFr: [],
    entityMentionsFr: [],
    meaningFr: "Un rouleau de parchemin.",
    meaningHtmlFr: "<p>Un rouleau de parchemin.</p>",
    notesFr: "",
    carrierTermsFr: ["rouleau"],
    confidence: 0.97,
    ...overrides
  };
}

function executionProofs(models: {
  proposerA: string;
  proposerB: string;
  arbiter: string;
}) {
  return Object.fromEntries(
    Object.entries(models).map(([role, identity]) => {
      const separator = identity.indexOf("/");
      return [
        role,
        {
          actualModel: identity.slice(separator + 1),
          provider: identity.slice(0, separator),
          identity,
          verified: true
        }
      ];
    })
  ) as Record<
    "proposerA" | "proposerB" | "arbiter",
    {
      actualModel: string;
      provider: string;
      identity: string;
      verified: boolean;
    }
  >;
}
