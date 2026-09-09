import type { UserState } from './modules/user'
import { normalizeCompareSelection } from './compareSelectionMigration'

/** The same write contract is used by immediate sync and offline replay. */
export const buildCompareSettingsWrite = (
  settings: Pick<UserState['bible']['settings'], 'compare' | 'compareSelectionVersion'>
) => ({
  // Send the marker even when the local migration already set it, and retain {}.
  settings: normalizeCompareSelection(settings),
  mergeFields: ['bible.settings.compare', 'bible.settings.compareSelectionVersion'],
})
