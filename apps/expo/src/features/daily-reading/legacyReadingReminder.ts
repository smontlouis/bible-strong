import { parseInlineBibleReferences } from '~helpers/bcvParser'
import type { ExistingReminder } from './readingReminderReconciler'

/**
 * Before this refactor the app's only iOS timestamp creator was the daily verse:
 * a generated 20-character ID, no data, Bonjour/Hello, and a verse + reference.
 * iOS strips the Android channel tag. Adopt only one exact-shape pending candidate;
 * ambiguous or unrecognized requests remain untouched.
 */
export const findLegacyDailyReminderIds = (
  notifications: (ExistingReminder & { repeats?: boolean })[],
  now = Date.now()
): Set<string> => {
  const candidates = notifications.filter(item => {
    if (!/^[0-9A-Za-z]{20}$/.test(item.id) || item.repeats || Object.keys(item.data ?? {}).length)
      return false
    if (!item.timestamp || item.timestamp <= now || item.timestamp > now + 30 * 60 * 60 * 1000)
      return false
    if (!/^(Bonjour|Hello)(?: |$)/.test(item.title ?? '') || !item.body?.includes('\n'))
      return false
    const reference = item.body.split('\n').at(-1)?.trim() ?? ''
    return (
      parseInlineBibleReferences(reference, 'fr').length === 1 ||
      parseInlineBibleReferences(reference, 'en').length === 1
    )
  })
  return new Set(candidates.length === 1 ? [candidates[0].id] : [])
}
