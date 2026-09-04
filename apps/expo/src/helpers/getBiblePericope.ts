import { VersionCode } from 'src/state/tabs'
import { Pericope } from '~common/types'
import { loadPericope } from './loadPericope'
import { usesCanonicalBibleExtras } from './strongBiblePublications'
import { getBibleCanonicalHeadingVerses } from './biblesDb'
import { getCanonicalChapterPericope } from './canonicalBibleHeadings'

async function getBiblePericope(version: VersionCode): Promise<Pericope> {
  if (usesCanonicalBibleExtras(version)) {
    return getCanonicalChapterPericope(await getBibleCanonicalHeadingVerses(version))
  }
  const pericope = await loadPericope(version)
  return pericope ?? {}
}

export default getBiblePericope
