import { createHash } from "node:crypto";

/** The public media bucket, served at https://media.bible-strong.app (ADR-0080, ADR-0089). */
export const ENTITY_IMAGE_BUCKET = "bible-strong-media-prod";
export const ENTITY_IMAGE_HOST = "https://media.bible-strong.app";

/** The folder of the portraits in that bucket. */
export const ENTITY_IMAGE_KEY_PREFIX = "entity-images";

/**
 * Widths a portrait is served at. 256 fills every avatar (76 points at 3x is 228 pixels); 768 an
 * enlarged portrait or a card; 1254, the original's width, a place behind a page or a tablet card.
 */
export const ENTITY_IMAGE_WIDTHS = [256, 768, 1254] as const;
export type EntityImageWidth = (typeof ENTITY_IMAGE_WIDTHS)[number];

/** The width of the placeholders bundled in the application. */
export const ENTITY_PLACEHOLDER_WIDTH = 256;
export const ENTITY_IMAGE_QUALITY = 80;

/**
 * Part of every portrait's hash: changing how copies are made gives them new addresses, so no
 * device keeps a copy made the old way.
 */
export const ENTITY_IMAGE_BUILD_SETTINGS = `webp-q${ENTITY_IMAGE_QUALITY}-square-v1`;

/**
 * The avatar keys of the application (`strongEntityPresentation.ts`) and how many placeholders each
 * has: five for people and groups, so that neighbours in a chapter differ, one for the others.
 */
export const ENTITY_PLACEHOLDER_COUNTS = {
  male: 5,
  female: 5,
  group: 5,
  place: 1,
  supernatural: 1,
  time: 1,
  musical: 1,
  other: 1,
  title: 1,
  language: 1,
  star: 1
} as const;
export type EntityPlaceholderKey = keyof typeof ENTITY_PLACEHOLDER_COUNTS;
export const ENTITY_PLACEHOLDER_KEYS = Object.keys(
  ENTITY_PLACEHOLDER_COUNTS
) as EntityPlaceholderKey[];

const PLACEHOLDER_NAME = /^placeholder:([a-z]+):([1-9])$/u;

/** `placeholder:<avatarKey>:<n>` names a placeholder in a selection, not an entity. */
export const parsePlaceholderName = (
  name: string
): { key: EntityPlaceholderKey; index: number } | undefined => {
  const match = PLACEHOLDER_NAME.exec(name);
  if (!match) return undefined;
  const key = match[1] as EntityPlaceholderKey;
  const index = Number(match[2]);
  if (!ENTITY_PLACEHOLDER_KEYS.includes(key)) return undefined;
  if (index > ENTITY_PLACEHOLDER_COUNTS[key]) return undefined;
  return { key, index };
};

/** The bundled file of a placeholder, as `strongEntityAvatars.ts` requires it. */
export const entityPlaceholderFile = (
  key: EntityPlaceholderKey,
  index: number
): string => `${key}-${index}.webp`;

/** A short hash of the original's bytes and of the build settings. */
export const entityImageHash = (original: Uint8Array): string =>
  createHash("sha256")
    .update(ENTITY_IMAGE_BUILD_SETTINGS)
    .update(original)
    .digest("hex")
    .slice(0, 12);

export const entityImageKey = (
  uniqueName: string,
  hash: string,
  width: EntityImageWidth
): string => `${ENTITY_IMAGE_KEY_PREFIX}/${uniqueName}/${hash}/w${width}.webp`;

/** The address percent-encodes the unique name: some carry an apostrophe, all an at sign. */
export const entityImageUrl = (
  uniqueName: string,
  hash: string,
  width: EntityImageWidth
): string =>
  `${ENTITY_IMAGE_HOST}/${ENTITY_IMAGE_KEY_PREFIX}/${encodeURIComponent(uniqueName)}/${hash}/w${width}.webp`;

export const ENTITY_IMAGE_CATALOG_KEY = `${ENTITY_IMAGE_KEY_PREFIX}/catalog.json`;

/** Chapters as the application numbers books (1 to 66); verses only when two pictures share a chapter. */
export type EntityChapterRange = {
  book: number;
  from: number;
  to: number;
  fromVerse?: number;
  toVerse?: number;
};

/** Every text the application shows, in each of its languages. */
export const ENTITY_CATALOG_LANGUAGES = ["fr", "en"] as const;
export type EntityCatalogText = Record<
  (typeof ENTITY_CATALOG_LANGUAGES)[number],
  string
