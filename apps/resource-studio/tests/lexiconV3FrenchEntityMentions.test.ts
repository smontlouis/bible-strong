import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  canonicalFrenchEntityPolicyForms,
  FRENCH_CANONICAL_ENTITY_SCHEMA_VERSION,
  FRENCH_CANONICAL_ENTRY_NAME_POLICY_SCHEMA_VERSION,
  FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
  FRENCH_ENTITY_CLASSIFICATION_PROOF_SCHEMA_VERSION,
  hashFrenchEntityJson,
  type FrenchCanonicalEntityRecord,
  type FrenchCanonicalEntryNamePolicy,
  type FrenchEntityBindingRelation,
  type FrenchEntityNameConstraint,
  type FrenchEntityNameTreatment
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import {
  assertFrenchEntityMentionsArtifact,
  assertFrenchEntityMentionsPublishable,
  buildFrenchEntityMentions,
  type BuildFrenchEntityMentionsInput,
  type FrenchEntityMentionEnglishMeaning,
  type FrenchEntityMentionEnglishParentHashes,
  type FrenchEntityMentionStepEntry
} from "../src/lexiconV3/frenchEntityMentions.js";
import { normalizeFrenchEvidence } from "../src/lexiconV3/frenchEditorialPolicy.js";
import { normalizeStepStrongCode } from "../src/lexiconV3/identity.js";
import { stripLexiconHtml } from "../src/lexiconV3/frenchValidation.js";

const RELEASE_KEY = "lexicon-v3-en-entity-mention-fixture.1";
const RELEASE_SNAPSHOT = sha256("entity-mention-release-snapshot");

test("extracts Israël and Israélite independently and joins an adjacent exact code across HTML segments", () => {
  const source = makeSourceEntry(
    "G0001",
    1,
    "<p><b>Israelite</b> and Israel (<strong>H3478</strong>).</p>"
  );
  const israel = makeStepEntry("H3478", 2, "N:N--M");
  const israelite = makeStepEntry("H3481", 3, "N:N--M");
  const policies = [
    makePolicy(israel.entry, {
      treatment: "canonical-name",
      constraint: "canonical",
      entityIds: [1],
      englishForms: ["Israel"],
      allowedFrenchForms: ["Israël"],
      primaryFr: "Israël"
    }),
    makePolicy(israelite.entry, {
      treatment: "gentilic",
      constraint: "derived",
      entityIds: [1],
      englishForms: ["Israelite"],
      allowedFrenchForms: ["Israélite"],
      derivedFr: "Israélite"
    })
  ];
  const entities = [
    makeEntity(1, "Israël", [israel.entry.entryKey, israelite.entry.entryKey])
  ];
  const input = fixtureInput([source, israel, israelite], entities, policies);
  const artifact = buildFrenchEntityMentions(input);

  assert.equal(artifact.requiredEntityMentions.length, 2);
  const gentilic = bySurface(artifact, "Israelite");
  assert.equal(gentilic.citedStrong, null);
  assert.equal(gentilic.targetEntryKey, null);
  assert.deepEqual(gentilic.targetEntityIds, [1]);
  assert.deepEqual(gentilic.allowedFrenchForms, ["Israélite", "Israélites"]);
  assert.equal(gentilic.resolution, "contextual");

  const name = bySurface(artifact, "Israel");
  assert.equal(name.citedStrong, "H3478");
  assert.equal(name.targetEntryKey, "hebrew:H3478");
  assert.deepEqual(name.allowedFrenchForms, ["Israël"]);
  assert.equal(name.segmentId, "t1");
  assert.throws(() => assertFrenchEntityMentionsPublishable(artifact));
  assert.doesNotThrow(() =>
    assertFrenchEntityMentionsArtifact(artifact, input)
  );
});

test("accepts an exact five-digit STEP identity whose source morphology is empty", () => {
  const source = makeSourceEntry("G20001", 4, "<p>to be made desert</p>", "");
  const input = fixtureInput([source], [], []);
  assert.doesNotThrow(() => buildFrenchEntityMentions(input));

  const forged = structuredClone(input);
  (forged.stepEntries[0]!.identity as unknown as { morph: unknown }).morph =
    null;
  assert.throws(
    () => buildFrenchEntityMentions(forged),
    /invalid-step-identity/u
  );
});

