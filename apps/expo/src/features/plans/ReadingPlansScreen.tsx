import { Image } from 'expo-image'
import { useEffect } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Link from '~common/Link'
import type { OnlinePlan } from '~common/types'
import Box, { usePageBottomInset } from '~common/ui/Box'
import Button from '~common/ui/Button'
import ListSection from '~common/ui/ListSection'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { pageContentStyle } from '~common/ui/PageContent'
import { useLocalReadingDate } from '~features/daily-reading/useDailyMeditation'
import { fetchPlans } from '~redux/modules/plan'
import type { RootState } from '~redux/modules/reducer'
import type { AppDispatch } from '~redux/store'
import { getEditorialKind } from './readingCalendar'
import { hasPlanParticipation } from './planProgress'
import { getParticipationJourney } from './planSchedule'
import { filterReadingPlans, type ReadingPlanFilters } from './readingPlanFilters'
import PlanContinuePill from './PlanContinuePill'
import ReadingPlansWide from './ReadingPlansWide'
import { useReadingPlanRow, type ReadingPlanRowKind } from './useReadingPlanRow'
import { useWidePlansLayout } from './useWidePlansLayout'
import PlanStreak from './PlanStreak'

// The padding and gap of a settings row, so the plans read as the same list
const ROW_PADDING = 14
const ROW_GAP = 12
const THUMBNAIL_WIDTH = 72
const TEXT_INSET = ROW_PADDING + THUMBNAIL_WIDTH + ROW_GAP

