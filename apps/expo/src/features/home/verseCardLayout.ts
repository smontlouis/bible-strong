/** The shortest a phone card stands; a longer text makes it taller. */
export const VERSE_CARD_HEIGHT = 280

/** The card's padding and its row of actions, which sit outside the measured header and text. */
const VERSE_CARD_CHROME = 84

export const getVerseCardHeight = (contentHeight: number) =>
  Math.ceil(contentHeight) + VERSE_CARD_CHROME
