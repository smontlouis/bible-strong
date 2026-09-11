import { useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { fetchPlan } from '~redux/modules/plan'
import type { AppDispatch } from '~redux/store'
import type { RootState } from '~redux/modules/reducer'
import type { TabItem } from '~state/tabs'
import { toast } from '~helpers/toast'

export function useSelectCatalogResult(onSelect: (tab: TabItem) => void) {
  const plans = useSelector((state: RootState) => state.plan.myPlans)
  const dispatch = useDispatch<AppDispatch>()
  const locked = useRef(false)
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()
  const select = async (tab: TabItem) => {
    if (locked.current) return
    locked.current = true
    setLoading(true)
    try {
      if (tab.type === 'plan' && !plans.some(plan => plan.id === tab.data.planId)) {
        await dispatch(fetchPlan({ id: tab.data.planId })).unwrap()
      }
      onSelect(tab)
    } catch {
      toast.error(t('commandPalette.sourceUnavailable'))
    } finally {
      locked.current = false
      setLoading(false)
    }
  }
  return { select, loading }
}
