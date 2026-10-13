import { useRef } from 'react'
import Sheet from '~common/ModalSheet'
import { SheetFlatList, SheetHeader, type SheetRef } from '~common/sheet'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

export type WidgetSelectItem = { id: string; label: string }

/** A compact choice: the current value in the card, the options in a sheet above it. */
export default function WidgetSelect({
  label,
  value,
  items,
  onChange,
}: {
  label: string
  value: string
  items: WidgetSelectItem[]
  onChange: (value: string) => void
}) {
  const sheet = useRef<SheetRef>(null)
  const selected = items.find(item => item.id === value)
  return (
    <>
      <TouchableBox
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label || value }}
        onPress={() => sheet.current?.present()}
        className="bg-light-grey h-[28px] max-w-[190px] flex-row items-center gap-1 rounded-full pl-3 pr-2"
      >
        <Text className="shrink text-[13px] font-semibold" numberOfLines={1}>
          {selected?.label || value}
        </Text>
        <FeatherIcon name="chevron-down" size={14} color="grey" />
      </TouchableBox>
      <Sheet ref={sheet} snapPoints={[0.5, 1]} header={<SheetHeader title={label} />}>
        <SheetFlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableBox
              accessibilityRole="button"
              accessibilityState={{ selected: item.id === value }}
              onPress={() => {
                onChange(item.id)
                sheet.current?.dismiss()
              }}
              className="border-border flex-row items-center justify-between border-b px-5 py-[14px]"
            >
              <Text className="flex-1 text-[15px]">{item.label}</Text>
              {item.id === value && <FeatherIcon name="check" size={17} color="primary" />}
            </TouchableBox>
          )}
        />
      </Sheet>
    </>
  )
}
