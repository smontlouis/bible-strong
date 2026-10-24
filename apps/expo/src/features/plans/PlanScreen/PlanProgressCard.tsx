import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Card from '~common/ui/Card'
import Text from '~common/ui/Text'
import PlanProgressCircle from '~features/home/PlanProgressCircle'
import { useTheme } from '~themes/ThemeProvider'
import PlanStreak from '../PlanStreak'

const RING = 120

/** The progress of a followed plan as a ring, with its days and its streak, beside the day. */
const PlanProgressCard = ({
  completed,
  total,
  streak,
}: {
  completed: number
  total: number
  streak: number
}) => {
  const { t, i18n } = useTranslation()
  const theme = useTheme()
  const progress = total ? completed / total : 0
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' }).format(progress)
  return (
    <Card className="p-[20px] items-center gap-[12px]">
      <PlanProgressCircle
        progress={progress}
        size={RING}
        thickness={10}
        color={theme.colors.primary}
        unfilledColor={theme.colors.lightGrey}
      >
        <Box className="flex-1 items-center justify-center">
          <Text
            className="text-default font-bold text-[26px]"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {percent}
          </Text>
        </Box>
      </PlanProgressCircle>
      <Text className="text-grey text-[13px]">
        {t('readingPlans.daysProgress', { count: completed, total })}
      </Text>
      <PlanStreak count={streak} label />
    </Card>
  )
}

export default PlanProgressCard
