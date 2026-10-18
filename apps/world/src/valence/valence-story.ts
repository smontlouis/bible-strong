// Valence 1876: the scenario. Every factual sentence is traceable to a dossier in
// apps/world/docs/valence-1876/recherche/. Real people speak only what the sources allow;
// invented people carry daily life. Neither the kinds nor the sources are shown to visitors.
// Characters address the visitor only once, with the closing question at the Rhône.
import type { Language } from '../language'

export type SpeakerId =
  | 'bourdeau'
  | 'marion'
  | 'employee'
  | 'pastor'
  | 'elise'
  | 'jeanne'
  | 'louis'
  | 'jacques'
  | 'crier'
  | 'peddler'
  | 'narrator'

export type Speaker = {
  name: Record<Language, string>
  role: Record<Language, string>
  kind: 'real' | 'composite' | 'narrator'
}

export const speakers: Record<SpeakerId, Speaker> = {
  bourdeau: {
    name: { fr: 'Daniel Bourdeau', en: 'Daniel Bourdeau' },
    role: { fr: 'Pasteur, 41 ans', en: 'Preacher, 41' },
    kind: 'real',
  },
  marion: {
    name: { fr: 'Marion Bourdeau', en: 'Marion Bourdeau' },
    role: { fr: 'Épouse de Daniel, 35 ans', en: 'Daniel’s wife, 35' },
    kind: 'real',
  },
  employee: {
    name: { fr: 'L’employé du PLM', en: 'The railway clerk' },
    role: { fr: 'Gare de Valence', en: 'Valence station' },
    kind: 'composite',
  },
  pastor: {
    name: { fr: 'Le pasteur', en: 'The pastor' },
    role: { fr: 'Temple Saint-Ruf', en: 'Saint-Ruf temple' },
    kind: 'composite',
  },
  elise: {
    name: { fr: 'Élise Faure', en: 'Élise Faure' },
    role: { fr: '16 ans', en: 'Age 16' },
    kind: 'composite',
  },
  jeanne: {
    name: { fr: 'Jeanne Faure', en: 'Jeanne Faure' },
    role: { fr: 'Mère d’Élise', en: 'Élise’s mother' },
    kind: 'composite',
  },
  louis: {
    name: { fr: 'Louis Faure', en: 'Louis Faure' },
    role: { fr: 'Ouvrier en soie', en: 'Silk worker' },
    kind: 'composite',
  },
  jacques: {
    name: { fr: 'Jacques Faure', en: 'Jacques Faure' },
    role: { fr: 'Grand-père d’Élise, 84 ans', en: 'Élise’s grandfather, 84' },
    kind: 'composite',
  },
  crier: {
    name: { fr: 'Le crieur', en: 'The newsboy' },
    role: { fr: 'Journal de Valence', en: 'Journal de Valence' },
    kind: 'composite',
  },
  peddler: {
    name: { fr: 'Le colporteur', en: 'The Bible peddler' },
    role: { fr: 'Société biblique', en: 'Bible Society' },
    kind: 'composite',
  },
  narrator: {
    name: { fr: 'Note', en: 'Note' },
    role: { fr: '', en: '' },
    kind: 'narrator',
  },
}

/** The expression a speaker wears for one line; each mood has its own dialogue portrait. */
export type Mood = 'neutral' | 'happy' | 'thinking' | 'surprised' | 'grave'
export type Line = { speaker: SpeakerId; mood?: Mood; text: Record<Language, string> }
export type TodayPanel = {
  title: Record<Language, string>
  body: Record<Language, string>
  /** Quoted verse, LSG in French and KJV in English. */
  verse?: { text: Record<Language, string>; reference: Record<Language, string> }
  cta: Record<Language, string>
  url: Record<Language, string>
  screenshot: string
}
export type Source = { label: string; url?: string }
export type BeatKind = 'fact' | 'study' | 'today'
export type StationId =
  | 'gare'
  | 'temple'
  | 'maison'
  | 'cathedrale'
  | 'citadelle'
  | 'champ'
  | 'clercs'
  | 'rhone'

export type Station = {
  id: StationId
  order: number
  date: Record<Language, string>
  place: Record<Language, string>
  title: Record<Language, string>
  fact: Line[]
  study: Line[]
  today: TodayPanel | null
  sources: Source[]
}

/** Public pages of the Bible Strong site, never the app: indexable and readable without signing in. */
const site = (path: string) => `https://bible-strong.app${path}`
const home = { fr: site('/fr'), en: site('/') }
const discover = { fr: 'Découvrir Bible Strong', en: 'Discover Bible Strong' }
const shot = (name: string) => `./valence-1876/today/${name}.webp`

