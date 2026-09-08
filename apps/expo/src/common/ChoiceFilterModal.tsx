import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React, { forwardRef } from 'react'
import { Pressable } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'

import { SheetFlatList, SheetHeader, type SheetRef, type SheetSnapPoint } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import Radio from '~common/ui/Radio'
import Text from '~common/ui/Text'

const ChoiceRow = (
  componentProps: Omit<UIComponentProps<typeof Pressable>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('flex-row items-center p-[16px] border-b-[1px] border-b-border', className)
  )
  return (
    <Pressable
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Pressable>['style']}
    />
  )
}

const FULL_HEIGHT_SNAP_POINTS: SheetSnapPoint[] = [1]
const LONG_CHOICE_LIST_THRESHOLD = 10

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
) => {
  return (
    <Sheet
      ref={ref}
      snapPoints={options.length > LONG_CHOICE_LIST_THRESHOLD ? FULL_HEIGHT_SNAP_POINTS : undefined}
      header={<SheetHeader title={title} />}
    >
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
              <Radio className="mr-[12px]" selected={isSelected} />
              <Text className="flex-[1] text-[16px]">{option.label}</Text>
            </ChoiceRow>
          )
        }}
      />
    </Sheet>
  )
}

const ChoiceFilterModal = forwardRef(ChoiceFilterModalInner) as <T extends string>(
  props: Props<T> & { ref?: React.ForwardedRef<SheetRef> }
) => React.ReactElement

export default ChoiceFilterModal
