import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSpanIndex,
  namesOnePerson,
  oneArticlePerSubject,
  parseScripture,
  pickEventSubject,
  resolveEntityLinks,
  resolveEventParticipants,
  resolveThemeLinks,
  subjectNames
} from "./study-links.mjs";

const context = ({ aliases, refs, strong, spans = [] }) => ({
  entitiesByAlias: new Map(
    Object.entries(aliases).map(([key, ids]) => [key, new Set(ids)])
  ),
  refsByEntity: new Map(
    Object.entries(refs).map(([id, verses]) => [Number(id), new Set(verses)])
  ),
  strongByEntity: new Map(
    Object.entries(strong).map(([id, code]) => [Number(id), code])
  ),
  spanIndex: buildSpanIndex(spans)
});

describe("subject names", () => {
  it("reads the headings of the sources", () => {
    assert.ok(subjectNames("Jesus, the Christ").includes("jesus"));
    assert.ok(subjectNames("God Continued...").includes("god"));
    assert.ok(subjectNames("Pilate, Pontius").includes("pilate"));
    assert.ok(subjectNames("Aminadab (or Amminidab)").includes("amminidab"));
    assert.ok(subjectNames("Artaxerxes I").includes("artaxerxes"));
    assert.ok(subjectNames("Amos the Prophet").includes("amos"));
  });

  it("keeps the subject a qualifier changes", () => {
    assert.ok(!subjectNames("Corinthians, First Epistle to the").includes("corinthians"));
    assert.ok(!subjectNames("Israel, Kingdom of").includes("israel"));
    assert.ok(!subjectNames("Daniel (livre de)").includes("daniel"));
    assert.ok(!subjectNames("Gad (vallée)").includes("gad"));
    assert.ok(!subjectNames("David, City of").includes("david"));
    assert.ok(!subjectNames("Moses, Song of").includes("moses"));
    assert.ok(!subjectNames("Jean (Évangile de)").includes("jean"));
    assert.ok(!subjectNames("Pierre (2e épître de)").includes("pierre"));
  });

  it("keeps the subject of a harmless qualifier", () => {
    assert.ok(subjectNames("Gad, the Tribe of").includes("gad"));
    assert.ok(subjectNames("Abner (lampe de mon père)").includes("abner"));
    assert.ok(subjectNames("Dan (1); Dan, Tribe of").includes("dan"));
  });

  it("recognizes a title that names one person", () => {
    assert.equal(namesOnePerson("John, the Apostle"), true);
    assert.equal(namesOnePerson("John (the Baptist)"), true);
    assert.equal(namesOnePerson("Joseph (accroissement)"), false);
    assert.equal(namesOnePerson("Joseph"), false);
  });
});

describe("scriptures", () => {
  it("expands a range and reads the malformed three-part references", () => {
    assert.deepEqual(parseScripture("10|14:25-27"), [
      "10-14-25",
      "10-14-26",
      "10-14-27"
    ]);
    assert.deepEqual(parseScripture("1|43|2:1"), ["43-2-1"]);
    assert.deepEqual(parseScripture("not a reference"), []);
  });
});

