#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAliasIndex, collectEntitySpellings, nameKey, strongBase } from "./entity-aliases.mjs";
import { defaultSourcesRoot } from "./export-sources.mjs";
import { bookNumber, isVerseKey, readSource } from "./source-files.mjs";
import {
  buildSpanIndex,
  parseScripture,
  resolveEntityLinks,
  resolveEventParticipants,
  resolveThemeLinks,
  pickEventSubject,
  namesOnePerson,
  oneArticlePerSubject,
  subjectNames,
  verseChapter
} from "./study-links.mjs";
import { chooseTopicTitle, proposeBibleTitle, replaceNames } from "./title-corrections.mjs";

const outputRoot = path.resolve(defaultSourcesRoot, "..");
const configRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../config"
);
const overridesPath = path.join(configRoot, "overrides.json");
const naveTitlesPath = path.join(configRoot, "nave-french-titles.json");
const timelineTitlesPath = path.join(configRoot, "timeline-french-titles.json");

const add = (map, key, value) => {
  const set = map.get(key) ?? new Set();
  set.add(value);
  map.set(key, set);
};

const readSpans = async (sourcesRoot, name) =>
  (await readSource(sourcesRoot, name)).map((span) => ({
    verseKey: `${span.book}-${span.chapter}-${span.verse}`,
    surface: span.surface,
    ids: span.ids
  }));

const buildContext = async (sourcesRoot) => {
  const entities = (await readSource(sourcesRoot, "entities")).map((row) => ({
    id: Number(row.entity_id),
    uniqueName: row.unique_name,
    uStrong: row.u_strong,
    category: row.category,
    type: row.type,
    nameEn: row.name_en,
    nameFr: row.name_fr,
    briefEn: row.brief_en,
    briefFr: row.brief_fr
  }));
  const refsByEntity = new Map();
  const entitiesByVerse = new Map();
  const entitiesByChapter = new Map();
  for (const ref of await readSource(sourcesRoot, "entity-refs")) {
    const verseKey = `${bookNumber.get(ref.book)}-${ref.chapter}-${ref.verse}`;
    add(refsByEntity, Number(ref.entity_id), verseKey);
    add(entitiesByVerse, verseKey, Number(ref.entity_id));
    add(entitiesByChapter, verseChapter(verseKey), Number(ref.entity_id));
  }
  const strongByEntity = new Map(
    entities.map((entity) => [entity.id, strongBase(entity.uStrong)])
  );
  const [kjvSpans, lsgSpans] = await Promise.all([
    readSpans(sourcesRoot, "spans-kjv"),
    readSpans(sourcesRoot, "spans-lsg")
  ]);
  const spelling = (spans) =>
    collectEntitySpellings({ spans, entitiesByVerse, strongByEntity });
  const { rejectedSpellings } = JSON.parse(await readFile(overridesPath, "utf8"));
  const { aliasesByEntity, entitiesByAlias } = buildAliasIndex({
    entities,
    spellingsByBible: { kjv: spelling(kjvSpans), lsg: spelling(lsgSpans) },
    rejectedSpellings
  });
  return {
    entities,
    entityById: new Map(entities.map((entity) => [entity.id, entity])),
    entityByUniqueName: new Map(entities.map((entity) => [entity.uniqueName, entity])),
    refsByEntity,
    entitiesByVerse,
    entitiesByChapter,
    strongByEntity,
    aliasesByEntity,
    entitiesByAlias,
    spanIndexes: [buildSpanIndex(kjvSpans), buildSpanIndex(lsgSpans)]
  };
};

const readNave = async (sourcesRoot) => {
  const { titles } = JSON.parse(await readFile(naveTitlesPath, "utf8"));
  const verses = new Map();
  for (const link of await readSource(sourcesRoot, "nave-links")) {
    if (isVerseKey(link.verse_key)) add(verses, link.normalized_name, link.verse_key);
  }
  return (await readSource(sourcesRoot, "nave")).map((topic) => ({
    key: topic.normalized_name,
    nameEn: topic.name_en,
    nameFr: titles[topic.normalized_name] ?? topic.name_fr,
    sourceNameFr: topic.name_fr,
    descriptionEn: topic.description_en,
    verses: verses.get(topic.normalized_name) ?? new Set()
  }));
};

