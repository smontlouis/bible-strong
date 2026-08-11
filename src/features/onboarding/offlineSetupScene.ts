import type { OfflineSetupFolderId } from './offlineSetupPresets'
import type {
  OfflineSetupFolderMergeOffset,
  OfflineSetupFrame,
  OfflineSetupHeroDirection,
} from './offlineSetupPresentation'

export type OfflineSetupHeroTransition = {
  direction: OfflineSetupHeroDirection
  folderId: OfflineSetupFolderId
  origin: OfflineSetupFrame
  target?: OfflineSetupFrame
}

export type OfflineSetupSceneState = {
  activeFolder?: OfflineSetupFolderId
  detailContentVisible: boolean
  downloadContentVisible: boolean
  downloadSceneActive: boolean
  downloadSceneSettled: boolean
  folderMergeOffsets: Partial<Record<OfflineSetupFolderId, OfflineSetupFolderMergeOffset>>
  folderOrigin?: OfflineSetupFrame
  hero?: OfflineSetupHeroTransition
  openingFolder?: OfflineSetupFolderId
  returningFolder?: OfflineSetupFolderId
}

export type OfflineSetupSceneAction =
  | { type: 'folder.open'; folderId: OfflineSetupFolderId; origin?: OfflineSetupFrame }
  | { type: 'folder.overview-hidden' }
  | { type: 'folder.target-measured'; target: OfflineSetupFrame }
  | { type: 'folder.close'; target?: OfflineSetupFrame }
  | { type: 'folder.hero-finished'; direction: OfflineSetupHeroDirection }
  | { type: 'folder.hero-released' }
  | {
      type: 'download.start'
      offsets: Partial<Record<OfflineSetupFolderId, OfflineSetupFolderMergeOffset>>
    }
  | { type: 'download.reveal' }
  | { type: 'download.settled' }

export const initialOfflineSetupSceneState: OfflineSetupSceneState = {
  detailContentVisible: false,
  downloadContentVisible: false,
  downloadSceneActive: false,
  downloadSceneSettled: false,
  folderMergeOffsets: {},
}

export const offlineSetupSceneReducer = (
  state: OfflineSetupSceneState,
  action: OfflineSetupSceneAction
): OfflineSetupSceneState => {
  switch (action.type) {
    case 'folder.open':
      return {
        ...state,
        activeFolder: action.folderId,
        detailContentVisible: !action.origin,
        hero: action.origin
          ? { direction: 'opening', folderId: action.folderId, origin: action.origin }
          : undefined,
        openingFolder: action.origin ? action.folderId : undefined,
        folderOrigin: action.origin,
        returningFolder: undefined,
      }
    case 'folder.overview-hidden':
      return { ...state, openingFolder: undefined }
    case 'folder.target-measured':
      if (!state.hero || state.hero.direction !== 'opening') return state
      return {
        ...state,
        detailContentVisible: true,
        hero: state.hero.target ? state.hero : { ...state.hero, target: action.target },
      }
    case 'folder.close':
      if (!state.activeFolder) return state
      if (!state.folderOrigin || !action.target) {
        return {
          ...state,
          activeFolder: undefined,
          detailContentVisible: false,
          hero: undefined,
          folderOrigin: undefined,
          returningFolder: state.activeFolder,
        }
      }
      return {
        ...state,
        detailContentVisible: false,
        hero: {
          direction: 'closing',
          folderId: state.activeFolder,
          origin: state.folderOrigin,
          target: action.target,
        },
      }
    case 'folder.hero-finished':
      if (!state.hero || state.hero.direction !== action.direction) return state
      if (action.direction === 'opening') {
        return {
          ...state,
          detailContentVisible: true,
          hero: { ...state.hero, direction: 'settled' },
        }
      }
      if (action.direction === 'closing') {
        return {
          ...state,
          activeFolder: undefined,
          detailContentVisible: false,
          hero: { ...state.hero, direction: 'settled' },
          returningFolder: state.hero.folderId,
          folderOrigin: undefined,
        }
      }
      return state
    case 'folder.hero-released':
      return state.hero?.direction === 'settled' ? { ...state, hero: undefined } : state
    case 'download.start':
      return {
        ...state,
        downloadSceneActive: true,
        folderMergeOffsets: action.offsets,
      }
    case 'download.reveal':
      return { ...state, downloadContentVisible: true }
    case 'download.settled':
      return {
        ...state,
        downloadSceneActive: true,
        downloadSceneSettled: true,
      }
  }
}
