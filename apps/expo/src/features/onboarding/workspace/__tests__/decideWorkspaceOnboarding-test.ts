import {
  decideWorkspaceOnboarding,
  isExistingUser,
  type WorkspaceOnboardingSituation,
} from '../decideWorkspaceOnboarding'

const firstVisit: WorkspaceOnboardingSituation = {
  completed: false,
  existingUser: false,
  incomingLink: false,
  wide: true,
  tourStatus: 'pending',
}

describe('decideWorkspaceOnboarding', () => {
  it('plays the story on a first visit', () => {
    expect(decideWorkspaceOnboarding(firstVisit)).toEqual({ view: 'story', markCompleted: false })
  })

  it('plays it in a narrow window too, in its mobile form', () => {
    expect(decideWorkspaceOnboarding({ ...firstVisit, wide: false }).view).toBe('story')
  })

  it('only offers it to a first visit that came to read a shared link', () => {
    expect(decideWorkspaceOnboarding({ ...firstVisit, incomingLink: true })).toEqual({
      view: 'invite',
      markCompleted: false,
    })
  })

  it('gives a device used before the tour alone, and records the story as done', () => {
    expect(decideWorkspaceOnboarding({ ...firstVisit, existingUser: true })).toEqual({
      view: 'tour',
      markCompleted: true,
    })
    expect(
      decideWorkspaceOnboarding({ ...firstVisit, existingUser: true, incomingLink: true }).view
    ).toBe('tour')
  })

  it('shows the tour until it is done, in a wide window only', () => {
    const completed = { ...firstVisit, completed: true }
    expect(decideWorkspaceOnboarding(completed).view).toBe('tour')
    expect(decideWorkspaceOnboarding({ ...completed, tourStatus: 'done' }).view).toBe('none')
    expect(decideWorkspaceOnboarding({ ...completed, wide: false }).view).toBe('none')
  })
})

describe('isExistingUser', () => {
  const state = (user: { id?: string; changelog?: object; highlights?: object }) => ({
    user: {
      id: user.id ?? '',
      bible: {
        changelog: (user.changelog ?? {}) as Record<string, boolean>,
        highlights: (user.highlights ?? {}) as Record<string, unknown>,
      },
    },
  })

  it('knows a device by its account, its changelog or its highlights', () => {
    expect(isExistingUser(state({}))).toBe(false)
    expect(isExistingUser(state({ id: 'uid' }))).toBe(true)
    expect(isExistingUser(state({ changelog: { '1730000000000': true } }))).toBe(true)
    expect(isExistingUser(state({ highlights: { '1-1-1': {} } }))).toBe(true)
  })
})
