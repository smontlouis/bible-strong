import type { WorkspaceOnboardingView } from './state'
import type { WorkspaceTourStatus } from './tourStatus'

export type WorkspaceOnboardingSituation = {
  /** The story was played or set aside on this device (`isOnboardingCompletedAtom`). */
  completed: boolean
  /** The device was used before the onboarding existed: an account, a highlight, a changelog seen. */
  existingUser: boolean
  /** The page was opened on an Incoming link: a verse someone shared, a search result. */
  incomingLink: boolean
  /** The workspace shows its sidebar: a keyboard is likely, and the tour has room. */
  wide: boolean
  tourStatus: WorkspaceTourStatus
}

export type WorkspaceOnboardingDecision = {
  view: WorkspaceOnboardingView
  /** Records the story as done without playing it: a reader who knows the app skips it. */
  markCompleted: boolean
}

/**
 * What a page load of the Web or the desktop app shows. A first visit gets the story, unless
 * it came to read something precise: then a card offers it, and the story waits for the next
 * visit. A device used before gets only the tour, which a narrow window never shows.
 */
export function decideWorkspaceOnboarding(
  situation: WorkspaceOnboardingSituation
): WorkspaceOnboardingDecision {
  const tour: WorkspaceOnboardingView =
    situation.wide && situation.tourStatus === 'pending' ? 'tour' : 'none'
  if (situation.completed) return { view: tour, markCompleted: false }
  if (situation.existingUser) return { view: tour, markCompleted: true }
  if (situation.incomingLink) return { view: 'invite', markCompleted: false }
  return { view: 'story', markCompleted: false }
}

type ExistingUserState = {
  user: {
    id: string
    bible: { changelog: Record<string, boolean>; highlights: Record<string, unknown> }
  }
}

/**
 * Before the onboarding, every page load of the Web and the desktop app showed the changelog,
 * and dismissing it recorded it: a device that has seen one was used before.
 */
export const isExistingUser = (state: ExistingUserState) =>
  Boolean(state.user.id) ||
  Object.keys(state.user.bible.changelog).length > 0 ||
  Object.keys(state.user.bible.highlights).length > 0
