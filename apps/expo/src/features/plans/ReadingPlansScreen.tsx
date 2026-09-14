import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
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
import useLanguage from '~helpers/useLanguage'
import { fetchPlan, fetchPlans } from '~redux/modules/plan'
import type { RootState } from '~redux/modules/reducer'
import type { AppDispatch } from '~redux/store'
import { useFireStorage } from './plan.hooks'
import { getEditorialKind } from './readingCalendar'
import { hasPlanParticipation } from './planProgress'

const ReadingPlanCard = ({ plan, active }: { plan: OnlinePlan; active: boolean }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const image = useFireStorage(plan.image)
  const cached = useSelector((state: RootState) =>
    state.plan.myPlans.find(item => item.id === plan.id)
  )
  const progress = useSelector((state: RootState) =>
    state.plan.ongoingPlans.find(item => item.id === plan.id)
  )
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const total = cached?.sections.flatMap(section => section.readingSlices).length
  const completed =
    cached?.sections
      .flatMap(section => section.readingSlices)
      .filter(reading => progress?.readingSlices[reading.id] === 'Completed').length ?? 0
  const open = async () => {
    setPending(true)
    setFailed(false)
    try {
      if (!cached) await dispatch(fetchPlan({ id: plan.id, enroll: false })).unwrap()
      router.push({ pathname: '/plan', params: { planId: plan.id } })
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }
  return (
    <Box className="bg-reverse rounded-[24px] p-[16px] mb-[16px]">
      <Link
        onPress={open}
        disabled={pending}
        accessibilityLabel={plan.title}
        className="flex-row gap-[16px] items-center"
      >
        <Box className="rounded-[14px] bg-light-grey overflow-hidden w-[88px] h-[104px]">
          {image ? (
            <Image
              source={{ uri: image }}
              contentFit="contain"
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <Box className="flex-1 items-center justify-center">
              <FeatherIcon name="book-open" size={28} color="primary" />
            </Box>
          )}
        </Box>
        <Box className="flex-1 gap-[8px]">
          <Text className="text-default font-bold text-[18px]">{plan.title}</Text>
          <Text className="text-grey text-[13px]">
            {total
              ? t(active ? 'readingPlans.progress' : 'readingPlans.duration', {
                  count: active ? completed : total,
                  total,
                })
              : t('readingPlans.journey')}
          </Text>
          <Text className="text-primary font-bold text-[13px]">
            {t(active ? 'readingPlans.continue' : 'readingPlans.discover')}
          </Text>
        </Box>
        {pending ? (
          <ActivityIndicator />
        ) : (
          <FeatherIcon name="chevron-right" color="primary" size={20} />
        )}
      </Link>
      {failed && (
        <Text accessibilityRole="alert" className="text-grey mt-[12px]">
          {t('dailyReading.downloadError')}
        </Text>
      )}
    </Box>
  )
}

const ReadingPlansScreen = () => {
  const { t } = useTranslation()
  const lang = useLanguage()
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
  useEffect(() => {
    dispatch(fetchPlans())
  }, [dispatch])
  return (
    <ScrollView contentContainerStyle={[pageContentStyle, { padding: 24, paddingBottom: 48 }]}>
      <Text className="text-default font-bold text-[28px] mb-[12px]">
        {t('readingPlans.heading')}
      </Text>
      <Text className="text-grey text-[15px] leading-[24px] mb-[28px]">
        {t('readingPlans.description')}
      </Text>
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
      {plans
        .filter(plan => plan.lang === lang && !isActive(plan.id))
        .map(plan => (
          <ReadingPlanCard key={plan.id} plan={plan} active={false} />
        ))}
    </ScrollView>
  )
}
export default ReadingPlansScreen
