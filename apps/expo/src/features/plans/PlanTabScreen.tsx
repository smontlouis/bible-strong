import { MeditationReader } from '~features/daily-reading/MeditationScreen'
import MeditationCollectionScreen from '~features/daily-reading/MeditationCollectionScreen'
import { getEditorialKind } from './readingCalendar'
import { produce } from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Loading from '~common/Loading'
import { useReadingContent } from '~features/daily-reading/useDailyMeditation'
import { useComputedPlan } from '~features/plans/plan.hooks'
import { subscribeToHardwareBackPress } from '~helpers/hardwareBackPress'
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
  const { isError, retry } = useReadingContent(planTab.data.planId)
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
    return subscribeToHardwareBackPress(() => {
      if (!isCurrentTab(planAtom) || (!planTab.data.readingSliceId && !planTab.data.meditationDate))
        return false

      setPlanTab(
        produce(draft => {
          draft.data = leavePlanSliceInTab(draft.data)
        })
      )
      return true
    })
  }, [isCurrentTab, planAtom, planTab.data.readingSliceId, planTab.data.meditationDate, setPlanTab])

  if (content.type === 'missing-plan') {
    return (
      <Container>
        <Header title={planTab.title} />
        {!isError ? (
          <Loading />
        ) : (
          <>
            <Empty
              icon={require('~assets/images/empty-state-icons/plan.svg')}
              message={t("Ce plan n'est plus disponible.")}
            />
            <Box className="p-[20px]">
              <Button
                onPress={() => {
                  void retry()
                }}
              >
                {t('dailyReading.retry')}
              </Button>
            </Box>
          </>
        )}
      </Container>
    )
  }

  if (plan && getEditorialKind(plan) === 'daily-meditation') {
    if (planTab.data.readingSliceId || planTab.data.meditationDate)
      return (
        <MeditationReader
          assistantScope={`tab:${planTab.id}`}
          collectionId={plan.id}
          readingId={planTab.data.readingSliceId}
          date={planTab.data.meditationDate}
          onBack={clearActiveSlice}
          onBrowse={clearActiveSlice}
          onDateChange={date =>
            setPlanTab(
              produce(draft => {
                draft.data.readingSliceId = undefined
                draft.data.meditationDate = date
              })
            )
          }
        />
      )
    return (
      <MeditationCollectionScreen
        assistantScope={`tab:${planTab.id}`}
        collectionId={plan.id}
        hasBackButton={false}
        onReadingSlicePress={slice =>
          setPlanTab(
            produce(draft => {
              draft.data = {
                ...openPlanSliceInTab(draft.data, slice.id),
                meditationDate: slice.meditationDate,
              }
            })
          )
        }
      />
    )
  }

  if (content.type === 'reading-slice') {
    return (
      <PlanSliceScreen
        assistantScope={`tab:${planTab.id}`}
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
      assistantScope={`tab:${planTab.id}`}
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
