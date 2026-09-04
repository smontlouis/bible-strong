import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioStatus as ExpoAudioStatus,
} from 'expo-audio'
import { useSetAtom } from 'jotai/react'
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import TrackPlayer, { Event, State, useTrackPlayerEvents } from 'react-native-track-player'
import { ensureTrackPlayerSetup } from '~features/audio/trackPlayerSetup'
import { playingBibleTabIdAtom } from './footer/atom'

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
  if (Platform.OS === 'android') {
    return <AndroidStrongAudioProvider>{children}</AndroidStrongAudioProvider>
  }

  return <ExpoStrongAudioProvider>{children}</ExpoStrongAudioProvider>
}

const ExpoStrongAudioProvider = ({ children }: { children: React.ReactNode }) => {
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

const AndroidStrongAudioProvider = ({ children }: { children: React.ReactNode }) => {
  const setPlayingBibleTabId = useSetAtom(playingBibleTabIdAtom)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [status, setStatus] = useState<StrongAudioState>('Idle')
  const activeIdRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)

  useTrackPlayerEvents([Event.PlaybackState, Event.PlaybackError], event => {
    if (!activeIdRef.current) return

    if (event.type === Event.PlaybackError) {
      console.log('[Bible] Error playing Strong audio:', event.message)
      setActiveId(null)
      activeIdRef.current = null
      setStatus('Idle')
      return
    }

    if (event.type === Event.PlaybackState) {
      if (event.state === State.Playing) {
        setStatus('Playing')
      } else if (event.state === State.Buffering || event.state === State.Loading) {
        setStatus('Loading')
      } else if (event.state === State.Ended || event.state === State.Stopped) {
        setActiveId(null)
        activeIdRef.current = null
        setStatus('Idle')
      }
    }
  })

  const play = ({ id, url }: PlayStrongAudioParams) => {
    if (activeIdRef.current === id) return

    const requestId = ++requestIdRef.current
    setPlayingBibleTabId('')
    setActiveId(id)
    activeIdRef.current = id
    setStatus('Loading')
    ;(async () => {
      try {
        await ensureTrackPlayerSetup()
        if (requestId !== requestIdRef.current) return

        await TrackPlayer.reset()
        if (requestId !== requestIdRef.current) return
        await TrackPlayer.add({
          id,
          url,
          title: id,
        })
        if (requestId !== requestIdRef.current) return
        await TrackPlayer.play()
      } catch (error) {
        if (requestId !== requestIdRef.current) return
        console.log('[Bible] Error playing Strong audio:', error)
        setActiveId(current => (current === id ? null : current))
        if (activeIdRef.current === id) activeIdRef.current = null
        setStatus('Idle')
      }
    })()
  }

  return (
    <StrongAudioContext.Provider
      value={{
        getStatus: id => (activeId === id ? status : 'Idle'),
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
