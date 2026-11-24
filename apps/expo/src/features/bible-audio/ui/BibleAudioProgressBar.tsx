import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { secondsToMinutes } from '~helpers/secondsToMinutes'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import { bibleAudioProgressAtom } from '../atoms'
import type { BibleAudioProgress } from '../types'

export const getProgressRatio = (progress: BibleAudioProgress | null) => {
  if (!progress) return 0
  if (progress.kind === 'time')
    return progress.duration > 0 ? Math.min(progress.position / progress.duration, 1) : 0
  return progress.count > 0 ? (progress.index + 1) / progress.count : 0
}

/** The thin line along the top of the small player. */
export const BibleAudioProgressLine = () => {
  const progress = useAtomValue(bibleAudioProgressAtom)
  return (
    <Box
      className="absolute top-[0px] left-[0px] h-[2px] bg-primary"
      style={{ width: `${getProgressRatio(progress) * 100}%` }}
    />
  )
}

/** The bar of the large player: minutes of a recording, verses of the device's voice. */
const BibleAudioProgressBar = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  const progress = useAtomValue(bibleAudioProgressAtom)
  const ratio = getProgressRatio(progress)

  const [start, end] =
    progress?.kind === 'verses'
      ? [
          t('bibleAudio.verse', { verse: progress.verse }),
          t('bibleAudio.verseCount', { index: progress.index + 1, count: progress.count }),
        ]
      : [
          progress?.position ? secondsToMinutes(progress.position) : '--:--',
          progress?.duration ? secondsToMinutes(progress.duration) : '--:--',
        ]

  return (
    <Box>
      <Box
        className="overflow-hidden border-continuous h-[4px] rounded-full"
        style={{ backgroundColor: colorWithOpacity(theme.colors.default, 0.15) }}
      >
        <Box
          className="absolute top-[0px] left-[0px] h-[4px] bg-primary rounded-full"
          style={{ width: `${ratio * 100}%` }}
        />
      </Box>
      <Box className="flex-row mt-[4px]">
        <Text className="text-[11px] text-grey">{start}</Text>
        <Box className="flex-[1]" />
        <Text className="text-[11px] text-grey">{end}</Text>
      </Box>
    </Box>
  )
}

export default BibleAudioProgressBar
