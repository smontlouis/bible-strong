import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import type { PanelPlacement } from '~common/ContextualPanel/types'
import Box from '~common/ui/Box'
import { IonIcon } from '~common/ui/Icon'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import { backgroundMusicStateAtom } from '../atoms'
import MusicEqualizer from './MusicEqualizer'
import MusicPanel from './MusicPanel'

/** The circle's size by default, the size of the footer's audio block too. */
export const MUSIC_BUTTON_SIZE = 44

type MusicButtonProps = {
  size?: number
  /** Where the web popover opens. */
  placement?: PanelPlacement
}

/**
 * The way to the background music wherever it belongs (ADR-0117), the reading footer and the
 * home: a note in a circle, bars that move while the music plays. It opens the music's own player.
 */
const MusicButton = ({ size = MUSIC_BUTTON_SIZE, placement }: MusicButtonProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const isPlaying = useAtomValue(backgroundMusicStateAtom) === 'playing'
  return (
    <MusicPanel
      placement={placement}
      trigger={
        <Box
          className="border-continuous items-center justify-center rounded-full"
          style={{
            width: size,
            height: size,
            backgroundColor: isPlaying
              ? (colorWithOpacity(theme.colors.primary, 0.14) ?? theme.colors.lightPrimary)
              : (colorWithOpacity(theme.colors.default, 0.06) ?? 'transparent'),
          }}
          accessibilityLabel={t('bibleAudio.music.panelTitle')}
        >
          {isPlaying ? (
            <MusicEqualizer color={theme.colors.primary} size={Math.round(size * 0.36)} />
          ) : (
            <IonIcon name="musical-notes-outline" size={Math.round(size * 0.43)} color="default" />
          )}
        </Box>
      }
    />
  )
}

export default MusicButton
