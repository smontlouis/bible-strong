import { createMMKV } from 'react-native-mmkv'
import { createReadingReminderInbox } from './readingReminderEvents'

let inbox: ReturnType<typeof createReadingReminderInbox> | undefined
export const getReadingReminderInbox = () => {
  if (!inbox) inbox = createReadingReminderInbox(createMMKV({ id: 'reading-reminder-inbox' }))
  return inbox
}