>;

/** What the portraits' working folder says beside the pictures: titles, stages, series and roles. */
export type EntityCatalogData = {
  entities: Record<
    string,
    {
      title?: EntityCatalogText;
      /** "Manifestations" for God; life stages otherwise. */
      stagesLabel?: EntityCatalogText;
      roles?: string[];
      stages?: {
        key: string;
        label: EntityCatalogText;
        ranges: EntityChapterRange[];
      }[];
    }
  >;
  series: { id: string; title: EntityCatalogText; members: string[] }[];
  roles: Record<string, EntityCatalogText>;
};

/** Everything the application knows of the portraits (ADR-0089), published as catalog.json. */
export type EntityImageCatalog = {
  version: 3;
  entities: Record<
    string,
    {
      hash: string;
      title?: EntityCatalogText;
      stagesLabel?: EntityCatalogText;
      roles?: string[];
      stages?: {
        key: string;
        label: EntityCatalogText;
        hash: string;
        ranges: EntityChapterRange[];
      }[];
    }
  >;
  series: EntityCatalogData["series"];
  roles: EntityCatalogData["roles"];
};

const sortedKeys = <T>(record: Record<string, T>): Record<string, T> =>
  Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );

const isRange = (range: EntityChapterRange): boolean =>
  Number.isInteger(range.book) &&
  range.book >= 1 &&
  range.book <= 66 &&
  Number.isInteger(range.from) &&
  Number.isInteger(range.to) &&
  range.from >= 1 &&
  range.to >= range.from &&
  (range.fromVerse === undefined) === (range.toVerse === undefined) &&
  (range.fromVerse === undefined ||
    (range.from === range.to && range.fromVerse <= (range.toVerse as number)));

const isText = (text: unknown): text is EntityCatalogText =>
  !!text &&
  typeof text === "object" &&
  ENTITY_CATALOG_LANGUAGES.every((language) => {
    const value = (text as Record<string, unknown>)[language];
    return typeof value === "string" && value.trim() !== "";
  });

/** The texts of the data file, each of which must exist in every language. */
const catalogTexts = (data: EntityCatalogData) => [
  ...Object.entries(data.entities).flatMap(([uniqueName, entity]) => [
    ...(entity.title ? [[uniqueName, entity.title] as const] : []),
    ...(entity.stagesLabel ? [[uniqueName, entity.stagesLabel] as const] : []),
    ...(entity.stages ?? []).map(
      (stage) => [`${uniqueName}#${stage.key}`, stage.label] as const
    )
  ]),
  ...data.series.map((series) => [series.id, series.title] as const),
  ...Object.entries(data.roles)
];

/** The verses of a chapter a range covers: every verse, or a span of them. */
const coveredSpans = (ranges: EntityChapterRange[]) =>
  ranges.flatMap((range) =>
    Array.from({ length: range.to - range.from + 1 }, (_, index) => ({
      chapter: `${range.book}.${range.from + index}`,
      from: range.fromVerse ?? 0,
      to: range.toVerse ?? Number.MAX_SAFE_INTEGER
    }))
  );

/**
 * Joins the hashes of the built pictures to the working folder's data. Every stage needs its
 * picture and every stage picture its data; no two stages of one entity share a verse; every text
 * exists in French and English.
 */
