import { useEffect, useReducer, useRef } from 'react'
import type { View } from 'react-native'

import type { OfflineSetupFolderId } from './offlineSetupPresets'
import { OFFLINE_SETUP_MOTION } from './offlineSetupMotion'
import {
  getFolderMergeOffset,
  OFFLINE_SETUP_FOLDER_PRESENTATIONS,
  type OfflineSetupFolderMergeOffset,
  type OfflineSetupFrame,
} from './offlineSetupPresentation'
import { initialOfflineSetupSceneState, offlineSetupSceneReducer } from './offlineSetupScene'

type Timer = ReturnType<typeof setTimeout>

const useOfflineSetupScene = ({
  reduceMotion,
  viewport,
}: {
  reduceMotion: boolean
  viewport: { width: number; height: number }
}) => {
  const [state, dispatch] = useReducer(offlineSetupSceneReducer, initialOfflineSetupSceneState)
  const folderRefs = useRef<Partial<Record<OfflineSetupFolderId, View | null>>>({})
  const timers = useRef<Set<Timer>>(new Set())

  const schedule = (action: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      action()
    }, delay)
    timers.current.add(timer)
  }

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      timers.current.clear()
    },
    []
  )

  const registerFolder = (folderId: OfflineSetupFolderId, node: View | null) => {
    folderRefs.current[folderId] = node
  }

  const openFolder = (folderId: OfflineSetupFolderId) => {
    if (state.openingFolder) return
    const folder = folderRefs.current[folderId]

    if (reduceMotion || !folder) {
      dispatch({ type: 'folder.open', folderId })
      return
    }

    folder.measureInWindow((x, y, width, height) => {
      dispatch({ type: 'folder.open', folderId, origin: { x, y, width, height } })
      schedule(
        () => dispatch({ type: 'folder.overview-hidden' }),
        OFFLINE_SETUP_MOTION.overview.exitDuration
      )
    })
  }

  const closeFolder = (target?: OfflineSetupFrame) => {
    dispatch({ type: 'folder.close', target: reduceMotion ? undefined : target })
  }

  const handleHeroTargetLayout = (target: OfflineSetupFrame) => {
    dispatch({ type: 'folder.target-measured', target })
  }

  const handleHeroTransitionEnd = (direction: 'opening' | 'closing' | 'settled') => {
    dispatch({ type: 'folder.hero-finished', direction })
    schedule(
      () => dispatch({ type: 'folder.hero-released' }),
      OFFLINE_SETUP_MOTION.hero.handoffDuration
    )
  }

  const startDownload = () => {
    if (reduceMotion) {
      dispatch({ type: 'download.start', offsets: {} })
      dispatch({ type: 'download.reveal' })
      dispatch({ type: 'download.settled' })
      return
    }

    const target = { x: viewport.width / 2, y: viewport.height / 2 }
    const offsets: Partial<Record<OfflineSetupFolderId, OfflineSetupFolderMergeOffset>> = {}
    let remaining = OFFLINE_SETUP_FOLDER_PRESENTATIONS.length

    const collect = () => {
      remaining -= 1
      if (remaining > 0) return
      dispatch({ type: 'download.start', offsets })
      schedule(
        () => dispatch({ type: 'download.reveal' }),
        OFFLINE_SETUP_MOTION.download.revealStart
      )
      schedule(() => dispatch({ type: 'download.settled' }), OFFLINE_SETUP_MOTION.download.mergeEnd)
    }

    OFFLINE_SETUP_FOLDER_PRESENTATIONS.forEach(folder => {
      const node = folderRefs.current[folder.id]
      if (!node) {
        offsets[folder.id] = { x: 0, y: 0 }
        collect()
        return
      }
      node.measureInWindow((x, y, width, height) => {
        offsets[folder.id] = getFolderMergeOffset({ x, y, width, height }, target)
        collect()
      })
    })
  }

  return {
    state,
    closeFolder,
    handleHeroTargetLayout,
    handleHeroTransitionEnd,
    openFolder,
    registerFolder,
    startDownload,
  }
}

export default useOfflineSetupScene
