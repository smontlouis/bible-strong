import { useAtom, useAtomValue } from 'jotai'
import {
  bibleSearchQuotaAtom,
  timelineSearchQuotaAtom,
  translateCommentsQuotaAtom,
} from '../state/app'

const AtomsPreloader = () => {
  const [a] = useAtom(bibleSearchQuotaAtom)
  // useAtomValue(timelineSearchQuotaAtom)
  // useAtomValue(translateCommentsQuotaAtom)

  console.log(a)

  return null
}

export default AtomsPreloader