test("keeps an exact autonomous STEP proper name without inventing an entity id", () => {
  const source = makeSourceEntry("G0003", 5, "<p>Cimath (G21458).</p>");
  const cimath = makeStepEntry("G21458", 6, "");
  const policy = makePolicy(cimath.entry, {
    treatment: "unregistered-proper-name",
    constraint: "proper-name-without-entity",
    entityIds: [],
    englishForms: ["Cimath"],
    allowedFrenchForms: ["Cimath"],
    derivedFr: "Cimath"
  });
  const artifact = buildFrenchEntityMentions(
    fixtureInput([source, cimath], [], [policy])
  );
  const mention = artifact.requiredEntityMentions.find(
    (candidate) => candidate.citedStrong === "G21458"
  );
  assert.ok(mention);
  assert.equal(mention.resolution, "exact");
  assert.equal(mention.targetEntryKey, "greek:G21458");
  assert.deepEqual(mention.targetEntityIds, []);
  assert.deepEqual(mention.allowedFrenchForms, ["Cimath"]);
  assert.doesNotThrow(() => assertFrenchEntityMentionsPublishable(artifact));
});

test("reviews one uncoded translation even when several entries impose the same entity constraint", () => {
  const source = makeSourceEntry("G0004", 7, "<p>Athenian.</p>");
  const first = makeStepEntry("G21459", 8, "N:N-M-P");
  const second = makeStepEntry("G21460", 9, "N:N-M-P");
  const policies = [
    makePolicy(first.entry, alternate(30, "Athenian", "Athénien")),
    makePolicy(second.entry, alternate(30, "Athenian", "Athénien"))
  ];
  const artifact = buildFrenchEntityMentions(
    fixtureInput(
      [source, first, second],
      [
        makeEntity(30, "Athénien", [
          first.entry.entryKey,
          second.entry.entryKey
        ])
      ],
      policies
    )
  );
  const mention = bySurface(artifact, "Athenian");
  assert.equal(mention.resolution, "contextual");
  assert.equal(mention.citedStrong, null);
  assert.equal(mention.targetEntryKey, null);
  assert.deepEqual(mention.targetEntityIds, [30]);
  assert.deepEqual(mention.allowedFrenchForms, ["Athénien"]);
});

test("reviews one uncoded proper-name translation across unregistered STEP siblings", () => {
  const source = makeSourceEntry("G0006", 10, "<p>Anah.</p>");
  const first = makeStepEntry("H6034G", 11, "N:N-F-P");
  const second = makeStepEntry("H6034H", 12, "N:N-M-P");
  const unregistered = (entry: FrenchEntityMentionStepEntry) =>
    makePolicy(entry, {
      treatment: "unregistered-proper-name",
      constraint: "proper-name-without-entity",
      entityIds: [],
      englishForms: ["Anah"],
      allowedFrenchForms: ["Ana"],
      derivedFr: "Ana"
    });
  const artifact = buildFrenchEntityMentions(
    fixtureInput(
      [source, first, second],
      [],
      [unregistered(first.entry), unregistered(second.entry)]
    )
  );
  const mention = bySurface(artifact, "Anah");
  assert.equal(mention.resolution, "contextual");
  assert.equal(mention.citedStrong, null);
  assert.equal(mention.targetEntryKey, null);
  assert.deepEqual(mention.targetEntityIds, []);
  assert.deepEqual(mention.allowedFrenchForms, ["Ana"]);
});

test("keeps Jérusalem, Sion, Jébus, Jésus, Christ and Emmanuel as reviewed entry-level forms", () => {
  const source = makeSourceEntry(
    "G0002",
    10,
    "<p><b>Jerusalem</b><br><i>Zion</i> and Jebus; Jesus, Christ and Emmanuel.</p>"
  );
  const targets = [
    makeStepEntry("H3389", 11, "N:N--L"),
    makeStepEntry("H6726", 12, "N:N--L"),
    makeStepEntry("H2982", 13, "N:N--L"),
    makeStepEntry("G2424", 14, "N:N-M-P"),
    makeStepEntry("G5547", 15, "N:N-M-T"),
    makeStepEntry("G1694", 16, "N:N-M-P")
  ];
  const [jerusalem, zion, jebus, jesus, christ, emmanuel] = targets.map(
    (target) => target.entry
  );
  const policies = [
    makePolicy(jerusalem!, canonical(20, "Jerusalem", "Jérusalem")),
    makePolicy(zion!, alternate(20, "Zion", "Sion")),
    makePolicy(jebus!, alternate(20, "Jebus", "Jébus")),
    makePolicy(jesus!, canonical(21, "Jesus", "Jésus")),
    makePolicy(christ!, {
      ...alternate(21, "Christ", "Christ"),
      treatment: "title-or-epithet"
    }),
    makePolicy(emmanuel!, alternate(21, "Emmanuel", "Emmanuel"))
  ];
  const entities = [
    makeEntity(20, "Jérusalem", [
      jerusalem!.entryKey,
      zion!.entryKey,
      jebus!.entryKey
    ]),
    makeEntity(21, "Jésus", [
      jesus!.entryKey,
      christ!.entryKey,
      emmanuel!.entryKey
    ])
  ];
  const artifact = buildFrenchEntityMentions(
    fixtureInput([source, ...targets], entities, policies)
  );

  assert.deepEqual(
    Object.fromEntries(
      artifact.requiredEntityMentions.map((mention) => [
        mention.sourceSurface,
        mention.allowedFrenchForms
      ])
    ),
    {
      Jerusalem: ["Jérusalem"],
      Zion: ["Sion"],
      Jebus: ["Jébus"],
      Jesus: ["Jésus"],
      Christ: ["Christ"],
      Emmanuel: ["Emmanuel"]
    }
  );
  assert.ok(
    artifact.requiredEntityMentions.every(
      (mention) => mention.resolution === "contextual"
    )
  );
  assert.equal(artifact.blockingMentionIds.length, 6);
});

