import { useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import type { ComputedPlanItem, OngoingPlan } from '~common/types'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useFireStorage } from './plan.hooks'
import { getPlanResumeDay } from './planProgress'

const FollowedPlanCard = ({
  plan,
  participation,
  row = false,
}: {
  plan: ComputedPlanItem
  participation: OngoingPlan
  /** Home list row: small cover, title with the day on the right, full-width progress bar. */
  row?: boolean
}) => {
  const { t } = useTranslation()
  const image = useFireStorage(plan.image)
  const content = useSelector((state: RootState) =>
    state.plan.myPlans.find(item => item.id === plan.id)
  )
  const readings = content?.sections.flatMap(section => section.readingSlices) ?? []
  const total = readings.length
  const day = getPlanResumeDay(readings, participation.readingSlices)
  const completed = readings.filter(
    reading => participation.readingSlices[reading.id] === 'Completed'
  ).length
  const percent = total ? (completed / total) * 100 : 0
  const detail = !total
    ? t('readingPlans.continue')
    : t(total > 0 && completed === total ? 'readingPlans.finished' : 'readingPlans.dayOfTotal', {
        day,
        total,
      })

  if (row)
    return (
      <Link
        route="Plan"
        params={{ planId: plan.id }}
        accessibilityLabel={plan.title}
        accessibilityHint={t('readingPlans.continue')}
        className="flex-row items-center gap-[12px] px-[16px] py-[12px]"
      >
        <Box className="w-[40px] h-[40px] rounded-[10px] bg-light-grey overflow-hidden items-center justify-center">
          {image ? (
            <Image
              source={{ uri: image }}
              contentFit="cover"
              accessible={false}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <FeatherIcon name="book-open" size={18} color="primary" />
          )}
        </Box>
        <Box className="flex-1 min-w-0 gap-[8px]">
          <Box className="flex-row items-baseline justify-between gap-[8px]">
            <Text className="flex-1 text-default text-[15px] font-bold" numberOfLines={1}>
              {plan.title}
            </Text>
            <Text className="text-grey text-[12px]" style={{ fontVariant: ['tabular-nums'] }}>
              {detail}
            </Text>
          </Box>
          <Box
            accessibilityRole="progressbar"
            accessibilityLabel={detail}
            accessibilityValue={{ min: 0, max: total, now: completed }}
            className="h-[6px] bg-light-grey rounded-full overflow-hidden"
          >
            <Box className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
          </Box>
        </Box>
      </Link>
    )

  return (
    <Link
      route="Plan"
      params={{ planId: plan.id }}
      accessibilityLabel={plan.title}
      accessibilityHint={t('readingPlans.continue')}
      className="flex-row items-center gap-[16px] bg-reverse rounded-[20px] p-[16px]"
    >
      <Box className="w-[80px] h-[64px] rounded-[12px] bg-light-grey overflow-hidden items-center justify-center">
        {image ? (
          <Image
            source={{ uri: image }}
            contentFit="cover"
            accessible={false}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <FeatherIcon name="book-open" size={26} color="primary" />
        )}
      </Box>
      <Box className="flex-1 gap-[8px]">
        <Text className="text-default text-[16px] font-bold">{plan.title}</Text>
        <Box className="flex-row items-center gap-[10px]">
          <Box
            accessibilityRole="progressbar"
            accessibilityLabel={detail}
            accessibilityValue={{ min: 0, max: total, now: completed }}
            className="w-[50px] h-[5px] bg-light-grey rounded-full overflow-hidden"
          >
            <Box className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
          </Box>
          <Text className="text-grey text-[12px] shrink" style={{ fontVariant: ['tabular-nums'] }}>
            {detail}
          </Text>
        </Box>
      </Box>
      <FeatherIcon name="chevron-right" color="primary" size={18} />
    </Link>
  )
}

export default FollowedPlanCard
