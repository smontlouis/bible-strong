import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import { IonIcon } from '~common/ui/Icon'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import { backgroundMusicStateAtom } from '../atoms'
import MusicEqualizer from './MusicEqualizer'
import MusicPanel from './MusicPanel'

/** The circles of the footer's audio block: the Bible audio's and the music's. */
export const FOOTER_CIRCLE_SIZE = 44

/**
 * The music's circle in the audio block of the reading footer: a note, or bars that move while
 * the music plays. It opens the music's own player, to read with music without listening to the Bible.
 */
const MusicFooterButton = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  const isPlaying = useAtomValue(backgroundMusicStateAtom) === 'playing'
  return (
    <MusicPanel
      trigger={
        <Box
          className="border-continuous items-center justify-center rounded-full"
          style={{
            width: FOOTER_CIRCLE_SIZE,
            height: FOOTER_CIRCLE_SIZE,
            backgroundColor: isPlaying
              ? (colorWithOpacity(theme.colors.primary, 0.14) ?? theme.colors.lightPrimary)
              : (colorWithOpacity(theme.colors.default, 0.06) ?? 'transparent'),
          }}
          accessibilityLabel={t('bibleAudio.music.panelTitle')}
        >
          {isPlaying ? (
            <MusicEqualizer color={theme.colors.primary} />
          ) : (
            <IonIcon name="musical-notes-outline" size={19} color="default" />
          )}
        </Box>
      }
    />
  )
}

export default MusicFooterButton
