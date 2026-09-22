/** Public presence only; never exposes the content being read or an answer. */
export const ACTIVITIES = ['menu', 'exploration', 'game', 'board', 'book'] as const
export type AvatarActivity = (typeof ACTIVITIES)[number]
export function isAvatarActivity(value: unknown): value is AvatarActivity {
  return ACTIVITIES.some(activity => activity === value)
}
export function currentActivity(state: {
  ready: boolean; menuOpen: boolean; profileOpen: boolean; opened: unknown;
  storyOpen: boolean; guestbookOpen: boolean; gamesOpen: boolean
}): AvatarActivity | null {
  if (!state.ready) return null
  if (state.gamesOpen) return 'game'
  if (state.guestbookOpen) return 'board'
  if (state.storyOpen) return 'book'
  if (state.opened) return 'exploration'
  if (state.menuOpen || state.profileOpen) return 'menu'
  return null
}

const paths: Record<AvatarActivity, string> = {
  menu: '<path d="M6 7h12M6 12h12M6 17h12"/>',
  exploration: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/>',
  game: '<path d="M7 8h10c3 0 4 4 4 8 0 3-3 3-5-1H8c-2 4-5 4-5 1 0-4 1-8 4-8Z"/><path d="M7 10v4m-2-2h4m6-1h.1m2 2h.1"/>',
  board: '<rect x="4" y="4" width="16" height="14" rx="2"/><path d="M8 8h8m-8 4h4m-4 6-2 3m10-3 2 3"/>',
  book: '<path d="M12 6C8 3 4 4 3 5v14c3-2 6-1 9 1 3-2 6-3 9-1V5c-1-1-5-2-9 1Zm0 0v14"/>',
}
export function activityBadgeSvg(activity: AvatarActivity) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="104" viewBox="0 0 48 52"><circle cx="24" cy="28" r="22" fill="#3055B6"/><circle cx="24" cy="24" r="22" fill="#587EF0" stroke="white" stroke-width="2"/><g transform="translate(10 10) scale(1.1667)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[activity]}</g></svg>`
}
