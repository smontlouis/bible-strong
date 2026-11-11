import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

/**
 * The guided steps in the real workspace that follow the story on the Web and in the desktop
 * app: the palette, a passage, the tab's actions, the guide. A reader who closes the card has
 * done it too.
 */
export type WorkspaceTourStatus = 'pending' | 'done'
export const workspaceTourStatusAtom = atomWithAsyncStorage<WorkspaceTourStatus>(
  'workspaceTourStatus',
  'pending'
)
