import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import type { PlanJourney } from './planSchedule'

/** Opens the plan and, over it, what « Continuer » leads to (see `ScheduledPlanContent`). */
export const useContinuePlan = () => {
  const router = useRouter()
  return (planId: string) => router.push({ pathname: '/plan', params: { planId, continue: '1' } })
}

/** The label of a row's pill, or none when the day is read and nothing is left behind. */
export const getContinueLabel = (journey: PlanJourney): string | undefined =>
  journey.finished || !journey.total
    ? undefined
    : journey.continueKind === 'continue'
      ? 'readingPlans.continueShort'
      : journey.continueKind === 'catchUp'
        ? 'readingPlans.catchUp'
        : undefined

/** The small filled button at the end of a plan's row. */
const PlanContinuePill = ({
  label,
  hint,
  onPress,
}: {
  label: string
  hint?: string
  onPress: () => void
}) => {
  const { t } = useTranslation()
  return (
    <Link
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      accessibilityHint={hint}
      hitSlop={6}
      onPress={onPress}
      className="rounded-full bg-primary px-[14px] h-[32px] items-center justify-center"
    >
      <Text className="text-white font-bold text-[13px]">{t(label)}</Text>
    </Link>
  )
}

export default PlanContinuePill
