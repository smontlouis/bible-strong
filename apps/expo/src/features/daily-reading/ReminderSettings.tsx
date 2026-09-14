import { DateTimePicker } from '@expo/ui/community/datetime-picker'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import Switch from '~common/ui/Switch'
import { useReadingReminderPermission } from './useReadingReminderPermission'

const ReminderSettings = ({
  time,
  onChange,
  scope = 'daily',
  showIcon = false,
}: {
  showIcon?: boolean
  time?: string
  scope?: string
  onChange: (time: string | null) => void
}) => {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const delivery = useReadingReminderPermission()
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(time ?? '') ? time : undefined
  const [hours, minutes] = (validTime || '07:00').split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  const through = delivery.through[scope]
  const toggle = async (enabled: boolean) => {
    if (!enabled) {
      onChange(null)
      return
    }
    setPending(true)
    const allowed = await delivery.request()
    if (!mounted.current) return
    setPending(false)
    if (allowed) onChange('07:00')
  }
  return (
    <Box className="bg-light-grey rounded-[20px] p-[20px] gap-[12px]">
      <Box className="flex-row items-center justify-between gap-[16px]">
        <Box className="flex-1 flex-row items-center gap-[8px]">
          {showIcon && Platform.OS !== 'web' && (
            <FeatherIcon name="bell" size={18} color="primary" />
          )}
          <Text className="text-default font-bold flex-1">{t('dailyReading.reminder')}</Text>
        </Box>
        {Platform.OS !== 'web' && (
          <Switch
            disabled={pending}
            value={Boolean(time)}
            accessibilityLabel={t('dailyReading.reminder')}
            onValueChange={toggle}
          />
        )}
      </Box>
      {Platform.OS === 'web' ? (
        <Text className="text-grey text-[13px] leading-[20px]">
          {t('dailyReading.mobileReminders')}
        </Text>
      ) : (
        <>
          {pending && <ActivityIndicator accessibilityLabel={t('Chargement...')} />}
          {time ? (
            <>
              <Link
                onPress={() => setOpen(true)}
                className="min-h-[44px] justify-center"
                accessibilityLabel={t("Choisir l'heure")}
              >
                <Text className="text-primary text-[18px] font-bold">{validTime ?? '07:00'}</Text>
              </Link>
              {(Platform.OS === 'ios' || open) && (
                <DateTimePicker
                  value={date}
                  mode="time"
                  is24Hour
                  presentation="dialog"
                  onValueChange={(_, next) => {
                    onChange(
                      `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`
                    )
                    setOpen(false)
                  }}
                  onDismiss={() => setOpen(false)}
                />
              )}
            </>
          ) : (
            delivery.permission !== 'denied' && (
              <Text className="text-grey text-[13px]">{t('dailyReading.reminderOptional')}</Text>
            )
          )}
          {delivery.permission === 'denied' && (
            <Box className="gap-[8px]">
              <Text accessibilityRole="alert" className="text-default text-[13px] leading-[20px]">
                {t('dailyReading.permissionDenied')}
              </Text>
              <Link
                onPress={() => {
                  void delivery.openSettings()
                }}
                className="min-h-[44px] justify-center"
              >
                <Text className="text-primary font-bold">
                  {t('dailyReading.notificationSettings')}
                </Text>
              </Link>
            </Box>
          )}
          {delivery.phase === 'error' && (
            <Box className="gap-[8px]">
              <Text accessibilityRole="alert" className="text-default text-[13px]">
                {t('dailyReading.reminderError')}
              </Text>
              <Link onPress={delivery.retry} className="min-h-[44px] justify-center">
                <Text className="text-primary font-bold">{t('dailyReading.retry')}</Text>
              </Link>
            </Box>
          )}
          {time &&
            delivery.permission === 'allowed' &&
            delivery.phase === 'scheduled' &&
            through && (
              <Text className="text-grey text-[12px] leading-[18px]">
                {t('dailyReading.remindersThrough', {
                  date: new Date(`${through}T12:00:00`).toLocaleDateString(i18n.language, {
                    day: 'numeric',
                    month: 'long',
                  }),
                })}
              </Text>
            )}
          {time &&
            delivery.permission === 'allowed' &&
            (delivery.phase === 'idle' || delivery.phase === 'scheduled') &&
            !through && (
              <Text className="text-grey text-[12px]">{t('dailyReading.noUpcomingReminder')}</Text>
            )}
        </>
      )}
    </Box>
  )
}
export default ReminderSettings
