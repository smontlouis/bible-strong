import Card from '~common/ui/Card'
import SheetWell from '~common/ui/SheetWell'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import Switch from '~common/ui/Switch'
import { IS_BROWSER } from '~desktop/isDesktop'
import ReminderTimeField from './ReminderTimeField'
import { useReadingReminderPermission } from './useReadingReminderPermission'

// iOS, Android and the desktop app deliver reminders; the browser points to them.
const DELIVERS_REMINDERS = !IS_BROWSER

const ReminderSettings = ({
  time,
  onChange,
  scope = 'daily',
  showIcon = false,
  surface = 'well',
}: {
  showIcon?: boolean
  /** A well inside a sheet; a card when the setting sits on a page. */
  surface?: 'well' | 'card'
  time?: string
  scope?: string
  onChange: (time: string | null) => void
}) => {
  const { t } = useTranslation()
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
  const Container = surface === 'card' ? Card : SheetWell
  return (
    <Container className={surface === 'card' ? 'p-[16px] gap-[12px]' : 'p-[20px] gap-[12px]'}>
      <Box className="flex-row items-center justify-between gap-[16px]">
        <Box className="flex-1 flex-row items-center gap-[8px]">
          {showIcon && DELIVERS_REMINDERS && <FeatherIcon name="bell" size={18} color="primary" />}
          <Text className="text-default font-bold flex-1">{t('dailyReading.reminder')}</Text>
        </Box>
        {DELIVERS_REMINDERS && (
          <Switch
            disabled={pending}
            value={Boolean(time)}
            accessibilityLabel={t('dailyReading.reminder')}
            onValueChange={toggle}
          />
        )}
      </Box>
      {!DELIVERS_REMINDERS ? (
        <Text className="text-grey text-[13px] leading-[20px]">
          {t('dailyReading.mobileReminders')}
        </Text>
      ) : (
        <>
          {pending && <ActivityIndicator accessibilityLabel={t('Chargement...')} />}
          {time ? (
            <ReminderTimeField time={validTime ?? '07:00'} onChange={onChange} />
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
                <Text className="text-link font-bold">
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
                <Text className="text-link font-bold">{t('dailyReading.retry')}</Text>
              </Link>
            </Box>
          )}
          {time &&
            delivery.permission === 'allowed' &&
            (delivery.phase === 'idle' || delivery.phase === 'scheduled') &&
            !through && (
              <Text className="text-grey text-[12px]">{t('dailyReading.noUpcomingReminder')}</Text>
            )}
        </>
      )}
    </Container>
  )
}
export default ReminderSettings
