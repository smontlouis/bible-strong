import { useTheme } from '~themes/ThemeProvider'
import { DateTimePicker } from '@expo/ui/community/datetime-picker'
import { useRef, useState } from 'react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Sheet from '~common/ModalSheet'
import { SheetView, type SheetRef } from '~common/sheet'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { toCivilDate } from '~features/plans/readingCalendar'

export interface ReadingDatePickerProps {
  variant?: 'default' | 'pill'
  value: string
  label: string
  onChange: (value: string) => void
  minimum?: string
  maximum?: string
}

const ReadingDatePicker = ({
  value,
  label,
  onChange,
  minimum,
  maximum,
  variant = 'default',
}: ReadingDatePickerProps) => {
  const { i18n } = useTranslation()
  const theme = useTheme()
  const sheet = useRef<SheetRef>(null)
  const [androidOpen, setAndroidOpen] = useState(false)
  const date = new Date(`${value}T12:00:00`)
  const picker = (
    <DateTimePicker
      mode="date"
      accentColor={theme.colors.primary}
      value={date}
      display={Platform.OS === 'ios' ? 'inline' : 'default'}
      presentation="dialog"
      locale={i18n.language}
      minimumDate={minimum ? new Date(`${minimum}T12:00:00`) : undefined}
      maximumDate={maximum ? new Date(`${maximum}T12:00:00`) : undefined}
      onValueChange={(_, next) => {
        onChange(toCivilDate(next))
        setAndroidOpen(false)
        sheet.current?.dismiss()
      }}
      onDismiss={() => setAndroidOpen(false)}
    />
  )
  return (
    <>
      <Link
        accessibilityLabel={label}
        onPress={() => (Platform.OS === 'ios' ? sheet.current?.present() : setAndroidOpen(true))}
        className={
          variant === 'pill'
            ? 'min-h-[36px] flex-row items-center justify-center bg-light-primary rounded-[14px] px-[11px] py-[7px]'
            : 'min-h-[44px] flex-row items-center justify-center gap-[8px] px-[12px] py-[10px]'
        }
      >
        <Text
          numberOfLines={1}
          className={
            variant === 'pill' ? 'text-primary font-bold' : 'text-primary text-[14px] font-bold'
          }
        >
          {date.toLocaleDateString(i18n.language, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        {variant !== 'pill' && <FeatherIcon name="chevron-down" size={16} color="primary" />}
      </Link>
      {Platform.OS === 'ios' ? (
        <Sheet ref={sheet}>
          <SheetView>
            <Box className="px-[20px] pt-[20px] pb-[32px] gap-[16px]">
              <Text className="text-default font-bold text-[18px]">{label}</Text>
              {picker}
            </Box>
          </SheetView>
        </Sheet>
      ) : androidOpen ? (
        picker
      ) : null}
    </>
  )
}
export default ReadingDatePicker
