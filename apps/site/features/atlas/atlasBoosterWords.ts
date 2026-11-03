// The words of the packs, apart from the packs themselves: the gallery shows its button long
// before a pack is opened, and loads the packs only then.
export const BOOSTER_WORDS = {
  fr: {
    open: 'Ouvrir un paquet',
    choose: 'Choisissez un paquet',
    chooseLead:
      'Cinq cartes au hasard, à retourner une à une. Rien n’est gardé : ouvrez-en autant que vous voulez.',
    everything: 'Toute la Bible',
    brand: 'Atlas de la Bible',
    cards: '{count} cartes',
    perPack: '{count} cartes',
    tear: 'Touchez le paquet ou glissez dessus pour le déchirer',
    turn: 'Touchez une carte pour la retourner',
    look: 'Touchez une carte pour l’ouvrir',
    turnAll: 'Tout retourner',
    again: 'Un autre paquet',
    other: 'Changer de paquet',
    close: 'Fermer',
    hidden: 'Carte face cachée, {rank} sur {count}',
  },
  en: {
    open: 'Open a pack',
    choose: 'Choose a pack',
    chooseLead:
      'Five cards at random, to turn over one by one. Nothing is kept: open as many as you like.',
    everything: 'The whole Bible',
    brand: 'Bible Atlas',
    cards: '{count} cards',
    perPack: '{count} cards',
    tear: 'Tap the pack or swipe across it to tear it open',
    turn: 'Tap a card to turn it over',
    look: 'Tap a card to open it',
    turnAll: 'Turn them all',
    again: 'Another pack',
    other: 'Another kind of pack',
    close: 'Close',
    hidden: 'Card face down, {rank} of {count}',
  },
} as const
