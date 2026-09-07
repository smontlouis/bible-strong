import { getWorkspacePageForPath, workspacePagePath } from '~features/app-switcher/workspaceRoutes'

test('settings URLs highlight the settings page, including direct links', () => {
  for (const path of ['/more', '/theme', '/resource-language', '/bible-defaults', '/profile']) {
    expect(getWorkspacePageForPath(path)).toBe('settings')
  }
  expect(getWorkspacePageForPath(workspacePagePath.home)).toBe('home')
})

test('content and unrelated routes do not falsely highlight Home or Settings', () => {
  for (const path of ['/', '/strong/123', '/history', '/dictionnaire']) {
    expect(getWorkspacePageForPath(path)).toBeNull()
  }
})
