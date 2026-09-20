// Quotations checked against LSG and KJV on 2026-09-20.
// Ecclesiastes 1:2: https://www.biblegateway.com/passage/?search=Ecclesiastes+1:2&version=LSG;KJV
// Psalm: LSG printed numbering 39:6 corresponds to KJV 39:5.
// https://www.biblegateway.com/passage/?search=Psalm+39:5&version=LSG;KJV
export const lexiconCopy = {
  fr: {
    // The deployed app still uses query-based Strong routes (ADR-0053 is not deployed).
    lexiconUrl: 'https://web.bible-strong.app/strong?book=1&reference=1892&bibleVersion=LSG',
    label: 'LE LEXIQUE',
    close: 'Fermer',
    next: 'Suivant',
    previous: 'Précédent',
    progress: 'Étapes de découverte',
    titles: [
      'Derrière un mot,\nun monde.',
      'Un mot qui\nprend vie.',
      'Un mot.\nPlusieurs horizons.',
    ],
    descriptions: [
      'Explore les mots hébreux et grecs de la Bible, même sans connaître ces langues.',
      'Lis le mot original, écoute sa prononciation et découvre ses nuances.',
      'Retrouve le même mot dans différents passages. Le contexte éclaire son sens.',
    ],
    touch: 'Touche le mot surligné',
    reference: 'ECCLÉSIASTE 1.2 · LSG',
    before: 'Vanité des vanités, dit l’Ecclésiaste, vanité des vanités, tout est ',
    word: 'vanité',
    after: '.',
    revealed: 'Tu viens de retrouver le mot hébreu !',
    meaning: 'souffle · vapeur · vanité',
    definition:
      'Un souffle, une vapeur : une image de ce qui est passager. Selon le contexte, le mot évoque aussi la vanité.',
    language: 'HÉBREU · NOM COMMUN',
    listen: 'Écouter le mot',
    playing: 'Écoute…',
    loading: 'Chargement…',
    audioError: 'Le son est indisponible. Réessaie.',
    passages: [
      {
        label: 'Vanité',
        reference: 'Ecclésiaste 1.2 · LSG',
        text: 'Vanité des vanités, dit l’Ecclésiaste, vanité des vanités, tout est vanité.',
      },
      {
        label: 'Souffle',
        reference: 'Psaumes 39.6 · LSG · extrait',
        text: '… Oui, tout homme debout n’est qu’un souffle. — Pause.',
      },
    ],
    more: 'Et ce n’est que le début…',
    possibilities:
      'Recherche des mots, explore leurs liens et approfondis les définitions dans Bible Strong.',
    open: 'Ouvrir le lexique',
    finish: 'Continuer l’exploration',
    illustration: 'Un lecteur explore les mots hébreux et grecs avec une loupe',
  },
  en: {
    lexiconUrl: 'https://web.bible-strong.app/strong?book=1&reference=1892&bibleVersion=KJV',
    label: 'THE LEXICON',
    close: 'Close',
    next: 'Next',
    previous: 'Previous',
    progress: 'Discovery steps',
    titles: ['Behind a word,\na world.', 'A word\ncomes alive.', 'One word.\nNew horizons.'],
    descriptions: [
      'Explore the Hebrew and Greek words of the Bible, even without knowing these languages.',
      'Read the original word, hear its pronunciation and explore its shades of meaning.',
      'Find the same word in different passages. Context helps reveal its meaning.',
    ],
    touch: 'Tap the highlighted word',
    reference: 'ECCLESIASTES 1:2 · KJV',
    before: 'Vanity of vanities, saith the Preacher, vanity of vanities; all is ',
    word: 'vanity',
    after: '.',
    revealed: 'You found the Hebrew word!',
    meaning: 'breath · vapour · vanity',
    definition:
      'A breath, a vapour: an image of something fleeting. Depending on context, the word can also express vanity.',
    language: 'HEBREW · NOUN',
    listen: 'Listen to the word',
    playing: 'Listen…',
    loading: 'Loading…',
    audioError: 'Audio is unavailable. Please try again.',
    passages: [
      {
        label: 'Vanity',
        reference: 'Ecclesiastes 1:2 · KJV',
        text: 'Vanity of vanities, saith the Preacher, vanity of vanities; all is vanity.',
      },
      {
        label: 'Vanity',
        reference: 'Psalm 39:5 · KJV · excerpt',
        text: '… verily every man at his best state is altogether vanity. Selah.',
      },
    ],
    more: 'And this is just the beginning…',
    possibilities:
      'Search for words, explore their connections and dig into definitions in Bible Strong.',
    open: 'Open the lexicon',
    finish: 'Keep exploring',
    illustration: 'A reader explores Hebrew and Greek words with a magnifying glass',
  },
}
