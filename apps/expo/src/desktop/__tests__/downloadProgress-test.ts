jest.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: jest.fn(), ProgressBarStatus: {} }))
jest.mock('~helpers/agentObservability', () => ({ appLogger: { warn: jest.fn() } }))
jest.mock('~state/downloadQueue', () => ({}))

import { dockProgress } from '../downloadProgress'

describe('the Offline copies on the Dock icon', () => {
  it('shows the queue’s progress as a whole percent while it runs', () => {
    expect(dockProgress(true, { total: 3, progress: 0.4166 })).toBe(42)
    expect(dockProgress(true, { total: 1, progress: 1 })).toBe(100)
  })

  it('shows nothing once the queue stops or has nothing', () => {
    expect(dockProgress(false, { total: 3, progress: 0.5 })).toBeNull()
    expect(dockProgress(true, { total: 0, progress: 0 })).toBeNull()
  })
})
