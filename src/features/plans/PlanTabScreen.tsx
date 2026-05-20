import { produce } from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { BackHandler } from 'react-native'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Container from '~common/ui/Container'
import { ComputedReadingSlice } from '~common/types'
import { useComputedPlan } from '~features/plans/plan.hooks'
import { PlanTab, useIsCurrentTab } from '~state/tabs'
import PlanScreen from './PlanScreen/PlanScreen'
import PlanSliceScreen from './PlanSliceScreen/PlanSliceScreen'

interface Props {
  planAtom: PrimitiveAtom<PlanTab>
}

const PlanTabScreen = ({ planAtom }: Props) => {
  const { t } = useTranslation()
  const [planTab, setPlanTab] = useAtom(planAtom)
  const isCurrentTab = useIsCurrentTab()
  const plan = useComputedPlan(planTab.data.planId)

  const activeSlice = (() => {
    if (!planTab.data.readingSliceId || !plan) return undefined

    for (const section of plan.sections) {
      const slice = section.data.find(s => s.id === planTab.data.readingSliceId)
      if (slice) return slice
    }

    return undefined
  })()

  const clearActiveSlice = () => {
    setPlanTab(
      produce(draft => {
        draft.data.readingSliceId = undefined
      })
    )
  }

  React.useEffect(() => {
    if (!plan?.title || plan.title === planTab.title) return

    setPlanTab(
      produce(draft => {
        draft.title = plan.title
      })
    )
  }, [plan?.title, planTab.title, setPlanTab])

  React.useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isCurrentTab(planAtom) || !planTab.data.readingSliceId) return false

      setPlanTab(
        produce(draft => {
          draft.data.readingSliceId = undefined
        })
      )
      return true
    })

    return () => backHandler.remove()
  }, [isCurrentTab, planAtom, planTab.data.readingSliceId, setPlanTab])

  if (!plan) {
    return (
      <Container>
        <Header title={planTab.title} />
        <Empty
          icon={require('~assets/images/empty-state-icons/plan.svg')}
          message={t("Ce plan n'est plus disponible.")}
        />
      </Container>
    )
  }

  if (planTab.data.readingSliceId && activeSlice) {
    return (
      <PlanSliceScreen
        readingSlice={
          {
            ...activeSlice,
            planId: plan.id,
            planTitle: plan.title,
            planLanguage: plan.lang,
          } as ComputedReadingSlice & {
            planId: string
            planTitle: string
            planLanguage?: typeof plan.lang
          }
        }
        planTitle={plan.title}
        onBack={clearActiveSlice}
        onRead={clearActiveSlice}
      />
    )
  }

  return (
    <PlanScreen
      planId={plan.id}
      hasBackButton={false}
      onRemove={clearActiveSlice}
      onReadingSlicePress={slice => {
        setPlanTab(
          produce(draft => {
            draft.data.readingSliceId = slice.id
          })
        )
      }}
    />
  )
}

export default PlanTabScreen
