// John 1:5, public-domain translations. Checked 2026-09-20:
// https://www.biblegateway.com/passage/?search=Jean+1%3A5&version=LSG
// https://www.bible.com/fr/bible/compare/JHN.1.5 (Bible J.N.Darby)
// https://www.biblegateway.com/passage/?search=John+1%3A5&version=ASV%3BKJV
// Versions available: apps/expo/src/helpers/bibleVersions.ts (LSG, DBY, KJV, ASV).
export const comparisonsCopy = {
  fr: {
    label: 'LES COMPARAISONS',
    close: 'Fermer',
    next: 'Suivant',
    previous: 'Précédent',
    finish: 'Continuer l’exploration',
    progress: 'Étapes de découverte',
    titles: [
      'Un passage,\nplusieurs éclairages.',
      'Un mot change.\nLa lecture s’enrichit.',
      'À toi de\nrapprocher les textes.',
    ],
    descriptions: [
      'Lis le même verset dans plusieurs traductions. Un autre choix de mots peut éveiller une question.',
      'Observe les formulations de Jean 1.5. Qu’est-ce qui attire ton attention ?',
      'Choisis tes versions et prends le temps de lire les passages ensemble, dans leur contexte.',
    ],
    reference: 'JEAN 1.5',
    illustration: 'Deux lecteurs rapprochent différentes traductions bibliques',
    versions: [
      {
        code: 'LSG',
        name: 'Louis Segond 1910',
        before: 'La lumière luit dans les ténèbres, et les ténèbres ne l’ont point ',
        focus: 'reçue',
        after: '.',
      },
      {
        code: 'DBY',
        name: 'Bible Darby 1890',
        before: 'Et la lumière luit dans les ténèbres ; et les ténèbres ne l’ont pas ',
        focus: 'comprise',
        after: '.',
      },
    ],
    add: 'Ajouter Darby',
    remove: 'Masquer Darby',
    highlight: 'Éclairer les mots',
    clear: 'Masquer les repères',
    hint: 'Une même référence, deux traductions.',
    insight:
      '« Reçue », « comprise » : ces choix invitent à relire le passage. Comparer ouvre des pistes ; le contexte aide à les explorer.',
    steps: [
      {
        title: 'Choisis un passage',
        text: 'Depuis ta lecture, sélectionne un ou plusieurs versets à comparer.',
      },
      {
        title: 'Rapproche tes versions',
        text: 'Ajoute les traductions que tu souhaites lire et compare leurs formulations.',
      },
      {
        title: 'Poursuis ta lecture',
        text: 'Reviens au chapitre pour replacer chaque expression dans son contexte.',
      },
    ],
    more: 'Une nouvelle façon de lire',
    possibilities: 'Les versions se répondent. Ton étude prend de la profondeur.',
    open: 'Comparer dans Bible Strong',
  },
  en: {
    label: 'COMPARISONS',
    close: 'Close',
    next: 'Next',
    previous: 'Previous',
    finish: 'Keep exploring',
    progress: 'Discovery steps',
    titles: [
      'One passage,\nfresh perspectives.',
      'Different words.\nA closer reading.',
      'Bring the texts\ntogether.',
    ],
    descriptions: [
      'Read the same verse in different translations. Another choice of words can spark a question.',
      'Look at the wording of John 1:5. What catches your attention?',
      'Choose your versions and take time to read passages together, in their context.',
    ],
    reference: 'JOHN 1:5',
    illustration: 'Two readers bring different Bible translations together',
    versions: [
      {
        code: 'KJV',
        name: 'King James Version',
        before: 'And the light shineth in darkness; and the darkness ',
        focus: 'comprehended',
        after: ' it not.',
      },
      {
        code: 'ASV',
        name: 'American Standard Version',
        before: 'And the light shineth in the darkness; and the darkness ',
        focus: 'apprehended',
        after: ' it not.',
      },
    ],
    add: 'Add ASV',
    remove: 'Hide ASV',
    highlight: 'Light up the words',
    clear: 'Hide the highlights',
    hint: 'The same reference, two translations.',
    insight:
      '“Comprehended”, “apprehended”: these choices invite a second look. Comparing raises questions; context helps you explore them.',
    steps: [
      { title: 'Choose a passage', text: 'While reading, select one or more verses to compare.' },
      {
        title: 'Bring your versions together',
        text: 'Add the translations you want to read and compare their wording.',
      },
      {
        title: 'Keep reading',
        text: 'Return to the chapter to see each expression in its context.',
      },
    ],
    more: 'A fresh way to read',
    possibilities: 'Let translations inform one another and take your study further.',
    open: 'Compare in Bible Strong',
  },
}
