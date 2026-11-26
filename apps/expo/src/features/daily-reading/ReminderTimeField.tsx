import { DateTimePicker } from '@expo/ui/community/datetime-picker'
import { useState } from 'react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'

import Link from '~common/Link'
import Text from '~common/ui/Text'

const twoDigits = (value: number) => String(value).padStart(2, '0')

/** The time of a reading reminder: the system's picker, inline on iOS, in a dialog on Android. */
const ReminderTimeField = ({
  time,
  onChange,
}: {
  /** `HH:mm` */
  time: string
  onChange: (time: string) => void
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return (
    <>
      {Platform.OS !== 'ios' && (
        <Link
          onPress={() => setOpen(true)}
          className="min-h-[44px] justify-center"
          accessibilityLabel={t("Choisir l'heure")}
        >
          <Text className="text-link text-[18px] font-bold">{time}</Text>
        </Link>
      )}
      {(Platform.OS === 'ios' || open) && (
        <DateTimePicker
          value={date}
          mode="time"
          is24Hour
          presentation="dialog"
          onValueChange={(_, next) => {
            onChange(`${twoDigits(next.getHours())}:${twoDigits(next.getMinutes())}`)
            setOpen(false)
          }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </>
  )
}

export default ReminderTimeField
