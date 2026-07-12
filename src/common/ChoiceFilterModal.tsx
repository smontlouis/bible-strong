import styled from '@emotion/native'
import React, { forwardRef } from 'react'
import { TouchableOpacity } from 'react-native'

import { Sheet, SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import Checkbox from '~common/ui/Checkbox'
import { FeatherIcon } from '~common/ui/Icon'
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
  <Sheet ref={ref} snapPoints={[0.5]} header={<SheetHeader title={title} />}>
    <SheetScrollView>
      {options.map(option => {
        const isSelected = option.value === selectedValue
        return (
          <ChoiceRow key={option.value} onPress={() => onSelect(option.value)}>
            <Checkbox checked={isSelected} marginRight={12} />
            <Text flex={1} fontSize={16}>
              {option.label}
            </Text>
            {isSelected && <FeatherIcon name="check" size={20} color="primary" />}
          </ChoiceRow>
        )
      })}
    </SheetScrollView>
  </Sheet>
)

const ChoiceFilterModal = forwardRef(ChoiceFilterModalInner) as <T extends string>(
  props: Props<T> & { ref?: React.ForwardedRef<SheetRef> }
) => React.ReactElement

export default ChoiceFilterModal
