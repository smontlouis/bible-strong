/**
 * The tour of the workspace, played in the real app after the story: the reader opens the
 * palette, opens a passage from it, lists the tab's actions, then opens the guide. Each step
 * ends on what the app does, never on a click on the card.
 */
export const TOUR_STEPS = ['palette', 'passage', 'actions', 'guide'] as const
export type TourStep = (typeof TOUR_STEPS)[number] | 'done'

export type TourSignals = {
  paletteOpen: boolean
  /** The palette shows the actions of the tab (⇧⌘K). */
  actionsOpen: boolean
  guideOpen: boolean
  /** Another tab became the active one since the step began. */
  tabChanged: boolean
}

export function advanceTour(step: TourStep, signals: TourSignals): TourStep {
  switch (step) {
    case 'palette':
      return signals.paletteOpen ? 'passage' : step
    case 'passage':
      return !signals.paletteOpen && signals.tabChanged ? 'actions' : step
    case 'actions':
      return signals.actionsOpen ? 'guide' : step
    case 'guide':
      return signals.guideOpen ? 'done' : step
    case 'done':
      return step
  }
}
