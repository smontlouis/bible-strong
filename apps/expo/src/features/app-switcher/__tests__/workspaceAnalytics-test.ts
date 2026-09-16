import { createWorkspaceViewTracker } from '../workspaceViewTracking'

it('counts visible transitions once without sending tab identities', () => {
  const emit = jest.fn()
  const track = createWorkspaceViewTracker(emit)
  track({ tabId: 'private-a', tabType: 'bible' })
  track({ tabId: 'private-a', tabType: 'bible' })
  track({ tabId: 'private-b', tabType: 'bible' })
  track('home')
  track('home')
  track({ tabId: 'private-b', tabType: 'bible' })
  expect(emit.mock.calls).toEqual([
    ['study_tab_view', { tab_type: 'bible' }],
    ['study_tab_view', { tab_type: 'bible' }],
    ['workspace_drawer_view', { screen_name: 'home' }],
    ['study_tab_view', { tab_type: 'bible' }],
  ])
})

it('does not track hidden content and counts returning to it', () => {
  const emit = jest.fn()
  const track = createWorkspaceViewTracker(emit)
  track(null)
  expect(emit).not.toHaveBeenCalled()
  track({ tabId: 'note-id', tabType: 'notes' })
  track(null)
  track(null)
  track({ tabId: 'note-id', tabType: 'notes' })
  expect(emit).toHaveBeenCalledTimes(2)
  expect(emit).toHaveBeenLastCalledWith('study_tab_view', { tab_type: 'notes' })
})

it('counts a new tab becoming a study surface without changing its ID', () => {
  const emit = jest.fn()
  const track = createWorkspaceViewTracker(emit)
  track({ tabId: 'same-tab', tabType: 'new' })
  track({ tabId: 'same-tab', tabType: 'strong' })
  expect(emit.mock.calls).toEqual([
    ['study_tab_view', { tab_type: 'new' }],
    ['study_tab_view', { tab_type: 'strong' }],
  ])
})
