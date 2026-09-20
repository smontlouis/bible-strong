import type { WebAuthStatus } from './useWebAuthStatus'

export type PublicShellMode = 'pending' | 'public' | 'workspace'

export const resolvePublicShellMode = ({
  publicPath,
  authStatus,
  guestWorkspaceRequested,
}: {
  publicPath: boolean
  authStatus: WebAuthStatus
  guestWorkspaceRequested: boolean
}): PublicShellMode => {
  if (!publicPath || authStatus === 'authenticated' || guestWorkspaceRequested) return 'workspace'
  return authStatus === 'unknown' ? 'pending' : 'public'
}
