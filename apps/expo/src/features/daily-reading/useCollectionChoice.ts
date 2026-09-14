import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import type { OnlinePlan } from '~common/types'
import { fetchPlan } from '~redux/modules/plan'
import { setDailyMeditation } from '~redux/modules/user'
import type { RootState } from '~redux/modules/reducer'
import type { AppDispatch } from '~redux/store'
import { selectDailyCollection } from './selectDailyCollection'

export const useCollectionChoice = (collection: Pick<OnlinePlan, 'id'>) => {
  const dispatch = useDispatch<AppDispatch>()
  const store = useStore<RootState>()
  const mounted = useRef(true)
  const choosing = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const cached = useSelector((state: RootState) =>
    state.plan.myPlans.some(plan => plan.id === collection.id)
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  const choose = async () => {
    if (choosing.current) return
    choosing.current = true
    setPending(true)
    setError(false)
    const result = await selectDailyCollection({
      read: () => ({
        owner: store.getState().user.id,
        collectionId: store.getState().user.bible.settings.dailyMeditationId,
      }),
      subscribe: store.subscribe,
      prepare: async () => {
        if (!cached) await dispatch(fetchPlan({ id: collection.id, enroll: false })).unwrap()
      },
      isActive: () => mounted.current,
      commit: () => dispatch(setDailyMeditation(collection.id)),
    })
    choosing.current = false
    if (!mounted.current) return
    setPending(false)
    setError(result === 'failed')
  }

  const selected = useSelector(
    (state: RootState) => state.user.bible.settings.dailyMeditationId === collection.id
  )
  return { choose, pending, error, selected }
}