test("uses longest reviewed uncoded form and never emits its overlapping shorter alias", () => {
  const source = makeSourceEntry("G0003", 20, "<p>Jesus Christ arrived.</p>");
  const jesus = makeStepEntry("G2424", 21, "N:N-M-P");
  const compound = makeStepEntry("G9991A", 22, "N:N-M-P");
  const policies = [
    makePolicy(jesus.entry, canonical(30, "Jesus", "Jésus")),
    makePolicy(compound.entry, {
      treatment: "compound-name",
      constraint: "derived",
      entityIds: [30],
      englishForms: ["Jesus Christ"],
      allowedFrenchForms: ["Jésus-Christ"],
      derivedFr: "Jésus-Christ"
    })
  ];
  const entity = makeEntity(30, "Jésus", [
    jesus.entry.entryKey,
    compound.entry.entryKey
  ]);
  const artifact = buildFrenchEntityMentions(
    fixtureInput([source, jesus, compound], [entity], policies)
  );

  assert.equal(artifact.requiredEntityMentions.length, 1);
  assert.equal(
    artifact.requiredEntityMentions[0]?.sourceSurface,
    "Jesus Christ"
  );
  assert.deepEqual(artifact.requiredEntityMentions[0]?.allowedFrenchForms, [
    "Jésus-Christ"
  ]);
});

test("keeps apostrophe, dash, whitespace and Unicode-fold aliases while respecting Unicode word boundaries", () => {
  const source = makeSourceEntry(
    "G0005",
    23,
    "<p>O’Brien; Bar–Jesus; KISH; ſuſa; Jesus   Christ; αIsrael; Israelβ.</p>"
  );
  const definitions = [
    ["G9980", "O'Brien", "O’Brien"],
    ["G9981", "Bar-Jesus", "Bar-Jésus"],
    ["G9982", "Kish", "Kish"],
    ["G9983", "Susa", "Suse"],
    ["G9984", "Jesus Christ", "Jésus-Christ"],
    ["G9985", "Israel", "Israël"]
  ] as const;
  const targets = definitions.map(([code], index) =>
    makeStepEntry(code, 24 + index, "N:N-M-P")
  );
  const policies = targets.map((target, index) =>
    makePolicy(
      target.entry,
      alternate(100 + index, definitions[index]![1], definitions[index]![2])
    )
  );
  const entities = targets.map((target, index) =>
    makeEntity(100 + index, definitions[index]![2], [target.entry.entryKey])
  );
  const artifact = buildFrenchEntityMentions(
    fixtureInput([source, ...targets], entities, policies)
  );

  assert.deepEqual(
    artifact.requiredEntityMentions.map((mention) => mention.sourceSurface),
    ["O’Brien", "Bar–Jesus", "KISH", "ſuſa", "Jesus   Christ"]
  );
  assert.equal(
    artifact.requiredEntityMentions.some(
      (mention) => mention.allowedFrenchForms[0] === "Israël"
    ),
    false
  );
});

