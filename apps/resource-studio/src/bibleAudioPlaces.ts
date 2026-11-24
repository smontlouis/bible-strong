/**
 * Chooses the place painted on the cover of each chapter in the audio player (ADR-0117): among the
 * places of the chapter that have a portrait on the media host, the one named most often in it;
 * on a tie, the one named first; then the best known across the Bible. A short list of chosen
 * chapters overrides the rule.
 */

/** STEPBible's book codes, in the order of the application's book numbers. */
export const STEP_BOOK_CODES = [
  "Gen",
  "Exo",
  "Lev",
  "Num",
  "Deu",
  "Jos",
  "Jdg",
  "Rut",
  "1Sa",
  "2Sa",
  "1Ki",
  "2Ki",
  "1Ch",
  "2Ch",
  "Ezr",
  "Neh",
  "Est",
  "Job",
  "Psa",
  "Pro",
  "Ecc",
  "Sng",
  "Isa",
  "Jer",
  "Lam",
  "Ezk",
  "Dan",
  "Hos",
  "Jol",
  "Amo",
  "Oba",
  "Jon",
  "Mic",
  "Nam",
  "Hab",
  "Zep",
  "Hag",
  "Zec",
  "Mal",
  "Mat",
  "Mrk",
  "Luk",
  "Jhn",
  "Act",
  "Rom",
  "1Co",
  "2Co",
  "Gal",
  "Eph",
  "Php",
  "Col",
  "1Th",
  "2Th",
  "1Ti",
  "2Ti",
  "Tit",
  "Phm",
  "Heb",
  "Jas",
  "1Pe",
  "2Pe",
  "1Jn",
  "2Jn",
  "3Jn",
  "Jud",
  "Rev"
] as const;

const BOOK_NUMBERS = new Map<string, number>(
  STEP_BOOK_CODES.map((code, index) => [code, index + 1])
);
const REFERENCE_PATTERN = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)/;

export type PlaceMention = { book: number; chapter: number; verse: number };

/** The places of TIPNR and where each is named, by unique name (`Eden@Gen.2.8-Jol`). */
export type TipnrPlaces = Map<string, PlaceMention[]>;

/**
 * Reads TIPNR.txt: an entity's head line gives its unique name and its type; each of its name
 * lines (`– Named`, `– LXX addition`…) lists the verses that name it. Deuterocanonical and
 * Septuagint references are left out.
 */
export const parseTipnrPlaces = (text: string): TipnrPlaces => {
  const places = new Set<string>();
  const mentions = new Map<string, PlaceMention[]>();
  for (const line of text.split("\n")) {
    const fields = line.replace(/\r$/, "").split("\t");
    const head = fields[0] ?? "";
    if (!line.startsWith("– ") && head.includes("@") && head.includes("=")) {
      if (fields.some((field) => field.trim() === "Place"))
        places.add(head.split("=")[0]!);
      continue;
    }
    if (!line.startsWith("– ") || fields.length < 6) continue;
    const uniqueName = fields[1]!.split("|").at(-1)!;
    const list = mentions.get(uniqueName) ?? [];
    for (const reference of fields[5]!.split(";")) {
      const match = REFERENCE_PATTERN.exec(reference.trim());
      const book = match ? BOOK_NUMBERS.get(match[1]!) : undefined;
      if (match && book)
        list.push({ book, chapter: Number(match[2]), verse: Number(match[3]) });
    }
    mentions.set(uniqueName, list);
  }
  return new Map([...places].map((name) => [name, mentions.get(name) ?? []]));
};

export const chapterKey = (book: number, chapter: number) =>
  `${book}:${chapter}`;

/**
 * The place of each chapter, by `book:chapter`, among the places that have a portrait. An
 * override names a place for a chapter, or `null` to keep a cover of type alone.
 */
export const chooseChapterPlaces = (
  places: TipnrPlaces,
  painted: ReadonlySet<string>,
  overrides: Record<string, string | null> = {}
): Record<string, string> => {
  const byChapter = new Map<
    string,
    Map<string, { count: number; firstVerse: number }>
  >();
  const fame = new Map<string, number>();
  for (const [name, mentions] of places) {
    if (!painted.has(name)) continue;
    fame.set(name, mentions.length);
    for (const { book, chapter, verse } of mentions) {
      const key = chapterKey(book, chapter);
      const chapterPlaces = byChapter.get(key) ?? new Map();
      const seen = chapterPlaces.get(name);
      chapterPlaces.set(name, {
        count: (seen?.count ?? 0) + 1,
        firstVerse: Math.min(
          seen?.firstVerse ?? Number.POSITIVE_INFINITY,
          verse
        )
      });
      byChapter.set(key, chapterPlaces);
    }
  }

  const chosen: Record<string, string> = {};
  for (const [key, chapterPlaces] of byChapter) {
    const [best] = [...chapterPlaces].sort(
      ([nameA, a], [nameB, b]) =>
        b.count - a.count ||
        a.firstVerse - b.firstVerse ||
        (fame.get(nameB) ?? 0) - (fame.get(nameA) ?? 0) ||
        nameA.localeCompare(nameB)
    );
    if (best) chosen[key] = best[0];
  }
  for (const [key, name] of Object.entries(overrides)) {
    if (name === null) delete chosen[key];
    else if (painted.has(name)) chosen[key] = name;
    else
      throw new Error(
        `BIBLE_AUDIO_PLACE_UNPAINTED: ${key} names ${name}, which has no portrait.`
      );
  }

  const byBookThenChapter = (key: string) =>
    key.split(":").map(Number) as [number, number];
  return Object.fromEntries(
    Object.entries(chosen).sort(([a], [b]) => {
      const [bookA, chapterA] = byBookThenChapter(a);
      const [bookB, chapterB] = byBookThenChapter(b);
      return bookA - bookB || chapterA - chapterB;
    })
  );
};

