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
import { useLocalSearchParams } from 'expo-router'
import React from 'react'
import { ComputedReadingSlice, Plan } from 'src/common/types'
import Header from '~common/Header'
import Container from '~common/ui/Container'
import { usePrevious } from '~helpers/usePrevious'
import { useComputedPlan, useFireStorage } from '../plan.hooks'
import DetailsModal from './DetailsModal'
import Menu from './Menu'
import SuccessModal from './SuccessModal'

interface Props {
  planId?: string
  hasBackButton?: boolean
  onReadingSlicePress?: (
    slice: ComputedReadingSlice & { planId: string; planTitle: string; planLanguage?: Plan['lang'] }
  ) => void
  onRemove?: () => void
}

const PlanScreen = ({
  planId: planIdFromProps,
  hasBackButton = true,
  onReadingSlicePress,
  onRemove,
}: Props) => {
  const params = useLocalSearchParams<{ plan?: string; planId?: string }>()

  const id = planIdFromProps || params.planId || getLegacyPlanRouteId(params.plan) || ''
  const modalRef = React.useRef<SheetRef | null>(null)
  const modalRefDetails = React.useRef<SheetRef | null>(null)

  const { t } = useTranslation()
  const { isError, retry } = useReadingContent(id)
  const plan = useComputedPlan(id)
  const title = plan?.title ?? t('readingPlans.tab')
  const image = plan?.image
  const description = plan?.description
  const author = plan?.author
  const cacheImage = useFireStorage(image)
  const progress = plan?.progress
  const prevProgress: number | undefined = usePrevious<number | undefined>(progress)
  const isPlanCompleted = progress === 1

  React.useEffect(() => {
    if (progress != null && prevProgress != null && prevProgress !== progress) {
      if (progress > prevProgress) {
        modalRef.current?.present()
      }
    }
  }, [progress, prevProgress])

  return (
    <Container>
      <Header
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
        <ScheduledPlanContent plan={plan} onReadingSlicePress={onReadingSlicePress} />
      )}
      <SuccessModal modalRef={modalRef} isPlanCompleted={isPlanCompleted} />
      <DetailsModal
        modalRefDetails={modalRefDetails}
        title={title || ''}
        image={cacheImage}
        id={id}
        author={author || { id: '', displayName: '', photoUrl: '' }}
        description={description}
      />
    </Container>
  )
}

export default PlanScreen
