import { applyPendingStrongMode, applyStrongModeSelection } from '../strongModeState'

describe('applyStrongModeSelection', () => {
  it('cancels a pending reverse-interlinear activation when the user explicitly selects text', () => {
    const state = {
      strongMode: 'hidden' as const,
      pendingStrongModeVersionId: 'LSG' as const,
      pendingStrongMode: 'reverse-interlinear' as const,
      pendingStrongInterlinearLocale: 'en' as const,
    }

    applyStrongModeSelection(state, 'hidden')

    expect(state).toEqual({
      strongMode: 'hidden',
      pendingStrongModeVersionId: undefined,
      pendingStrongMode: undefined,
      pendingStrongInterlinearLocale: undefined,
    })
  })

  it('remembers the STEP locale actually queued for a pending reverse interlinear mode', () => {
    const state = { strongMode: 'hidden' as const }

    applyPendingStrongMode(state, 'LSG', 'reverse-interlinear', 'en')

    expect(state).toEqual({
      strongMode: 'hidden',
      pendingStrongModeVersionId: 'LSG',
      pendingStrongMode: 'reverse-interlinear',
      pendingStrongInterlinearLocale: 'en',
    })
  })
})
