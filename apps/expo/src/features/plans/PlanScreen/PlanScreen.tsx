import { editorialContext } from '~features/study-assistant/editorialContext'
import { useAssistantResourceContext } from '~features/study-assistant/useAssistantResourceContext'
import { getLegacyPlanRouteId } from '../planTabState'
import { useReadingContent } from '~features/daily-reading/useDailyMeditation'
import { useTranslation } from 'react-i18next'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Button from '~common/ui/Button'
import ScheduledPlanContent from './ScheduledPlanContent'
import { getEditorialKind } from '../readingCalendar'
import { type SheetRef } from '~common/sheet'
import { useIsFocused, useLocalSearchParams } from 'expo-router'
import React from 'react'
import Header from '~common/Header'
import Container from '~common/ui/Container'
import { usePrevious } from '~helpers/usePrevious'
import { useComputedPlan, useFireStorage } from '../plan.hooks'
import DetailsModal from './DetailsModal'
import Menu from './Menu'
import SuccessModal from './SuccessModal'

interface Props {
  assistantScope?: string
  planId?: string
  hasBackButton?: boolean
  /** The day to show first; links to a day of the plan land here. */
  readingSliceId?: string
  onRemove?: () => void
}

const PlanScreen = ({
  assistantScope = 'panel',
  planId: planIdFromProps,
  hasBackButton = true,
  readingSliceId,
  onRemove,
}: Props) => {
  const params = useLocalSearchParams<{
    plan?: string
    planId?: string
    readingSliceId?: string
  }>()

  const id = planIdFromProps || params.planId || getLegacyPlanRouteId(params.plan) || ''
  const modalRef = React.useRef<SheetRef | null>(null)
  const modalRefDetails = React.useRef<SheetRef | null>(null)

  const { t } = useTranslation()
  const { isError, retry } = useReadingContent(id)
  const plan = useComputedPlan(id)
  useAssistantResourceContext(assistantScope, editorialContext(plan))
  const title = plan?.title ?? t('readingPlans.tab')
  const image = plan?.image
  const description = plan?.description
  const author = plan?.author
  const cacheImage = useFireStorage(image)
  const progress = plan?.progress
  const prevProgress: number | undefined = usePrevious<number | undefined>(progress)
  const isPlanCompleted = progress === 1

  // Progress can rise while an element's page covers the plan: congratulate on the way back.
  const isFocused = useIsFocused()
  const celebrationPending = React.useRef(false)
  React.useEffect(() => {
    if (progress != null && prevProgress != null && progress > prevProgress)
      celebrationPending.current = true
    if (!celebrationPending.current || !isFocused) return
    celebrationPending.current = false
    modalRef.current?.present()
  }, [progress, prevProgress, isFocused])

  return (
    <Container>
      <Header
        maxWidth={1000}
        title={title}
        hasBackButton={hasBackButton}
        rightComponent={
          plan && (
            <Menu
              modalRefDetails={modalRefDetails}
              planId={id}
              canManageParticipation={getEditorialKind(plan) === 'reading-plan'}
              title={title || ''}
              onRemove={onRemove}
              details={
                <DetailsModal
                  inline
                  title={title || ''}
                  image={cacheImage}
                  id={id}
                  author={author || { id: '', displayName: '', photoUrl: '' }}
                  description={description}
                  attribution={plan?.attribution}
                />
              }
            />
          )
        }
      />
      {!plan && !isError && <Loading />}
      {!plan && isError && (
        <Box className="p-[20px] gap-[16px]">
          <Text className="text-grey">{t('dailyReading.downloadError')}</Text>
          <Button
            onPress={() => {
              void retry()
            }}
          >
            {t('dailyReading.retry')}
          </Button>
        </Box>
      )}
      {plan?.sections && (
        <ScheduledPlanContent
          key={plan.id}
          plan={plan}
          initialReadingSliceId={readingSliceId ?? params.readingSliceId}
        />
      )}
      <SuccessModal modalRef={modalRef} isPlanCompleted={isPlanCompleted} />
      <DetailsModal
        modalRefDetails={modalRefDetails}
        title={title || ''}
        image={cacheImage}
        id={id}
        author={author || { id: '', displayName: '', photoUrl: '' }}
        description={description}
        attribution={plan?.attribution}
      />
    </Container>
  )
}

export default PlanScreen
