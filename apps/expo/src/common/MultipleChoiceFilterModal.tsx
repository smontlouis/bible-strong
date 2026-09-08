import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React, { forwardRef } from 'react'
import { TouchableOpacity } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'

import { SheetFlatList, SheetHeader, type SheetRef, type SheetSnapPoint } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import Checkbox from '~common/ui/Checkbox'
import Text from '~common/ui/Text'

const ChoiceRow = (
  componentProps: Omit<UIComponentProps<typeof TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('flex-row items-center p-[16px] border-b-[1px] border-b-border', className)
  )
  return (
    <TouchableOpacity
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof TouchableOpacity>['style']}
    />
  )
}

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
            <Checkbox className="mr-[12px]" checked={isSelected} fillChecked checkColor="white" />
            <Text className="flex-[1] text-[16px]">{option.label}</Text>
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
