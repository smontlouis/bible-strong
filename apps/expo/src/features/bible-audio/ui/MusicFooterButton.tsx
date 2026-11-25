import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import { IonIcon } from '~common/ui/Icon'
import { floatingShadow } from '~common/ui/surfaces'
import { resolveThemeColor } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import { backgroundMusicStateAtom } from '../atoms'
import MusicEqualizer from './MusicEqualizer'
import MusicPanel from './MusicPanel'

export const MUSIC_FOOTER_BUTTON_SIZE = 40

/**
 * The music beside the play button of the reading footer: a note, or bars that move while the
 * music plays. It opens the music's own player, to read with music without listening to the Bible.
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
            width: MUSIC_FOOTER_BUTTON_SIZE,
            height: MUSIC_FOOTER_BUTTON_SIZE,
            backgroundColor: resolveThemeColor(theme, 'surfaceRaised'),
            ...floatingShadow,
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
