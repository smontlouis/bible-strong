import React from 'react'

import { Sheet, SheetHeader, SheetItem } from '~common/sheet'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useSheet } from '~helpers/useSheet'

interface DropdownMenuProps<T extends string | number = string> {
  currentValue?: T
  setValue: (value: T) => void
  choices: { value: T; label: string; subLabel?: string }[]
  title: string
  customRender?: React.ReactNode
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
      <TouchableBox onPress={() => open()}>
        {customRender || (
          <Box padding={10}>
            <Text color="grey" fontSize={12}>
              {title}
            </Text>
            <Box row pr={5} alignItems="center">
              <Text bold fontSize={12} mr={3}>
                {choice?.label}
              </Text>
              <FeatherIcon name="chevron-down" size={15} color="default" />
            </Box>
          </Box>
        )}
      </TouchableBox>
      <Sheet ref={ref} header={<SheetHeader title={title} centerTitle />}>
        {choices.map(({ value, label, subLabel }) => (
          <SheetItem key={String(value)} tag={subLabel} onPress={() => onItemPress(value)}>
            {label}
          </SheetItem>
        ))}
      </Sheet>
    </>
  )
}

export default DropdownMenu
