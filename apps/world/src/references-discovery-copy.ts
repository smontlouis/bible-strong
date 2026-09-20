// Quotes verified against Bible Gateway's public-domain LSG and KJV (2026-09-20).
// https://www.biblegateway.com/passage/?search=Psalm+23%3A1&version=LSG%3BKJV
// https://www.biblegateway.com/passage/?search=John+10%3A11&version=LSG%3BKJV
// https://www.biblegateway.com/passage/?search=Isaiah+40%3A11&version=LSG%3BKJV
// These are editorially selected connections, not a live Tresor query.
export const referencesCopy = {
  fr: {
    label: 'LES RÉFÉRENCES',
    close: 'Fermer',
    previous: 'Précédent',
    next: 'Suivant',
    finish: 'Continuer l’exploration',
    progress: 'Étapes de découverte',
    titles: [
      'Un verset,\nmille connexions.',
      'Suis le fil\nd’une image.',
      'Laisse la Bible\néclairer la Bible.',
    ],
    descriptions: [
      'Et si ta lecture était le début d’un voyage ? Découvre les passages qui lui font écho.',
      'Un berger dans un psaume, une parole de Jésus, une promesse : touche un passage pour explorer le lien.',
      'Les références croisées ouvrent de nouvelles pistes. Lis chaque passage dans son contexte pour aller plus loin.',
    ],
    illustration: 'Des lecteurs relient des passages bibliques entre eux',
    reference: 'Psaumes 23.1 · LSG · extrait',
    before: 'L’Éternel est mon ',
    word: 'berger',
    after: ': je ne manquerai de rien.',
    touch: 'Révéler les passages liés',
    hide: 'Masquer les passages liés',
    connected: 'Deux pistes à explorer : Jean 10.11 et Ésaïe 40.11.',
    thread: 'L’image du berger',
    hint: 'Touche une référence',
    passages: [
      {
        label: 'Le berger qui donne sa vie',
        reference: 'Jean 10.11 · LSG',
        text: 'Je suis le bon berger. Le bon berger donne sa vie pour ses brebis.',
        insight: 'Dans l’Évangile, Jésus reprend l’image du berger pour parler de lui-même.',
      },
      {
        label: 'Le berger qui prend soin',
        reference: 'Ésaïe 40.11 · LSG',
        text: 'Comme un berger, il paîtra son troupeau, Il prendra les agneaux dans ses bras, Et les portera dans son sein; Il conduira les brebis qui allaitent.',
        insight: 'Chez Ésaïe, cette image exprime le soin porté au troupeau et aux plus fragiles.',
      },
    ],
    steps: [
      { title: 'Pars d’un verset', text: 'Sélectionne un verset pendant ta lecture.' },
      {
        title: 'Ouvre ses références',
        text: 'Découvre les passages associés dans les outils d’étude.',
      },
      { title: 'Poursuis ta lecture', text: 'Ouvre un passage lié et lis ce qui l’entoure.' },
    ],
    more: 'À toi de suivre le fil.',
    possibilities: 'Commence avec le Psaume 23 dans Bible Strong.',
    open: 'Ouvrir la Bible',
    url: 'https://web.bible-strong.app/bible-view?book=19&chapter=23&version=LSG',
  },
  en: {
    label: 'CROSS REFERENCES',
    close: 'Close',
    previous: 'Previous',
    next: 'Next',
    finish: 'Keep exploring',
    progress: 'Discovery steps',
    titles: [
      'One verse,\nso many connections.',
      'Follow\nthe thread.',
      'Let Scripture\nilluminate Scripture.',
    ],
    descriptions: [
      'What if your reading was the start of a journey? Discover passages that echo one another.',
      'A shepherd in a psalm, the words of Jesus, a promise: tap a passage to explore the connection.',
      'Cross references open new paths. Read each passage in context to explore further.',
    ],
    illustration: 'Readers connecting Bible passages to one another',
    reference: 'Psalm 23:1 · KJV',
    before: 'The LORD is my ',
    word: 'shepherd',
    after: '; I shall not want.',
    touch: 'Reveal related passages',
    hide: 'Hide related passages',
    connected: 'Two paths to explore: John 10:11 and Isaiah 40:11.',
    thread: 'The image of the shepherd',
    hint: 'Tap a reference',
    passages: [
      {
        label: 'The shepherd who gives his life',
        reference: 'John 10:11 · KJV',
        text: 'I am the good shepherd: the good shepherd giveth his life for the sheep.',
        insight: 'In the Gospel, Jesus uses the image of the shepherd to speak about himself.',
      },
      {
        label: 'The shepherd who cares',
        reference: 'Isaiah 40:11 · KJV',
        text: 'He shall feed his flock like a shepherd: he shall gather the lambs with his arm, and carry them in his bosom, and shall gently lead those that are with young.',
        insight:
          'In Isaiah, this image expresses care for the flock and its most vulnerable members.',
      },
    ],
    steps: [
      { title: 'Start with a verse', text: 'Select a verse as you read.' },
      { title: 'Open its references', text: 'Discover related passages in the study tools.' },
      { title: 'Keep reading', text: 'Open a related passage and read the surrounding verses.' },
    ],
    more: 'Your turn to follow the thread.',
    possibilities: 'Start with Psalm 23 in Bible Strong.',
    open: 'Open the Bible',
    url: 'https://web.bible-strong.app/bible-view?book=19&chapter=23&version=KJV',
  },
}
