export type StrongReferenceFamily = 'hebrew' | 'greek'

export const getStrongReferenceFamily = (book: number): StrongReferenceFamily =>
  book > 39 ? 'greek' : 'hebrew'
