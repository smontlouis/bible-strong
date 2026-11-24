import { getChapterPlace, getChapterScene } from '@bible-strong/resource-domain/bible-audio'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { radii } from '~common/ui/surfaces'
import { getEntityPortraitUri } from '~features/lexique/entityPortraits'
import { useEntityPortraitHash } from '~features/lexique/entityPortraitManifest'
import { getTimelinePaintingUri } from '~features/timeline/timelinePaintings'
import { useTimelinePaintings } from '~features/timeline/useTimelinePaintings'
import { colorWithOpacity } from '~themes/colorValues'
import { getBiblePart, getBiblePartColors, isDarkTheme } from '~themes/bibleBookColors'
import { useTheme } from '~themes/ThemeProvider'
import { bibleAudioCatalogAtom } from '../audioCatalog'
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
 * The painting of the chapter's scene or place (ADR-0117), brought to the hue of the part of the Bible: the
 * accent laid over it in the « color » blend gives it that hue, the ground washes it so that the
 * type reads, and a fade clears the top for the book's name.
 */
const PlacePainting = ({
  uri,
  colors,
  dark,
}: {
  uri: string
  colors: { ground: string; accent: string }
  dark: boolean
}) => (
  <>
    <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
    <Box
      className="absolute inset-0"
      style={{ backgroundColor: colors.accent, mixBlendMode: 'color' }}
    />
    <Box
      className="absolute inset-0"
      style={{ backgroundColor: colors.ground, opacity: dark ? 0.35 : 0.42 }}
    />
    <LinearGradient
      pointerEvents="none"
      colors={[
        colors.ground,
        colorWithOpacity(colors.ground, 0.8) ?? colors.ground,
        colorWithOpacity(colors.ground, 0) ?? 'transparent',
      ]}
      locations={[0, 0.3, 0.62]}
      style={StyleSheet.absoluteFill}
    />
  </>
)

/**
 * The picture of a chapter (ADR-0117): its timeline scene, else its place, when the catalog names
 * one and the media host holds its painting.
 */
const useChapterPainting = (passage: BibleAudioPassage, wanted: boolean) => {
  const catalog = useAtomValue(bibleAudioCatalogAtom)
  const { paintings } = useTimelinePaintings()
  const book = passage.book.Numero
  const scene = wanted ? getChapterScene(catalog, book, passage.chapter) : undefined
  const sceneHash = scene ? paintings?.[scene]?.hash : undefined
  const place = wanted && !sceneHash ? getChapterPlace(catalog, book, passage.chapter) : undefined
  const placeHash = useEntityPortraitHash(place)
  if (scene && sceneHash) return getTimelinePaintingUri(scene, sceneHash, 'w768')
  if (place && placeHash) return getEntityPortraitUri(place, placeHash, 'w768')
  return undefined
}

/**
 * The cover of the passage heard: the name of the book and a large chapter number, cropped by the
 * edge, in the colours of the book's part of the Bible, over the painting of the chapter's scene
 * or place when the catalog names one. Small, it keeps the number alone.
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
  const painting = useChapterPainting(passage, !isThumbnail)

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
      {!!painting && <PlacePainting uri={painting} colors={colors} dark={isDarkTheme(theme)} />}
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
          // Over a painting, the number takes the ink, which the painting's hue would swallow.
          color: painting ? colors.ink : colors.accent,
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