const RH_1877_04_05: Source = {
  label: 'Review and Herald, 5 avril 1877 (lettre datée de Valence, 22 février 1877)',
  url: 'https://documents.adventistarchives.org/Periodicals/RH/RH18770405-V49-14.pdf',
}
const RH_1877_10_04: Source = {
  label: 'Review and Herald, 4 octobre 1877 (« D. T. Bourdeau, France »)',
  url: 'https://documents.adventistarchives.org/Periodicals/RH/RH18771004-V50-14.pdf',
}
const ARCHIVES_FRANCE: Source = {
  label: 'Archives adventistes, « Histoire de l’adventisme en France »',
  url: 'https://www.archivesadventistes.org/blog/2006/09/histoire-de-lad.html',
}
const ESDA_BOURDEAU: Source = {
  label: 'Encyclopédie adventiste, « Bourdeau, Daniel Toussaint »',
  url: 'https://encyclopedia.adventist.org/article?id=C90G',
}
const ESDA_ANDREWS: Source = {
  label: 'Encyclopédie adventiste, « Andrews, John Nevins »',
  url: 'https://encyclopedia.adventist.org/article?id=C8VX',
}
const REVUE_SUISSE: Source = {
  label: 'Revue adventiste, « Les débuts en Suisse, 1866-1922 »',
  url: 'https://revue.adventiste.org/vie-et-sante-les-debuts-en-suisse-1866-1922/',
}
const EVENT_150: Source = {
  label: 'Fédération France-Sud, « 150 ans de l’adventisme en France »',
  url: 'https://adventisteffs.org/150-ans-adventisme-france/',
}

