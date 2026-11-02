import {
  nameKey,
  normalizeName,
  parseIdentities,
  spanStrongBases,
  strongBase
} from "./entity-aliases.mjs";

// A link is fail-closed: a name opens a candidate, and only the verses and the Strong tagging of
// those verses can confirm it. Sharing a verse alone never makes a link.

const MIN_SHARED_FOR_HOMONYM = 3;
const HOMONYM_SHARE_OF_BEST = 0.15;
const FALSE_FRIEND_PURITY = 0.2;
const FALSE_FRIEND_MIN_OTHERS = 3;

// What follows a comma or sits in brackets can change the subject: "Corinthians, First Epistle to
// the" is a letter, "Daniel (livre de)" a book, "Gad (vallée)" a place, "Moses, Song of" a text.
// "Pilate, Pontius", "Gad, the Tribe of" or "Abner (lampe de mon père)" keep it.
const ABOUT_SOMETHING_ELSE =
  /(?<!\p{L})(?:epistles?|books?|gospel|kingdom|prophec(?:y|ies)|concerning|city|valley|brook|root|song|vine|depths|synagogue|sea|ark|rest|offices|exaltation|strange|language|mountain|second|épîtres?|livres?|évangile|royaume|vallée|torrent|cantique|arche|lieu|mer|langue)(?!\p{L})/iu;

// An article titled "John, the Apostle" is about one of the Johns, whatever else it cites.
const ONE_PERSON =
  /(?<!\p{L})(?:apostle|baptist|prophet|king|apôtre|baptiste|prophète|roi|fils de|son of)(?!\p{L})/iu;

