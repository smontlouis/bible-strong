import styled from '@emotion/native'
import React, { forwardRef } from 'react'
import { TouchableOpacity } from 'react-native'

import { Sheet, SheetFlatList, SheetHeader, type SheetRef } from '~common/sheet'
import Radio from '~common/ui/Radio'
import Text from '~common/ui/Text'

const ChoiceRow = styled(TouchableOpacity)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

export type ChoiceFilterOption<T extends string> = {
  value: T
  label: string
}

type Props<T extends string> = {
  title: string
  selectedValue: T
  options: readonly ChoiceFilterOption<T>[]
  onSelect: (value: T) => void
}

const ChoiceFilterModalInner = <T extends string>(
  { title, selectedValue, options, onSelect }: Props<T>,
  ref: React.ForwardedRef<SheetRef>
) => (
  <Sheet ref={ref} header={<SheetHeader title={title} />}>
    <SheetFlatList
      data={options}
      extraData={selectedValue}
      keyExtractor={option => option.value}
      renderItem={({ item: option }) => {
        const isSelected = option.value === selectedValue
        return (
          <ChoiceRow
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            onPress={() => onSelect(option.value)}
          >
            <Radio selected={isSelected} marginRight={12} />
            <Text flex={1} fontSize={16}>
              {option.label}
            </Text>
          </ChoiceRow>
        )
      }}
    />
  </Sheet>
)

const ChoiceFilterModal = forwardRef(ChoiceFilterModalInner) as <T extends string>(
  props: Props<T> & { ref?: React.ForwardedRef<SheetRef> }
) => React.ReactElement

export default ChoiceFilterModal
