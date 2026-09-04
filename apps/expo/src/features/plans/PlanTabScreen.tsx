import { produce } from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { BackHandler } from 'react-native'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Container from '~common/ui/Container'
import { useComputedPlan } from '~features/plans/plan.hooks'
import { PlanTab, useIsCurrentTab } from '~state/tabs'
import PlanScreen from './PlanScreen/PlanScreen'
import PlanSliceScreen from './PlanSliceScreen/PlanSliceScreen'
import {
  getRecoveredPlanTabTitle,
  leavePlanSliceInTab,
  openPlanSliceInTab,
  resolvePlanTabContent,
} from './planTabState'

interface Props {
  planAtom: PrimitiveAtom<PlanTab>
}

const PlanTabScreen = ({ planAtom }: Props) => {
  const { t } = useTranslation()
  const [planTab, setPlanTab] = useAtom(planAtom)
  const isCurrentTab = useIsCurrentTab()
  const plan = useComputedPlan(planTab.data.planId)
  const content = resolvePlanTabContent(plan, planTab.data.readingSliceId)

  const clearActiveSlice = () => {
    setPlanTab(
      produce(draft => {
        draft.data = leavePlanSliceInTab(draft.data)
      })
    )
  }

  React.useEffect(() => {
    const recoveredTitle = getRecoveredPlanTabTitle(planTab.title, plan)
    if (!recoveredTitle) return

    setPlanTab(
      produce(draft => {
        draft.title = recoveredTitle
      })
    )
  }, [plan, planTab.title, setPlanTab])

  React.useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isCurrentTab(planAtom) || !planTab.data.readingSliceId) return false

      setPlanTab(
        produce(draft => {
          draft.data = leavePlanSliceInTab(draft.data)
        })
      )
      return true
    })

    return () => backHandler.remove()
  }, [isCurrentTab, planAtom, planTab.data.readingSliceId, setPlanTab])

  if (content.type === 'missing-plan') {
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

  if (content.type === 'reading-slice') {
    return (
      <PlanSliceScreen
        readingSlice={content.readingSlice}
        planTitle={content.readingSlice.planTitle}
        onBack={clearActiveSlice}
        onRead={clearActiveSlice}
      />
    )
  }

  const resolvedPlan = plan!

  return (
    <PlanScreen
      planId={resolvedPlan.id}
      hasBackButton={false}
      onRemove={clearActiveSlice}
      onReadingSlicePress={slice => {
        setPlanTab(
          produce(draft => {
            draft.data = openPlanSliceInTab(draft.data, slice.id)
          })
        )
      }}
    />
  )
}

export default PlanTabScreen
