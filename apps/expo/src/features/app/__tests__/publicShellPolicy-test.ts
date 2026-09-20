import { resolvePublicShellMode } from '../publicShellPolicy'

describe('public shell policy', () => {
  it('waits for auth resolution on public routes', () => {
    expect(
      resolvePublicShellMode({
        publicPath: true,
        authStatus: 'unknown',
        guestWorkspaceRequested: false,
      })
    ).toBe('pending')
  })

  it('uses the public shell only for guests on public routes', () => {
    expect(
      resolvePublicShellMode({
        publicPath: true,
        authStatus: 'guest',
        guestWorkspaceRequested: false,
      })
    ).toBe('public')
    expect(
      resolvePublicShellMode({
        publicPath: true,
        authStatus: 'authenticated',
        guestWorkspaceRequested: false,
      })
    ).toBe('workspace')
  })

  it('keeps ordinary routes and explicit guest app entry in the workspace', () => {
    expect(
      resolvePublicShellMode({
        publicPath: false,
        authStatus: 'guest',
        guestWorkspaceRequested: false,
      })
    ).toBe('workspace')
    expect(
      resolvePublicShellMode({
        publicPath: true,
        authStatus: 'guest',
        guestWorkspaceRequested: true,
      })
    ).toBe('workspace')
  })
})