describe("entity links", () => {
  it("separates homonyms by the verses of the subject", () => {
    const result = resolveEntityLinks({
      names: ["jacob"],
      verses: new Set(["1-25-26", "1-27-15", "1-28-1", "1-28-2"]),
      context: context({
        aliases: { jacob: [1, 2] },
        refs: { 1: ["1-25-26", "1-27-15", "1-28-1", "1-28-2"], 2: ["40-1-15"] },
        strong: { 1: "H3478", 2: "G2384" },
        spans: [
          { verseKey: "1-25-26", surface: "Jacob", ids: "strong:H3290 ustrong:H3478" }
        ]
      })
    });
    assert.equal(result.status, "single");
    assert.equal(result.links[0].entityId, 1);
    assert.equal(result.links[0].tier, "confirmed");
  });

  it("refuses a false friend the Strong tagging disproves", () => {
    const result = resolveEntityLinks({
      names: ["sin"],
      verses: new Set(["2-16-1", "19-51-3", "45-6-23"]),
      context: context({
        aliases: { sin: [1] },
        refs: { 1: ["2-16-1"] },
        strong: { 1: "H5512" },
        spans: [
          { verseKey: "19-51-3", surface: "sin", ids: "strong:H2403" },
          { verseKey: "19-51-3", surface: "sin", ids: "strong:H2403" },
          { verseKey: "45-6-23", surface: "sin", ids: "strong:G266" },
          { verseKey: "45-6-23", surface: "sin", ids: "strong:G266" },
          { verseKey: "45-6-23", surface: "sin", ids: "strong:G266" },
          { verseKey: "45-6-23", surface: "sin", ids: "strong:G266" }
        ]
      })
    });
    assert.equal(result.status, "false-friend");
    assert.equal(result.links.length, 0);
  });

  it("keeps a subject when a single word disagrees with the entity's Strong", () => {
    const result = resolveEntityLinks({
      names: ["smyrna"],
      verses: new Set(["66-1-11"]),
      context: context({
        aliases: { smyrna: [1] },
        refs: { 1: ["66-1-11"] },
        strong: { 1: "G4667" },
        spans: [{ verseKey: "66-1-11", surface: "Smyrna", ids: "strong:G4668" }]
      })
    });
    assert.equal(result.status, "single");
    assert.equal(result.links[0].tier, "probable");
  });

  it("does not count the words of a homonym against an entity", () => {
    const result = resolveEntityLinks({
      names: ["joseph"],
      verses: new Set(["1-30-24", "40-27-57"]),
      context: context({
        aliases: { joseph: [1, 2] },
        refs: { 1: ["1-30-24"], 2: ["40-27-57"] },
        strong: { 1: "H3130", 2: "G2501" },
        spans: [
          { verseKey: "1-30-24", surface: "Joseph", ids: "strong:H3130" },
          { verseKey: "40-27-57", surface: "Joseph", ids: "strong:G2501" }
        ]
      })
    });
    assert.deepEqual(result.links.map(({ tier }) => tier), ["confirmed", "confirmed"]);
  });

  it("keeps several people when the subject really covers them", () => {
    const result = resolveEntityLinks({
      names: ["philip"],
      verses: new Set(["43-1-43", "43-1-44", "44-8-5", "44-8-6"]),
      context: context({
        aliases: { philip: [1, 2] },
        refs: { 1: ["43-1-43", "43-1-44"], 2: ["44-8-5", "44-8-6"] },
        strong: { 1: "G5376", 2: "G5376" }
      })
    });
    assert.equal(result.status, "several");
    assert.equal(result.links.length, 2);
  });

  it("keeps the best homonym of a title that names one person", () => {
    const result = resolveEntityLinks({
      names: ["john"],
      onePerson: true,
      verses: new Set(["43-1-1", "43-1-2", "43-1-3", "40-3-1", "40-3-2", "40-3-3", "40-3-4"]),
      context: context({
        aliases: { john: [1, 2] },
        refs: { 1: ["43-1-1", "43-1-2", "43-1-3"], 2: ["40-3-1", "40-3-2", "40-3-3", "40-3-4"] },
        strong: { 1: "G2491", 2: "G2491" }
      })
    });
    assert.deepEqual(result.links.map(({ entityId }) => entityId), [2]);
    assert.equal(result.status, "single");
  });

  it("drops a homonym that only brushes the subject", () => {
    const verses = Array.from({ length: 12 }, (_, index) => `9-1-${index + 1}`);
    const result = resolveEntityLinks({
      names: ["kish"],
      verses: new Set(verses),
      context: context({
        aliases: { kish: [1, 2] },
        refs: { 1: verses.slice(0, 11), 2: verses.slice(11) },
        strong: { 1: "H7027", 2: "H7027" }
      })
    });
    assert.deepEqual(result.links.map((link) => link.entityId), [1]);
  });

  it("makes no link without a shared verse", () => {
    const result = resolveEntityLinks({
      names: ["ephod"],
      verses: new Set(["2-28-4"]),
      context: context({
        aliases: { ephod: [1] },
        refs: { 1: ["4-34-23"] },
        strong: { 1: "H641" }
      })
    });
    assert.equal(result.status, "no-shared-verse");
  });
});

