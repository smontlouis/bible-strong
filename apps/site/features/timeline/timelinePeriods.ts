import type { ResourceLanguage } from '../resources/publicSite'
import {
  buildTimelineBands,
  timelinePeriodScales,
  timelineWidth,
  type TimelineBand,
} from './timelineGeometry'

type Localized = Record<ResourceLanguage, string>

export type TimelinePeriod = {
  /** The `period` an event of the publication is filed under. */
  id: string
  /**
   * The stretch of the timeline the period is drawn on. Each period has its own scale: a
   * tick of the ruler, a hundred pixels apart, stands for this many years.
   */
  startYear: number
  endYear: number
  yearsPerTick: number
  /** Years of the period drawn at a finer scale, because they hold many events. */
  detail?: { startYear: number; endYear: number; yearsPerTick: number }
  /** The age the period belongs to; three ages cover the thirteen periods. */
  era: Localized
  title: Localized
  /** The years the period is named after, when it has a place in time. */
  span?: Localized
  summary: Localized
  /** The colour of the period on the timeline of the study workspace; decoration only. */
  color: string
}

const PATRIARCHS: Localized = { fr: 'L’ère des patriarches', en: 'Age of Patriarchs' }
const ISRAEL: Localized = { fr: 'L’ère d’Israël', en: 'Age of Israel' }
const CHRIST: Localized = { fr: 'L’ère de Christ', en: 'Age of Christ' }