const readDictionary = async (sourcesRoot) => {
  const entryKey = (work, entryId) => `${work}:${entryId}`;
  const citations = new Map();
  const presences = new Map();
  for (const row of await readSource(sourcesRoot, "dictionary-citations")) {
    const [work] = row.work_language.split("|");
    if (isVerseKey(row.verse_key)) add(citations, entryKey(work, row.entry_id), row.verse_key);
  }
  for (const row of await readSource(sourcesRoot, "dictionary-presences")) {
    if (isVerseKey(row.verse_key)) add(presences, entryKey(row.work, row.entry_id), row.verse_key);
  }
  return (await readSource(sourcesRoot, "dictionary")).map((row) => {
    const [work, language] = row.work_language.split("|");
    const key = entryKey(work, row.entry_id);
    return {
      key,
      work,
      language,
      entryId: Number(row.entry_id),
      word: row.word,
      cluster: row.correspondence_id || null,
      excerpt: row.excerpt,
      // What an article cites tells homonyms apart; a verse holding the same name does not.
      verses: citations.get(key) ?? presences.get(key) ?? new Set()
    };
  });
};

const readTimeline = async (sourcesRoot) => {
  const { titles } = JSON.parse(await readFile(timelineTitlesPath, "utf8"));
  return (await readSource(sourcesRoot, "timeline")).map((row) => ({
    id: row.event_id,
    slug: row.slug,
    titleEn: row.title_en,
    titleFr: titles[row.slug] ?? row.title_fr,
    sourceTitleFr: row.title_fr,
    dates: row.dates,
    period: Number(row.period),
    descriptionEn: row.description_en,
    related: JSON.parse(row.related),
    verses: new Set(JSON.parse(row.scriptures).flatMap(parseScripture))
  }));
};

const entityLink = (context, { source, target, candidate, status, kind }) => ({
  kind,
  source,
  target,
  entity: context.entityById.get(candidate.entityId).uniqueName,
  tier: candidate.tier,
  status,
  evidence: {
    alias: candidate.alias,
    sharedVerses: candidate.shared,
    entityRefs: candidate.refs,
    lexicalHits: candidate.hits,
    lexicalOthers: candidate.others
  }
});

const linkNave = (nave, context, report) => {
  const links = [];
  const linked = new Set();
  for (const topic of nave) {
    const names = [
      ...new Set([...subjectNames(topic.nameEn), ...subjectNames(topic.nameFr)])
    ];
    const result = resolveEntityLinks({
      names,
      verses: topic.verses,
      context
    });
    report.nave[result.status] = (report.nave[result.status] ?? 0) + 1;
    if (result.status === "false-friend") {
      report.falseFriends.push({
        kind: "nave",
        subject: topic.nameEn,
        entity: context.entityById.get(result.rejected[0].entityId).uniqueName,
        hits: result.rejected[0].hits,
        others: result.rejected[0].others
      });
    }
    if (result.links.length > 0) linked.add(topic.key);
    for (const candidate of result.links) {
      links.push(
        entityLink(context, {
          kind: "entity-nave",
          source: topic.nameEn,
          target: topic.key,
          candidate,
          status: result.status
        })
      );
    }
  }
  return { links, linked };
};

const linkDictionary = (entries, context, report) => {
  const links = [];
  const linked = new Set();
  for (const entry of entries) {
    const result = resolveEntityLinks({
      names: subjectNames(entry.word),
      verses: entry.verses,
      context,
      onePerson: namesOnePerson(entry.word)
    });
    const key = `${entry.language}:${result.status}`;
    report.dictionary[key] = (report.dictionary[key] ?? 0) + 1;
    if (result.status === "false-friend") {
      report.falseFriends.push({
        kind: "dictionary",
        subject: `${entry.word} (${entry.work})`,
        entity: context.entityById.get(result.rejected[0].entityId).uniqueName,
        hits: result.rejected[0].hits,
        others: result.rejected[0].others
      });
    }
    if (result.links.length > 0) linked.add(entry.key);
    for (const candidate of result.links) {
      links.push(
        entityLink(context, {
          kind: "entity-dictionary",
          source: `${entry.word} (${entry.work})`,
          target: entry.key,
          candidate,
          status: result.status
        })
      );
    }
  }
  return { links, linked };
};