export const stations: Station[] = [
  {
    id: 'gare',
    order: 1,
    date: { fr: 'Octobre 1876', en: 'October 1876' },
    place: { fr: 'La gare', en: 'The station' },
    title: { fr: 'L’arrivée', en: 'The arrival' },
    fact: [
      {
        speaker: 'employee',
        mood: 'surprised',
        text: {
          fr: 'Le train de Lyon. Un homme, sa femme, un petit garçon d’un an. Et des malles lourdes comme des pierres.',
          en: 'The Lyon train. A man, his wife, a little boy of one. And trunks as heavy as stones.',
        },
      },
      {
        speaker: 'bourdeau',
        mood: 'happy',
        text: {
          fr: 'Des journaux, surtout. Les Signes des Temps. Le premier numéro est sorti à Bâle en juillet : huit pages, deux mille exemplaires.',
          en: 'Newspapers, mostly. Les Signes des Temps. The first issue came out in Basel in July: eight pages, two thousand copies.',
        },
      },
      {
        speaker: 'bourdeau',
        mood: 'neutral',
        text: {
          fr: 'Nous le rédigeons à deux, M. Andrews et moi. Il paraît une fois par mois, chez un imprimeur bâlois.',
          en: 'Mr. Andrews and I edit it together. It comes out once a month, from a printer in Basel.',
        },
      },
      {
        speaker: 'narrator',
        text: {
          fr: 'Cinq mois après le premier numéro, la revue compte quatre cents abonnés, surtout en Suisse et en France.',
          en: 'Five months after the first issue, the paper has four hundred subscribers, mostly in Switzerland and France.',
        },
      },
    ],
    study: [
      {
        speaker: 'bourdeau',
        mood: 'thinking',
        text: {
          fr: 'Un article, une correction, une réponse : tout passe par la poste et par le train.',
          en: 'An article, a correction, a reply: everything travels by post and by train.',
        },
      },
      {
        speaker: 'bourdeau',
        mood: 'happy',
        text: {
          fr: 'À Bâle, Mary, la fille de M. Andrews, quinze ans, relit les épreuves. Charles, son frère, apprend l’imprimerie.',
          en: 'In Basel, Mr. Andrews’s daughter Mary, fifteen, reads the proofs. Her brother Charles is learning the printing trade.',
        },
      },
      {
        speaker: 'employee',
        mood: 'happy',
        text: {
          fr: 'Alors je vous garderai les paquets de Bâle, monsieur.',
          en: 'Then I will keep the parcels from Basel for you, sir.',
        },
      },
    ],
    today: {
      title: { fr: 'La bibliothèque en ligne', en: 'The online library' },
      body: {
        fr: 'Commentaires, dictionnaires, Bibles : Bible Strong les télécharge en quelques secondes, et les met à jour sans attendre le train.',
        en: 'Commentaries, dictionaries, Bibles: Bible Strong downloads them in seconds and keeps them up to date without waiting for a train.',
      },
      cta: { fr: 'Ouvrir la bibliothèque', en: 'Open the library' },
      url: { fr: site('/commentary/fr'), en: site('/commentary/en') },
      screenshot: shot('download-manager'),
    },
    sources: [ARCHIVES_FRANCE, REVUE_SUISSE, ESDA_ANDREWS, EVENT_150],
  },
  {
    id: 'temple',
    order: 2,
    date: { fr: 'Automne 1876', en: 'Autumn 1876' },
    place: { fr: 'Le temple Saint-Ruf', en: 'The Saint-Ruf temple' },
    title: { fr: 'L’invitation', en: 'The invitation' },
    fact: [
      {
        speaker: 'pastor',
        mood: 'neutral',
        text: {
          fr: 'Des familles de la ville ont invité ce prédicateur venu des États-Unis à parler ici, au temple.',
          en: 'Some families of the town invited this preacher from the United States to speak here, in the temple.',
        },
      },
      {
        speaker: 'pastor',
        mood: 'grave',
        text: {
          fr: 'Ce temple sert au culte protestant depuis le début du siècle. Son clocher menaçait ruine : on l’a démoli en 1805.',
          en: 'This temple has served Protestant worship since the start of the century. Its bell tower was falling apart: it was pulled down in 1805.',
        },
      },
      {
        speaker: 'narrator',
        text: {
          fr: 'Les Églises reconnues ne prêtent pas leurs bâtiments aux groupes religieux nouveaux. Au printemps, Bourdeau et Andrews iront à Paris demander au gouvernement de pouvoir travailler avec moins de contraintes.',
          en: 'Recognized churches do not lend their buildings to new religious groups. In the spring, Bourdeau and Andrews will go to Paris to ask the government for fewer restrictions on their work.',
        },
      },
    ],
    study: [
      {
        speaker: 'pastor',
        mood: 'neutral',
        text: {
          fr: 'Au pupitre, je lis l’Ostervald. C’est la version de notre culte réformé.',
          en: 'From the pulpit I read the Ostervald. It is the version of our Reformed worship.',
        },
      },
      {
        speaker: 'pastor',
        mood: 'thinking',
        text: {
          fr: 'Pour comparer, il me faudrait d’autres livres : la Bible de Lausanne, complète depuis 1872, le Nouveau Testament de Darby, et l’Ancien Testament de M. Segond, paru à Genève en 1874.',
          en: 'To compare, I would need other books: the Lausanne Bible, complete since 1872, Darby’s New Testament, and Mr. Segond’s Old Testament, published in Geneva in 1874.',
        },
      },
      {
        speaker: 'pastor',
        mood: 'grave',
        text: {
          fr: 'Quatre livres. Quatre achats.',
          en: 'Four books. Four purchases.',
        },
      },
    ],
    today: {
      title: { fr: 'Comparer les versions', en: 'Compare versions' },
      body: {
        fr: 'L’Ostervald, la Bible de Lausanne de 1872, la Martin de 1744, la Darby et la Segond : les Bibles du pasteur, et celles qui ont suivi, s’ouvrent côte à côte sur un même verset.',
        en: 'The Ostervald, the 1872 Lausanne Bible, the 1744 Martin, the Darby and the Segond: the pastor’s Bibles, and those that followed, open side by side on the same verse.',
      },
      verse: {
        text: {
          fr: 'Ta parole est une lampe à mes pieds, Et une lumière sur mon sentier.',
          en: 'Thy word is a lamp unto my feet, and a light unto my path.',
        },
        reference: { fr: 'Psaume 119:105', en: 'Psalm 119:105' },
      },
      cta: { fr: 'Comparer ce verset', en: 'Compare this verse' },
      url: {
        fr: site('/bible/lsg/ps/119/105'),
        en: site('/bible/kjv/ps/119/105'),
      },
      screenshot: shot('compare'),
    },
    sources: [
      {
        label: 'Musée protestant, « Le temple Saint-Ruf de Valence »',
        url: 'https://museeprotestant.org',
      },
      {
        label: 'M. Verfaillie, L’identité religieuse au sein de l’adventisme (citant J.-M. Martin, 1980)',
        url: 'https://dokumen.pub',
      },
      ARCHIVES_FRANCE,
      {
        label: 'Bibliorama, histoire des Bibles de Lausanne et Segond',
        url: 'https://bibliorama.org',
      },
    ],
  },
  {
    id: 'maison',
    order: 3,
    date: { fr: 'Hiver 1876-1877', en: 'Winter 1876-1877' },
    place: { fr: 'Chez les Faure', en: 'At the Faures’' },
    title: { fr: 'La veillée', en: 'The evening' },
    fact: [
      {
        speaker: 'jeanne',
        mood: 'grave',
        text: {
          fr: 'À la filature, l’ouvrage manque. La soie va mal depuis des années.',
          en: 'There is little work at the silk mill. Silk has been doing badly for years.',
        },
      },
      {
        speaker: 'jeanne',
        mood: 'neutral',
        text: {
          fr: 'Alors le soir, on lit. Le pétrole coûte cher ; souvent, c’est la bougie.',
          en: 'So in the evening, we read. Lamp oil is dear; often it is a candle.',
        },
      },
      {
        speaker: 'elise',
        mood: 'happy',
        text: {
          fr: 'Sur la table : la Bible d’Ostervald, la concordance, le dictionnaire de M. Bost en deux volumes, et la feuille venue de Bâle.',
          en: 'On the table: the Ostervald Bible, the concordance, Mr. Bost’s dictionary in two volumes, and the paper from Basel.',
        },
      },
    ],
    study: [
      {
        speaker: 'elise',
        mood: 'happy',
        text: {
          fr: 'Je lis à voix haute. Maman cherche chaque mot dans la concordance, page après page.',
          en: 'I read aloud. Mother looks up every word in the concordance, page after page.',
        },
      },
      {
        speaker: 'jeanne',
        mood: 'thinking',
        text: {
          fr: 'Pour un mot hébreu, il n’existe qu’un dictionnaire en français, celui de Sander et Trenel, fait pour les écoles juives.',
          en: 'For a Hebrew word there is only one dictionary in French, Sander and Trenel’s, made for Jewish schools.',
        },
      },
      {
        speaker: 'elise',
        mood: 'thinking',
        text: {
          fr: 'Et pour le grec, rien en français. Les lexiques sont en latin ou en anglais.',
          en: 'And for Greek, nothing in French. The lexicons are in Latin or in English.',
        },
      },
      {
        speaker: 'narrator',
        text: {
          fr: 'Les numéros Strong n’existent pas encore. Ils paraîtront en 1890, en anglais.',
          en: 'Strong’s numbers do not exist yet. They will appear in 1890, in English.',
        },
      },
    ],
    today: {
      title: { fr: 'Toucher un mot', en: 'Tap a word' },
      body: {
        fr: 'Dans Bible Strong, touche « lampe » : le mot hébreu apparaît, avec sa prononciation, sa définition et tous les versets où il se trouve. Le dictionnaire de Bost est dans l’app, lui aussi.',
        en: 'In Bible Strong, tap “lamp”: the Hebrew word appears with its pronunciation, its definition and every verse where it occurs. Bost’s dictionary is in the app too.',
      },
      verse: {
        text: {
          fr: 'Ta parole est une lampe à mes pieds, Et une lumière sur mon sentier.',
          en: 'Thy word is a lamp unto my feet, and a light unto my path.',
        },
        reference: { fr: 'Psaume 119:105', en: 'Psalm 119:105' },
      },
      cta: { fr: 'Ouvrir le mot hébreu', en: 'Open the Hebrew word' },
      url: {
        fr: site('/strong/fr/h5216'),
        en: site('/strong/en/h5216'),
      },
      screenshot: shot('lexicon'),
    },
    sources: [
      {
        label: 'Concordance des Saintes Écritures, Meyrueis, 1856 (fondée sur l’Ostervald)',
        url: 'https://catalog.hathitrust.org',
      },
      { label: 'J.-A. Bost, Dictionnaire de la Bible, 1849', url: 'https://levigilant.com' },
      { label: 'Sander et Trenel, Dictionnaire hébreu-français, Paris, Jouaust, 1859' },
      {
        label: 'Ville de Valence, histoire de la soie et des filatures',
        url: 'https://fr.wikipedia.org/wiki/Valence_(Drôme)',
      },
    ],
  },
  {
    id: 'cathedrale',
    order: 4,
    date: { fr: 'Février 1877', en: 'February 1877' },
    place: { fr: 'La cathédrale', en: 'The cathedral' },
    title: { fr: 'Le cœur du pape', en: 'The pope’s heart' },
    fact: [
      {
        speaker: 'jacques',
        mood: 'grave',
        text: {
          fr: 'J’avais six ans. On disait que le pape était prisonnier, dans la citadelle. Il y est mort le 29 août 1799.',
          en: 'I was six. People said the pope was a prisoner in the citadel. He died there on 29 August 1799.',
        },
      },
      {
        speaker: 'jacques',
        mood: 'grave',
        text: {
          fr: 'Son corps est reparti pour Rome en 1802. Son cœur est resté ici, dans la cathédrale, sous le buste de marbre.',
          en: 'His body went back to Rome in 1802. His heart stayed here, in the cathedral, beneath the marble bust.',
        },
      },
      {
        speaker: 'bourdeau',
        mood: 'neutral',
        text: {
          fr: 'J’ai écrit sur ce monument ce mois-ci, dans une lettre datée de Valence, le 22 février. « Valence a joué un rôle de premier plan dans l’histoire de la France. »',
          en: 'I wrote about this monument this month, in a letter dated Valence, 22 February: “Valence has acted a prominent part in the events that make up the history of France.”',
        },
      },
      {
        speaker: 'bourdeau',
        mood: 'thinking',
        text: {
          fr: 'Ma lettre parle aussi des mille deux cent soixante ans annoncés par la prophétie.',
          en: 'My letter also speaks of the twelve hundred and sixty years foretold in prophecy.',
        },
      },
    ],
    study: [
      {
        speaker: 'bourdeau',
        mood: 'thinking',
        text: {
          fr: 'Pour les prophéties, mes livres sont en anglais : les commentaires d’Uriah Smith sur Daniel et l’Apocalypse, l’Histoire du sabbat de M. Andrews.',
          en: 'For the prophecies, my books are in English: Uriah Smith’s commentaries on Daniel and the Revelation, Mr. Andrews’s History of the Sabbath.',
        },
      },
      {
        speaker: 'bourdeau',
        mood: 'neutral',
        text: {
          fr: 'Le soir, je traduis en français articles et brochures.',
          en: 'In the evenings I translate articles and pamphlets into French.',
        },
      },
    ],
    today: {
      title: { fr: 'Un verset et ses commentaires', en: 'A verse and its commentaries' },
      body: {
        fr: 'Ouvre le verset des mille deux cent soixante jours, touche un mot pour voir le grec, puis lis ce qu’en disent les commentaires, en français.',
        en: 'Open the verse of the twelve hundred and sixty days, tap a word to see the Greek, then read what the commentaries say about it.',
      },
      verse: {
        text: {
          fr: 'Et la femme s’enfuit dans le désert, où elle avait un lieu préparé par Dieu, afin qu’elle y fût nourrie pendant mille deux cent soixante jours.',
          en: 'And the woman fled into the wilderness, where she hath a place prepared of God, that they should feed her there a thousand two hundred and threescore days.',
        },
        reference: { fr: 'Apocalypse 12:6', en: 'Revelation 12:6' },
      },
      cta: { fr: 'Ouvrir Apocalypse 12', en: 'Open Revelation 12' },
      url: { fr: site('/bible/lsg/rev/12/6'), en: site('/bible/kjv/rev/12/6') },
      screenshot: shot('commentaries'),
    },
    sources: [
      RH_1877_04_05,
      {
        label: 'Wikipédia, « Pie VI » et « Cathédrale Saint-Apollinaire de Valence »',
        url: 'https://fr.wikipedia.org/wiki/Pie_VI',
      },
      ESDA_BOURDEAU,
    ],
  },
  {
    id: 'citadelle',
    order: 5,
    date: { fr: '29 août 1799', en: '29 August 1799' },
    place: { fr: 'La citadelle', en: 'The citadel' },
    title: { fr: 'La tour', en: 'The tower' },
    fact: [
      {
        speaker: 'narrator',
        text: {
          fr: 'Pie VI, quatre-vingt-un ans, prisonnier, meurt ici, dans la citadelle de Valence, le 29 août 1799.',
          en: 'Pius VI, aged eighty-one and a prisoner, dies here, in the citadel of Valence, on 29 August 1799.',
        },
      },
      {
        speaker: 'narrator',
        text: {
          fr: 'Son corps est d’abord déposé dans la chapelle de la citadelle. La citadelle occupe l’angle nord-ouest de la ville.',
          en: 'His body is first laid in the citadel chapel. The citadel stands at the north-west corner of the town.',
        },
      },
      {
        speaker: 'narrator',
        text: {
          fr: 'En 1886, Ellen White, de passage à Valence, viendra voir la cathédrale et cette tour.',
          en: 'In 1886, Ellen White, passing through Valence, will come to see the cathedral and this tower.',
        },
      },
    ],
    study: [],
    today: null,
    sources: [
      {
        label: 'L’Empreinte, « Valence ville militaire »',
        url: 'https://lempreinte.valenceromansagglo.fr',
      },
      {
        label: 'Ellen G. White Writings (voyage de 1886)',
        url: 'https://m.egwwritings.org/en/book/669.1088',
      },
    ],
  },
  {
    id: 'champ',
    order: 6,
    date: { fr: 'Mars à octobre 1877', en: 'March to October 1877' },
    place: { fr: 'Le Champ de Mars', en: 'The Champ de Mars' },
    title: { fr: 'La ville et le temps', en: 'Town and times' },
    fact: [
      {
        speaker: 'crier',
        mood: 'happy',
        text: {
          fr: 'Journal de Valence ! À partir du 1er septembre, six numéros par semaine !',
          en: 'Journal de Valence! From the first of September, six issues a week!',
        },
      },
      {
        speaker: 'crier',
        mood: 'surprised',
        text: {
          fr: 'Vingt-trois mille habitants, trois mille soldats, et des élections en octobre !',
          en: 'Twenty-three thousand people, three thousand soldiers, and elections in October!',
        },
      },
      {
        speaker: 'marion',
        mood: 'neutral',
        text: {
          fr: 'En mars, mon mari et M. Andrews sont allés à Paris demander au gouvernement de pouvoir travailler avec moins de contraintes.',
          en: 'In March, my husband and Mr. Andrews went to Paris to ask the government for fewer restrictions on their work.',
        },
      },
      {
        speaker: 'marion',
        mood: 'happy',
        text: {
          fr: 'Janvier 1876, La Coudre, puis Le Locle. Ensuite Bâle. En octobre, Valence. Augustin avait un an en arrivant ici.',
          en: 'January 1876, La Coudre, then Le Locle. Then Basel. In October, Valence. Augustin was one year old when we came here.',
        },
      },
    ],
    study: [
      {
        speaker: 'crier',
        mood: 'happy',
        text: {
          fr: 'Ici, on lit le journal : trois numéros par semaine depuis 1873, bientôt six.',
          en: 'Here people read the paper: three issues a week since 1873, soon six.',
        },
      },
      {
        speaker: 'narrator',
        text: {
          fr: 'L’année suivante, Bourdeau écrira que les changements politiques ont rendu plus faciles la prédication et la distribution des tracts.',
          en: 'The following year, Bourdeau will write that the political changes have made preaching and distributing tracts easier.',
        },
      },
    ],
    today: {
      title: { fr: 'Le verset du jour', en: 'The verse of the day' },
      body: {
        fr: 'Chaque matin, un verset, une méditation, un plan de lecture : une lecture quotidienne qui tient dans la poche, en ville ou en voyage.',
        en: 'Every morning, a verse, a meditation, a reading plan: daily reading that fits in your pocket, at home or on the road.',
      },
      cta: discover,
      url: home,
      screenshot: shot('verse-of-day'),
    },
    sources: [
      ARCHIVES_FRANCE,
      {
        label: 'BnF, Presse locale ancienne : Journal de Valence',
        url: 'https://presselocaleancienne.bnf.fr/ark:/12148/cb32798997b',
      },
      { label: 'Wikipédia, « Valence (Drôme) », population', url: 'https://fr.wikipedia.org/wiki/Valence_(Drôme)' },
      ESDA_BOURDEAU,
    ],
  },
  {
    id: 'clercs',
    order: 7,
    date: { fr: 'Été 1877', en: 'Summer 1877' },
    place: { fr: 'La place des Clercs', en: 'The Place des Clercs' },
    title: { fr: 'L’étal de livres', en: 'The book stand' },
    fact: [
      {
        speaker: 'bourdeau',
        mood: 'happy',
        text: {
          fr: 'Cet été, l’étal tourne bien : près d’une vingtaine de volumes reliés, et des centaines de tracts différents distribués.',
          en: 'This summer the book stand is in lively operation: nearly a score of bound volumes and hundreds of different tracts distributed.',
        },
      },
      {
        speaker: 'bourdeau',
        mood: 'grave',
        text: {
          fr: 'Deux colporteurs sont partis vendre Les Signes et Le Vulgarisateur. Ils ont peu vendu : ils ne pouvaient pas entrer dans les maisons.',
          en: 'Two colporteurs went out to sell Les Signes and Le Vulgarisateur. They sold little: they could not get into people’s homes.',
        },
      },
      {
        speaker: 'peddler',
        mood: 'neutral',
        text: {
          fr: 'Moi, je colporte pour la Société biblique. Depuis la loi de 1849, il faut une autorisation pour vendre des imprimés de porte en porte.',
          en: 'I sell for the Bible Society. Since the law of 1849, you need a permit to sell printed matter from door to door.',
        },
      },
    ],
    study: [
      {
        speaker: 'peddler',
        mood: 'happy',
        text: {
          fr: 'Dans mon sac : des Nouveaux Testaments d’Ostervald, imprimés à Londres en 1870 aux frais de la Société biblique.',
          en: 'In my bag: Ostervald New Testaments, printed in London in 1870 at the Bible Society’s expense.',
        },
      },
      {
        speaker: 'peddler',
        mood: 'grave',
        text: {
          fr: 'Une Bible entière, c’est une dépense. Et tout le monde ne sait pas lire : en France, un homme sur cinq et une femme sur trois ne savent pas signer leur nom.',
          en: 'A whole Bible is an expense. And not everyone can read: in France, one man in five and one woman in three cannot sign their name.',
        },
      },
    ],
    today: {
      title: { fr: 'Toute une bibliothèque, hors ligne', en: 'A whole library, offline' },
      body: {
        fr: 'Bibles, lexiques, dictionnaires, commentaires : télécharge-les une fois, et lis sans réseau, au fond d’une vallée comme dans le train.',
        en: 'Bibles, lexicons, dictionaries, commentaries: download them once and read without a connection, deep in a valley or on a train.',
      },
      cta: discover,
      url: home,
      screenshot: shot('offline'),
    },
    sources: [
      RH_1877_10_04,
      ARCHIVES_FRANCE,
      { label: 'Bibliquest, J. Lortsch, histoire de la Société biblique', url: 'https://bibliquest.org' },
      { label: 'Loi du 27 juillet 1849 sur la presse, article sur le colportage' },
    ],
  },
  {
    id: 'rhone',
    order: 8,
    date: { fr: 'Septembre 1877', en: 'September 1877' },
    place: { fr: 'Le Rhône', en: 'The Rhône' },
    title: { fr: 'Dix-sept', en: 'Seventeen' },
    fact: [
      {
        speaker: 'elise',
        mood: 'happy',
        text: {
          fr: 'Ce mois-ci, dix-sept personnes de Valence vont être baptisées. J’en fais partie.',
          en: 'This month, seventeen people from Valence are to be baptized. I am one of them.',
        },
      },
      {
        speaker: 'elise',
        mood: 'grave',
        text: {
          fr: 'Ce sera la première église adventiste de France. Et M. Bourdeau repart pour la Suisse.',
          en: 'It will be the first Adventist church in France. And Mr. Bourdeau is leaving for Switzerland.',
        },
      },
      {
        speaker: 'narrator',
        text: {
          fr: 'Septembre 1877. Dix-sept baptêmes : Valence a désormais son église.',
          en: 'September 1877. Seventeen baptisms: Valence now has its church.',
        },
      },
    ],
    study: [
      {
        speaker: 'narrator',
        text: {
          fr: '1878. Un Valentinois nommé Gabert vend des abonnements aux Signes et va prêcher jusqu’à Crest et Lyon.',
          en: '1878. A man of Valence named Gabert sells subscriptions to Les Signes and preaches as far as Crest and Lyon.',
        },
      },
      {
        speaker: 'narrator',
        text: {
          fr: '1886. Ellen White s’arrête à Valence et y réunit, pour deux rencontres, les quelques observateurs du sabbat.',
          en: '1886. Ellen White stops at Valence and meets the few Sabbath keepers there for two services.',
        },
      },
      {
        speaker: 'narrator',
        text: {
          fr: '2026. Cent cinquante ans.',
          en: '2026. One hundred and fifty years.',
        },
      },
      {
        speaker: 'elise',
        mood: 'happy',
        text: {
          fr: 'Vous avez tout cela dans la poche. Qu’allez-vous lire ce soir ?',
          en: 'You have all of this in your pocket. What will you read tonight?',
        },
      },
    ],
    today: null,
    sources: [
      {
        label: 'Église adventiste de Draguignan, histoire de l’Église adventiste (septembre 1877)',
        url: 'https://adventiste-draguignan.jimdofree.com/qui-sommes-nous/histoire-de-l-eglise-adventiste-du-7e-jour',
      },
      ARCHIVES_FRANCE,
      EVENT_150,
      {
        label: 'Ellen G. White Writings (Valence, 1886)',
        url: 'https://m.egwwritings.org/en/book/665.2326',
      },
    ],
  },
]