export const ReadingPlanRow = ({ plan, kind }: { plan: OnlinePlan; kind: ReadingPlanRowKind }) => {
  const { image, journey, progress, hasReadings, detail, pill, open, onPill } = useReadingPlanRow(
    plan,
    kind
  )
  return (
    <Box className="flex-row items-center" style={{ gap: ROW_GAP, paddingRight: ROW_PADDING }}>
      <Link
        onPress={open}
        accessibilityLabel={`${plan.title}, ${detail}`}
        className="flex-1 flex-row items-center"
        style={{ gap: ROW_GAP, paddingLeft: ROW_PADDING, paddingVertical: 10 }}
      >
        <Box
          className="rounded-[8px] bg-canvas overflow-hidden h-[48px]"
          style={{ width: THUMBNAIL_WIDTH }}
        >
          {image ? (
            <Image
              source={{ uri: image }}
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <Box className="flex-1 items-center justify-center">
              <FeatherIcon name="book-open" size={22} color="primary" />
            </Box>
          )}
        </Box>
        <Box className="flex-1 gap-[4px]">
          <Text className="text-default font-bold text-[15px]" numberOfLines={2}>
            {plan.title}
          </Text>
          <Box className="flex-row flex-wrap items-center gap-[8px]">
            {kind === 'active' && hasReadings && (
              <Box className="w-[50px] h-[6px] bg-canvas rounded-full overflow-hidden">
                <Box
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${progress * 100}%` }}
                />
              </Box>
            )}
            <Text className="text-grey text-[13px]">{detail}</Text>
            {kind === 'active' && <PlanStreak count={journey.streak} />}
          </Box>
        </Box>
        {!pill && <FeatherIcon name="chevron-right" color="grey" size={18} />}
      </Link>
      {pill && <PlanContinuePill label={pill} hint={plan.title} onPress={onPill} />}
    </Box>
  )
}

const ReadingPlansScreen = ({ filters }: { filters: ReadingPlanFilters }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const bottomInset = usePageBottomInset()
  const today = useLocalReadingDate()
  const online = useSelector((state: RootState) => state.plan.onlinePlans)
  const local = useSelector((state: RootState) => state.plan.myPlans)
  const ongoing = useSelector((state: RootState) => state.plan.ongoingPlans)
  const status = useSelector((state: RootState) => state.plan.onlineStatus)
  const plans = [
    ...online,
    ...local.filter(plan => !online.some(item => item.id === plan.id)),
  ].filter(plan => getEditorialKind(plan) === 'reading-plan')
  const participation = (id: string) => ongoing.find(item => item.id === id)
  /** A followed plan is done when its participation says so or every day of it is read. */
  const isFinished = (plan: OnlinePlan) => {
    const progress = participation(plan.id)
    if (progress?.status === 'Completed') return true
    const content = local.find(item => item.id === plan.id)
    const readings = content?.sections.flatMap(section => section.readingSlices) ?? []
    return getParticipationJourney(readings, progress, today).finished
  }
  const followed = plans.filter(plan => hasPlanParticipation(participation(plan.id)))
  const active = followed.filter(plan => !isFinished(plan))
  const completed = followed.filter(isFinished)
  const discoverable = filterReadingPlans(
    plans.filter(plan => !followed.includes(plan)),
    filters
  )
  useEffect(() => {
    dispatch(fetchPlans({ reuseRecent: true }))
  }, [dispatch])
  const notices = (
    <>
      {status === 'Pending' && !plans.length && (
        <ActivityIndicator accessibilityLabel={t('Chargement...')} />
      )}
      {status === 'Rejected' && (
        <Box className="gap-[12px] mb-[16px]">
          <Text className="text-grey">{t('dailyReading.catalogError')}</Text>
          <Button reverse onPress={() => dispatch(fetchPlans())}>
            {t('dailyReading.retry')}
          </Button>
        </Box>
      )}
      {status === 'Resolved' && !discoverable.length && (
        <Text className="text-grey mb-[22px]">
          {t(plans.length ? 'readingPlans.noMatchingPlans' : 'readingPlans.noAvailablePlans')}
        </Text>
      )}
    </>
  )
  const layout = useWidePlansLayout()
  if (layout.wide)
    return (
      <Box ref={layout.ref} onLayout={layout.onLayout} className="flex-1">
        <ReadingPlansWide
          active={active}
          completed={completed}
          discoverable={discoverable}
          notices={notices}
          height={layout.height}
          missed={active.reduce((count, plan) => {
            const content = local.find(item => item.id === plan.id)
            const readings = content?.sections.flatMap(section => section.readingSlices) ?? []
            return (
              count + getParticipationJourney(readings, participation(plan.id), today).missed.length
            )
          }, 0)}
        />
      </Box>
    )
  return (
    <Box ref={layout.ref} onLayout={layout.onLayout} className="flex-1">
      <ScrollView
        contentContainerStyle={[
          pageContentStyle,
          { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 + bottomInset },
        ]}
      >
        {!!active.length && (
          <>
            <Text className="text-default font-bold text-[18px] mb-[16px]">
              {t('readingPlans.yours')}
            </Text>
            <ListSection className="mx-0" separatorInset={TEXT_INSET}>
              {active.map(plan => (
                <ReadingPlanRow key={plan.id} plan={plan} kind="active" />
              ))}
            </ListSection>
          </>
        )}
        <Text className="text-default font-bold text-[18px] mb-[16px]">
          {t('readingPlans.explore')}
        </Text>
        {notices}
        {(['fr', 'en'] as const).map(language => {
          const entries = discoverable.filter(plan => plan.lang === language)
          if (!entries.length) return null
          return (
            <ListSection
              key={language}
              title={t(language === 'fr' ? 'Français' : 'Anglais')}
              className="mx-0"
              separatorInset={TEXT_INSET}
            >
              {entries.map(plan => (
                <ReadingPlanRow key={plan.id} plan={plan} kind="discover" />
              ))}
            </ListSection>
          )
        })}
        {!!completed.length && (
          <>
            <Text className="text-default font-bold text-[18px] mb-[16px]">
              {t('readingPlans.completedPlans')}
            </Text>
            <ListSection className="mx-0" separatorInset={TEXT_INSET}>
              {completed.map(plan => (
                <ReadingPlanRow key={plan.id} plan={plan} kind="completed" />
              ))}
            </ListSection>
          </>
        )}
      </ScrollView>
    </Box>
  )
}
export default ReadingPlansScreen