const DIVINE_NAMES = /^LORD@/;
// The entity of Israel is presented as Jacob. After his generation, an event about Israel is about
// the nation, and opening his portrait from it would mislead.
const PATRIARCH_OF_THE_NATION = /^Israel@Gen\.25\.26/;
const LAST_PERIOD_OF_THE_PATRIARCHS = 3;
const NUMBERED_RULER = /\s(?:II|III|IV|V|VI)$/;

const isNationReading = (event, uniqueName, alias) =>
  PATRIARCH_OF_THE_NATION.test(uniqueName) &&
  event.period > LAST_PERIOD_OF_THE_PATRIARCHS &&
  alias !== "jacob";

const isBiblicalPeriod = (event) => event.period <= 10;

const linkTimeline = (events, context, report) => {
  const links = [];
  for (const event of events) {
    const person = resolveEntityLinks({
      names: subjectNames(event.titleEn),
      verses: event.verses,
      context
    });
    const entities = new Map();
    for (const candidate of pickEventSubject(person.links)) {
      entities.set(candidate.entityId, { ...candidate, role: "subject" });
    }
    if (entities.size === 0) {
      const participants = resolveEventParticipants({
        title: event.titleEn,
        description: event.descriptionEn,
        verses: event.verses,
        context
      });
      for (const participant of participants) {
        const { uniqueName } = context.entityById.get(participant.entityId);
        if (DIVINE_NAMES.test(uniqueName)) continue;
        if (isNationReading(event, uniqueName, participant.alias)) continue;
        entities.set(participant.entityId, {
          ...participant,
          hits: null,
          others: null,
          refs: context.refsByEntity.get(participant.entityId)?.size ?? 0
        });
      }
    }
    if (
      entities.size === 0 &&
      event.verses.size === 0 &&
      isBiblicalPeriod(event) &&
      !NUMBERED_RULER.test(event.titleEn.trim())
    ) {
      for (const name of subjectNames(event.titleEn)) {
        const owners = context.entitiesByAlias.get(nameKey(name)) ?? new Set();
        if (owners.size !== 1) continue;
        const [entityId] = owners;
        entities.set(entityId, {
          entityId,
          alias: nameKey(name),
          shared: 0,
          hits: null,
          others: null,
          refs: context.refsByEntity.get(entityId)?.size ?? 0,
          role: "subject",
          tier: "probable"
        });
      }
    }
    const status =
      entities.size === 0
        ? event.verses.size === 0
          ? "no-verses"
          : "no-entity"
        : [...entities.values()][0].role;
    report.timeline[status] = (report.timeline[status] ?? 0) + 1;
    for (const candidate of entities.values()) {
      links.push({
        ...entityLink(context, {
          kind: "entity-timeline",
          source: event.titleEn,
          target: event.slug,
          candidate,
          status: candidate.role
        }),
        role: candidate.role,
        dates: event.dates
      });
    }
  }
  return links;
};

const linkTimelineThemes = (events, nave, linkedTopics, timelineLinks, report) => {
  const withEntity = new Set(timelineLinks.map(({ target }) => target));
  const topics = new Map();
  for (const topic of nave) {
    if (linkedTopics.has(topic.key)) continue;
    for (const name of subjectNames(topic.nameEn)) {
      add(topics, nameKey(name), topic);
    }
  }
  const links = [];
  for (const event of events) {
    if (!isBiblicalPeriod(event)) continue;
    const found = new Set(
      subjectNames(event.titleEn).flatMap((name) => [...(topics.get(nameKey(name)) ?? [])])
    );
    for (const topic of found) {
      const shared = [...event.verses].filter((verse) => topic.verses.has(verse)).length;
      if (shared === 0) continue;
      report.timeline.theme = (report.timeline.theme ?? 0) + 1;
      links.push({
        kind: "nave-timeline",
        source: event.titleEn,
        target: event.slug,
        topic: topic.key,
        tier: "confirmed",
        evidence: {
          sharedVerses: shared,
          withEntity: withEntity.has(event.slug)
        }
      });
    }
  }
  return links;
};

