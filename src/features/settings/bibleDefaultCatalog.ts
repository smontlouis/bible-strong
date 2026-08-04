import { versions, type Version } from '~helpers/bibleVersions'
import {
  STRONG_BIBLE_PUBLICATIONS,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'

export type BibleDefaultSelectionKind = 'reading' | 'strong'

export const getBibleDefaultCatalog = (kind: BibleDefaultSelectionKind): Version[] => {
  if (kind === 'strong') {
    return (Object.keys(STRONG_BIBLE_PUBLICATIONS) as StrongBibleVersionId[]).map(
      versionId => versions[versionId]
    )
  }

  return Object.values(versions).filter(
    version => !version.hidden && (version.language === 'fr' || version.language === 'en')
  )
}