export type PioneerObjectId =
  | 'ostervald'
  | 'signes'
  | 'concordance'
  | 'bost'
  | 'sander'
  | 'lampe'
  | 'lettre'

export type PioneerObject = {
  id: PioneerObjectId
  name: Record<Language, string>
  yesterday: Record<Language, string>
  today: Record<Language, string>
  cta: Record<Language, string>
  url: Record<Language, string>
  screenshot: string
}

export const pioneerObjects: PioneerObject[] = [
  {
    id: 'ostervald',
    name: { fr: 'La Bible d’Ostervald', en: 'The Ostervald Bible' },
    yesterday: {
      fr: 'Édition stéréotype de la Société biblique protestante de Paris : la version du culte réformé.',
      en: 'A stereotype edition of the Protestant Bible Society of Paris: the version of Reformed worship.',
    },
    today: {
      fr: 'L’Ostervald est dans Bible Strong, avec la Martin, la Lausanne, la Darby et la Segond.',
      en: 'The Ostervald is in Bible Strong, alongside the Martin, the Lausanne, the Darby and the Segond.',
    },
    cta: { fr: 'Lire l’Ostervald', en: 'Read the Ostervald' },
    url: { fr: site('/bible/ost/ps/119/105'), en: site('/bible/ost/ps/119/105') },
    screenshot: shot('versions'),
  },
  {
    id: 'signes',
    name: { fr: 'Un numéro des Signes des Temps', en: 'An issue of Les Signes des Temps' },
    yesterday: {
      fr: 'Juillet 1876, Bâle : huit pages de 30 × 41 cm, deux mille exemplaires, une fois par mois.',
      en: 'July 1876, Basel: eight pages of 30 × 41 cm, two thousand copies, once a month.',
    },
    today: {
      fr: 'Les plans de lecture et les méditations de Bible Strong arrivent chaque jour.',
      en: 'Bible Strong’s reading plans and meditations arrive every day.',
    },
    cta: discover,
    url: home,
    screenshot: shot('plans'),
  },
  {
    id: 'concordance',
    name: { fr: 'La Concordance des Saintes Écritures', en: 'The Concordance of the Holy Scriptures' },
    yesterday: {
      fr: 'Paris, Meyrueis, 1856. Fondée sur l’Ostervald, cherchée page après page.',
      en: 'Paris, Meyrueis, 1856. Based on the Ostervald, searched page after page.',
    },
    today: {
      fr: 'La recherche parcourt toute la Bible en un instant, et la concordance Strong suit chaque mot hébreu et grec.',
      en: 'Search runs through the whole Bible in an instant, and the Strong concordance follows every Hebrew and Greek word.',
    },
    cta: { fr: 'Ouvrir la concordance', en: 'Open the concordance' },
    url: { fr: site('/strong/fr/h5216'), en: site('/strong/en/h5216') },
    screenshot: shot('concordance'),
  },
  {
    id: 'bost',
    name: { fr: 'Le Dictionnaire de la Bible de Bost', en: 'Bost’s Bible Dictionary' },
    yesterday: {
      fr: 'Deux volumes, Paris, 1849.',
      en: 'Two volumes, Paris, 1849.',
    },
    today: {
      fr: 'Le même Bost, dans le dictionnaire de Bible Strong.',
      en: 'The same Bost, in Bible Strong’s dictionary.',
    },
    cta: { fr: 'Ouvrir le dictionnaire', en: 'Open the dictionary' },
    url: { fr: site('/dictionary/fr/bost'), en: site('/dictionary/en') },
    screenshot: shot('dictionary'),
  },
  {
    id: 'sander',
    name: { fr: 'Le dictionnaire hébreu-français', en: 'The Hebrew-French dictionary' },
    yesterday: {
      fr: 'Sander et Trenel, Paris, 1859 : le seul en français, fait pour les écoles juives.',
      en: 'Sander and Trenel, Paris, 1859: the only one in French, made for Jewish schools.',
    },
    today: {
      fr: 'Le lexique hébreu de Bible Strong, avec la prononciation de chaque mot.',
      en: 'Bible Strong’s Hebrew lexicon, with the pronunciation of every word.',
    },
    cta: { fr: 'Ouvrir le lexique hébreu', en: 'Open the Hebrew lexicon' },
    url: { fr: site('/strong/fr/h7676'), en: site('/strong/en/h7676') },
    screenshot: shot('hebrew'),
  },
  {
    id: 'lampe',
    name: { fr: 'La lampe à pétrole', en: 'The oil lamp' },
    yesterday: {
      fr: 'Le pétrole lampant coûte cher ; la bougie reste la règle.',
      en: 'Lamp oil is expensive; candles are still the rule.',
    },
    today: {
      fr: 'Le thème sombre et le mode sépia, pour lire tard le soir.',
      en: 'The dark theme and the sepia mode, for reading late in the evening.',
    },
    cta: { fr: 'Choisir un thème', en: 'Choose a theme' },
    url: { fr: site('/nave/fr'), en: site('/nave/en') },
    screenshot: shot('theme'),
  },
  {
    id: 'lettre',
    name: { fr: 'La lettre de Bâle', en: 'The letter from Basel' },
    yesterday: {
      fr: 'Des nouvelles de Bâle, au milieu de 1877 : M. Andrews a été gravement malade ; Mary relit les épreuves ; on compte les abonnés.',
      en: 'News from Basel, in mid-1877: Mr. Andrews has been gravely ill; Mary reads the proofs; the subscribers are counted.',
    },
    today: {
      fr: 'Les commentaires de la bibliothèque, à portée de main sous chaque verset.',
      en: 'The library’s commentaries, right under every verse.',
    },
    cta: { fr: 'Ouvrir les commentaires', en: 'Open the commentaries' },
    url: { fr: site('/commentary/fr'), en: site('/commentary/en') },
    screenshot: shot('commentaries'),
  },
]
