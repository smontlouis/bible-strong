import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { radii } from '~common/ui/surfaces'
import { getBiblePart, getBiblePartColors } from '~themes/bibleBookColors'
import { useTheme } from '~themes/ThemeProvider'
import type { BibleAudioPassage } from '../types'

/** The cover is drawn for this size and scaled: every measure below is in its points. */
const BASE = 320

type BibleAudioCoverProps = {
  passage: BibleAudioPassage
  size: number
}

const getNameSize = (name: string) => (name.length > 12 ? 32 : name.length > 9 ? 38 : 44)
const getNumberSize = (chapter: number) => (chapter >= 100 ? 160 : chapter >= 10 ? 210 : 250)

/**
 * The cover of the passage heard: the name of the book and a large chapter number, cropped by the
 * edge, in the colours of the book's part of the Bible. Small, it keeps the number alone.
 */
const BibleAudioCover = ({ passage, size }: BibleAudioCoverProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const part = getBiblePart(passage.book.Numero)
  const colors = getBiblePartColors(part, theme)
  const scale = size / BASE
  const isThumbnail = size < 80
  const numberSize = getNumberSize(passage.chapter) * scale * (isThumbnail ? 1.15 : 1)
  const name = t(passage.book.Nom)

  return (
    <Box
      className="overflow-hidden border-continuous"
      style={{
        width: size,
        height: size,
        backgroundColor: colors.ground,
        borderRadius: size >= 200 ? radii.sheet : size >= 80 ? radii.card : radii.tile,
      }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {!isThumbnail && (
        <Box className="absolute" style={{ left: 24 * scale, top: 24 * scale, right: 24 * scale }}>
          {size >= 200 && (
            <Text
              className="uppercase"
              style={{
                color: colors.ink,
                opacity: 0.6,
                fontSize: 11 * scale,
                letterSpacing: 11 * scale * 0.14,
                fontWeight: '500',
              }}
              numberOfLines={1}
            >
              {t(`bibleAudio.part.${part}`)}
            </Text>
          )}
          <Text
            numberOfLines={2}
            style={{
              color: colors.ink,
              fontSize: getNameSize(name) * scale,
              lineHeight: getNameSize(name) * scale * 1.05,
              letterSpacing: -getNameSize(name) * scale * 0.02,
              fontWeight: '800',
              marginTop: size >= 200 ? 8 * scale : 0,
            }}
          >
            {name}
          </Text>
        </Box>
      )}
      <Text
        className="absolute"
        numberOfLines={1}
        style={{
          right: (isThumbnail ? -2 : -8) * scale,
          bottom: -numberSize * 0.2,
          color: colors.accent,
          fontSize: numberSize,
          lineHeight: numberSize,
          letterSpacing: -numberSize * 0.05,
          fontWeight: '800',
          includeFontPadding: false,
        }}
      >
        {passage.chapter}
      </Text>
      {size >= 200 && (
        <Text
          className="absolute"
          style={{
            left: 24 * scale,
            bottom: 22 * scale,
            color: colors.ink,
            opacity: 0.6,
            fontSize: 12 * scale,
            fontWeight: '600',
          }}
        >
          {passage.version}
        </Text>
      )}
    </Box>
  )
}

export default BibleAudioCover