/** The chapters of each book of the Protestant canon, by book number from 1. */
export const BOOK_CHAPTER_COUNTS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150,
  31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16,
  24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1,
  22
] as const;

/** A timeline event with a painting, and the passages it tells (`1|7:6-12`, `40|2:1`). */
export type TimelineScene = { slug: string; scriptures: string[] };

const SCRIPTURE_PATTERN = /^(\d+)\|(\d+):(\d+)(?:-(\d+))?$/;

/**
 * The scene of each chapter, by `book:chapter`: among the painted timeline events whose passages
 * fall in the chapter, the one that tells most of its verses; on a tie, the one spread over fewer
 * chapters, then the one that starts first. An override names a scene, or `null` for none.
 */
export const chooseChapterScenes = (
  scenes: TimelineScene[],
  overrides: Record<string, string | null> = {}
): Record<string, string> => {
  const byChapter = new Map<
    string,
    Map<string, { verses: number; firstVerse: number }>
  >();
  const spread = new Map<string, number>();
  for (const { slug, scriptures } of scenes) {
    const chapters = new Set<string>();
    for (const scripture of scriptures) {
      const match = SCRIPTURE_PATTERN.exec(scripture);
      if (!match) continue;
      const key = chapterKey(Number(match[1]), Number(match[2]));
      const from = Number(match[3]);
      const to = Number(match[4] ?? match[3]);
      const chapterScenes = byChapter.get(key) ?? new Map();
      const seen = chapterScenes.get(slug);
      chapterScenes.set(slug, {
        verses: (seen?.verses ?? 0) + Math.max(1, to - from + 1),
        firstVerse: Math.min(seen?.firstVerse ?? Number.POSITIVE_INFINITY, from)
      });
      byChapter.set(key, chapterScenes);
      chapters.add(key);
    }
    spread.set(slug, chapters.size);
  }

  const chosen: Record<string, string> = {};
  for (const [key, chapterScenes] of byChapter) {
    const [best] = [...chapterScenes].sort(
      ([slugA, a], [slugB, b]) =>
        b.verses - a.verses ||
        (spread.get(slugA) ?? 0) - (spread.get(slugB) ?? 0) ||
        a.firstVerse - b.firstVerse ||
        slugA.localeCompare(slugB)
    );
    if (best) chosen[key] = best[0];
  }
  const known = new Set(scenes.map((scene) => scene.slug));
  for (const [key, slug] of Object.entries(overrides)) {
    if (slug === null) delete chosen[key];
    else if (known.has(slug)) chosen[key] = slug;
    else
      throw new Error(
        `BIBLE_AUDIO_SCENE_UNPAINTED: ${key} names ${slug}, which has no painting.`
      );
  }
  return sortChapters(chosen);
};

const sortChapters = (chapters: Record<string, string>) => {
  const parts = (key: string) => key.split(":").map(Number) as [number, number];
  return Object.fromEntries(
    Object.entries(chapters).sort(([a], [b]) => {
      const [bookA, chapterA] = parts(a);
      const [bookB, chapterB] = parts(b);
      return bookA - bookB || chapterA - chapterB;
    })
  );
};

/** How far a chapter with no picture of its own may borrow one from its book. */
export const NEIGHBOUR_REACH = 3;

/**
 * Gives a chapter with neither scene nor place the picture of the nearest chapter of its book
 * that has one, within `NEIGHBOUR_REACH` chapters, the earlier one first on a tie.
 */
export const borrowNeighbourPictures = (
  scenes: Record<string, string>,
  places: Record<string, string>
): {
  scenes: Record<string, string>;
  places: Record<string, string>;
  borrowed: number;
} => {
  const filledScenes = { ...scenes };
  const filledPlaces = { ...places };
  let borrowed = 0;
  BOOK_CHAPTER_COUNTS.forEach((count, index) => {
    const book = index + 1;
    for (let chapter = 1; chapter <= count; chapter++) {
      const key = chapterKey(book, chapter);
      if (scenes[key] || places[key]) continue;
      for (let distance = 1; distance <= NEIGHBOUR_REACH; distance++) {
        const neighbour = [chapter - distance, chapter + distance]
          .filter((other) => other >= 1 && other <= count)
          .map((other) => chapterKey(book, other))
          .find((other) => scenes[other] || places[other]);
        if (!neighbour) continue;
        if (scenes[neighbour]) filledScenes[key] = scenes[neighbour]!;
        else filledPlaces[key] = places[neighbour]!;
        borrowed++;
        break;
      }
    }
  });
  return {
    scenes: sortChapters(filledScenes),
    places: sortChapters(filledPlaces),
    borrowed
  };
};
