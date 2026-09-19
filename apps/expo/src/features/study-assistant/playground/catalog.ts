import type { StudyWidget } from '@bible-strong/ai-contract/contract'
export type WidgetExample = {
  id: string
  category: string
  title: string
  description: string
  prompt: string
  checks: string[]
  widget: StudyWidget
}
export type WidgetStory = {
  id: string
  category: string
  title: string
  description: string
  states: { exampleId: string; label: string }[]
}
const passage = (book: number, chapter: number, start: number, end = start, version = 'LSG') => ({
  book,
  chapter,
  start,
  end,
  version,
})
const base = { id: 'w1', language: 'fr' as const }
export const widgetExamples: WidgetExample[] = [
  {
    id: 'passages',
    category: 'Bible',
    title: 'Passages bibliques',
    description:
      'Les passages réunis dans une liste simple : textes exacts, références cliquables et ouverture dans la Bible.',
    prompt: 'Montre-moi quatre passages bibliques sur la patience.',
    checks: [
      'Cliquer sur une référence pour afficher son aperçu.',
      'Agrandir pour lire ou ouvrir le passage dans la Bible.',
    ],
    widget: {
      ...base,
      kind: 'passages',
      title: 'La patience dans les Écritures',
      passages: [passage(19, 37, 7), passage(59, 5, 7, 8), passage(45, 8, 25), passage(58, 6, 15)],
    },
  },
  {
    id: 'translations',
    category: 'Bible',
    title: 'Comparaison de traductions',
    description:
      'Un même passage dans plusieurs éditions, avec un choix de versions et un surlignage des différences de formulation.',
    prompt: 'Compare Jean 3:16 dans la Louis Segond et la Darby française.',
    checks: [
      'Changer la traduction dans le sélecteur.',
      'Souligner les différences ; essayer aussi une version sans couverture.',
    ],
    widget: {
      ...base,
      kind: 'translation_comparison',
      title: 'Jean 3:16 · deux traductions',
      passages: [passage(43, 3, 16), passage(43, 3, 16, 16, 'DBY')],
    },
  },
  {
    id: 'concordance',
    category: 'Mots & lexique',
    title: 'Concordance',
    description:
      'Les versets associés au Strong, avec les mots correspondants en emphase, un filtre par livre et la suite des résultats.',
    prompt: 'Montre les passages associés au Strong H7050.',
    checks: ['Filtrer sur Zacharie.', 'Revenir à tous les livres et afficher la suite.'],
    widget: {
      ...base,
      kind: 'concordance',
      title: 'H7050',
      reference: 'H7050',
      identityKind: 'strong',
      scope: 'classic_family',
    },
  },
  {
    id: 'strong',
    category: 'Mots & lexique',
    title: 'Fiche Strong',
    description:
      'L’identité lexicale précise : langue originale, translittération, définition et prononciation lorsqu’elle existe.',
    prompt: 'Montre la fiche du mot hébreu H7050A et explique brièvement son sens.',
    checks: ['Écouter la prononciation.', 'Ouvrir l’entrée complète sans perdre son suffixe.'],
    widget: {
      ...base,
      kind: 'strong_entry',
      title: 'H7050A · fronde',
      reference: 'H7050A',
      identityKind: 'dstrong',
      scope: 'precise_identity',
    },
  },
  {
    id: 'words',
    category: 'Mots & lexique',
    title: 'Mots du verset',
    description:
      'Les mots cliquables du modal Lexique : un clic remplace le verset par sa fiche Strong, puis Retour au verset permet de revenir.',
    prompt: 'J’aimerais explorer les mots de Jean 15:4 pour comprendre ce que signifie demeurer.',
    checks: [
      'Cliquer sur Demeurez.',
      'Lire la fiche G3306, puis revenir au verset pour choisir un autre mot.',
    ],
    widget: {
      ...base,
      kind: 'verse_analysis',
      title: 'Explorer Jean 15:4',
      passages: [passage(43, 15, 4)],
    },
  },
  {
    id: 'commentaries',
    category: 'Ressources',
    title: 'Commentaires comparés',
    description:
      'Des extraits attribués à leurs auteurs, regroupés pour comparer leurs lectures du même passage.',
    prompt: 'Compare les commentaires de Clarke et Barnes sur Jean 15:4, avec leurs extraits.',
    checks: [
      'Comparer les deux auteurs en grand format.',
      'Ouvrir la section exacte du commentaire.',
    ],
    widget: {
      ...base,
      kind: 'commentary_comparison',
      title: 'Jean 15:4 · Clarke et Barnes',
      sources: [],
    },
  },
  {
    id: 'dictionaries',
    category: 'Ressources',
    title: 'Articles de dictionnaires',
    description:
      'Plusieurs articles sur un même mot, avec leur attribution et un accès direct à chaque dictionnaire.',
    prompt:
      'Cherche la patience dans les dictionnaires Calmet et Westphal et montre leurs articles.',
    checks: [
      'Comparer les extraits de Calmet et Westphal.',
      'Cliquer sur un titre pour afficher son aperçu.',
    ],
    widget: {
      ...base,
      kind: 'dictionary_articles',
      title: 'Patience · deux dictionnaires',
      sources: [],
    },
  },
  {
    id: 'nave',
    category: 'Ressources',
    title: 'Thème Nave',
    description:
      'Une entrée thématique avec ses subdivisions, références et liens vers les thèmes voisins.',
    prompt: 'Montre le thème Patience dans Nave avec ses références bibliques.',
    checks: ['Ouvrir une référence biblique.', 'Ouvrir le thème complet dans l’app.'],
    widget: { ...base, kind: 'nave_topic', title: 'Patience', topic: 'patience' },
  },
  {
    id: 'person',
    category: 'Personnes & histoire',
    title: 'Fiche personnage',
    description:
      'La présentation éditoriale d’un personnage biblique et les liens vers ses passages et entrées lexicales.',
    prompt: 'Montre-moi la fiche biblique d’Adam.',
    checks: ['Agrandir pour lire le profil détaillé.', 'Ouvrir le personnage dans l’app.'],
    widget: { ...base, kind: 'person_profile', title: 'Adam', entityKey: 'Adam@Gen.2.19-Jud' },
  },
  {
    id: 'relations',
    category: 'Personnes & histoire',
    title: 'Relations entre personnages',
    description:
      'Le graphe existant de l’app pour explorer les liens familiaux. Les relations reflètent les données et leur degré de certitude.',
    prompt: 'Montre les relations familiales d’Adam dans un graphe.',
    checks: [
      'Agrandir et sélectionner une personne reliée.',
      'Consulter le détail des relations et leur certitude.',
    ],
    widget: {
      ...base,
      kind: 'entity_relations',
      title: 'Autour d’Adam',
      entityKey: 'Adam@Gen.2.19-Jud',
    },
  },
  {
    id: 'place',
    category: 'Personnes & histoire',
    title: 'Fiche lieu',
    description:
      'Le profil d’un lieu, ses références et un lien cartographique uniquement lorsque des coordonnées sont fournies.',
    prompt: 'Montre-moi la fiche de Jéricho et sa localisation.',
    checks: [
      'Consulter les coordonnées attribuées à la ressource.',
      'Ouvrir la fiche complète ou la carte.',
    ],
    widget: { ...base, kind: 'place_profile', title: 'Jéricho', entityKey: 'Jericho@Num.22.1-Heb' },
  },
  {
    id: 'timeline',
    category: 'Personnes & histoire',
    title: 'Frise chronologique',
    description:
      'Des événements ordonnés à partir de leurs dates sourcées. Les dates incertaines ou inconnues restent explicites.',
    prompt: 'Place la naissance et la résurrection de Jésus sur une frise chronologique.',
    checks: ['Agrandir la frise.', 'Ouvrir le détail d’un événement.'],
    widget: {
      ...base,
      kind: 'event_timeline',
      title: 'De la naissance à la résurrection',
      events: ['incarnation-of-jesus', 'the-resurrection'],
    },
  },
  {
    id: 'book',
    category: 'Lecture',
    title: 'Présentation d’un livre',
    description:
      'Les panoramas disponibles, la structure éditoriale lorsqu’elle existe et une navigation vers chaque chapitre.',
    prompt: 'Présente la Genèse avec ses panoramas disponibles et ses chapitres.',
    checks: ['Ouvrir un panorama vidéo.', 'Déplier les chapitres et ouvrir Genèse 2.'],
    widget: {
      ...base,
      kind: 'book_overview',
      title: 'Découvrir la Genèse',
      book: 1,
      version: 'LSG',
    },
  },
  {
    id: 'plan',
    category: 'Lecture',
    title: 'Étape de plan de lecture',
    description:
      'Le contenu éditorial d’une étape, sans inscription au plan ni modification de la progression personnelle.',
    prompt: 'Affiche le premier jour du plan Lire Philippiens, sans démarrer le plan.',
    checks: ['Ouvrir la référence de Philippiens 1.', 'Ouvrir la lecture complète.'],
    widget: {
      ...base,
      kind: 'reading_plan',
      title: 'Philippiens · jour 1',
      planId: 'bible-strong-philippians-fr',
      readingId: 'day-001',
    },
  },
  {
    id: 'meditation',
    category: 'Lecture',
    title: 'Méditation accompagnée',
    description:
      'Le texte original de la méditation, son attribution et une piste de réflexion clairement séparée de la source.',
    prompt:
      'Affiche la méditation de la Bonne Semence du 17 septembre 2026 avec une question pour réfléchir.',
    checks: [
      'Lire le contenu en faisant défiler la carte.',
      'Distinguer la piste de réflexion du texte éditorial.',
    ],
    widget: {
      ...base,
      kind: 'meditation',
      title: 'La compassion du smartphone',
      planId: 'la-bonne-semence-2026',
      readingId: '2026-09-17',
      reflection:
        'Exemple de piste : comment pourrais-je montrer davantage de patience dans mes échanges numériques ?',
    },
  },
  {
    id: 'resources',
    category: 'Ressources',
    title: 'Pour approfondir',
    description:
      'Une sélection de ressources ouvrables. Une suggestion n’est pas présentée comme un document déjà lu par l’assistant.',
    prompt:
      'Quelles ressources de l’application puis-je consulter pour approfondir la patience dans Jacques 5 ?',
    checks: [
      'Ouvrir un dictionnaire ou un commentaire.',
      'Vérifier la distinction entre suggestion et source consultée.',
    ],
    widget: {
      ...base,
      kind: 'further_resources',
      title: 'Approfondir la patience',
      items: [
        { kind: 'nave', id: 'patience', label: 'Patience · Nave', language: 'fr' },
        {
          kind: 'dictionary',
          id: '10591',
          work: 'westphal',
          word: 'Patience',
          label: 'Patience · Westphal',
          language: 'fr',
        },
        {
          kind: 'commentary',
          id: 'acbc',
          book: 59,
          chapter: 5,
          label: 'Jacques 5 · Adam Clarke',
          language: 'fr',
        },
      ],
    },
  },
]

