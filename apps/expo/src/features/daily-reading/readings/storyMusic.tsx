import { getDefaultStore, useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { FeatherIcon } from '~common/ui/Icon'
import { backgroundMusicStateAtom } from '~features/bible-audio/atoms'
import { closeMusic, playMusic } from '~features/bible-audio/backgroundMusic'
import MusicEqualizer from '~features/bible-audio/ui/MusicEqualizer'
import MusicPanel from '~features/bible-audio/ui/MusicPanel'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

/** Whether a meditation starts with music: the reader's last say in one, on by default. */
const storyMusicAtom = atomWithAsyncStorage<boolean>('dailyStoryMusic', true)

/**
 * Starts the background music (ADR-0117) when a meditation opens, unless the reader paused it in
 * the last one; stops it when the meditation closes, if the meditation started it. Music already
 * playing before is left as it was.
 */
export const useStoryMusic = () => {
  const store = getDefaultStore()
  const state = useAtomValue(backgroundMusicStateAtom)
  const startedHere = useRef(false)
  const previous = useRef(state)

  useEffect(() => {
    if (store.get(storyMusicAtom) && store.get(backgroundMusicStateAtom) !== 'playing') {
      playMusic()
      startedHere.current = true
    }
    return () => {
      if (startedHere.current && store.get(backgroundMusicStateAtom) === 'playing') closeMusic()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // What the reader does with the music during a meditation is how the next one starts.
  useEffect(() => {
    if (previous.current === state) return
    if (state === 'playing') store.set(storyMusicAtom, true)
    else if (previous.current === 'playing') store.set(storyMusicAtom, false)
    previous.current = state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
}

/** The music's button over a scene: white, bars while it plays; it opens the usual music player. */
export const StoryMusicButton = () => {
  const { t } = useTranslation()
  const playing = useAtomValue(backgroundMusicStateAtom) === 'playing'
  return (
    <MusicPanel
      placement="bottom"
      trigger={
        <View
          accessibilityLabel={t('bibleAudio.music.panelTitle')}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          {playing ? (
            <MusicEqualizer color="#ffffff" size={15} />
          ) : (
            <FeatherIcon name="music" size={19} color="#ffffff" />
          )}
        </View>
      }
    />
  )
}
