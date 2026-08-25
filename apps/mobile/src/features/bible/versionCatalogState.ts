import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import type { BibleVersionGrouping } from './versionCatalog'

const BIBLE_VERSION_GROUPINGS: BibleVersionGrouping[] = ['alphabetical', 'language', 'style']

export const migrateBibleVersionGrouping = (value: unknown): BibleVersionGrouping =>
  BIBLE_VERSION_GROUPINGS.includes(value as BibleVersionGrouping)
    ? (value as BibleVersionGrouping)
    : 'language'

export const bibleVersionGroupingAtom = atomWithAsyncStorage<BibleVersionGrouping>(
  'bibleVersionGrouping.v1',
  'language',
  { migrate: migrateBibleVersionGrouping }
)