export const entityImageCatalog = (
  hashes: { uniqueName: string; stage?: string; hash: string }[],
  data: EntityCatalogData
): EntityImageCatalog => {
  for (const [owner, text] of catalogTexts(data))
    if (!isText(text)) throw new Error(`ENTITY_CATALOG_TEXT_MISSING: ${owner}`);
  const portraits = new Map<string, string>();
  const stageHashes = new Map<string, string>();
  for (const { uniqueName, stage, hash } of hashes) {
    if (stage) stageHashes.set(`${uniqueName}#${stage}`, hash);
    else portraits.set(uniqueName, hash);
  }
  const entities: EntityImageCatalog["entities"] = {};
  for (const [uniqueName, hash] of portraits) {
    const info = data.entities[uniqueName] ?? {};
    const stages = (info.stages ?? []).map((stage) => {
      const name = `${uniqueName}#${stage.key}`;
      const stageHash = stageHashes.get(name);
      if (!stageHash)
        throw new Error(`ENTITY_CATALOG_STAGE_PICTURE_MISSING: ${name}`);
      if (!stage.ranges.length || !stage.ranges.every(isRange))
        throw new Error(`ENTITY_CATALOG_STAGE_RANGES_INVALID: ${name}`);
      stageHashes.delete(name);
      return {
        key: stage.key,
        label: stage.label,
        hash: stageHash,
        ranges: stage.ranges
      };
    });
    const spans = coveredSpans(stages.flatMap((stage) => stage.ranges));
    for (const [index, span] of spans.entries()) {
      if (
        spans
          .slice(index + 1)
          .some(
            (other) =>
              other.chapter === span.chapter &&
              other.from <= span.to &&
              span.from <= other.to
          )
      )
        throw new Error(
          `ENTITY_CATALOG_STAGES_OVERLAP: ${uniqueName} ${span.chapter}`
        );
    }
    entities[uniqueName] = {
      hash,
      ...(info.title ? { title: info.title } : {}),
      ...(info.stagesLabel ? { stagesLabel: info.stagesLabel } : {}),
      ...(info.roles?.length ? { roles: info.roles } : {}),
      ...(stages.length ? { stages } : {})
    };
  }
  const orphan = [...stageHashes.keys()][0];
  if (orphan) throw new Error(`ENTITY_CATALOG_STAGE_WITHOUT_DATA: ${orphan}`);
  for (const role of Object.values(entities).flatMap(
    (entity) => entity.roles ?? []
  ))
    if (!data.roles[role])
      throw new Error(`ENTITY_CATALOG_ROLE_UNKNOWN: ${role}`);
  return {
    version: 3,
    entities: sortedKeys(entities),
    series: data.series,
    roles: data.roles
  };
};

/**
 * A selection maps each unique name, or placeholder name, to its original. The file is the whole
 * published set: an entity left out of it loses its portrait.
 */
export type EntityImageSelection = {
  /** A portrait, or with `stage` one of the entity's stages (`<uniqueName>#<stage>`). */
  portraits: { uniqueName: string; stage?: string; source: string }[];
  placeholders: { key: EntityPlaceholderKey; index: number; source: string }[];
};

export const parseEntityImageSelection = (
  value: unknown
): EntityImageSelection => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("ENTITY_IMAGE_SELECTION_NOT_AN_OBJECT");
  const selection: EntityImageSelection = { portraits: [], placeholders: [] };
  for (const [name, source] of Object.entries(value)) {
    if (typeof source !== "string" || !source)
      throw new Error(`ENTITY_IMAGE_SELECTION_SOURCE_MISSING: ${name}`);
    if (name.startsWith("placeholder:")) {
      const placeholder = parsePlaceholderName(name);
      if (!placeholder)
        throw new Error(`ENTITY_IMAGE_SELECTION_UNKNOWN_PLACEHOLDER: ${name}`);
      selection.placeholders.push({ ...placeholder, source });
    } else if (/[/\\]/u.test(name) || !name.trim()) {
      // A unique name becomes a folder of the bucket.
      throw new Error(`ENTITY_IMAGE_SELECTION_INVALID_NAME: ${name}`);
    } else {
      const [uniqueName, stage, ...rest] = name.split("#");
      if (rest.length || stage === "" || !/^[a-z0-9-]*$/u.test(stage ?? ""))
        throw new Error(`ENTITY_IMAGE_SELECTION_INVALID_NAME: ${name}`);
      selection.portraits.push(
        stage ? { uniqueName, stage, source } : { uniqueName, source }
      );
    }
  }
  return selection;
};

/** Placeholders the application requires and the selection does not give. */
export const missingPlaceholders = (
  placeholders: EntityImageSelection["placeholders"]
): string[] => {
  const given = new Set(
    placeholders.map((placeholder) =>
      entityPlaceholderFile(placeholder.key, placeholder.index)
    )
  );
  return ENTITY_PLACEHOLDER_KEYS.flatMap((key) =>
    Array.from({ length: ENTITY_PLACEHOLDER_COUNTS[key] }, (_, index) =>
      entityPlaceholderFile(key, index + 1)
    )
  ).filter((file) => !given.has(file));
};

/** The centred square of a picture, which every avatar shows in a circle. */
export const centredSquare = (
  width: number,
  height: number
): { x: number; y: number; side: number } => {
  const side = Math.min(width, height);
  return {
    x: Math.floor((width - side) / 2),
    y: Math.floor((height - side) / 2),
    side
  };
};