const linkThemes = (nave, entries, linkedTopics, linkedEntries, report) => {
  const headings = { en: new Map(), fr: new Map() };
  const entryVerses = new Map();
  for (const entry of entries) {
    entryVerses.set(entry.key, entry.verses);
    if (linkedEntries.has(entry.key)) continue;
    for (const name of subjectNames(entry.word)) {
      add(headings[entry.language], nameKey(name), entry);
    }
  }
  const links = [];
  for (const topic of nave) {
    if (linkedTopics.has(topic.key)) continue;
    report.themes.topics += 1;
    const found = new Map();
    for (const [language, name] of [
      ["en", topic.nameEn],
      ["fr", topic.nameFr]
    ]) {
      const entriesForName = new Set(
        subjectNames(name).flatMap((subject) => [
          ...(headings[language].get(nameKey(subject)) ?? [])
        ])
      );
      for (const { entry, shared } of resolveThemeLinks({
        verses: topic.verses,
        entries: [...entriesForName],
        entryVerses
      })) {
        found.set(entry.key, { entry, shared });
      }
    }
    if (found.size > 0) report.themes.topicsLinked += 1;
    for (const { entry, shared } of found.values()) {
      if (entry.language === "fr") report.themes.frenchEntries += 1;
      links.push({
        kind: "nave-dictionary",
        source: topic.nameEn,
        sourceFr: topic.nameFr,
        topic: topic.key,
        target: entry.key,
        entry: `${entry.word} (${entry.work})`,
        tier: "confirmed",
        evidence: {
          sharedVerses: shared,
          topicVerses: topic.verses.size,
          entryVerses: entry.verses.size
        }
      });
    }
  }
  return links;
};

// Every correction names the link it touches and says why: the generator stays the source of the
// links, and a human decision survives a rebuild.
export const applyOverrides = (links, overrides) => {
  const linkId = ({ kind, target, entity }) => `${kind}|${target}|${entity}`;
  const removed = new Set(overrides.remove.map(linkId));
  const unknown = overrides.remove.filter(
    (override) => !links.some((link) => linkId(link) === linkId(override))
  );
  if (unknown.length > 0) {
    throw new Error(`study-links-override-unknown:${unknown.map(linkId).join(",")}`);
  }
  return [
    ...links.filter((link) => !removed.has(linkId(link))),
    ...overrides.add.map((override) => ({
      ...override,
      tier: "reviewed",
      evidence: { reason: override.reason }
    }))
  ];
};

