import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'

/** The three groups of the selection sheet, as tabs at the top of the desktop menu. */
export default function SelectionMenuTabs({
  labels,
  activeIndex,
  onChange,
}: {
  labels: string[]
  activeIndex: number
  onChange: (index: number) => void
}) {
  return (
    <Box className="flex-row bg-light-grey rounded-lg p-[2px] mx-[2px] mt-[6px] mb-[6px]">
      {labels.map((label, index) => (
        <TouchableBox
          key={label}
          accessibilityRole="tab"
          accessibilityState={{ selected: index === activeIndex }}
          onPress={() => onChange(index)}
          className={`flex-1 items-center py-[5px] rounded-md ${index === activeIndex ? 'bg-reverse' : ''}`}
        >
          <Text
            className={`text-[12px] ${index === activeIndex ? 'font-bold text-default' : 'text-tertiary'}`}
          >
            {label}
          </Text>
        </TouchableBox>
      ))}
    </Box>
  )
}
