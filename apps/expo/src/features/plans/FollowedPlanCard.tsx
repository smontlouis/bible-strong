import { useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import type { ComputedPlanItem, OngoingPlan } from '~common/types'
import Box from '~common/ui/Box'
import IconTile from '~common/ui/IconTile'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useLocalReadingDate } from '~features/daily-reading/useDailyMeditation'
import { useFireStorage } from './plan.hooks'
import { getParticipationJourney } from './planSchedule'
import { getJourneyDetail } from './planJourneyLabel'
import PlanContinuePill, { getContinueLabel, useContinuePlan } from './PlanContinuePill'
import PlanStreak from './PlanStreak'

/**
 * Home list row: small cover, title with its streak, where the plan stands over a full-width
 * progress bar, and « Continuer » at the end, which opens the next reading over the plan.
 */
const FollowedPlanCard = ({
  plan,
  participation,
}: {
  plan: ComputedPlanItem
  participation: OngoingPlan
}) => {
  const { t, i18n } = useTranslation()
  const today = useLocalReadingDate()
  const continuePlan = useContinuePlan()
  const image = useFireStorage(plan.image)
  const content = useSelector((state: RootState) =>
    state.plan.myPlans.find(item => item.id === plan.id)
  )
  const readings = content?.sections.flatMap(section => section.readingSlices) ?? []
  const total = readings.length
  const journey = getParticipationJourney(readings, participation, today)
  const percent = total ? (journey.completed / total) * 100 : 0
  const detail = total
    ? getJourneyDetail(journey, t, { startDate: participation.startDate, language: i18n.language })
    : t('readingPlans.continue')
  const pill = total ? getContinueLabel(journey) : undefined

  return (
    <Box className="flex-row items-center gap-[12px] pr-[16px]">
      <Link
        route="Plan"
        params={{ planId: plan.id }}
        accessibilityLabel={`${plan.title}, ${detail}`}
        className="flex-1 flex-row items-center gap-[12px] pl-[16px] py-[12px]"
      >
        {image ? (
          <Box className="w-[40px] h-[40px] rounded-[8px] bg-canvas overflow-hidden">
            <Image
              source={{ uri: image }}
              contentFit="cover"
              accessible={false}
              style={{ width: '100%', height: '100%' }}
            />
          </Box>
        ) : (
          <IconTile tint="primary" size={40}>
            <FeatherIcon name="book-open" size={18} color="primary" />
          </IconTile>
        )}
        <Box className="flex-1 min-w-0 gap-[6px]">
          <Box className="flex-row items-center gap-[8px]">
            <Text className="flex-1 text-default text-[15px] font-bold" numberOfLines={1}>
              {plan.title}
            </Text>
            <PlanStreak count={journey.streak} />
          </Box>
          <Box
            accessibilityRole="progressbar"
            accessibilityLabel={detail}
            accessibilityValue={{ min: 0, max: total, now: journey.completed }}
            className="h-[6px] bg-canvas rounded-full overflow-hidden"
          >
            <Box className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
          </Box>
          <Text
            className="text-grey text-[12px]"
            numberOfLines={1}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {detail}
          </Text>
        </Box>
      </Link>
      {pill && (
        <PlanContinuePill label={pill} hint={plan.title} onPress={() => continuePlan(plan.id)} />
      )}
    </Box>
  )
}

export default FollowedPlanCard