test("preserves suffix and case in H3068H/I and H2148V/v, and ignores an unknown sibling without base/eStrong fallback", () => {
  const source = makeSourceEntry(
    "G0004",
    30,
    "<p>H3068H/I; H3068J; H2148V; H2148v.</p>"
  );
  const base = makeStepEntry("H3068", 31, "N:N--T");
  const suffixH = makeStepEntry("H3068H", 32, "N:N--T", "H3068");
  const suffixI = makeStepEntry("H3068I", 33, "N:N--T", "H3068");
  const upper = makeStepEntry("H2148V", 34, "N:N-M-P", "H2148");
  const lower = makeStepEntry("H2148v", 35, "N:N-M-P", "H2148");
  const policies = [
    makePolicy(base.entry, canonical(40, "YHWH", "YHWH")),
    makePolicy(suffixH.entry, alternate(41, "Jerusalem H", "Jérusalem")),
    makePolicy(suffixI.entry, alternate(41, "Jerusalem I", "Jérusalem")),
    makePolicy(upper.entry, canonical(42, "Ziphite V", "Ziphite V")),
    makePolicy(lower.entry, canonical(43, "Ziphite v", "Ziphite v"))
  ];
  const entities = [
    makeEntity(40, "YHWH", [base.entry.entryKey]),
    makeEntity(41, "Jérusalem", [
      suffixH.entry.entryKey,
      suffixI.entry.entryKey
    ]),
    makeEntity(42, "Ziphite V", [upper.entry.entryKey]),
    makeEntity(43, "Ziphite v", [lower.entry.entryKey])
  ];
  const artifact = buildFrenchEntityMentions(
    fixtureInput(
      [source, base, suffixH, suffixI, upper, lower],
      entities,
      policies
    )
  );
  const byCode = new Map(
    artifact.requiredEntityMentions.map((mention) => [
      mention.citedStrong,
      mention
    ])
  );

  assert.equal(byCode.get("H3068H")?.targetEntryKey, "hebrew:H3068H");
  assert.equal(byCode.get("H3068I")?.targetEntryKey, "hebrew:H3068I");
  assert.equal(byCode.get("H2148V")?.targetEntryKey, "hebrew:H2148V");
  assert.equal(byCode.get("H2148v")?.targetEntryKey, "hebrew:H2148v");
  assert.equal(byCode.has("H3068"), false);
  assert.equal(byCode.has("H3068J"), false);
  assert.equal(artifact.blockingMentionIds.length, 0);
  assert.doesNotThrow(() => assertFrenchEntityMentionsPublishable(artifact));
});

test("reviews an uncited translation even when distinct entities authorize the same French form", () => {
  const source = makeSourceEntry("G0008", 54, "<p>Alex.</p>");
  const first = makeStepEntry("G9994", 55, "N:N-M-P");
  const second = makeStepEntry("G9995", 56, "N:N-M-P");
  const policies = [
    makePolicy(first.entry, canonical(62, "Alex", "Alex")),
    makePolicy(second.entry, canonical(63, "Alex", "Alex"))
  ];
  const artifact = buildFrenchEntityMentions(
    fixtureInput(
      [source, first, second],
      [
        makeEntity(62, "Alex", [first.entry.entryKey]),
        makeEntity(63, "Alex", [second.entry.entryKey])
      ],
      policies
    )
  );
  const mention = bySurface(artifact, "Alex");

  assert.equal(mention.resolution, "contextual");
  assert.equal(mention.targetEntryKey, null);
  assert.deepEqual(mention.targetEntityIds, [62, 63]);
  assert.deepEqual(mention.allowedFrenchForms, ["Alex"]);
  assert.throws(() => assertFrenchEntityMentionsPublishable(artifact));
});

test("keeps a bare STEP code protected without forcing its entity name into French", () => {
  const source = makeSourceEntry("G0005", 40, "<p>See G1234.</p>");
  const compound = makeStepEntry("G1234", 41, "N:N-M-P");
  const policy = makePolicy(compound.entry, {
    treatment: "compound-name",
    constraint: "derived",
    entityIds: [50, 51],
    englishForms: ["Jesus of Jerusalem"],
    allowedFrenchForms: ["Jésus de Jérusalem"],
    derivedFr: "Jésus de Jérusalem"
  });
  const entities = [
    makeEntity(50, "Jésus", [compound.entry.entryKey]),
    makeEntity(51, "Jérusalem", [compound.entry.entryKey])
  ];
  const artifact = buildFrenchEntityMentions(
    fixtureInput([source, compound], entities, [policy])
  );
  const mention = artifact.requiredEntityMentions[0]!;

  assert.equal(mention.citedStrong, "G1234");
  assert.equal(mention.targetEntryKey, "greek:G1234");
  assert.deepEqual(mention.targetEntityIds, []);
  assert.deepEqual(mention.allowedFrenchForms, []);
  assert.equal(mention.resolution, "non-entity");
});

