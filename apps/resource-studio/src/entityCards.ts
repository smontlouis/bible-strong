import { createHash } from "node:crypto";

import { ENTITY_IMAGE_HOST, type EntityImageCatalog } from "./entityImages.js";

/**
 * The catalog of the character cards (ADR-0090), published next to the portraits' catalog in the
 * media bucket, with the backdrops the cards stand on. A card names its portrait by its identity,
 * never by a hash: the application finds the picture in the portraits' catalog it already reads.
 */

export const ENTITY_CARD_KEY_PREFIX = "entity-cards";
export const ENTITY_CARD_CATALOG_KEY = `${ENTITY_CARD_KEY_PREFIX}/catalog.json`;

/** A backdrop is served at the width of an enlarged card, in the 2:3 of its painting. */
export const ENTITY_BACKDROP_WIDTH = 768;
/** And at the width of a card in a grid of cards, under the same hash. */
export const ENTITY_BACKDROP_GRID_WIDTH = 384;
export const ENTITY_BACKDROP_WIDTHS = [
  ENTITY_BACKDROP_WIDTH,
  ENTITY_BACKDROP_GRID_WIDTH
] as const;
export const ENTITY_BACKDROP_QUALITY = 80;
/** Part of every backdrop's hash, as for the portraits: a new way of copying gives new addresses. */
export const ENTITY_BACKDROP_BUILD_SETTINGS = `webp-q${ENTITY_BACKDROP_QUALITY}-w${ENTITY_BACKDROP_WIDTH}-v1`;

/** A card's sentence fits four lines of its parchment. */
export const ENTITY_CARD_LINE_MAX = 120;

const FAMILIES = ["divine", "human", "spirit", "idol"] as const;
const LINE_KINDS = ["citation", "paraphrase", "verset"] as const;
const LANGUAGES = ["fr", "en"] as const;

export type EntityCardFamily = (typeof FAMILIES)[number];
export type EntityCardLanguage = (typeof LANGUAGES)[number];
type Both = Record<EntityCardLanguage, string>;

export type EntityCardText = {
  name: string;
  fullName: string;
  title: string;
  chaptersLabel: string;
  era: string;
  roles: string[];
  series: string[];
  meaning: string;
  firstMention: string;
  brief: string;
  typeLine: string;
};

/** A card as the portraits' working folder writes it (portraits/cards/catalog.json). */
export type SourceEntityCard = {
  id: string;
  entity: string;
  stage: string | null;
  image: string;
  scene: boolean;
  backdrop: string | null;
  fadeTop: boolean;
  family: string;
  era: string;
  series: { title: string; rank: number; total: number }[];
  original: string;
  script: string;
  transliteration: string;
  strong: string;
  strongs: EntityCardStrong[];
  chapterCount: number;
  stageIndex: number;
  stageCount: number;
  text: Record<EntityCardLanguage, EntityCardText>;
  line: {
    kind: string;
    fr: string;
    en: string;
    ref: string;
    refEn: string;
    reference: Both;
    speaker: Both | null;
    source: Both;
    reviewed: boolean;
  } | null;
};

/** A published card: its texts in both languages, its sentence, its backdrop and how it is drawn. */
export type EntityCard = {
  id: string;
  entity: string;
  stage: string | null;
  family: EntityCardFamily;
  /** The portrait's era, in French: a key to sort by, shown through `text.<language>.era`. */
  era: string;
  /** A whole painting (God's cards): no backdrop, no fade. */
  scene: boolean;
  /** A key of `backdrops`; null for a scene. */
  backdrop: string | null;
  /** The painting cut the person at the top: the card fades that edge into its shade. */
  fadeTop: boolean;
  stageIndex: number;
  stageCount: number;
  chapterCount: number;
  strong: string;
  /** Every Strong number of the character's names, `strong` first: David is H1732 and G1138. */
  strongs: EntityCardStrong[];
  original: string;
  script: string;
  transliteration: string;
  /** Rank and size of each series, in the order of `text.<language>.series`. */
  series: { rank: number; total: number }[];
  text: Record<EntityCardLanguage, EntityCardText>;
  line: {
    kind: (typeof LINE_KINDS)[number];
    text: Both;
    /** LSG and BSB references (they differ where the LSG follows the Hebrew numbering). */
    ref: string;
    refEn: string;
    reference: Both;
    speaker: Both | null;
    /** What the card prints under the sentence: speaker, « d’après », reference. */
    source: Both;
  };
};

/** A Strong number of a character, with the name it stands for and the script of that name. */
export type EntityCardStrong = {
  code: string;
  original: string;
  script: string;
};

export type EntityCardCatalog = {
  version: 1;
  cards: EntityCard[];
  backdrops: Record<string, { hash: string }>;
};

