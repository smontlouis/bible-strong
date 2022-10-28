import { useAtom } from 'jotai'
import { useCallback } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import { quotaAtoms, QuotaAtomType, quotaModalAtom } from '../state/app'

export const useIsPremium = () => {
  const hasPremium = useSelector((state: RootState) => state.user.subscription)
  return !!hasPremium
}

export const useQuota = (quotaType: QuotaAtomType) => {
  const [quota, setQuota] = useAtom(quotaAtoms[quotaType])
  const isPremium = useIsPremium()
  const hasQuota = quota.remaining > 0
  const [, setShowQuotaModal] = useAtom(quotaModalAtom)
  return useCallback(
    (fn: () => void, failCb?: () => void) => {
      console.log(quota)
      if (isPremium) {
        fn()
        return
      }
      if (hasQuota) {
        fn()
        setQuota(q => ({ ...q, remaining: q.remaining - 1 }))
        return
      }
      if (failCb) failCb()
      setShowQuotaModal(true)
    },
    [hasQuota, isPremium, setShowQuotaModal, setQuota, quota]
  )
}
