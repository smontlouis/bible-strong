import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import Link from '~common/Link'
import type { OnlinePlan } from '~common/types'
import Box, { usePageBottomInset } from '~common/ui/Box'
import Button from '~common/ui/Button'
import ListSection from '~common/ui/ListSection'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { pageContentStyle } from '~common/ui/PageContent'
import { useLocalReadingDate } from '~features/daily-reading/useDailyMeditation'
import { fetchPlans, resetPlan, startPlan } from '~redux/modules/plan'
import type { RootState } from '~redux/modules/reducer'
import type { AppDispatch } from '~redux/store'
import { useFireStorage } from './plan.hooks'
import { getEditorialKind } from './readingCalendar'
import { hasPlanParticipation } from './planProgress'
import { getParticipationJourney } from './planSchedule'
import { getJourneyDetail } from './planJourneyLabel'
import { filterReadingPlans, type ReadingPlanFilters } from './readingPlanFilters'
import PlanContinuePill, { getContinueLabel, useContinuePlan } from './PlanContinuePill'
import PlanStreak from './PlanStreak'

// The padding and gap of a settings row, so the plans read as the same list
const ROW_PADDING = 14
const ROW_GAP = 12
const THUMBNAIL_WIDTH = 72
const TEXT_INSET = ROW_PADDING + THUMBNAIL_WIDTH + ROW_GAP

type RowKind = 'active' | 'completed' | 'discover'

const ReadingPlanRow = ({ plan, kind }: { plan: OnlinePlan; kind: RowKind }) => {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const dispatch = useDispatch()
  const confirm = useConfirmDialog()
  const continuePlan = useContinuePlan()
  const today = useLocalReadingDate()
  const image = useFireStorage(plan.image)
  const cached = useSelector((state: RootState) =>
    state.plan.myPlans.find(item => item.id === plan.id)
  )
  const progress = useSelector((state: RootState) =>
    state.plan.ongoingPlans.find(item => item.id === plan.id)
  )
  const readings = cached?.sections.flatMap(section => section.readingSlices) ?? []
  const journey = getParticipationJourney(readings, progress, today)
  const total = readings.length || plan.duration
  const open = () => router.push({ pathname: '/plan', params: { planId: plan.id } })
  const restart = async () => {
    if (
      await confirm({
        title: t('readingPlans.restart'),
        message: t('readingPlans.restartMessage'),
        cancelLabel: t('Annuler'),
        confirmLabel: t('readingPlans.restart'),
      })
    ) {
      dispatch(resetPlan(plan.id))
      dispatch(startPlan({ planId: plan.id, startDate: today }))
      open()
    }
  }
  const pill =
    kind === 'active' && readings.length
      ? getContinueLabel(journey)
      : kind === 'completed' && cached
        ? 'readingPlans.restart'
        : undefined
  const detail =
    kind !== 'discover' && readings.length
      ? getJourneyDetail(journey, t, { startDate: progress?.startDate, language: i18n.language })
      : total
        ? t('readingPlans.duration', { count: total })
        : t('readingPlans.journey')
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
            {kind === 'active' && !!readings.length && (
              <Box className="w-[50px] h-[6px] bg-canvas rounded-full overflow-hidden">
                <Box
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${(journey.completed / readings.length) * 100}%` }}
                />
              </Box>
            )}
            <Text className="text-grey text-[13px]">{detail}</Text>
            {kind === 'active' && <PlanStreak count={journey.streak} />}
          </Box>
          {kind === 'discover' && !!plan.description && (
            <Text className="text-grey text-[13px] leading-[18px]" numberOfLines={2}>
              {plan.description}
            </Text>
          )}
        </Box>
        {!pill && <FeatherIcon name="chevron-right" color="grey" size={18} />}
      </Link>
      {pill && (
        <PlanContinuePill
          label={pill}
          hint={plan.title}
          onPress={() => (kind === 'completed' ? void restart() : continuePlan(plan.id))}
        />
      )}
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
  return (
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
  )
}
export default ReadingPlansScreen
