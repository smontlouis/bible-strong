import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Link from '~common/Link'
import type { OnlinePlan } from '~common/types'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { pageContentStyle } from '~common/ui/PageContent'
import { fetchPlans } from '~redux/modules/plan'
import type { RootState } from '~redux/modules/reducer'
import type { AppDispatch } from '~redux/store'
import { useFireStorage } from './plan.hooks'
import { getEditorialKind } from './readingCalendar'
import { hasPlanParticipation, getPlanResumeDay } from './planProgress'
import { filterReadingPlans, type ReadingPlanFilters } from './readingPlanFilters'

const ReadingPlanCard = ({ plan, active }: { plan: OnlinePlan; active: boolean }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const image = useFireStorage(plan.image)
  const cached = useSelector((state: RootState) =>
    state.plan.myPlans.find(item => item.id === plan.id)
  )
  const progress = useSelector((state: RootState) =>
    state.plan.ongoingPlans.find(item => item.id === plan.id)
  )
  const total = cached?.sections.flatMap(section => section.readingSlices).length ?? plan.duration
  const resumeDay = getPlanResumeDay(
    cached?.sections.flatMap(section => section.readingSlices) ?? [],
    progress?.readingSlices
  )
  const completed =
    cached?.sections
      .flatMap(section => section.readingSlices)
      .filter(reading => progress?.readingSlices[reading.id] === 'Completed').length ?? 0
  const open = () => router.push({ pathname: '/plan', params: { planId: plan.id } })
  return (
    <Box className="bg-reverse rounded-[20px] p-[16px] mb-[12px]">
      <Link
        onPress={open}
        accessibilityLabel={plan.title}
        className="flex-row gap-[16px] items-center"
      >
        <Box className="rounded-[14px] bg-light-grey overflow-hidden w-[96px] h-[64px]">
          {image ? (
            <Image
              source={{ uri: image }}
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <Box className="flex-1 items-center justify-center">
              <FeatherIcon name="book-open" size={28} color="primary" />
            </Box>
          )}
        </Box>
        <Box className="flex-1 gap-[8px]">
          <Text className="text-default font-bold text-[16px]">{plan.title}</Text>
          <Box className="flex-row flex-wrap items-center gap-[8px]">
            {active && !!total && (
              <Box className="w-[50px] h-[6px] bg-light-grey rounded-full overflow-hidden">
                <Box
                  className="h-full bg-primary"
                  style={{ width: `${(completed / total) * 100}%` }}
                />
              </Box>
            )}
            <Text className="text-grey text-[13px]">
              {total
                ? t(
                    active
                      ? completed === total
                        ? 'readingPlans.finished'
                        : 'readingPlans.dayOfTotal'
                      : 'readingPlans.duration',
                    {
                      day: resumeDay,
                      count: active ? completed : total,
                      total,
                    }
                  )
                : t('readingPlans.journey')}
            </Text>
          </Box>
          <Text className="text-primary font-bold text-[13px]">
            {t(
              active
                ? total && completed === total
                  ? 'readingPlans.reread'
                  : 'readingPlans.continue'
                : 'readingPlans.discover'
            )}
          </Text>
        </Box>
        <FeatherIcon name="chevron-right" color="primary" size={20} />
      </Link>
    </Box>
  )
}

const ReadingPlansScreen = ({ filters }: { filters: ReadingPlanFilters }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const online = useSelector((state: RootState) => state.plan.onlinePlans)
  const local = useSelector((state: RootState) => state.plan.myPlans)
  const ongoing = useSelector((state: RootState) => state.plan.ongoingPlans)
  const status = useSelector((state: RootState) => state.plan.onlineStatus)
  const plans = [
    ...online,
    ...local.filter(plan => !online.some(item => item.id === plan.id)),
  ].filter(plan => getEditorialKind(plan) === 'reading-plan')
  const isActive = (id: string) => hasPlanParticipation(ongoing.find(item => item.id === id))
  const active = plans.filter(plan => isActive(plan.id))
  const discoverable = filterReadingPlans(plans, filters)
  useEffect(() => {
    dispatch(fetchPlans())
  }, [dispatch])
  return (
    <ScrollView contentContainerStyle={[pageContentStyle, { padding: 24, paddingBottom: 48 }]}>
      {!!active.length && (
        <Text className="text-default font-bold text-[18px] mb-[16px]">
          {t('readingPlans.yours')}
        </Text>
      )}
      {active.map(plan => (
        <ReadingPlanCard key={plan.id} plan={plan} active />
      ))}
      <Text className="text-default font-bold text-[18px] mt-[12px] mb-[16px]">
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
        <Text className="text-grey">
          {t(plans.length ? 'readingPlans.noMatchingPlans' : 'readingPlans.noAvailablePlans')}
        </Text>
      )}
      {(['fr', 'en'] as const).map(language => {
        const entries = discoverable.filter(plan => plan.lang === language)
        if (!entries.length) return null
        return (
          <Box key={language} className="mb-[20px]">
            <Text accessibilityRole="header" className="text-grey font-bold text-[14px] mb-[12px]">
              {t(language === 'fr' ? 'Français' : 'Anglais')}
            </Text>
            {entries.map(plan => (
              <ReadingPlanCard key={plan.id} plan={plan} active={isActive(plan.id)} />
            ))}
          </Box>
        )
      })}
    </ScrollView>
  )
}
export default ReadingPlansScreen
