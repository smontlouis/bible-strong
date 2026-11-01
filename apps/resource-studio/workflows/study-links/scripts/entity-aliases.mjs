// Spellings of a Biblical entity are read from the Bibles themselves: a Strong span carries the
// entity's lexical identity and its position in the text, so "Jacob" reaches Israel@Gen.25.26-Rev
// without any fuzzy comparison.

export const normalizeName = (value) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

// Spacing and hyphens vary between sources: Ben-Hadad, Benhadad, Ben Hadad.
export const nameKey = (value) =>
  normalizeName(value)
    .replace(/'s$/, "")
    .replace(/s'$/, "s")
    .replace(/[' ]/g, "");

const sentenceWords = new Set(
  (
    "and of to the for by in from with unto that was at on but when as o or upon is his her which " +
    "who said saith then so because against not before after into shall now thus let did seeing " +
    "though therefore also yet behold how why what there they he she it we ye you i these those " +
    "this all " +
    "et de du des au aux le la les par pour dans sur avec chez que qui car ou mais en il elle ils " +
    "elles alors ainsi voici comme lorsque quand puis un une ce cette ces"
  ).split(" ")
);

export const cleanSurface = (surface) => {
  const tokens = (surface ?? "")
    .replace(/[’]/g, "'")
    .replace(/^[dDlL]'/, "")
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""))
    .filter(Boolean);
  while (tokens.length > 0) {
    const first = tokens[0];
    const isName = /^\p{Lu}/u.test(first);
    if (isName && !sentenceWords.has(first.toLowerCase())) break;
    tokens.shift();
  }
  const name = tokens.join(" ").replace(/'s$/, "");
  return name.length > 0 ? name : null;
};

export const parseIdentities = (ids) => {
  const parsed = {};
  for (const item of (ids ?? "").split(" ")) {
    const separator = item.indexOf(":");
    if (separator > 0) parsed[item.slice(0, separator)] = item.slice(separator + 1);
  }
  return parsed;
};

export const strongBase = (code) => {
  const match = /^([HG])0*(\d+)/.exec(code ?? "");
  return match ? `${match[1]}${match[2]}` : null;
};

export const spanStrongBases = (ids) => {
  const parsed = parseIdentities(ids);
  return [parsed.ustrong, parsed.strong, parsed.dstrong]
    .map(strongBase)
    .filter(Boolean);
};

export const collectEntitySpellings = ({ spans, entitiesByVerse, strongByEntity }) => {
  const spellings = new Map();
  for (const span of spans) {
    const present = entitiesByVerse.get(span.verseKey);
    if (!present) continue;
    const bases = spanStrongBases(span.ids);
    if (bases.length === 0) continue;
    const name = cleanSurface(span.surface);
    if (!name) continue;
    for (const entityId of present) {
      if (!bases.includes(strongByEntity.get(entityId))) continue;
      const counts = spellings.get(entityId) ?? new Map();
      counts.set(name, (counts.get(name) ?? 0) + 1);
      spellings.set(entityId, counts);
    }
  }
  return spellings;
};

// A spelling must be a real share of the entity's occurrences. A spelling seen once or twice among
// others is at best a conjecture of the source (Kerioth for Kiriathaim), whereas the only spelling
// of a rare entity is its name.
export const keepSpelling = ({ count, total }) =>
  count >= 3 ? count / total >= 0.004 : count / total > 0.5;

// A spelling that is another entity's name is often a tagging slip: "David" is 0.8 % of Saul's
// occurrences, whereas Jacob is 12 % of Israel's and Simon 22 % of Peter's.
export const MIN_SHARE_OF_ANOTHER_NAME = 0.08;

// The spans of "Havvoth-jair" can stop at its hyphen, and Jair is not the name of those villages.
export const isCutFromCompound = (spelling, displayNames) => {
  const key = nameKey(spelling);
  return displayNames.some((name) => {
    const parts = normalizeName(name).split(" ");
    return parts.length > 1 && nameKey(name) !== key && parts.some((part) => nameKey(part) === key);
  });
};

// Peter's mother-in-law is told apart by her unique name only: the word that tags her in the text
// is her son-in-law's name, and it must not become hers.
export const isDerivedEntity = (uniqueName) => (uniqueName ?? "").includes("_");

export const buildAliasIndex = ({
  entities,
  spellingsByBible,
  rejectedSpellings = {}
}) => {
  const derived = new Set(
    entities.filter(({ uniqueName }) => isDerivedEntity(uniqueName)).map(({ id }) => id)
  );
  const aliasesByEntity = new Map();
  const entitiesByAlias = new Map();
  const add = (entityId, name, source) => {
    const key = nameKey(name);
    if (key.length < 2) return;
    const aliases = aliasesByEntity.get(entityId) ?? new Map();
    const alias = aliases.get(key) ?? { name, sources: new Set() };
    alias.sources.add(source);
    aliases.set(key, alias);
    aliasesByEntity.set(entityId, aliases);
    const owners = entitiesByAlias.get(key) ?? new Set();
    owners.add(entityId);
    entitiesByAlias.set(key, owners);
  };
  for (const entity of entities) {
    add(entity.id, entity.nameEn, "display-en");
    add(entity.id, entity.nameFr, "display-fr");
  }
  const displayNames = new Map(
    entities.map(({ id, nameEn, nameFr }) => [id, [nameEn, nameFr]])
  );
  const displayOwners = new Map();
  for (const { id, nameEn, nameFr } of entities) {
    for (const key of [nameKey(nameEn), nameKey(nameFr)]) {
      displayOwners.set(key, new Set([...(displayOwners.get(key) ?? []), id]));
    }
  }
  const isOtherName = (entityId, key) =>
    [...(displayOwners.get(key) ?? [])].some((owner) => owner !== entityId);
  const rejected = new Map(
    entities.map(({ id, uniqueName }) => [
      id,
      new Set((rejectedSpellings[uniqueName] ?? []).map(nameKey))
    ])
  );
  for (const [bible, spellings] of Object.entries(spellingsByBible)) {
    for (const [entityId, counts] of spellings) {
      if (derived.has(entityId)) continue;
      const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
      for (const [name, count] of counts) {
        if (!keepSpelling({ count, total })) continue;
        if (isCutFromCompound(name, displayNames.get(entityId))) continue;
        const key = nameKey(name);
        if (rejected.get(entityId)?.has(key)) continue;
        if (isOtherName(entityId, key) && count / total < MIN_SHARE_OF_ANOTHER_NAME) continue;
        add(entityId, name, bible);
      }
    }
  }
  return { aliasesByEntity, entitiesByAlias };
};
