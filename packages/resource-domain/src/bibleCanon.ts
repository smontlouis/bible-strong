export type BibleCanonId =
  | 'protestant-66'
  | 'catholic-73'
  | 'clementine-vulgate'
  | 'theotex-septuagint'

export const BIBLE_CANON_IDS = [
  'protestant-66',
  'catholic-73',
  'clementine-vulgate',
  'theotex-septuagint',
] as const satisfies readonly BibleCanonId[]

export const isBibleCanonId = (value: string): value is BibleCanonId =>
  BIBLE_CANON_IDS.includes(value as BibleCanonId)