/** A short hash of the backdrop painting's bytes and of the build settings. */
export const entityBackdropHash = (original: Uint8Array): string =>
  createHash("sha256")
    .update(ENTITY_BACKDROP_BUILD_SETTINGS)
    .update(original)
    .digest("hex")
    .slice(0, 12);

export const entityBackdropKey = (
  key: string,
  hash: string,
  width: number = ENTITY_BACKDROP_WIDTH
): string =>
  `${ENTITY_CARD_KEY_PREFIX}/backdrops/${key}/${hash}/w${width}.webp`;

export const entityBackdropUrl = (
  key: string,
  hash: string,
  width: number = ENTITY_BACKDROP_WIDTH
): string => `${ENTITY_IMAGE_HOST}/${entityBackdropKey(key, hash, width)}`;

/** The backdrop keys the cards name, each once. */
export const backdropsNamed = (cards: SourceEntityCard[]): string[] =>
  [
    ...new Set(cards.flatMap((card) => (card.backdrop ? [card.backdrop] : [])))
  ].sort();

const filled = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Checks every card and returns the catalog to publish, or throws with every problem found: a card
 * is published only with a reviewed sentence, both languages, a portrait the media host serves and
 * a painted backdrop.
 */
export const entityCardCatalog = (
  cards: SourceEntityCard[],
  portraits: EntityImageCatalog,
  backdropHashes: Record<string, string>
): EntityCardCatalog => {
  const problems: string[] = [];
  const seen = new Set<string>();
  const published: EntityCard[] = [];

  for (const card of cards) {
    const where = card.id;
    const before = problems.length;
    if (seen.has(card.id)) problems.push(`${where}: twice in the catalog`);
    seen.add(card.id);
    const expectedId = card.stage
      ? `${card.entity}~${card.stage}`
      : card.entity;
    if (card.id !== expectedId)
      problems.push(`${where}: identity is not ${expectedId}`);

    const portrait = portraits.entities[card.entity];
    if (!portrait) problems.push(`${where}: no portrait on the media host`);
    else if (
      card.stage &&
      !portrait.stages?.some((stage) => stage.key === card.stage)
    )
      problems.push(`${where}: no portrait of the stage ${card.stage}`);

    if (!FAMILIES.includes(card.family as EntityCardFamily))
      problems.push(`${where}: unknown family ${card.family}`);

    if (card.scene) {
      if (card.backdrop) problems.push(`${where}: a scene has no backdrop`);
    } else if (!card.backdrop) problems.push(`${where}: no backdrop`);
    else if (!backdropHashes[card.backdrop])
      problems.push(`${where}: backdrop ${card.backdrop} is not painted`);

    for (const language of LANGUAGES) {
      const text = card.text?.[language];
      for (const field of ["name", "title", "typeLine"] as const)
        if (!filled(text?.[field]))
          problems.push(`${where}: no ${language} ${field}`);
    }

    const line = card.line;
    if (!line) problems.push(`${where}: no sentence`);
    else {
      if (!line.reviewed) problems.push(`${where}: sentence not reviewed`);
      if (!LINE_KINDS.includes(line.kind as EntityCard["line"]["kind"]))
        problems.push(`${where}: unknown sentence kind ${line.kind}`);
      for (const language of LANGUAGES) {
        if (!filled(line[language]))
          problems.push(`${where}: no ${language} sentence`);
        else if (line[language].length > ENTITY_CARD_LINE_MAX)
          problems.push(
            `${where}: ${language} sentence is ${line[language].length} characters (> ${ENTITY_CARD_LINE_MAX})`
          );
        if (!filled(line.source?.[language]))
          problems.push(`${where}: no ${language} source`);
      }
    }
    if (problems.length > before || !line) continue;

    published.push({
      id: card.id,
      entity: card.entity,
      stage: card.stage,
      family: card.family as EntityCardFamily,
      era: card.era,
      scene: card.scene,
      backdrop: card.scene ? null : card.backdrop,
      fadeTop: card.fadeTop,
      stageIndex: card.stageIndex,
      stageCount: card.stageCount,
      chapterCount: card.chapterCount,
      strong: card.strong,
      strongs: card.strongs,
      original: card.original,
      script: card.script,
      transliteration: card.transliteration,
      series: card.series.map(({ rank, total }) => ({ rank, total })),
      text: card.text,
      line: {
        kind: line.kind as EntityCard["line"]["kind"],
        text: { fr: line.fr, en: line.en },
        ref: line.ref,
        refEn: line.refEn,
        reference: line.reference,
        speaker: line.speaker,
        source: line.source
      }
    });
  }

  if (problems.length > 0)
    throw new Error(
      `ENTITY_CARDS_INVALID: ${problems.length} problems, nothing written.\n${problems.slice(0, 40).join("\n")}`
    );

  const backdrops = Object.fromEntries(
    backdropsNamed(cards).map((key) => [key, { hash: backdropHashes[key] }])
  );
  return { version: 1, cards: published, backdrops };
};
