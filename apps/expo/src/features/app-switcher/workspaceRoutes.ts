export const workspacePagePath = { home: '/home', settings: '/more' } as const
const settingsPaths = new Set([
  '/more',
  '/theme',
  '/resource-language',
  '/bible-defaults',
  '/bible-share-options',
  '/profile',
  '/login',
  '/register',
  '/forgot-password',
  '/faq',
  '/support',
  '/backup',
  '/automatic-backups',
  '/import-export',
])

export function getWorkspacePageForPath(path: string): 'home' | 'settings' | null {
  if (path === '/home') return 'home'
  return settingsPaths.has(path) ? 'settings' : null
}
