import { useAtom } from 'jotai'
import { bibleSearchQuotaAtom, useTriggerResetQuotaAtoms } from '../state/app'

const InitAtoms = () => {
  const [a] = useAtom(bibleSearchQuotaAtom)

  console.log({ a })

  return null
}

export default InitAtoms
