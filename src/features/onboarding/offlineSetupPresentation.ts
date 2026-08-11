import type { Feather } from '@expo/vector-icons'

import type { OfflineSetupFolderId } from './offlineSetupPresets'

export type OfflineSetupFrame = {
  x: number
  y: number
  width: number
  height: number
}

export type OfflineSetupFolderVisual = {
  icon: React.ComponentProps<typeof Feather>['name']
  colors: {
    back: string
    frontStart: string
    frontEnd: string
    icon: string
  }
}

export type OfflineSetupFolderPresentation = OfflineSetupFolderVisual & {
  id: OfflineSetupFolderId
}

export type OfflineSetupFolderMergeOffset = { x: number; y: number }
export type OfflineSetupHeroDirection = 'opening' | 'closing' | 'settled'

export const OFFLINE_SETUP_FOLDER_PRESENTATIONS: OfflineSetupFolderPresentation[] = [
  {
    id: 'read-bible',
    icon: 'book-open',
    colors: { back: '#C9DAFF', frontStart: '#76A0FA', frontEnd: '#5983F0', icon: '#5983F0' },
  },
  {
    id: 'understand-words',
    icon: 'type',
    colors: { back: '#E0C8F8', frontStart: '#B578EE', frontEnd: '#9654D8', icon: '#9654D8' },
  },
  {
    id: 'explore-bible',
    icon: 'share-2',
    colors: { back: '#FAD9A8', frontStart: '#F8B663', frontEnd: '#EE9D39', icon: '#D97D18' },
  },
  {
    id: 'original-languages',
    icon: 'globe',
    colors: { back: '#F7C7D1', frontStart: '#EB879C', frontEnd: '#DD617C', icon: '#D84D6D' },
  },
]

export const getFolderMergeOffset = (
  frame: OfflineSetupFrame,
  target: { x: number; y: number }
): OfflineSetupFolderMergeOffset => ({
  x: target.x - (frame.x + frame.width / 2),
  y: target.y - (frame.y + frame.height / 2),
})