// The Timeline publication only names the period of an event by its number. Names, spans
// and summaries mirror the timeline bundled with the study workspace
// (apps/expo/src/assets/timeline/events.txt), in the order of the periods. Scales start
// from the workspace's and are finer where its events would otherwise pile up: the site
// draws the whole timeline at once and keeps it close to its axis.
export const TIMELINE_PERIODS: readonly TimelinePeriod[] = [
  {
    id: '1',
    startYear: -4100,
    endYear: -2900,
    yearsPerTick: 100,
    era: PATRIARCHS,
    title: { fr: 'Première génération', en: 'First Generation' },
    span: { fr: 'Création – v. 2500 av. J.-C.', en: 'Creation – c. 2500 BC' },
    summary: {
      fr: 'De la création d’Adam et Ève, au meurtre d’Abel par Caïn, et à l’histoire de l’humanité avant le déluge.',
      en: 'From the creation of Adam and Eve, to the murder of Abel by Cain, and human history before the flood.',
    },
    color: '#ad1f26',
  },
  {
    id: '2',
    startYear: -2900,
    endYear: -1950,
    yearsPerTick: 25,
    era: PATRIARCHS,
    title: { fr: 'Noé et le déluge', en: 'Noah & the Flood' },
    span: { fr: 'v. 2500 – v. 2166 av. J.-C.', en: 'c. 2500 – c. 2166 BC' },
    summary: {
      fr: 'Du ministère de Noé et du déluge mondial à Cush, Nimrod et la tour de Babel.',
      en: 'From the ministry of Noah and the global deluge, to Cush, Nimrod, and the tower of Babel.',
    },
    color: '#db2f2c',
  },
  {
    id: '3',
    startYear: -1950,
    endYear: -1650,
    yearsPerTick: 5,
    era: PATRIARCHS,
    title: { fr: 'Les patriarches', en: 'The Patriarchs' },
    span: { fr: 'v. 2166 – v. 1660 av. J.-C.', en: 'c. 2166 – c. 1660 BC' },
    summary: {
      fr: 'De l’appel d’Abraham, à Sodome et Gomorrhe, à l’ascension des 12 tribus juives en passant par Isaac et Jacob.',
      en: 'From the call of Abraham, to Sodom and Gomorrah, and the rise of the 12 Jewish tribes through Isaac and Jacob.',
    },
    color: '#bb3380',
  },
  {
    id: '4',
    startYear: -1650,
    endYear: -1450,
    yearsPerTick: 25,
    era: ISRAEL,
    title: { fr: 'Israël en Égypte', en: 'Israel in Egypt' },
    span: { fr: 'v. 1660 – v. 1445 av. J.-C.', en: 'c. 1660 – c. 1445 BC' },
    summary: {
      fr: 'De la vente de Joseph en esclavage, à sa montée en puissance en Égypte, en passant par Moïse et l’Exode.',
      en: 'From Joseph being sold into slavery, his rise to power in Egypt, and to Moses and the Exodus.',
    },
    color: '#903a95',
  },
  {
    id: '5',
    startYear: -1450,
    endYear: -1100,
    yearsPerTick: 10,
    era: ISRAEL,
    title: { fr: 'Les Juges', en: 'The Judges' },
    span: { fr: 'v. 1445 – v. 1050 av. J.-C.', en: 'c. 1445 – c. 1050 BC' },
    summary: {
      fr: 'De Moïse et les dix commandements à l’entrée de Josué et à l’expansion juive en Terre promise.',
      en: 'From Moses and the Ten Commandments to Joshua’s entrance and Jewish expansion into the Promised Land.',
    },
    color: '#63479b',
  },
  {
    id: '6',
    startYear: -1100,
    endYear: -930,
    yearsPerTick: 2,
    era: ISRAEL,
    title: { fr: 'Le royaume uni', en: 'United Kingdom' },
    span: { fr: 'v. 1050 – v. 930 av. J.-C.', en: 'c. 1050 – c. 930 BC' },
    summary: {
      fr: 'Du roi Saül au prophète Samuel et au jeune roi David et sa dynastie royale en passant par Salomon.',
      en: 'From King Saul to the prophet Samuel and young King David and his royal dynasty through Solomon.',
    },
    color: '#3b6eb5',
  },
  {
    id: '7',
    startYear: -930,
    endYear: -620,
    yearsPerTick: 2,
    era: ISRAEL,
    title: { fr: 'Le royaume divisé', en: 'Divided Kingdom' },
    span: { fr: 'v. 930 – v. 586 av. J.-C.', en: 'c. 930 – c. 586 BC' },
    summary: {
      fr: 'Des conflits internes qui ont divisé la nation d’Israël aux prophètes qui ont averti de l’exil à venir.',
      en: 'From the internal strife that divided the nation of Israel to the prophets who warned of the coming exile.',
    },
    color: '#23a6c5',
  },
  {
    id: '8',
    startYear: -620,
    endYear: -100,
    yearsPerTick: 5,
    era: ISRAEL,
    // The bundled timeline reads « L’Exode » in French, a slip for the exile its summary describes.
    title: { fr: 'L’Exil', en: 'The Exile' },
    span: { fr: 'v. 585 – v. 457 av. J.-C.', en: 'c. 585 – c. 457 BC' },
    summary: {
      fr: 'De la chute d’Israël à l’exil à Babylone et aux grands prophètes déclarant le Messie à venir.',
      en: 'From Israel’s fall to exile in Babylon and the major prophets declaring the coming Messiah.',
    },
    color: '#33bdbb',
  },
  {
    id: '9',
    startYear: -100,
    endYear: 35,
    yearsPerTick: 1,
    // The ministry of Jesus holds more events than any other stretch of the timeline:
    // a tick is two months there, so they can be read one after the other.
    detail: { startYear: 27, endYear: 32, yearsPerTick: 1 / 6 },
    era: CHRIST,
    title: { fr: 'La vie de Christ', en: 'Life of Christ' },
    span: { fr: 'v. 4 av. J.-C. – v. 34 ap. J.-C.', en: 'c. 4 BC – c. 34 AD' },
    summary: {
      fr: 'Depuis la naissance du Messie promis, Jésus le Christ, jusqu’à son ministère, sa mort et sa résurrection.',
      en: 'From the birth of the promised Messiah, Jesus the Christ, to His ministry and death and resurrection.',
    },
    color: '#52b148',
  },
  {
    id: '10',
    startYear: 35,
    endYear: 350,
    yearsPerTick: 5,
    era: CHRIST,
    title: { fr: 'L’Église primitive', en: 'Early Church' },
    span: { fr: 'v. 34 – v. 330 ap. J.-C.', en: 'c. 34 – c. 330 AD' },
    summary: {
      fr: 'Du martyre d’Étienne à la persécution et à l’ascension de l’Église par Paul et les apôtres.',
      en: 'From the martyrdom of Stephen to the persecution and rise of the church through Paul and the apostles.',
    },
    color: '#b6bf34',
  },
  {
    id: '11',
    startYear: 350,
    endYear: 1520,
    yearsPerTick: 20,
    era: CHRIST,
    title: { fr: 'Le Moyen Âge', en: 'Middle Ages' },
    span: { fr: 'v. 450 – v. 1517 ap. J.-C.', en: 'c. 450 – c. 1517 AD' },
    summary: {
      fr: 'De la légalisation du christianisme sous Constantin à la persécution de l’âge des ténèbres.',
      en: 'From the legalization of Christianity under Constantine to the persecution of the Dark Ages.',
    },
    color: '#eec826',
  },
  {
    id: '12',
    startYear: 1520,
    endYear: 1840,
    yearsPerTick: 2,
    era: CHRIST,
    title: { fr: 'Réformation', en: 'Reformation' },
    span: { fr: 'v. 1517 – v. 1840 ap. J.-C.', en: 'c. 1517 – c. 1840 AD' },
    summary: {
      fr: 'Des grands réformateurs, tels que Luther et Wycliffe, à l’expansion du mouvement protestant.',
      en: 'From the great reformers, such as Luther and Wycliffe, to the expansion of the Protestant movement.',
    },
    color: '#e9a327',
  },
  {
    id: '13',
    startYear: 1840,
    endYear: 3100,
    yearsPerTick: 25,
    era: CHRIST,
    // The bundled timeline spreads these prophecies from Creation to the present; the
    // publication files the events of the last centuries and those still to come here.
    title: { fr: 'Prophéties de l’Apocalypse', en: 'Revelation Prophecies' },
    summary: {
      fr: 'De la montée de l’Antéchrist, la marque de la bête, au retour du Christ et à la restauration du paradis.',
      en: 'From the rise of the antichrist, the mark of the beast, to the return of Christ and paradise restored.',
    },
    color: '#ed7c2c',
  },
]

/** The room the drawing keeps before its first year, for its title. */
export const TIMELINE_INTRO_WIDTH = 600
/** The room it keeps after its last year, for what follows the timeline. */
export const TIMELINE_OUTRO_WIDTH = 520

/** The whole timeline on its axis, every period at its scale. */
export const TIMELINE_BANDS: readonly TimelineBand[] = buildTimelineBands(
  TIMELINE_PERIODS.flatMap(timelinePeriodScales),
  TIMELINE_INTRO_WIDTH
)

/** The width of the drawing, from its title to what follows the last year. */
export const TIMELINE_CANVAS_WIDTH = timelineWidth(TIMELINE_BANDS) + TIMELINE_OUTRO_WIDTH

export const findTimelinePeriod = (id: string): TimelinePeriod | undefined =>
  TIMELINE_PERIODS.find(period => period.id === id)

/** Periods follow one another in time; an event filed under an unknown one comes last. */
export const timelinePeriodRank = (id: string): number => {
  const index = TIMELINE_PERIODS.findIndex(period => period.id === id)
  return index === -1 ? TIMELINE_PERIODS.length : index
}
