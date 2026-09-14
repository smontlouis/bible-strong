import { findLegacyDailyReminderIds } from './legacyReadingReminder'
import notifee, { AndroidImportance, AuthorizationStatus, TriggerType } from '@notifee/react-native'
import { Linking, Platform } from 'react-native'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import {
  createReadingReminderQueue,
  READING_REMINDER_CHANNEL,
  type ReadingNotificationPermission,
  type ReadingReminderDriver,
} from './readingReminderReconciler'

export const readReadingPermission = async (): Promise<ReadingNotificationPermission> => {
  const settings = await notifee.getNotificationSettings()
  if (settings.authorizationStatus === AuthorizationStatus.NOT_DETERMINED) return 'not-requested'
  if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) return 'denied'
  if (
    Platform.OS === 'android' &&
    (await notifee.isChannelCreated(READING_REMINDER_CHANNEL)) &&
    (await notifee.isChannelBlocked(READING_REMINDER_CHANNEL))
  )
    return 'denied'
  return 'allowed'
}

const driver: ReadingReminderDriver = {
  scheduled: async () => {
    const requests = (await notifee.getTriggerNotifications()).flatMap(
      ({ notification, trigger }) =>
        notification.id
          ? [
              {
                id: notification.id,
                timestamp: trigger.type === TriggerType.TIMESTAMP ? trigger.timestamp : undefined,
                repeats:
                  trigger.type !== TriggerType.TIMESTAMP ||
                  (trigger.repeatFrequency !== undefined && trigger.repeatFrequency !== -1),
                title: notification.title,
                body: notification.body,
                data: notification.data,
                legacyDaily: notification.android?.channelId === 'vod-notifications',
              },
            ]
          : []
    )
    const legacy = Platform.OS === 'ios' ? findLegacyDailyReminderIds(requests) : new Set<string>()
    return requests.map(item => ({ ...item, legacyDaily: item.legacyDaily || legacy.has(item.id) }))
  },
  displayed: async () =>
    (await notifee.getDisplayedNotifications()).flatMap(({ id, notification }) =>
      id ? [{ id, data: notification.data }] : []
    ),
  permission: readReadingPermission,
  cancelScheduled: id => notifee.cancelTriggerNotification(id),
  removeDisplayed: id => notifee.cancelDisplayedNotification(id),
  schedule: async reminder => {
    const channelId = await notifee.createChannel({
      id: READING_REMINDER_CHANNEL,
      name: 'Bible Strong',
      importance: AndroidImportance.DEFAULT,
    })
    await notifee.createTriggerNotification(
      {
        id: reminder.id,
        title: reminder.title,
        body: reminder.body,
        data: reminder.data,
        android: { channelId, pressAction: { id: 'default' } },
      },
      { type: TriggerType.TIMESTAMP, timestamp: reminder.timestamp }
    )
  },
}

export const readingReminderQueue = createReadingReminderQueue(
  driver,
  () => getCurrentAuthUser()?.uid ?? ''
)

export const openReadingNotificationSettings = async () => {
  if (Platform.OS === 'ios') return Linking.openSettings()
  const settings = await notifee.getNotificationSettings()
  // Before the first schedule, there is no channel settings page to open.
  // App-wide denial must also be resolved at the application level.
  if (
    settings.authorizationStatus < AuthorizationStatus.AUTHORIZED ||
    !(await notifee.isChannelCreated(READING_REMINDER_CHANNEL))
  )
    return notifee.openNotificationSettings()
  return notifee.openNotificationSettings(READING_REMINDER_CHANNEL)
}