describe("event participants", () => {
  const eventContext = (byChapter, refs, aliases) => ({
    entitiesByAlias: Object.entries(aliases).reduce((index, [id, names]) => {
      for (const key of Object.keys(names)) {
        index.set(key, new Set([...(index.get(key) ?? []), Number(id)]));
      }
      return index;
    }, new Map()),
    entitiesByChapter: new Map(
      Object.entries(byChapter).map(([chapter, ids]) => [chapter, new Set(ids)])
    ),
    refsByEntity: new Map(
      Object.entries(refs).map(([id, verses]) => [Number(id), new Set(verses)])
    ),
    aliasesByEntity: new Map(
      Object.entries(aliases).map(([id, names]) => [
        Number(id),
        new Map(
          Object.entries(names).map(([key, sources]) => [
            key,
            { sources: new Set(sources) }
          ])
        )
      ])
    )
  });

  it("takes the people the title names and the chapter holds", () => {
    const participants = resolveEventParticipants({
      title: "Absalom Returns to Jerusalem from Geshur",
      verses: new Set(["10-14-1"]),
      context: eventContext(
        { "10-14": [1, 2, 3] },
        { 1: ["10-14-1"], 2: ["10-14-1"], 3: ["10-14-1"] },
        {
          1: { absalom: ["display-en"] },
          2: { jerusalem: ["kjv"] },
          3: { joab: ["display-en"] }
        }
      )
    });
    assert.deepEqual(participants.map(({ entityId }) => entityId).sort(), [1, 2]);
  });

  it("reads a possessive in the title", () => {
    const participants = resolveEventParticipants({
      title: "Korah's Rebellion",
      verses: new Set(["4-16-1"]),
      context: eventContext(
        { "4-16": [1] },
        { 1: ["4-16-1"] },
        { 1: { korah: ["display-en"] } }
      )
    });
    assert.equal(participants.length, 1);
  });

  it("finds in the chapter a person the verse does not name", () => {
    const participants = resolveEventParticipants({
      title: "Ishmael Mocks Isaac",
      verses: new Set(["1-21-9"]),
      context: eventContext(
        { "1-21": [1] },
        { 1: ["1-21-14"] },
        { 1: { ishmael: ["display-en"] } }
      )
    });
    assert.deepEqual(
      participants.map(({ role }) => role),
      ["participant"]
    );
  });

  it("takes from the description only the people the verses hold", () => {
    const participants = resolveEventParticipants({
      title: "Sermon on the Mount",
      description: "Jesus teaches the crowd, as Moses did",
      verses: new Set(["40-5-1"]),
      context: eventContext(
        { "40-5": [1, 2] },
        { 1: ["40-5-1"], 2: ["40-5-40"] },
        { 1: { jesus: ["display-en"] }, 2: { moses: ["display-en"] } }
      )
    });
    assert.deepEqual(
      participants.map(({ entityId, role }) => [entityId, role]),
      [[1, "mentioned"]]
    );
  });

  it("gives a homonym's title to the person of the book", () => {
    const participants = resolveEventParticipants({
      title: "Nehemiah Starts to Build Walls",
      verses: new Set(["16-3-16"]),
      context: eventContext(
        { "16-3": [2], "16-1": [1], "16-2": [1] },
        { 1: ["16-1-1", "16-2-1"], 2: ["16-3-16"] },
        { 1: { nehemiah: ["display-en"] }, 2: { nehemiah: ["display-en"] } }
      )
    });
    assert.deepEqual(
      participants.map(({ entityId, tier }) => [entityId, tier]),
      [[1, "confirmed"]]
    );
  });

  it("marks a person named by the title and absent from the verses as unproven", () => {
    const participants = resolveEventParticipants({
      title: "Ishmael Mocks Isaac",
      verses: new Set(["1-21-9"]),
      context: eventContext(
        { "1-21": [1] },
        { 1: ["1-21-14"] },
        { 1: { ishmael: ["display-en"] } }
      )
    });
    assert.equal(participants[0].tier, "probable");
  });

  it("does not read a French spelling in an English title", () => {
    const participants = resolveEventParticipants({
      title: "Son of the Prophet",
      verses: new Set(["1-1-1"]),
      context: eventContext({ "1-1": [1] }, { 1: ["1-1-1"] }, { 1: { son: ["lsg"] } })
    });
    assert.equal(participants.length, 0);
  });
});

