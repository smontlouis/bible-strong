import React from 'react'
import { Sheet, SheetHeader, SheetItem, SheetScrollView } from '~common/sheet'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useSheet } from '~helpers/useSheet'
export interface DropdownMenuProps<T extends string | number = string> {
  currentValue?: T
  setValue: (value: T) => void
  choices: { value: T; label: string; subLabel?: string }[]
  title: string
  customRender?: React.ReactNode
  searchable?: boolean
}

const DropdownMenu = <T extends string | number = string>({
  currentValue,
  setValue,
  choices,
  title,
  customRender,
}: DropdownMenuProps<T>) => {
  const choice = choices.find(l => l.value === currentValue)
  const { ref, open, close } = useSheet()

  const onItemPress = (value: T) => {
    setValue(value)
    close()
  }
  return (
    <>
      <TouchableBox
        className="overflow-hidden border-continuous"
        onPress={() => open()}
        accessibilityRole="button"
        accessibilityLabel={choice ? `${title}: ${choice.label}` : title}
      >
        {customRender || (
          <Box className="overflow-hidden border-continuous p-[10px]">
            <Text className="text-grey text-[12px]">{title}</Text>
            <Box className="overflow-hidden border-continuous flex-row pr-[5px] items-center">
              <Text className="font-bold text-[12px] mr-[3px]">{choice?.label}</Text>
              <FeatherIcon name="chevron-down" size={15} color="default" />
            </Box>
          </Box>
        )}
      </TouchableBox>
      <Sheet
        ref={ref}
        snapPoints={choices.length > 10 ? [1] : ['auto']}
        header={<SheetHeader title={title} centerTitle />}
      >
        <SheetScrollView>
          {choices.map(({ value, label, subLabel }) => (
            <SheetItem key={String(value)} tag={subLabel} onPress={() => onItemPress(value)}>
              {label}
            </SheetItem>
          ))}
        </SheetScrollView>
      </Sheet>
    </>
  )
}

export default DropdownMenu
