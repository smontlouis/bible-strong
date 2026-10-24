import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import { IonIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

/** Days read in a row: a flame and their count, or their full label. Nothing before the first. */
const PlanStreak = ({ count, label = false }: { count: number; label?: boolean }) => {
  const { t } = useTranslation()
  if (count < 1) return null
  const text = t('readingPlans.streak', { count })
  return (
    <Box className="flex-row items-center gap-[4px]" accessible accessibilityLabel={text}>
      <IonIcon name="flame" size={label ? 16 : 14} color="secondary" />
      <Text
        className={
          label ? 'text-default text-[13px] font-bold' : 'text-default text-[12px] font-bold'
        }
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {label ? text : count}
      </Text>
    </Box>
  )
}

export default PlanStreak
