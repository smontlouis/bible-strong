import React from 'react'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Link from '~common/Link'
import Loading from '~common/Loading'
import { PLAN_READING_HORIZONTAL_PADDING, READING_TEXT_MAX_WIDTH } from '~common/readingLayout'
import { type SheetRef } from '~common/sheet'
import Box, { usePageBottomInset } from '~common/ui/Box'
import Button from '~common/ui/Button'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import ScrollView from '~common/ui/ScrollView'
import { useReadingContent } from '~features/daily-reading/useDailyMeditation'
import { editorialContext } from '~features/study-assistant/editorialContext'
import { useAssistantResourceContext } from '~features/study-assistant/useAssistantResourceContext'
import { goBackOrHome } from '~navigation/goBackOrHome'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { getEntitySliceTitle } from './entitySliceTitle'
import { useComputedPlan } from './plan.hooks'
import { getEntitySliceKey } from './planProgress'
import ParamsModal from './PlanSliceScreen/ParamsModal'
import Slice from './PlanSliceScreen/Slice'
import PlanDayStepCard from './PlanDayStepCard'
import { usePlanDayStep } from './usePlanDayStep'

type PlanEntityScreenProps = {
  isFormSheet?: boolean
}

/**
 * The page of one text, image or video of a plan day. Passages open the Bible reader instead.
 * It shares the reader's sheet, so « Voir la suite » moves between them in place.
 */
const PlanEntityScreen = ({ isFormSheet = false }: PlanEntityScreenProps) => {
  const {
    planId = '',
    readingSliceId = '',
    entitySliceId = '',
  } = useLocalSearchParams<{ planId?: string; readingSliceId?: string; entitySliceId?: string }>()
  const { t } = useTranslation()
  const router = useRouter()
  const paramsModalRef = React.useRef<SheetRef>(null)
  const bottomInset = usePageBottomInset()
  const { isError, retry } = useReadingContent(planId)
  const plan = useComputedPlan(planId)
  const reading = plan?.sections
    .flatMap(section => section.data)
    .find(item => item.id === readingSliceId)
  const slice = reading?.slices.find(
    (item, index) => getEntitySliceKey(reading.id, item, index) === entitySliceId
  )
  useAssistantResourceContext('panel', editorialContext(plan, reading))
  const dayStep = usePlanDayStep(slice ? { planId, readingSliceId, entitySliceId } : undefined)
  const goBack = () => goBackOrHome(router)
  const canGoBackInStack = useCanGoBackInStack()
  // In the sheet, an element opened from the plan is closed by the sheet itself.
  const hasBackButton = isFormSheet ? canGoBackInStack : true

  if (!plan || !slice) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Header
          hasBackButton={hasBackButton}
          title={t('readingPlans.tab')}
          onCustomBackPress={goBack}
        />
        {isError || plan ? (
          <>
            <Empty message={t('dailyReading.unavailableReading')} />
            {isError && (
              <Box className="p-[20px]">
                <Button
                  onPress={() => {
                    void retry()
                  }}
                >
                  {t('dailyReading.retry')}
                </Button>
              </Box>
            )}
          </>
        ) : (
          <Loading />
        )}
      </FormSheetScreen>
    )
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Header
        hasBackButton={hasBackButton}
        title={getEntitySliceTitle(slice, t)}
        onCustomBackPress={goBack}
        rightComponent={
          slice.type === 'Text' && (
            <Link
              onPress={() => paramsModalRef.current?.present()}
              accessibilityLabel={t('Mise en forme')}
              className="items-center justify-center h-[54px] w-[54px]"
            >
              <FeatherIcon name="type" size={18} />
            </Link>
          )
        }
      />
      <ScrollView
        contentContainerStyle={{
          width: '100%',
          alignSelf: 'center',
          maxWidth: READING_TEXT_MAX_WIDTH + PLAN_READING_HORIZONTAL_PADDING * 2,
          paddingTop: 24,
          paddingBottom: 32 + bottomInset,
        }}
      >
        <Slice {...slice} planLanguage={plan.lang} />
        {dayStep && (
          <Box className="mt-[32px]" style={{ paddingHorizontal: PLAN_READING_HORIZONTAL_PADDING }}>
            <PlanDayStepCard step={dayStep} />
          </Box>
        )}
      </ScrollView>
      <ParamsModal paramsModalRef={paramsModalRef} />
    </FormSheetScreen>
  )
}

export default PlanEntityScreen
