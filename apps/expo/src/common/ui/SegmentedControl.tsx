import { twMerge } from '~common/ui/classNames'
import { HStack, TouchableBox } from './Box'
import Text from './Text'

/**
 * A choice between a few options on a page. The track is recessed into the canvas and the chosen
 * option is raised above it, in every theme.
 */
const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) => (
  <HStack className="overflow-hidden border-continuous bg-opacity5 rounded-full p-[3px] gap-[2px]">
    {options.map(option => {
      const selected = option.value === value
      return (
        <TouchableBox
          key={option.value}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{ selected }}
          onPress={() => onChange(option.value)}
          activeOpacity={0.7}
          className={twMerge(
            'overflow-hidden border-continuous flex-[1] items-center rounded-full py-[6px]',
            selected && 'bg-surface-raised'
          )}
        >
          <Text className={twMerge('text-[13px] font-semibold', !selected && 'text-grey')}>
            {option.label}
          </Text>
        </TouchableBox>
      )
    })}
  </HStack>
)

export default SegmentedControl
