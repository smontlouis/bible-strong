type PassageLocation = { version: string; book: { Numero: number }; chapter: number }

/** Whether two passages are the same chapter of the same version. */
export const isSamePassage = (left: PassageLocation, right: PassageLocation) =>
  left.version === right.version &&
  left.book.Numero === right.book.Numero &&
  left.chapter === right.chapter