test("blocks one uncoded English surface that resolves to two different entity ids", () => {
  const source = makeSourceEntry("G0006", 50, "<p>Jordan is cited.</p>");
  const river = makeStepEntry("H3383", 51, "N:N--L");
  const person = makeStepEntry("G9992", 52, "N:N-M-P");
  const policies = [
    makePolicy(river.entry, canonical(60, "Jordan", "Jourdain")),
    makePolicy(person.entry, canonical(61, "Jordan", "Jordan"))
  ];
  const artifact = buildFrenchEntityMentions(
    fixtureInput(
      [source, river, person],
      [
        makeEntity(60, "Jourdain", [river.entry.entryKey]),
        makeEntity(61, "Jordan", [person.entry.entryKey])
      ],
      policies
    )
  );
  const mention = artifact.requiredEntityMentions[0]!;

  assert.equal(mention.sourceSurface, "Jordan");
  assert.equal(mention.citedStrong, null);
  assert.equal(mention.targetEntryKey, null);
  assert.deepEqual(mention.targetEntityIds, [60, 61]);
  assert.deepEqual(mention.allowedFrenchForms, ["Jordan", "Jourdain"]);
  assert.equal(mention.resolution, "contextual");
  assert.deepEqual(artifact.blockingMentionIds, [mention.mentionId]);
  assert.throws(() => assertFrenchEntityMentionsPublishable(artifact));
});

test("uses an adjacent exact STEP citation to close a contextual homonym", () => {
  const source = makeSourceEntry(
    "G0007",
    57,
    "<p>Jordan (H3383) is cited.</p>"
  );
  const river = makeStepEntry("H3383", 58, "N:N--L");
  const person = makeStepEntry("G9996", 59, "N:N-M-P");
  const policies = [
    makePolicy(river.entry, canonical(64, "Jordan", "Jourdain")),
    makePolicy(person.entry, canonical(65, "Jordan", "Jordan"))
  ];
  const artifact = buildFrenchEntityMentions(
    fixtureInput(
      [source, river, person],
      [
        makeEntity(64, "Jourdain", [river.entry.entryKey]),
        makeEntity(65, "Jordan", [person.entry.entryKey])
      ],
      policies
    )
  );
  const mention = bySurface(artifact, "Jordan");

  assert.equal(mention.resolution, "exact");
  assert.equal(mention.citedStrong, "H3383");
  assert.equal(mention.targetEntryKey, river.entry.entryKey);
  assert.deepEqual(mention.targetEntityIds, [64]);
  assert.deepEqual(mention.allowedFrenchForms, ["Jourdain"]);
  assert.doesNotThrow(() => assertFrenchEntityMentionsPublishable(artifact));
});

test("routes every uncited alias through context review while preserving an exact adjacent citation", () => {
  const source = makeSourceEntry(
    "G0009",
    60,
    "<p>Mark (G3138) can mark a boundary; MARK alone remains contextual.</p>"
  );
  const mark = makeStepEntry("G3138", 61, "N:N-M-P");
  const policy = makePolicy(mark.entry, canonical(70, "Mark", "Marc"));
  const artifact = buildFrenchEntityMentions(
    fixtureInput(
      [source, mark],
      [makeEntity(70, "Marc", [mark.entry.entryKey])],
      [policy]
    )
  );
  const cited = artifact.requiredEntityMentions.find(
    (mention) => mention.citedStrong === "G3138"
  );
  const uncited = artifact.requiredEntityMentions.filter(
    (mention) => mention.citedStrong === null
  );

  assert.ok(cited);
  assert.equal(cited.resolution, "exact");
  assert.equal(cited.targetEntryKey, "greek:G3138");
  assert.deepEqual(
    uncited.map((mention) => ({
      surface: mention.sourceSurface,
      resolution: mention.resolution,
      targetEntryKey: mention.targetEntryKey,
      forms: mention.allowedFrenchForms
    })),
    [
      {
        surface: "mark",
        resolution: "contextual",
        targetEntryKey: null,
        forms: ["Marc"]
      },
      {
        surface: "MARK",
        resolution: "contextual",
        targetEntryKey: null,
        forms: ["Marc"]
      }
    ]
  );
  assert.equal(artifact.blockingMentionIds.length, 2);
  assert.throws(() => assertFrenchEntityMentionsPublishable(artifact));
});

test("classifies the reviewed G9048 common gloss as non-entity and never matches 'a plain' as a name", () => {
  const own = makeSourceEntry("G9048", 60, "<p>a plain</p>", "N:N");
  const citing = makeSourceEntry(
    "G0007",
    61,
    "<p>A plain remains lexical; see G9048.</p>"
  );
  const policy = makePolicy(own.entry, {
    treatment: "etymological-or-common-gloss",
    constraint: "lexical-translation",
    entityIds: [],
    englishForms: [],
    allowedFrenchForms: ["plaine"],
    derivedFr: "plaine"
  });
  const artifact = buildFrenchEntityMentions(
    fixtureInput([own, citing], [], [policy])
  );

  assert.equal(artifact.requiredEntityMentions.length, 1);
  const mention = artifact.requiredEntityMentions[0]!;
  assert.equal(mention.sourceEntryKey, "greek:G0007");
  assert.equal(mention.sourceSurface, "G9048");
  assert.equal(mention.citedStrong, "G9048");
  assert.equal(mention.targetEntryKey, "greek:G9048");
  assert.deepEqual(mention.targetEntityIds, []);
  assert.deepEqual(mention.allowedFrenchForms, []);
  assert.equal(mention.resolution, "non-entity");
  assert.doesNotThrow(() => assertFrenchEntityMentionsPublishable(artifact));
});

