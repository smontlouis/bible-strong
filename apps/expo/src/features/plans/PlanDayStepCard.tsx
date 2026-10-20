import { useTranslation } from 'react-i18next'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type { PlanDayStepAction } from './usePlanDayStep'

/** At the end of an element of a plan day: the way on to the next one, or to the day's end. */
const PlanDayStepCard = ({ step }: { step: PlanDayStepAction }) => {
  const { t } = useTranslation()
  const label = t(step.kind === 'next' ? 'readingPlans.seeNext' : 'readingPlans.finishDay')
  return (
    <TouchableBox
      className="bg-reverse rounded-[18px] px-[18px] py-[16px]"
      style={{ boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)' }}
      accessibilityRole="button"
      accessibilityLabel={step.kind === 'next' ? `${label}, ${step.title}` : label}
      onPress={step.onPress}
    >
      <HStack className="items-center gap-[14px]">
        <Box className="flex-1 gap-[2px]">
          <Text className="text-primary font-bold text-[16px]">{label}</Text>
          {step.kind === 'next' && (
            <Text className="text-default text-[14px]" numberOfLines={1}>
              {step.title}
            </Text>
          )}
        </Box>
        <Box className="w-[36px] h-[36px] rounded-full bg-primary items-center justify-center">
          <FeatherIcon
            name={step.kind === 'next' ? 'arrow-right' : 'check'}
            size={18}
            color="reverse"
          />
        </Box>
      </HStack>
    </TouchableBox>
  )
}

export default PlanDayStepCard
