import styled from '@emotion/native'
import React, { forwardRef } from 'react'
import { TouchableOpacity } from 'react-native'

import {
  Sheet,
  SheetFlatList,
  SheetHeader,
  type SheetRef,
  type SheetSnapPoint,
} from '~common/sheet'
import Checkbox from '~common/ui/Checkbox'
import Text from '~common/ui/Text'

const ChoiceRow = styled(TouchableOpacity)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const FULL_HEIGHT_SNAP_POINTS: SheetSnapPoint[] = [1]
const LONG_CHOICE_LIST_THRESHOLD = 10

export type MultipleChoiceFilterOption<T extends string> = {
  value: T
  label: string
}

type Props<T extends string> = {
  title: string
  selectedValues: readonly T[]
  options: readonly MultipleChoiceFilterOption<T>[]
  onToggle: (value: T) => void
}

const MultipleChoiceFilterModalInner = <T extends string>(
  { title, selectedValues, options, onToggle }: Props<T>,
  ref: React.ForwardedRef<SheetRef>
) => (
  <Sheet
    ref={ref}
    snapPoints={options.length > LONG_CHOICE_LIST_THRESHOLD ? FULL_HEIGHT_SNAP_POINTS : undefined}
    header={<SheetHeader title={title} />}
  >
    <SheetFlatList
      data={options}
      extraData={selectedValues}
      keyExtractor={option => option.value}
      renderItem={({ item: option }) => {
        const isSelected = selectedValues.includes(option.value)
        return (
          <ChoiceRow
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={option.label}
            onPress={() => onToggle(option.value)}
          >
            <Checkbox checked={isSelected} fillChecked checkColor="white" mr={12} />
            <Text flex={1} fontSize={16}>
              {option.label}
            </Text>
          </ChoiceRow>
        )
      }}
    />
  </Sheet>
)

const MultipleChoiceFilterModal = forwardRef(MultipleChoiceFilterModalInner) as <T extends string>(
  props: Props<T> & { ref?: React.ForwardedRef<SheetRef> }
) => React.ReactElement

export default MultipleChoiceFilterModal
