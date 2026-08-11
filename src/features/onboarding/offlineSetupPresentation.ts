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
    accentSoft: string
    back: string
    frontStart: string
    frontEnd: string
    icon: string
    surface: string
    surfaceTransparent: string
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
    colors: {
      accentSoft: 'rgba(89,131,240,0.22)',
      back: '#C9DAFF',
      frontStart: '#76A0FA',
      frontEnd: '#5983F0',
      icon: '#5983F0',
      surface: '#182B4A',
      surfaceTransparent: 'rgba(24,43,74,0)',
    },
  },
  {
    id: 'understand-words',
    icon: 'type',
    colors: {
      accentSoft: 'rgba(150,84,216,0.22)',
      back: '#E0C8F8',
      frontStart: '#B578EE',
      frontEnd: '#9654D8',
      icon: '#9654D8',
      surface: '#2C2040',
      surfaceTransparent: 'rgba(44,32,64,0)',
    },
  },
  {
    id: 'explore-bible',
    icon: 'share-2',
    colors: {
      accentSoft: 'rgba(238,157,57,0.22)',
      back: '#FAD9A8',
      frontStart: '#F8B663',
      frontEnd: '#EE9D39',
      icon: '#D97D18',
      surface: '#392A1D',
      surfaceTransparent: 'rgba(57,42,29,0)',
    },
  },
  {
    id: 'original-languages',
    icon: 'globe',
    colors: {
      accentSoft: 'rgba(221,97,124,0.22)',
      back: '#F7C7D1',
      frontStart: '#EB879C',
      frontEnd: '#DD617C',
      icon: '#D84D6D',
      surface: '#3A202D',
      surfaceTransparent: 'rgba(58,32,45,0)',
    },
  },
]

export const getFolderMergeOffset = (
  frame: OfflineSetupFrame,
  target: { x: number; y: number }
): OfflineSetupFolderMergeOffset => ({
  x: target.x - (frame.x + frame.width / 2),
  y: target.y - (frame.y + frame.height / 2),
})
