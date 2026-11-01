import { cleanSurface, nameKey, normalizeName } from "./entity-aliases.mjs";

// A French title takes the spelling of the French Bible, read in the subject's own verses: the
// Strong number of the English word leads to the word of the Louis Segond. The entity's name would
// be wrong for a people: "Canaanites" is "Cananéens", not "Canaan".
export const proposeBibleTitle = ({
  names,
  verses,
  englishSpans,
  frenchSpans
}) => {
  const keys = new Set(names.map(nameKey));
  const strongs = new Set();
  for (const verseKey of verses) {
    for (const span of englishSpans.get(verseKey) ?? []) {
      const spelled =
        keys.has(span.fullKey) || [...span.keys].some((key) => keys.has(key));
      if (spelled && span.strong) strongs.add(span.strong);
    }
  }
  if (strongs.size === 0) return null;
  const counts = new Map();
  for (const verseKey of verses) {
    for (const span of frenchSpans.get(verseKey) ?? []) {
      if (!strongs.has(span.strong)) continue;
      const name = cleanSurface(span.surface);
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  if (ranked.length === 0) return null;
  const total = ranked.reduce((sum, [, count]) => sum + count, 0);
  const [title, count] = ranked[0];
  return count / total >= 0.5 ? title : null;
};

const skeleton = (name) =>
  normalizeName(name)
    .replace(/[' ]/g, "")
    .replace(/sch|sh/g, "s")
    .replace(/ch|c|q|k/g, "k")
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/ts|tz/g, "z")
    .replace(/gu/g, "g")
    .replace(/w/g, "v")
    .replace(/[aeiouyjh]/g, "");

const similarity = (left, right) => {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
      previous = current;
    }
  }
  return 1 - row[right.length] / Math.max(left.length, right.length, 1);
};

const PEOPLE_ENDING = /(?:ites?|ians?|eans?|ims?|iens?|éens?|ains?)$/i;

// The verses of a topic hold several names, so the word found must still be this one: Oded is not
// Obed, Beno is not "Fils", Ramoth-Gilead is not Ramoth and a Shilonite is not Silo.
export const isSameName = (english, french) => {
  const compound = (name) => normalizeName(name).split(" ").length;
  if (compound(english) !== compound(french)) return false;
  if (PEOPLE_ENDING.test(english) && !PEOPLE_ENDING.test(french)) return false;
  return similarity(skeleton(english), skeleton(french)) >= 0.6;
};

// The spans of a compound name can stop at its hyphen, and a name can look like a sentence word.
export const chooseTopicTitle = ({ topic, entities, biblical }) => {
  const continued = /^(.+?)\s+continued\.*$/i.exec(topic.nameEn);
  if (continued) {
    const [entity] = entities;
    return entity ? `${entity.nameFr} (suite)` : null;
  }
  const same = entities.find(
    (entity) => nameKey(entity.nameEn) === nameKey(topic.nameEn)
  );
  if (!biblical) return same?.nameFr ?? null;
  const longer = entities.find(({ nameFr }) => {
    const key = nameKey(nameFr);
    return key !== nameKey(biblical) && key.startsWith(nameKey(biblical));
  });
  const title = longer?.nameFr ?? biblical;
  return isSameName(topic.nameEn, title) ? title : (same?.nameFr ?? null);
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const replaceNames = (title, replacements) =>
  replacements.reduce(
    (current, { from, to }) =>
      current.replace(
        new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(from)}(?![\\p{L}\\p{N}])`, "gu"),
        to
      ),
    title
  );
