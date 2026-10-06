import type { ResourceLanguage } from '../resources/publicSite'

type Localized = Record<ResourceLanguage, string>

export type TimelinePeriod = {
  /** The `period` an event of the publication is filed under. */
  id: string
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
// (apps/expo/src/assets/timeline/events.txt), in the order of the periods.
export const TIMELINE_PERIODS: readonly TimelinePeriod[] = [
  {
    id: '1',
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

export const findTimelinePeriod = (id: string): TimelinePeriod | undefined =>
  TIMELINE_PERIODS.find(period => period.id === id)

/** Periods follow one another in time; an event filed under an unknown one comes last. */
export const timelinePeriodRank = (id: string): number => {
  const index = TIMELINE_PERIODS.findIndex(period => period.id === id)
  return index === -1 ? TIMELINE_PERIODS.length : index
}
