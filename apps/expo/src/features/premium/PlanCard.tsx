import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Radio from '~common/ui/Radio'
import Text from '~common/ui/Text'
import { resolveThemeColor } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'

/**
 * One plan of the offer, as a card the reader picks. The amount the store charges is the
 * largest price on the card, as App Review requires (3.1.2); the price brought to a month only
 * follows it. The chosen card takes the accent's outline: a border that carries the selection.
 */
const PlanCard = ({
  name,
  price,
  period,
  detail,
  badge,
  selected,
  onPress,
}: {
  name: string
  /** What the store charges for each period. */
  price: string
  period: string
  detail?: string
  badge?: string
  selected: boolean
  onPress: () => void
}) => {
  const theme = useTheme()
  return (
    <TouchableBox
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={[name, `${price} ${period}`, detail, badge].filter(Boolean).join(', ')}
      onPress={onPress}
      className="flex-row items-center rounded-[16px] bg-surface px-[18px] py-[16px] border-continuous"
      style={{
        borderWidth: 2,
        borderColor: selected ? resolveThemeColor(theme, 'primary') : 'transparent',
      }}
    >
      <Box className="flex-1">
        <HStack className="items-center gap-[8px]">
          <Text className="text-[16px] font-semibold">{name}</Text>
          {badge ? (
            <Box className="rounded-full bg-light-primary px-[8px] py-[2px]">
              <Text className="text-[12px] font-semibold text-link">{badge}</Text>
            </Box>
          ) : null}
        </HStack>
        <HStack className="items-baseline mt-[6px] gap-[6px]">
          <Text className="text-[24px] font-semibold">{price}</Text>
          <Text className="text-[15px] text-grey">{period}</Text>
        </HStack>
        {detail ? <Text className="text-[13px] text-grey mt-[2px]">{detail}</Text> : null}
      </Box>
      <Radio selected={selected} size={24} />
    </TouchableBox>
  )
}

export default PlanCard
