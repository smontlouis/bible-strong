import type { AtlasFamily } from './atlasRoutes'

// Interface strings of the atlas pages, indexed by the language of the page.
// `{name}` marks are filled in by the page.
export const ATLAS_MESSAGES = {
  fr: {
    name: 'Atlas de la Bible',
    homeEyebrow: 'Personnages, lieux et peuples',
    homeTitle: 'L’Atlas de la Bible',
    homeLead:
      '{entities} personnages, lieux, peuples et êtres de la Bible, chacun avec les chapitres qui le nomment. Les grandes figures sont peintes.',
    homeHeadTitle: 'Atlas de la Bible – personnages, lieux et peuples bibliques',
    homeHeadDescription:
      'Découvrez {entities} personnages, lieux, peuples et êtres de la Bible : portraits, étapes de vie, relations, carte des lieux et passages bibliques.',
    families: {
      people: 'Personnages',
      places: 'Lieux',
      groups: 'Peuples et groupes',
      beings: 'Dieu, anges et dieux',
      others: 'Temps, titres et mots',
    } satisfies Record<AtlasFamily, string>,
    familyLeads: {
      people:
        'Les hommes et les femmes de la Bible, des patriarches aux apôtres. Les plus nommés sont peints.',
      places: 'Les villes, les montagnes, les fleuves et les pays de l’histoire biblique.',
      groups: 'Les peuples, les tribus et les familles qui traversent le récit.',
      beings: 'Dieu, les anges, Satan et les dieux des nations, que la Bible nomme.',
      others: 'Les fêtes, les mois, les titres, les langues, les étoiles et les mots du texte.',
    } satisfies Record<AtlasFamily, string>,
    familyHeadTitle: '{family} de la Bible – Atlas de la Bible',
    familyHeadDescriptions: {
      people:
        '{count} personnages de la Bible, avec leurs portraits, leurs liens de famille et les passages qui les nomment.',
      places:
        '{count} lieux de la Bible sur une carte, avec leurs peintures et les passages qui les nomment.',
      groups: '{count} peuples, tribus et familles de la Bible, avec les passages qui les nomment.',
      beings:
        'Dieu, les anges, Satan et les dieux des nations : {count} êtres que la Bible nomme, avec leurs passages.',
      others:
        '{count} fêtes, mois, titres, langues, étoiles et mots de la Bible, avec les passages qui les nomment.',
    } satisfies Record<AtlasFamily, string>,
    count: '{count} entrées',
    seeAll: 'Tout voir',
    series: 'Les séries',
    seriesLead: 'Les grandes figures, dans l’ordre de l’histoire.',
    painted: 'Les figures peintes',
    mostNamed: 'Les plus nommés',
    map: 'La carte des lieux',
    mapLead:
      '{places} lieux situés, de Rome à la Perse. Faites glisser pour vous déplacer, utilisez la molette ou les boutons pour zoomer.',
    mapZoomIn: 'Zoomer',
    mapZoomOut: 'Dézoomer',
    mapReset: 'Revenir à toute la carte',
    mapHoly: 'La Terre promise',
    mapLabel: 'Carte des lieux de la Bible',
    search: 'Chercher un nom',
    searchPlaceholder: 'David, Jérusalem, Philistins…',
    searchEmpty: 'Aucune entrée ne porte ce nom.',
    chapters: { one: 'Nommé dans 1 chapitre', other: 'Nommé dans {count} chapitres' },
    chaptersShort: { one: '1 chapitre', other: '{count} chapitres' },
    roles: 'Rôles',
    strong: 'Numéros Strong',
    stages: 'Étapes de vie',
    portrait: 'Portrait',
    about: 'Qui est-ce',
    aboutPlace: 'Le lieu',
    relations: 'Ses liens',
    passages: 'Où la Bible le nomme',
    passagesCount: '{chapters} chapitres, {verses} versets',
    seriesPlace: '{rank} sur {total}',
    location: 'Où se trouve ce lieu',
    locationUnknown: 'L’emplacement de ce lieu n’est pas connu.',
    region: 'Région',
    openMap: 'Voir sur une carte',
    uncertain: 'incertain',
    entityHeadTitle: '{name} – {brief} | Atlas de la Bible',
    entityHeadTitlePlain: '{name} dans la Bible | Atlas de la Bible',
    entityHeadTitleNamed: '{brief} | Atlas de la Bible',
    entityFallbackDescription:
      '{name} dans la Bible : qui est-ce, ses liens et les passages qui le nomment.',
    cards: 'Ses cartes',
    allCards: 'Toutes les cartes',
    cardsName: 'Cartes de la Bible',
    cardsTitle: 'Les cartes de la Bible',
    cardsLead:
      '{cards} cartes peintes : une pour chaque grande figure de la Bible et pour chacune de ses étapes de vie. Touchez une carte pour l’ouvrir, encore une fois pour la retourner.',
    cardsHeadTitle: 'Les cartes des personnages de la Bible – Atlas de la Bible',
    cardsHeadDescription:
      '{cards} cartes illustrées des personnages de la Bible : leur nom en hébreu ou en grec, une phrase de la Bible, leurs étapes de vie. Triez-les, filtrez-les, ouvrez un paquet.',
    cardHeadTitle: '{name} – {title} | Cartes de la Bible',
    cardHeadDescription: '{name}, {title} : « {sentence} » ({source}). {brief}.',
    cardsCount: { one: '1 carte', other: '{count} cartes' },
    cardsEntry: 'Parcourir les cartes',
    cardsEntryLead:
      'Chaque grande figure a sa carte, et chacune de ses étapes de vie la sienne. Triez-les, filtrez-les, ou ouvrez un paquet de cinq au hasard.',
    breadcrumbHome: 'Atlas',
    // The kinds of relation of the entity publication, in the order a page groups them.
    relationKinds: {
      father: 'Père',
      mother: 'Mère',
      partner: 'Conjoints',
      sibling: 'Frères et sœurs',
      offspring: 'Enfants',
      founder_or_origin: 'Fondateur ou origine',
      resident: 'Habitants',
    } as Record<string, string>,
  },
  en: {
    name: 'Bible Atlas',
    homeEyebrow: 'People, places and nations',
    homeTitle: 'The Bible Atlas',
    homeLead:
      '{entities} people, places, nations and beings of the Bible, each with the chapters that name it. The great figures are painted.',
    homeHeadTitle: 'Bible Atlas – people, places and nations of the Bible',
    homeHeadDescription:
      'Discover {entities} people, places, nations and beings of the Bible: portraits, life stages, relations, a map of places and Bible passages.',
    families: {
      people: 'People',
      places: 'Places',
      groups: 'Nations and groups',
      beings: 'God, angels and gods',
      others: 'Times, titles and words',
    } satisfies Record<AtlasFamily, string>,
    familyLeads: {
      people:
        'The men and women of the Bible, from the patriarchs to the apostles. The most named are painted.',
      places: 'The cities, mountains, rivers and lands of biblical history.',
      groups: 'The nations, tribes and families that run through the story.',
      beings: 'God, the angels, Satan and the gods of the nations, as the Bible names them.',
      others: 'The feasts, months, titles, languages, stars and words of the text.',
    } satisfies Record<AtlasFamily, string>,
    familyHeadTitle: '{family} of the Bible – Bible Atlas',
    familyHeadDescriptions: {
      people:
        '{count} people of the Bible, with their portraits, their families and the passages that name them.',
      places:
        '{count} places of the Bible on a map, with their paintings and the passages that name them.',
      groups:
        '{count} nations, tribes and families of the Bible, with the passages that name them.',
      beings:
        'God, the angels, Satan and the gods of the nations: {count} beings the Bible names, with their passages.',
      others:
        '{count} feasts, months, titles, languages, stars and words of the Bible, with the passages that name them.',
    } satisfies Record<AtlasFamily, string>,
    count: '{count} entries',
    seeAll: 'See all',
    series: 'The series',
    seriesLead: 'The great figures, in the order of the story.',
    painted: 'The painted figures',
    mostNamed: 'The most named',
    map: 'The map of places',
    mapLead:
      '{places} located places, from Rome to Persia. Drag to move around, use the wheel or the buttons to zoom.',
    mapZoomIn: 'Zoom in',
    mapZoomOut: 'Zoom out',
    mapReset: 'Back to the whole map',
    mapHoly: 'The Promised Land',
    mapLabel: 'Map of the places of the Bible',
    search: 'Search a name',
    searchPlaceholder: 'David, Jerusalem, Philistines…',
    searchEmpty: 'No entry has this name.',
    chapters: { one: 'Named in 1 chapter', other: 'Named in {count} chapters' },
    chaptersShort: { one: '1 chapter', other: '{count} chapters' },
    roles: 'Roles',
    strong: 'Strong’s numbers',
    stages: 'Life stages',
    portrait: 'Portrait',
    about: 'Who is this',
    aboutPlace: 'The place',
    relations: 'Relations',
    passages: 'Where the Bible names it',
    passagesCount: '{chapters} chapters, {verses} verses',
    seriesPlace: '{rank} of {total}',
    location: 'Where this place lies',
    locationUnknown: 'Where this place lay is not known.',
    region: 'Region',
    openMap: 'See on a map',
    uncertain: 'uncertain',
    entityHeadTitle: '{name} – {brief} | Bible Atlas',
    entityHeadTitlePlain: '{name} in the Bible | Bible Atlas',
    entityHeadTitleNamed: '{brief} | Bible Atlas',
    entityFallbackDescription:
      '{name} in the Bible: who this is, relations and the passages that name it.',
    cards: 'Cards',
    allCards: 'All the cards',
    cardsName: 'Bible cards',
    cardsTitle: 'The cards of the Bible',
    cardsLead:
      '{cards} painted cards: one for each great figure of the Bible and one for each of their life stages. Tap a card to open it, and once more to turn it over.',
    cardsHeadTitle: 'Cards of the people of the Bible – Bible Atlas',
    cardsHeadDescription:
      '{cards} illustrated cards of the people of the Bible: their name in Hebrew or Greek, a sentence from the Bible, their life stages. Sort them, filter them, open a pack.',
    cardHeadTitle: '{name} – {title} | Bible cards',
    cardHeadDescription: '{name}, {title}: “{sentence}” ({source}). {brief}.',
    cardsCount: { one: '1 card', other: '{count} cards' },
    cardsEntry: 'Browse the cards',
    cardsEntryLead:
      'Each great figure has a card, and each of their life stages has its own. Sort them, filter them, or open a pack of five at random.',
    breadcrumbHome: 'Atlas',
    relationKinds: {
      father: 'Father',
      mother: 'Mother',
      partner: 'Spouses',
      sibling: 'Brothers and sisters',
      offspring: 'Children',
      founder_or_origin: 'Founder or origin',
      resident: 'Residents',
    } as Record<string, string>,
  },
} as const

export type AtlasMessages = (typeof ATLAS_MESSAGES)[keyof typeof ATLAS_MESSAGES]

/** « Nommé dans 12 chapitres », with the one and the many told apart. */
export const countLabel = (
  forms: { one: string; other: string },
  count: number,
  language: 'fr' | 'en'
) => (count === 1 ? forms.one : forms.other.replace('{count}', count.toLocaleString(language)))
