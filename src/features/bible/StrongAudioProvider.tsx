import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioStatus as ExpoAudioStatus,
} from 'expo-audio'
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

type StrongAudioState = 'Idle' | 'Loading' | 'Playing'

type PlayStrongAudioParams = {
  id: string
  url: string
}

type StrongAudioContextValue = {
  getStatus: (id: string) => StrongAudioState
  play: (params: PlayStrongAudioParams) => void
}

const StrongAudioContext = createContext<StrongAudioContextValue | null>(null)

const getActiveStatus = (status: ExpoAudioStatus): StrongAudioState => {
  if (status.isBuffering || !status.isLoaded) return 'Loading'
  if (status.playing) return 'Playing'
  return 'Idle'
}

export const StrongAudioProvider = ({ children }: { children: React.ReactNode }) => {
  const player = useAudioPlayer(null)
  const status = useAudioPlayerStatus(player)
  const audioModeConfiguredRef = useRef(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (
      activeId &&
      status.duration > 0 &&
      status.currentTime >= status.duration &&
      !status.playing
    ) {
      setActiveId(null)
    }
  }, [activeId, status.currentTime, status.duration, status.playing])

  const play = ({ id, url }: PlayStrongAudioParams) => {
    if (activeId === id && status.playing) return

    setActiveId(id)

    ;(async () => {
      try {
        if (!audioModeConfiguredRef.current) {
          await setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
          })
          audioModeConfiguredRef.current = true
        }

        player.replace(url)
        player.play()
      } catch (error) {
        console.log('[Bible] Error playing Strong audio:', error)
        setActiveId(current => (current === id ? null : current))
      }
    })()
  }

  return (
    <StrongAudioContext.Provider
      value={{
        getStatus: id => (activeId === id ? getActiveStatus(status) : 'Idle'),
        play,
      }}
    >
      {children}
    </StrongAudioContext.Provider>
  )
}

export const useStrongAudio = () => {
  const context = useContext(StrongAudioContext)
  if (!context) {
    throw new Error('useStrongAudio must be used within StrongAudioProvider')
  }
  return context
}
