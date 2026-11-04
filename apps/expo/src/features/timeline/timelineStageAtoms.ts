import { atom } from 'jotai'

/**
 * The event a sheet of the timeline shows. A timeline that opened the sheet follows it, so that
 * closing the sheet leaves the reader where the last event stands.
 */
export const timelineShownEventAtom = atom<{ slug: string } | undefined>(undefined)

/** Whether a timeline lies under the sheet it opened, already showing its event. */
export const timelineUnderSheetAtom = atom(false)