describe("event subject", () => {
  it("keeps the homonym the passage is about", () => {
    assert.deepEqual(
      pickEventSubject([
        { entityId: 1, shared: 5, tier: "confirmed" },
        { entityId: 2, shared: 1, tier: "confirmed" }
      ]),
      [{ entityId: 1, shared: 5, tier: "confirmed" }]
    );
  });

  it("leaves a tie to be decided", () => {
    assert.deepEqual(
      pickEventSubject([
        { entityId: 1, shared: 1, tier: "confirmed" },
        { entityId: 2, shared: 1, tier: "confirmed" }
      ]).map(({ tier }) => tier),
      ["probable", "probable"]
    );
  });
});

describe("theme links", () => {
  it("requires two shared verses", () => {
    const links = resolveThemeLinks({
      verses: new Set(["1-1-1", "1-1-2"]),
      entries: [{ key: "a" }, { key: "b" }],
      entryVerses: new Map([
        ["a", new Set(["1-1-1", "1-1-2"])],
        ["b", new Set(["1-1-1"])]
      ])
    });
    assert.deepEqual(links.map(({ entry }) => entry.key), ["a"]);
  });
});

describe("one article per subject", () => {
  const entries = new Map(
    [
      { key: "westphal:9", work: "westphal", entryId: 9, language: "fr", cluster: "david" },
      { key: "bost:5", work: "bost", entryId: 5, language: "fr", cluster: "david" },
      { key: "calmet:7", work: "calmet", entryId: 7, language: "fr", cluster: "david" },
      { key: "isbe:1", work: "isbe", entryId: 1, language: "en", cluster: "david" },
      { key: "westphal:10", work: "westphal", entryId: 10, language: "fr", cluster: null },
      { key: "westphal:11", work: "westphal", entryId: 11, language: "fr", cluster: null }
    ].map((entry) => [entry.key, entry])
  );
  const article = (target, entity = "David") => ({ kind: "entity-dictionary", entity, target });

  it("keeps one article of a word, whatever the order", () => {
    assert.deepEqual(
      oneArticlePerSubject(
        [article("westphal:9"), article("bost:5"), article("calmet:7")],
        entries
      ).map(({ target }) => target),
      ["bost:5"]
    );
  });

  it("keeps each language, each subject and the articles that stand alone", () => {
    assert.deepEqual(
      oneArticlePerSubject(
        [
          article("bost:5"),
          article("isbe:1"),
          article("calmet:7", "Jesse"),
          article("westphal:10"),
          article("westphal:11")
        ],
        entries
      ).map(({ target }) => target),
      ["bost:5", "isbe:1", "calmet:7", "westphal:10", "westphal:11"]
    );
  });

  it("leaves the other links alone", () => {
    const event = { kind: "entity-timeline", entity: "David", target: "bost:5" };
    assert.deepEqual(oneArticlePerSubject([event, event], entries), [event, event]);
  });
});