test("keeps an explicit code for a quarantined STEP entry as protected non-entity content", () => {
  const source = makeSourceEntry("G0009", 62, "<p>See G9993.</p>");
  const quarantined = makeStepEntry("G9993", 63, "N:N-M-P");
  const input = fixtureInput([source, quarantined], [], []);
  input.quarantinedEntryKeys = [quarantined.entry.entryKey];
  const artifact = buildFrenchEntityMentions(input);
  const mention = artifact.requiredEntityMentions[0]!;

  assert.equal(mention.citedStrong, "G9993");
  assert.equal(mention.targetEntryKey, quarantined.entry.entryKey);
  assert.deepEqual(mention.targetEntityIds, []);
  assert.deepEqual(mention.allowedFrenchForms, []);
  assert.equal(mention.resolution, "non-entity");
  assert.deepEqual(artifact.blockingMentionIds, []);
  assert.doesNotThrow(() => assertFrenchEntityMentionsPublishable(artifact));
  assert.doesNotThrow(() =>
    assertFrenchEntityMentionsArtifact(artifact, input)
  );
});

test("rejects blocked, unknown and treatment-incoherent rehashed policies before mention extraction", () => {
  const source = makeSourceEntry("G0007", 60, "<p>Aharon.</p>");
  const aharon = makeStepEntry("H1001", 61, "N:N-M-P");
  const policy = makePolicy(aharon.entry, alternate(60, "Aharon", "Aharon"));
  const entity = makeEntity(60, "Aaron", [aharon.entry.entryKey]);
  const pristine = fixtureInput([source, aharon], [entity], [policy]);

  const assertForgedRejected = (
    mutate: (policyRecord: Record<string, unknown>) => void,
    pattern: RegExp
  ): void => {
    const forged = structuredClone(pristine);
    const forgedPolicy = forged.canonicalPolicies[0];
    assert.ok(forgedPolicy);
    mutate(forgedPolicy as unknown as Record<string, unknown>);
    resealPolicy(forgedPolicy);
    assert.throws(() => buildFrenchEntityMentions(forged), pattern);
  };

  assertForgedRejected((policyRecord) => {
    policyRecord.constraint = "blocked";
  }, /unresolved-policy/u);
  assertForgedRejected((policyRecord) => {
    policyRecord.treatment = "invented-runtime-treatment";
  }, /invalid-policy-treatment/u);
  assertForgedRejected((policyRecord) => {
    policyRecord.constraint = "invented-runtime-constraint";
  }, /invalid-policy-constraint/u);
  assertForgedRejected((policyRecord) => {
    const bindings = policyRecord.entityBindings as Array<
      Record<string, unknown>
    >;
    assert.ok(bindings[0]);
    bindings[0].relation = "primary";
  }, /invalid-policy-relation/u);
  assertForgedRejected((policyRecord) => {
    const bindings = policyRecord.entityBindings as Array<
      Record<string, unknown>
    >;
    assert.ok(bindings[0]);
    bindings[0].relation = "invented-runtime-relation";
  }, /invalid-policy-bindings/u);
});

test("fails closed on policy hash drift, STEP lineage drift, dStrong drift and English meaning drift", () => {
  const source = makeSourceEntry("G0008", 70, "<p>Israel.</p>");
  const israel = makeStepEntry("H3478", 71, "N:N--M");
  const policy = makePolicy(israel.entry, canonical(70, "Israel", "Israël"));
  const entity = makeEntity(70, "Israël", [israel.entry.entryKey]);
  const pristine = fixtureInput([source, israel], [entity], [policy]);
  assert.doesNotThrow(() => buildFrenchEntityMentions(pristine));

  const policyDrift = structuredClone(pristine);
  policyDrift.canonicalPolicies[0]!.englishForms = ["Israel", "Israeli"];
  assert.throws(
    () => buildFrenchEntityMentions(policyDrift),
    /policy-hash-mismatch/u
  );

  const competingSpelling = structuredClone(pristine);
  const contaminatedPolicy = competingSpelling.canonicalPolicies[0]!;
  contaminatedPolicy.allowedFrenchForms = ["Israel", "Israël"].sort();
  const { contentHash: _contentHash, ...policyContent } = contaminatedPolicy;
  void _contentHash;
  contaminatedPolicy.contentHash = hashFrenchEntityJson(policyContent);
  assert.throws(
    () => buildFrenchEntityMentions(competingSpelling),
    /noncanonical-french-forms/u
  );

  const stepIdDrift = structuredClone(pristine);
  stepIdDrift.stepEntries[1]!.identity.stepEntryId = 999;
  assert.throws(
    () => buildFrenchEntityMentions(stepIdDrift),
    /invalid-step-identity/u
  );

  const dStrongDrift = structuredClone(pristine);
  dStrongDrift.stepEntries[1]!.identity.dStrong = "H3478A = sibling";
  assert.throws(
    () => buildFrenchEntityMentions(dStrongDrift),
    /invalid-step-identity/u
  );

  const meaningDrift = structuredClone(pristine);
  meaningDrift.englishMeanings[0]!.meaningHtml = "<p>Judah.</p>";
  assert.throws(
    () => buildFrenchEntityMentions(meaningDrift),
    /meaning-lineage-mismatch/u
  );
});