export const widgetStories: WidgetStory[] = [
  {
    id: 'passage-widget',
    category: 'Bible',
    title: 'PassageWidget',
    description:
      'Le composant des textes bibliques exacts, partagé entre une liste de passages et une comparaison de traductions.',
    states: [
      { exampleId: 'passages', label: 'Passages' },
      { exampleId: 'translations', label: 'Traductions' },
    ],
  },
  {
    id: 'verse-analysis-widget',
    category: 'Bible',
    title: 'VerseAnalysisWidget',
    description:
      'Le composant d’exploration des mots d’un verset : texte aligné, sélection d’un mot et remplacement par sa fiche Strong.',
    states: [{ exampleId: 'words', label: 'Mots du verset' }],
  },
  {
    id: 'concordance-widget',
    category: 'Mots & lexique',
    title: 'ConcordanceWidget',
    description:
      'La concordance d’un identifiant Strong, avec décompte, filtre par livre, pagination et mots correspondants en emphase.',
    states: [{ exampleId: 'concordance', label: 'Résultats' }],
  },
  {
    id: 'strong-entry-widget',
    category: 'Mots & lexique',
    title: 'StrongWidget',
    description:
      'La fiche d’une identité lexicale précise : original, translittération, définition, morphologie et prononciation.',
    states: [{ exampleId: 'strong', label: 'Fiche' }],
  },
  {
    id: 'source-group-widget',
    category: 'Ressources',
    title: 'SourceGroupWidget',
    description:
      'Le comparateur de contenus attribués. Il présente plusieurs lectures réelles sans mélanger leurs auteurs ni leurs œuvres.',
    states: [
      { exampleId: 'commentaries', label: 'Commentaires' },
      { exampleId: 'dictionaries', label: 'Dictionnaires' },
    ],
  },
  {
    id: 'nave-widget',
    category: 'Ressources',
    title: 'NaveWidget',
    description:
      'L’entrée thématique Nave, avec ses subdivisions, ses références et l’ouverture du thème complet.',
    states: [{ exampleId: 'nave', label: 'Thème' }],
  },
  {
    id: 'further-resources-widget',
    category: 'Ressources',
    title: 'FurtherResourcesWidget',
    description:
      'Une liste de ressources réellement ouvrables pour poursuivre l’étude dans les différents catalogues de l’app.',
    states: [{ exampleId: 'resources', label: 'Suggestions' }],
  },
  {
    id: 'entity-widget',
    category: 'Personnes & histoire',
    title: 'EntityWidget',
    description:
      'Le composant partagé des entités bibliques : profils de personnes, relations et lieux documentés.',
    states: [
      { exampleId: 'person', label: 'Personnage' },
      { exampleId: 'relations', label: 'Relations' },
      { exampleId: 'place', label: 'Lieu' },
    ],
  },
  {
    id: 'timeline-widget',
    category: 'Personnes & histoire',
    title: 'TimelineWidget',
    description:
      'Une chronologie de plusieurs événements lus, avec dates sourcées, approximations et ouverture des détails.',
    states: [{ exampleId: 'timeline', label: 'Événements' }],
  },
  {
    id: 'book-widget',
    category: 'Lecture',
    title: 'BookWidget',
    description:
      'La présentation d’un livre biblique : panoramas disponibles, structure éditoriale et accès aux chapitres.',
    states: [{ exampleId: 'book', label: 'Présentation' }],
  },
  {
    id: 'reading-widget',
    category: 'Lecture',
    title: 'ReadingWidget',
    description:
      'Le lecteur de contenu éditorial sans écriture personnelle, partagé entre les étapes de plan et les méditations.',
    states: [
      { exampleId: 'plan', label: 'Plan de lecture' },
      { exampleId: 'meditation', label: 'Méditation' },
    ],
  },
]

export function resolveWidgetStory(widgetId?: string, stateId?: string) {
  const story =
    widgetStories.find(item => item.id === widgetId) ||
    widgetStories.find(item => item.states.some(state => state.exampleId === widgetId)) ||
    widgetStories.find(item => item.states.some(state => state.exampleId === stateId)) ||
    widgetStories[0]
  const state =
    story.states.find(item => item.exampleId === stateId) ||
    story.states.find(item => item.exampleId === widgetId) ||
    story.states[0]
  const example = widgetExamples.find(item => item.id === state.exampleId)
  if (!example) throw new Error(`Unknown widget playground state: ${state.exampleId}`)
  return { story, state, example }
}
