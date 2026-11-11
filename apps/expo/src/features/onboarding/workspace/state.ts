// Plain atoms only: the desktop shell and the palette read them without loading the storage.
import { atom } from 'jotai/vanilla'

/**
 * What the onboarding of the Web and the desktop app shows now: nothing, the story (full
 * window), the invitation card of a first visit opened on an Incoming link, or the tour card.
 */
export type WorkspaceOnboardingView = 'none' | 'story' | 'invite' | 'tour'
export const workspaceOnboardingViewAtom = atom<WorkspaceOnboardingView>('none')

/** The story holds the keyboard: the workspace's own shortcuts, ⌘K included, stay quiet. */
export const workspaceStoryOpenAtom = atom(get => get(workspaceOnboardingViewAtom) === 'story')

/** Plays the story again: from the shortcut guide, the shortcuts page, the desktop Help menu. */
export const replayWorkspaceOnboardingAtom = atom(null, (_get, set) =>
  set(workspaceOnboardingViewAtom, 'story')
)