interface StepFixture {
  entry: FrenchEntityMentionStepEntry;
  meaning?: FrenchEntityMentionEnglishMeaning;
}

function makeSourceEntry(
  primaryCode: string,
  stepEntryId: number,
  meaningHtml: string,
  morph = "G:N"
): StepFixture {
  const meaning = stripLexiconHtml(meaningHtml);
  const fixture = makeStepEntry(
    primaryCode,
    stepEntryId,
    morph,
    undefined,
    meaning,
    meaningHtml
  );
  return {
    ...fixture,
    meaning: {
      sourceEntryKey: fixture.entry.entryKey,
      meaning,
      meaningHtml,
      meaningParentContentHash:
        fixture.entry.englishParentHashes.meaning.contentHash,
      meaningValueTextHash:
        fixture.entry.englishParentHashes.meaning.valueTextHash,
      meaningValueHtmlHash:
        fixture.entry.englishParentHashes.meaning.valueHtmlHash
    }
  };
}

function makeStepEntry(
  code: string,
  stepEntryId: number,
  morph: string,
  eStrong?: string,
  meaning = `Meaning for ${code}.`,
  meaningHtml = meaning
): StepFixture {
  const primaryDStrong = normalizeStepStrongCode(code);
  if (!primaryDStrong) throw new Error(`invalid-test-code:${code}`);
  const language = primaryDStrong.startsWith("G") ? "greek" : "hebrew";
  const baseMatch = /^([GH]\d+)/u.exec(primaryDStrong)?.[1];
  const exactEStrong =
    eStrong ?? (baseMatch ? normalizeStepStrongCode(baseMatch) : null);
  if (!exactEStrong) throw new Error(`invalid-test-estrong:${code}`);
  const entryKey = `${language}:${primaryDStrong}`;
  const englishParentHashes = makeEnglishParents(
    entryKey,
    stepEntryId,
    `gloss-${primaryDStrong}`,
    meaning,
    meaningHtml
  );
  return {
    entry: {
      entryKey,
      stepEntryId,
      identity: {
        stepEntryId,
        language,
        primaryDStrong,
        eStrong: exactEStrong,
        dStrong: `${primaryDStrong} =`,
        uStrong: primaryDStrong,
        original: language === "greek" ? "ὄνομα" : "שֵׁם",
        transliteration: "onoma",
        morph
      },
      englishParentHashes
    }
  };
}

function makeEnglishParents(
  entryKey: string,
  stepEntryId: number,
  gloss: string,
  meaning: string,
  meaningHtml: string
): FrenchEntityMentionEnglishParentHashes {
  const withoutHash = {
    releaseKey: RELEASE_KEY,
    releaseSnapshotFingerprint: RELEASE_SNAPSHOT,
    gloss: {
      fieldVersionId: stepEntryId * 2 - 1,
      contentHash: sha256(`gloss-content:${entryKey}:${gloss}`),
      valueTextHash: sha256(gloss),
      valueHtmlHash: null
    },
    meaning: {
      fieldVersionId: stepEntryId * 2,
      contentHash: sha256(
        `meaning-content:${entryKey}:${meaning}:${meaningHtml}`
      ),
      valueTextHash: sha256(meaning),
      valueHtmlHash: sha256(meaningHtml)
    }
  };
  return {
    ...withoutHash,
    lineageHash: hashFrenchEntityJson(withoutHash)
  };
}

interface PolicyOptions {
  treatment: Exclude<FrenchEntityNameTreatment, "unresolved">;
  constraint: FrenchEntityNameConstraint;
  entityIds: number[];
  englishForms: string[];
  allowedFrenchForms: string[];
  primaryFr?: string;
  derivedFr?: string;
}