const proposeTitleCorrections = ({ nave, timeline, links, context }) => {
  const [englishSpans, frenchSpans] = context.spanIndexes;
  const entitiesByTopic = new Map();
  for (const { kind, target, entity } of links) {
    if (kind === "entity-nave") {
      add(entitiesByTopic, target, context.entityByUniqueName.get(entity));
    }
  }
  const naveTitles = [];
  for (const topic of nave) {
    const entities = entitiesByTopic.get(topic.key);
    if (!entities) continue;
    if (/[,(]/.test(topic.nameEn)) continue;
    const proposed = chooseTopicTitle({
      topic,
      entities: [...entities],
      biblical: proposeBibleTitle({
        names: subjectNames(topic.nameEn),
        verses: topic.verses,
        englishSpans,
        frenchSpans
      })
    });
    if (proposed && nameKey(proposed) !== nameKey(topic.nameFr)) {
      naveTitles.push({ topic: topic.key, en: topic.nameEn, current: topic.nameFr, proposed });
    }
  }
  const replacements = new Map();
  for (const { kind, role, target, entity } of links) {
    if (kind !== "entity-timeline" || role === "mentioned") continue;
    const { nameEn, nameFr } = context.entityByUniqueName.get(entity);
    if (nameEn === nameFr) continue;
    const list = replacements.get(target) ?? [];
    list.push({ from: nameEn, to: nameFr });
    replacements.set(target, list);
  }
  const timelineTitles = [];
  for (const event of timeline) {
    const proposed = replaceNames(event.titleFr, replacements.get(event.slug) ?? []);
    if (proposed !== event.titleFr) {
      timelineTitles.push({ event: event.slug, current: event.titleFr, proposed });
    }
  }
  return { naveTitles, timelineTitles };
};

const finalFrenchTitles = ({ nave, timeline, corrections }) => {
  const naveTitles = new Map(nave.map((topic) => [topic.key, topic.nameFr]));
  for (const { topic, proposed } of corrections.naveTitles) naveTitles.set(topic, proposed);
  const timelineTitles = new Map(timeline.map((event) => [event.slug, event.titleFr]));
  for (const { event, proposed } of corrections.timelineTitles) {
    timelineTitles.set(event, proposed);
  }
  const changed = (entries, source) =>
    Object.fromEntries(
      [...entries].filter(([key, title]) => title !== source.get(key)).sort()
    );
  return {
    nave: changed(naveTitles, new Map(nave.map((topic) => [topic.key, topic.sourceNameFr]))),
    timeline: changed(
      timelineTitles,
      new Map(timeline.map((event) => [event.slug, event.sourceTitleFr]))
    ),
    naveAll: Object.fromEntries(naveTitles),
    timelineAll: Object.fromEntries(timelineTitles)
  };
};

const STILL_TO_COME = 9999;

// The grammar of the timeline: "1444 BC", "3954-3024 BC", "89 BC-7 AD", "1559-", "476-Future",
// "Future" and "After Millenium".
const frenchDates = (dates) => {
  const text = dates.trim();
  if (text === "Future") return "À venir";
  if (/^After Mill?enn?ium$/.test(text)) return "Après le millénium";
  return text
    .replace(/^(\d+)-(\d+) (BC|AD)$/, "$1–$2 $3")
    .replace(/ (BC|AD)-(\d+)/, " $1 – $2")
    .replace(/-Future$/, " – à venir")
    .replace(/\bBC\b/g, "av. J.-C.")
    .replace(/\bAD\b/g, "apr. J.-C.");
};

// The year an event starts, to read events in the order of time: "1040-970 BC" is -1040, "30 AD"
// is 30, "55 BC-10 AD" is -55. What is only dated as still to come closes the list.
const firstYear = (dates) => {
  const match = /^(\d+)(?: (BC|AD))?(?:-(?:\d+)(?: (BC|AD))?)?/.exec(dates.trim());
  if (!match) return STILL_TO_COME;
  const year = Number(match[1]);
  return (match[2] ?? match[3]) === "BC" ? -year : year;
};

// The two pivots become the same graph: a node knows how to show itself in each language, so no
// reader has to open four resources to print one title.
const WORK_NAMES = {
  bost: "Bost",
  calmet: "Calmet",
  lelievre: "Lelièvre",
  westphal: "Westphal",
  "easton-webster": "Easton",
  isbe: "ISBE",
  smith: "Smith",
  "unfoldingword-translation-words": "Translation Words"
};

const buildGraph = ({ links, titles, nave, dictionary, timeline, context }) => {
  const nodes = new Map();
  const topics = new Map(nave.map((topic) => [topic.key, topic]));
  const entries = new Map(dictionary.map((entry) => [entry.key, entry]));
  const events = new Map(timeline.map((event) => [event.slug, event]));
  const node = (kind, key) => {
    const id = `${kind}|${key}`;
    if (nodes.has(id)) return { kind, key };
    if (kind === "entity") {
      const { nameFr, nameEn, briefFr, briefEn } = context.entityByUniqueName.get(key);
      nodes.set(id, { kind, key, labelFr: nameFr, labelEn: nameEn, detailFr: briefFr, detailEn: briefEn, language: null, position: null });
    } else if (kind === "nave") {
      nodes.set(id, { kind, key, labelFr: titles.naveAll[key], labelEn: topics.get(key).nameEn, detailFr: null, detailEn: null, language: null, position: null });
    } else if (kind === "dictionary") {
      const { word, work, language } = entries.get(key);
      nodes.set(id, { kind, key, labelFr: word, labelEn: word, detailFr: WORK_NAMES[work], detailEn: WORK_NAMES[work], language, position: null });
    } else {
      const { titleEn, dates } = events.get(key);
      nodes.set(id, { kind, key, labelFr: titles.timelineAll[key], labelEn: titleEn, detailFr: frenchDates(dates), detailEn: dates, language: null, position: firstYear(dates) });
    }
    return { kind, key };
  };
  const edges = new Map();
  const add = (left, right, role = null) =>
    edges.set(`${left.kind}|${left.key}|${right.kind}|${right.key}`, { left, right, role });
  for (const link of oneArticlePerSubject(links, entries)) {
    if (link.tier === "probable" && link.kind === "entity-timeline") continue;
    if (link.kind === "entity-nave") add(node("entity", link.entity), node("nave", link.target));
    if (link.kind === "entity-dictionary") add(node("entity", link.entity), node("dictionary", link.target), link.role);
    if (link.kind === "entity-timeline") add(node("entity", link.entity), node("timeline", link.target), link.role);
    if (link.kind === "nave-dictionary") add(node("nave", link.topic), node("dictionary", link.target), link.role);
    if (link.kind === "nave-timeline") add(node("nave", link.topic), node("timeline", link.target));
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
};

const main = async () => {
  const sourcesRoot = process.argv[2] ?? defaultSourcesRoot;
  const context = await buildContext(sourcesRoot);
  const [nave, dictionary, timeline] = await Promise.all([
    readNave(sourcesRoot),
    readDictionary(sourcesRoot),
    readTimeline(sourcesRoot)
  ]);
  const report = {
    nave: {},
    dictionary: {},
    timeline: {},
    themes: { topics: 0, topicsLinked: 0, frenchEntries: 0 },
    falseFriends: []
  };
  const naveLinks = linkNave(nave, context, report);
  const dictionaryLinks = linkDictionary(dictionary, context, report);
  const timelineLinks = linkTimeline(timeline, context, report);
  const themeLinks = linkThemes(
    nave,
    dictionary,
    naveLinks.linked,
    dictionaryLinks.linked,
    report
  );
  const timelineThemes = linkTimelineThemes(
    timeline,
    nave,
    naveLinks.linked,
    timelineLinks,
    report
  );
  const links = applyOverrides(
    [
      ...naveLinks.links,
      ...dictionaryLinks.links,
      ...timelineLinks,
      ...themeLinks,
      ...timelineThemes
    ],
    JSON.parse(await readFile(overridesPath, "utf8"))
  );
  report.counts = links.reduce((counts, link) => {
    const key = `${link.kind}:${link.tier}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  await mkdir(outputRoot, { recursive: true });
  await writeFile(
    path.join(outputRoot, "links.jsonl"),
    `${links.map((link) => JSON.stringify(link)).join("\n")}\n`
  );
  const corrections = proposeTitleCorrections({ nave, timeline, links, context });
  report.titleCorrections = {
    nave: corrections.naveTitles.length,
    timeline: corrections.timelineTitles.length
  };
  await writeFile(
    path.join(outputRoot, "title-corrections.json"),
    `${JSON.stringify(corrections, null, 2)}\n`
  );
  const titles = finalFrenchTitles({ nave, timeline, corrections });
  await writeFile(
    path.join(outputRoot, "french-titles.json"),
    `${JSON.stringify(titles, null, 2)}\n`
  );
  await writeFile(
    path.join(outputRoot, "graph.json"),
    `${JSON.stringify(buildGraph({ links, titles, nave, dictionary, timeline, context }))}\n`
  );
  await writeFile(
    path.join(outputRoot, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  const { falseFriends, ...summary } = report;
  console.log(JSON.stringify(summary, null, 2));
  console.log(`faux amis écartés : ${falseFriends.length}`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
