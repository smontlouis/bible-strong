import { getFolderMergeOffset } from '../offlineSetupPresentation'
import {
  initialOfflineSetupSceneState,
  offlineSetupSceneReducer,
  type OfflineSetupSceneState,
} from '../offlineSetupScene'

const origin = { x: 20, y: 100, width: 150, height: 136 }
const target = { x: 92, y: 320, width: 190, height: 172 }

const reduce = (
  state: OfflineSetupSceneState,
  action: Parameters<typeof offlineSetupSceneReducer>[1]
) => offlineSetupSceneReducer(state, action)

describe('offline setup scene', () => {
  it('keeps the measured origin after the opening hero handoff', () => {
    let state = reduce(initialOfflineSetupSceneState, {
      type: 'folder.open',
      folderId: 'read-bible',
      origin,
    })
    state = reduce(state, { type: 'folder.target-measured', target })
    state = reduce(state, { type: 'folder.hero-finished', direction: 'opening' })
    state = reduce(state, { type: 'folder.hero-released' })

    expect(state.activeFolder).toBe('read-bible')
    expect(state.folderOrigin).toEqual(origin)
    expect(state.hero).toBeUndefined()
  })

  it('creates a closing hero from the preserved origin', () => {
    const opened = reduce(initialOfflineSetupSceneState, {
      type: 'folder.open',
      folderId: 'explore-bible',
      origin,
    })
    const settled = { ...opened, hero: undefined, openingFolder: undefined }
    const closing = reduce(settled, { type: 'folder.close', target })

    expect(closing.detailContentVisible).toBe(false)
    expect(closing.hero).toEqual({
      direction: 'closing',
      folderId: 'explore-bible',
      origin,
      target,
    })
  })

  it('returns to the overview after the closing hero finishes', () => {
    const closing = reduce(
      reduce(initialOfflineSetupSceneState, {
        type: 'folder.open',
        folderId: 'original-languages',
        origin,
      }),
      { type: 'folder.close', target }
    )
    const returned = reduce(closing, { type: 'folder.hero-finished', direction: 'closing' })

    expect(returned.activeFolder).toBeUndefined()
    expect(returned.returningFolder).toBe('original-languages')
    expect(returned.folderOrigin).toBeUndefined()
  })

  it('settles the download scene without changing selection state', () => {
    const merging = reduce(initialOfflineSetupSceneState, {
      type: 'download.start',
      offsets: { 'read-bible': { x: 40, y: 80 } },
    })
    const revealed = reduce(merging, { type: 'download.reveal' })
    const settled = reduce(revealed, { type: 'download.settled' })

    expect(merging.downloadSceneActive).toBe(true)
    expect(merging.downloadContentVisible).toBe(false)
    expect(merging.downloadSceneSettled).toBe(false)
    expect(revealed.downloadContentVisible).toBe(true)
    expect(settled.downloadSceneSettled).toBe(true)
  })
})

describe('getFolderMergeOffset', () => {
  it('centers a measured folder on the download target', () => {
    expect(
      getFolderMergeOffset({ x: 10, y: 30, width: 100, height: 80 }, { x: 200, y: 300 })
    ).toEqual({ x: 140, y: 230 })
  })
})