export const namesOnePerson = (heading) => {
  const qualifier = /[,(](.*)$/.exec(heading ?? "");
  return Boolean(qualifier) && ONE_PERSON.test(qualifier[1]);
};

const NUMBERED_SUFFIX = /\s+(?:[ivx]+|\d+)$/;
const TRAILING_NOTE = /\s*\(.*\)\s*$/;

// Subject names are headings written for a reader: "Jesus, the Christ", "God Continued...",
// "Pilate, Pontius", "Aminadab (or Amminidab)", "Artaxerxes I".
export const subjectNames = (heading) => {
  const names = new Set();
  const add = (value) => {
    const normalized = normalizeName(value);
    if (normalized) names.add(normalized);
  };
  const text = (heading ?? "").trim();
  add(text);
  const parenthesis = /\((?:or|ou)\s+([^)]+)\)/i.exec(text);
  if (parenthesis) add(parenthesis[1]);
  const qualifier = /[,(](.*)$/.exec(text)?.[1] ?? "";
  if (ABOUT_SOMETHING_ELSE.test(qualifier)) return [...names];
  const plain = text.replace(TRAILING_NOTE, "").replace(/\s*continued\.*$/i, "");
  add(plain);
  for (const variant of plain.split(/\s*(?:;|\s+or\s+|\s+ou\s+)\s*/i)) add(variant);
  add(plain.split(",")[0]);
  add(plain.replace(/\s+the\s+\p{L}+$/iu, ""));
  for (const name of [...names]) add(name.replace(NUMBERED_SUFFIX, ""));
  return [...names];
};

export const parseScripture = (reference) => {
  const match = /^(?:\d+\|)?(\d+)\|(\d+):(\d+)(?:-(\d+))?$/.exec(reference.trim());
  if (!match) return [];
  const [, book, chapter, first, last] = match;
  const start = Number(first);
  const end = Number(last ?? first);
  const verses = [];
  for (let verse = start; verse <= end; verse += 1) {
    verses.push(`${book}-${chapter}-${verse}`);
  }
  return verses;
};

const sharedCount = (left, right) => {
  let count = 0;
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  for (const item of small) if (large.has(item)) count += 1;
  return count;
};

export const buildSpanIndex = (spans) => {
  const byVerse = new Map();
  for (const span of spans) {
    const verse = byVerse.get(span.verseKey) ?? [];
    verse.push({
      keys: new Set(
        normalizeName(span.surface).split(" ").map(nameKey).filter(Boolean)
      ),
      fullKey: nameKey(span.surface),
      bases: spanStrongBases(span.ids),
      strong: strongBase(parseIdentities(span.ids).strong),
      surface: span.surface
    });
    byVerse.set(span.verseKey, verse);
  }
  return byVerse;
};

// Among the words of the subject's verses that are spelled like its name, how many carry the
// Strong of the entity? The word "sin" is H2403; the wilderness of Sin is H5512.
export const lexicalEvidence = ({
  names,
  verses,
  strong,
  homonymStrongs = new Set([strong]),
  spanIndex
}) => {
  const keys = new Set(names.map(nameKey));
  let hits = 0;
  let others = 0;
  for (const verseKey of verses) {
    for (const span of spanIndex.get(verseKey) ?? []) {
      const spelled =
        keys.has(span.fullKey) || [...span.keys].some((key) => keys.has(key));
      if (!spelled) continue;
      if (span.bases.includes(strong)) hits += 1;
      else if (span.bases.some((base) => homonymStrongs.has(base))) continue;
      else if (span.bases.length > 0) others += 1;
    }
  }
  return { hits, others };
};

export const resolveEntityLinks = ({ names, verses, context, onePerson = false }) => {
  const spanIndexes = context.spanIndexes ?? [context.spanIndex];
  const candidates = new Set();
  const matchedAliases = new Map();
  for (const name of names) {
    const key = nameKey(name);
    for (const entityId of context.entitiesByAlias.get(key) ?? []) {
      candidates.add(entityId);
      matchedAliases.set(entityId, key);
    }
  }
  if (candidates.size === 0) return { status: "no-name", links: [] };
  if (verses.size === 0) return { status: "no-verses", links: [] };

  // Joseph the patriarch and Joseph of Arimathea have different Strong numbers: the words of one
  // say nothing against the other.
  const homonymStrongs = new Set(
    [...candidates].map((entityId) => context.strongByEntity.get(entityId))
  );
  const scored = [...candidates]
    .map((entityId) => {
      const refs = context.refsByEntity.get(entityId) ?? new Set();
      const shared = sharedCount(refs, verses);
      const strong = context.strongByEntity.get(entityId);
      const evidence = { hits: 0, others: 0 };
      for (const spanIndex of spanIndexes) {
        const { hits, others } = lexicalEvidence({
          names,
          verses,
          strong,
          homonymStrongs,
          spanIndex
        });
        evidence.hits += hits;
        evidence.others += others;
      }
      const seen = evidence.hits + evidence.others;
      return {
        entityId,
        shared,
        ...evidence,
        purity: seen > 0 ? evidence.hits / seen : null,
        refs: refs.size,
        alias: matchedAliases.get(entityId)
      };
    })
    .filter((candidate) => candidate.shared > 0)
    .sort((left, right) => right.shared - left.shared);

  if (scored.length === 0) return { status: "no-shared-verse", links: [] };

  const lexical = scored.filter(
    (candidate) =>
      candidate.purity === null ||
      candidate.purity >= FALSE_FRIEND_PURITY ||
      candidate.others < FALSE_FRIEND_MIN_OTHERS
  );
  if (lexical.length === 0) {
    return { status: "false-friend", links: [], rejected: scored };
  }

  const best = lexical[0].shared;
  const kept = lexical.filter(
    (candidate) =>
      candidate.shared >= MIN_SHARED_FOR_HOMONYM ||
      candidate.shared / best >= HOMONYM_SHARE_OF_BEST
  );
  const certain = (candidate) =>
    candidate.hits > 0 && candidate.purity >= 0.5;
  const chosen = onePerson ? kept.slice(0, 1) : kept;
  return {
    status: chosen.length > 1 ? "several" : "single",
    links: chosen.map((candidate) => ({
      ...candidate,
      tier: certain(candidate) ? "confirmed" : "probable"
    }))
  };
};

const titleWindows = (title) => {
  const tokens = normalizeName(title).split(" ").filter(Boolean);
  const windows = new Set();
  for (let size = 1; size <= 3; size += 1) {
    for (let start = 0; start + size <= tokens.length; start += 1) {
      windows.add(nameKey(tokens.slice(start, start + size).join(" ")));
    }
  }
  return windows;
};

export const verseChapter = (verseKey) => verseKey.split("-").slice(0, 2).join("-");

const namesEntity = (context, entityId, windows) => {
  const aliases = context.aliasesByEntity.get(entityId);
  if (!aliases) return null;
  const named = [...aliases.entries()].find(
    ([key, alias]) =>
      windows.has(key) &&
      [...alias.sources].some((source) => source !== "display-fr" && source !== "lsg")
  );
  return named ? named[0] : null;
};

// The people of an event are those its title names AND its chapters hold, then those its
// description names AND its verses hold. A passage alone lists everyone in a genealogy; a title
// alone would take "Ham" out of any sentence. The chapter matters because a passage often says
// "the son of Hagar" where the title says Ishmael.
export const resolveEventParticipants = ({ title, description = "", verses, context }) => {
  const windows = titleWindows(title);
  const descriptionWindows = titleWindows(description);
  const chapters = new Set([...verses].map(verseChapter));
  const books = new Set([...verses].map((verseKey) => verseKey.split("-")[0]));
  const inChapters = new Set();
  for (const chapter of chapters) {
    for (const entityId of context.entitiesByChapter.get(chapter) ?? []) {
      inChapters.add(entityId);
    }
  }
  const sharedWith = (entityId) =>
    sharedCount(context.refsByEntity.get(entityId) ?? new Set(), verses);
  const refsInBooks = (entityId) =>
    [...(context.refsByEntity.get(entityId) ?? [])].filter((verseKey) =>
      books.has(verseKey.split("-")[0])
    ).length;

  const participants = new Map();
  const add = (entityId, alias, role, tier) =>
    participants.set(entityId, {
      entityId,
      alias,
      shared: sharedWith(entityId),
      role,
      tier
    });

  for (const key of windows) {
    const owners = [...(context.entitiesByAlias.get(key) ?? [])].filter(
      (entityId) => namesEntity(context, entityId, new Set([key]))
    );
    if (owners.length === 1) {
      const [entityId] = owners;
      if (!inChapters.has(entityId)) continue;
      add(entityId, key, "participant", sharedWith(entityId) > 0 ? "confirmed" : "probable");
      continue;
    }
    // Nehemiah son of Azbuk is in the chapter of the walls; the book belongs to the governor.
    const ranked = owners
      .map((entityId) => ({
        entityId,
        book: refsInBooks(entityId),
        shared: sharedWith(entityId)
      }))
      .filter(({ book }) => book > 0)
      .sort((left, right) => right.book - left.book || right.shared - left.shared);
    if (ranked.length === 0) continue;
    const top = ranked.filter(
      ({ book, shared }) => book === ranked[0].book && shared === ranked[0].shared
    );
    for (const { entityId } of top) {
      add(entityId, key, "participant", top.length === 1 ? "confirmed" : "probable");
    }
  }

  for (const entityId of inChapters) {
    if (participants.has(entityId) || sharedWith(entityId) === 0) continue;
    const alias = namesEntity(context, entityId, descriptionWindows);
    if (alias) add(entityId, alias, "mentioned", "confirmed");
  }
  return [...participants.values()].sort((left, right) => right.shared - left.shared);
};

// An event titled with a name is about one person, whatever the homonyms of its passage.
export const pickEventSubject = (links) => {
  if (links.length < 2) return links;
  const best = links[0].shared;
  const top = links.filter((link) => link.shared === best);
  return top.length === 1
    ? top
    : top.map((link) => ({ ...link, tier: "probable" }));
};

// The dictionary each language offers first: the one a reader is most likely to hold offline.
const DEFAULT_DICTIONARY = { fr: "westphal", en: "easton-webster" };

// Marks the articles a subject does not list, which still lead to the subject.
export const SAME_WORD = "same-word";

// The page of a dictionary article already switches between the articles of the other dictionaries
// on the same word: a subject needs one door to them, not one per dictionary.
export const oneArticlePerSubject = (links, entries) => {
  const groupOf = (link) => {
    const entry = entries.get(link.target);
    const isArticle = link.kind === "entity-dictionary" || link.kind === "nave-dictionary";
    return isArticle && entry?.cluster
      ? `${link.kind}|${link.entity ?? link.topic}|${entry.language}|${entry.cluster}`
      : null;
  };
  const isDefault = (entry) => entry.work === DEFAULT_DICTIONARY[entry.language];
  const before = (left, right) =>
    Number(isDefault(right)) - Number(isDefault(left)) ||
    left.work.localeCompare(right.work) ||
    left.entryId - right.entryId;
  const kept = new Map();
  for (const link of links) {
    const group = groupOf(link);
    if (!group) continue;
    const best = kept.get(group);
    if (!best || before(entries.get(link.target), entries.get(best)) < 0) {
      kept.set(group, link.target);
    }
  }
  return links.map((link) => {
    const group = groupOf(link);
    return !group || kept.get(group) === link.target ? link : { ...link, role: SAME_WORD };
  });
};

export const resolveThemeLinks = ({ verses, entries, entryVerses }) =>
  entries
    .map((entry) => {
      const shared = sharedCount(verses, entryVerses.get(entry.key) ?? new Set());
      return { entry, shared };
    })
    .filter(({ shared }) => shared >= 2)
    .sort((left, right) => right.shared - left.shared);
