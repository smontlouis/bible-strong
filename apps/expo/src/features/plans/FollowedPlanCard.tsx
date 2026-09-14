import { useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import type { ComputedPlanItem, OngoingPlan } from '~common/types'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useLocalReadingDate } from '~features/daily-reading/useDailyMeditation'
import { useFireStorage } from './plan.hooks'
import { getScheduledPlanDay } from './readingCalendar'

const FollowedPlanCard = ({
  plan,
  participation,
}: {
  plan: ComputedPlanItem
  participation: OngoingPlan
}) => {
  const { t, i18n } = useTranslation()
  const today = useLocalReadingDate()
  const image = useFireStorage(plan.image)
  const total = useSelector(
    (state: RootState) =>
      state.plan.myPlans
        .find(item => item.id === plan.id)
        ?.sections.reduce((count, section) => count + section.readingSlices.length, 0) ?? 0
  )
  const percent = Math.round(Math.max(0, Math.min(1, plan.progress)) * 100)
  const day = participation.startDate
    ? getScheduledPlanDay(participation.startDate, today)
    : undefined
  const detail =
    plan.status === 'Completed'
      ? t('readingPlans.finished')
      : day !== undefined && total > 0 && day > total
        ? t('readingPlans.calendarEnded')
        : day !== undefined && day > 0
          ? t('readingPlans.todayDay', { day })
          : participation.startDate && day !== undefined
            ? t('readingPlans.startsOn', {
                date: new Date(`${participation.startDate}T12:00:00`).toLocaleDateString(
                  i18n.language,
                  { day: 'numeric', month: 'long' }
                ),
              })
            : t('readingPlans.legacyProgress')

  return (
    <Link
      route="Plan"
      params={{ planId: plan.id }}
      accessibilityLabel={plan.title}
      accessibilityHint={t('readingPlans.continue')}
      className="flex-row items-center gap-[16px] bg-reverse rounded-[20px] p-[16px]"
    >
      <Box className="w-[64px] h-[80px] rounded-[12px] bg-light-grey overflow-hidden items-center justify-center">
        {image ? (
          <Image
            source={{ uri: image }}
            contentFit="contain"
            accessible={false}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <FeatherIcon name="book-open" size={26} color="primary" />
        )}
      </Box>
      <Box className="flex-1 gap-[8px]">
        <Text className="text-default text-[16px] font-bold">{plan.title}</Text>
        <Text className="text-grey text-[12px]">{detail}</Text>
        <Box className="flex-row items-center gap-[10px]">
          <Box
            accessibilityRole="progressbar"
            accessibilityLabel={t('home.dashboard.planProgress', { percent })}
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            className="flex-1 h-[5px] bg-light-grey rounded-full overflow-hidden"
          >
            <Box className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
          </Box>
          <Text className="text-grey text-[12px]" style={{ fontVariant: ['tabular-nums'] }}>
            {percent} %
          </Text>
        </Box>
      </Box>
      <FeatherIcon name="chevron-right" color="primary" size={18} />
    </Link>
  )
}

export default FollowedPlanCard