function canonical(
  entityId: number,
  english: string,
  french: string
): PolicyOptions {
  return {
    treatment: "canonical-name",
    constraint: "canonical",
    entityIds: [entityId],
    englishForms: [english],
    allowedFrenchForms: [french],
    primaryFr: french
  };
}

function alternate(
  entityId: number,
  english: string,
  french: string
): PolicyOptions {
  return {
    treatment: "alternate-name",
    constraint: "derived",
    entityIds: [entityId],
    englishForms: [english],
    allowedFrenchForms: [french],
    derivedFr: french
  };
}

function makePolicy(
  entry: FrenchEntityMentionStepEntry,
  options: PolicyOptions
): FrenchCanonicalEntryNamePolicy {
  const relation = relationForTreatment(options.treatment);
  const proofWithoutHash = {
    schemaVersion: FRENCH_ENTITY_CLASSIFICATION_PROOF_SCHEMA_VERSION,
    sourceCandidateHash: sha256(`candidate:${entry.entryKey}`),
    sourceReviewUnitHash: null,
    decisionMethod: "deterministic-green-anchor" as const,
    agentArtifacts: null,
    evidenceHashes: [sha256(`evidence:${entry.entryKey}`)],
    reasons: ["test-fixture"]
  };
  const classificationProof = {
    ...proofWithoutHash,
    proofHash: hashFrenchEntityJson(proofWithoutHash)
  };
  const withoutHash = {
    schemaVersion: FRENCH_CANONICAL_ENTRY_NAME_POLICY_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
    entryKey: entry.entryKey,
    stepEntryId: entry.stepEntryId,
    identity: entry.identity,
    englishParentHashes: entry.englishParentHashes,
    treatment: options.treatment,
    entityBindings: [...options.entityIds]
      .sort((left, right) => left - right)
      .map((entityId) => ({ entityId, relation })),
    constraint: options.constraint,
    primaryFr: options.primaryFr ?? null,
    derivedFr: options.derivedFr ?? null,
    englishForms: uniqueSorted(options.englishForms),
    allowedFrenchForms: canonicalFrenchEntityPolicyForms(
      options.treatment,
      options.primaryFr ?? options.derivedFr ?? ""
    ),
    classificationProof
  };
  return {
    ...withoutHash,
    contentHash: hashFrenchEntityJson(withoutHash)
  };
}

function relationForTreatment(
  treatment: FrenchEntityNameTreatment
): FrenchEntityBindingRelation {
  switch (treatment) {
    case "canonical-name":
      return "primary";
    case "alternate-name":
    case "unregistered-proper-name":
      return "alias";
    case "gentilic":
      return "gentilic";
    case "title-or-epithet":
      return "title";
    case "compound-name":
      return "compound";
    case "etymological-or-common-gloss":
    case "unresolved":
      return "etymological";
  }
}

function makeEntity(
  entityId: number,
  primaryFr: string,
  memberEntryKeys: string[]
): FrenchCanonicalEntityRecord {
  const withoutHash = {
    schemaVersion: FRENCH_CANONICAL_ENTITY_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
    entityId,
    primaryFr,
    normalizedPrimaryFr: normalizeFrenchEvidence(primaryFr),
    category: "fixture",
    type: "fixture",
    memberEntryKeys: uniqueSorted(memberEntryKeys),
    sourceEntityHash: sha256(`source-entity:${entityId}`),
    groupProofHash: sha256(`group-proof:${entityId}`)
  };
  return {
    ...withoutHash,
    contentHash: hashFrenchEntityJson(withoutHash)
  };
}

function fixtureInput(
  entries: StepFixture[],
  canonicalEntities: FrenchCanonicalEntityRecord[],
  canonicalPolicies: FrenchCanonicalEntryNamePolicy[]
): BuildFrenchEntityMentionsInput {
  return {
    stepEntries: entries.map((fixture) => fixture.entry),
    canonicalEntities,
    canonicalPolicies,
    englishMeanings: entries.flatMap((fixture) =>
      fixture.meaning ? [fixture.meaning] : []
    )
  };
}

function resealPolicy(policy: { contentHash: string }): void {
  const record = policy as Record<string, unknown> & { contentHash: string };
  const { contentHash: _contentHash, ...content } = record;
  void _contentHash;
  policy.contentHash = hashFrenchEntityJson(content);
}

function bySurface(
  artifact: ReturnType<typeof buildFrenchEntityMentions>,
  surface: string
) {
  const mention = artifact.requiredEntityMentions.find(
    (item) => item.sourceSurface === surface
  );
  assert.ok(mention, `missing mention ${surface}`);
  return mention;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
