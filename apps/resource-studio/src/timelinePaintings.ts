import { createHash } from "node:crypto";

/** The public media bucket, served at https://media.bible-strong.app (ADR-0080, ADR-0096). */
export const TIMELINE_PAINTING_BUCKET = "bible-strong-media-prod";
export const TIMELINE_PAINTING_HOST = "https://media.bible-strong.app";

/** The folder of the paintings in that bucket. */
export const TIMELINE_PAINTING_KEY_PREFIX = "timeline-paintings";

/**
 * Widths a painting is served at. 256 fills the drawn timeline and the search; 768 a card or the
 * head of an event; 1254, the original's width, the pictures of an event.
 */
export const TIMELINE_PAINTING_WIDTHS = [256, 768, 1254] as const;
export type TimelinePaintingWidth = (typeof TIMELINE_PAINTING_WIDTHS)[number];

export const TIMELINE_PAINTING_QUALITY = 80;

/** The share image (ADR-0081) is drawn by a renderer that reads JPEG, not WebP. */
export const TIMELINE_PAINTING_SHARE_WIDTH = 768;
export const TIMELINE_PAINTING_JPEG_QUALITY = 82;

/** The periods the application bundles and the public site serves, as `period-<n>.jpg`. */
export const TIMELINE_PERIOD_COUNT = 13;
export const TIMELINE_PERIOD_WIDTH = 768;

/**
 * Part of every painting's hash: changing how copies are made gives them new addresses, so no
 * device keeps a copy made the old way.
 */
export const TIMELINE_PAINTING_BUILD_SETTINGS = `webp-q${TIMELINE_PAINTING_QUALITY}-jpeg-q${TIMELINE_PAINTING_JPEG_QUALITY}-v1`;

export const TIMELINE_PAINTING_CATALOG_KEY = `${TIMELINE_PAINTING_KEY_PREFIX}/catalog.json`;

/** A short hash of the original's bytes and of the build settings. */
export const timelinePaintingHash = (original: Uint8Array): string =>
  createHash("sha256")
    .update(TIMELINE_PAINTING_BUILD_SETTINGS)
    .update(original)
    .digest("hex")
    .slice(0, 12);

export const timelinePaintingKey = (
  slug: string,
  hash: string,
  width: TimelinePaintingWidth
): string => `${TIMELINE_PAINTING_KEY_PREFIX}/${slug}/${hash}/w${width}.webp`;

export const timelinePaintingUrl = (
  slug: string,
  hash: string,
  width: TimelinePaintingWidth
): string =>
  `${TIMELINE_PAINTING_HOST}/${timelinePaintingKey(slug, hash, width)}`;

export const timelinePaintingShareKey = (slug: string, hash: string): string =>
  `${TIMELINE_PAINTING_KEY_PREFIX}/${slug}/${hash}/w${TIMELINE_PAINTING_SHARE_WIDTH}.jpg`;

export const timelinePaintingShareUrl = (slug: string, hash: string): string =>
  `${TIMELINE_PAINTING_HOST}/${timelinePaintingShareKey(slug, hash)}`;

/** Everything a reader's device knows of the paintings (ADR-0096), published as catalog.json. */
export type TimelinePaintingCatalog = {
  version: 1;
  events: Record<string, { hash: string; documents?: string[] }>;
};

/** The whole published set: an event left out of a selection keeps the publication's pictures. */
export type TimelinePaintingSelection = {
  events: { slug: string; source: string; documents: string[] }[];
  periods: { number: number; source: string }[];
};

// A slug becomes a folder of the bucket.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PERIOD_NAME = /^period:([1-9][0-9]*)$/u;

export const parseTimelinePaintingSelection = (
  value: unknown
): TimelinePaintingSelection => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("TIMELINE_PAINTING_SELECTION_NOT_AN_OBJECT");
  const selection: TimelinePaintingSelection = { events: [], periods: [] };
  for (const [name, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error(`TIMELINE_PAINTING_SELECTION_ENTRY_INVALID: ${name}`);
    const { source, documents = [] } = entry as {
      source?: unknown;
      documents?: unknown;
    };
    if (typeof source !== "string" || !source)
      throw new Error(`TIMELINE_PAINTING_SELECTION_SOURCE_MISSING: ${name}`);
    const period = PERIOD_NAME.exec(name);
    if (period) {
      const number = Number(period[1]);
      if (number > TIMELINE_PERIOD_COUNT)
        throw new Error(`TIMELINE_PAINTING_SELECTION_UNKNOWN_PERIOD: ${name}`);
      selection.periods.push({ number, source });
    } else if (!SLUG_PATTERN.test(name)) {
      throw new Error(`TIMELINE_PAINTING_SELECTION_INVALID_NAME: ${name}`);
    } else {
      if (
        !Array.isArray(documents) ||
        !documents.every(
          (file): file is string => typeof file === "string" && !!file
        )
      )
        throw new Error(
          `TIMELINE_PAINTING_SELECTION_DOCUMENTS_INVALID: ${name}`
        );
      selection.events.push({ slug: name, source, documents });
    }
  }
  return selection;
};

/** Periods the application bundles and the selection does not give. */
export const missingPeriods = (
  periods: TimelinePaintingSelection["periods"]
): number[] => {
  const given = new Set(periods.map((period) => period.number));
  return Array.from(
    { length: TIMELINE_PERIOD_COUNT },
    (_, index) => index + 1
  ).filter((number) => !given.has(number));
};

/** The catalog of the built paintings, in a stable order; an event without documents names none. */
export const timelinePaintingCatalog = (
  built: { slug: string; hash: string; documents: string[] }[]
): TimelinePaintingCatalog => ({
  version: 1,
  events: Object.fromEntries(
    [...built]
      .sort((a, b) => (a.slug < b.slug ? -1 : 1))
      .map(({ slug, hash, documents }) => [
        slug,
        { hash, ...(documents.length ? { documents } : {}) }
      ])
  )
});
