import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Link, useRouter, type Href } from 'expo-router'
import { createContext, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native'
import { useSelector } from 'react-redux'
import CommonLink from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { radii } from '~common/ui/surfaces'
import { getVerseCardHeight, VERSE_CARD_HEIGHT } from '~features/home/verseCardLayout'
import { selectFontFamily } from '~redux/selectors/user'
import { resolveFontFamily } from '~themes/styleValues'
import { useDailySceneThumbhash, useDailySceneUri } from './useDailyReadings'

const INK = '#ffffff'
const SOFT_INK = 'rgba(255,255,255,0.82)'
const SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.4)',
  textShadowRadius: 10,
  textShadowOffset: { width: 0, height: 1 },
}

/** True inside a card over a painted scene: what the card holds is drawn in white there. */
export const OverSceneContext = createContext(false)

export type DailySceneCardProps = {
  /** The stories this card opens; on iOS the card grows into them (zoom transition). */
  href: Href
  sceneId: string
  /** « Verset du jour », « Méditation du jour », or the day. */
  label: string
  text: string
  reference?: string
  /** Small icon buttons, already white, at the bottom left. */
  actions?: ReactNode
  /** The day navigation of the carousel, beside the label. */
  navigation?: ReactNode
  footer?: ReactNode
  style?: ViewStyle
  onContentHeight?: (height: number) => void
  onChange: () => void
  /**
   * Whether the card is in front: a day stacked behind today's shows its scene's ThumbHash and
   * loads its picture only once it comes in front (2026-11-26). In front by default.
   */
  active?: boolean
}

/**
 * A day of the home over its painted scene: the verse or the opening of the day in white, a
 * « Méditer » button, and the reader's actions. The whole card opens the day as stories.
 */
const DailySceneCard = ({
  href,
  sceneId,
  label,
  text,
  reference,
  actions,
  navigation,
  footer,
  style,
  onContentHeight,
  onChange,
  active = true,
}: DailySceneCardProps) => {
  const { t } = useTranslation()
  const fontFamily = resolveFontFamily(useSelector(selectFontFamily))
  // The scene at the size and in the file the stories give it, so opening them reuses the
  // picture: the card's middle sits three quarters down the full-screen scene, where the horizon
  // meets the ground.
  // The stories draw the square scene at the screen's height: a phone in portrait fills its
  // height, a wide screen keeps the square in the middle.
  const { height } = useWindowDimensions()
  const sceneSize = height
  const background = useDailySceneUri(sceneId, 'bg', sceneSize * Math.min(3, PixelRatio.get()))
  const thumbhash = useDailySceneThumbhash(sceneId)
  // Once in front, a card keeps its picture when it goes back behind.
  const [seen, setSeen] = useState(active)
  if (active && !seen) setSeen(true)
  const showPicture = Boolean(background) && seen
  const router = useRouter()
  // On the web a link is an anchor and a Pressable a <button>: neither may hold the card's own
  // buttons (the day arrows, « Changer », the actions), whose clicks the anchor would follow
  // too. There the card is a plain block that opens the stories on a click outside them, or on
  // Enter. Elsewhere the link carries the iOS zoom into the stories.
  const web = Platform.OS === 'web'
  const webOpen = {
    role: 'link',
    tabIndex: 0,
    'aria-label': `${t('dailyReading.meditate')} · ${label}`,
    onClick: (event: { target: unknown; currentTarget: unknown }) => {
      const control = (event.target as Element | null)?.closest?.('button, a, [role="button"]')
      if (control && control !== event.currentTarget) return
      router.push(href)
    },
    onKeyDown: (event: { key: string; target: unknown; currentTarget: unknown }) => {
      if (event.key === 'Enter' && event.target === event.currentTarget) router.push(href)
    },
  }
  const cardStyle = StyleSheet.flatten([
    { minHeight: VERSE_CARD_HEIGHT, borderRadius: radii.sheet },
    style,
  ])
  const scene = (
    <View
      style={{
        flex: 1,
        borderRadius: radii.sheet,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: '#1b1a22',
      }}
    >
      {showPicture || thumbhash ? (
        <Image
          source={showPicture ? { uri: background } : null}
          placeholder={thumbhash ? { thumbhash } : undefined}
          placeholderContentFit="cover"
          contentFit="cover"
          // A light blur, computed once at decoding: the text reads better over the scene.
          // The web counts it in CSS pixels of the drawn image, iOS and Android in a smaller
          // unit: the same softness takes a larger number there.
          blurRadius={Platform.OS === 'web' ? 0 : 0}
          transition={300}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: sceneSize,
            height: sceneSize,
            marginLeft: -sceneSize / 2,
            marginTop: -sceneSize * 0.75,
          }}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <LinearGradient
        colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.62)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
        <View
          // Room after the reference: the verse breathes before the actions.
          style={{ paddingBottom: 20 }}
          onLayout={({ nativeEvent }) =>
            onContentHeight?.(getVerseCardHeight(nativeEvent.layout.height))
          }
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              // A narrow card (the wide home's column) puts the day arrows on their own line.
              flexWrap: 'wrap',
              columnGap: 12,
            }}
          >
            <Text
              className="text-[12px] font-medium uppercase tracking-[1.5px]"
              style={{ color: SOFT_INK, ...SHADOW }}
            >
              {label}
            </Text>
            <OverSceneContext value>{navigation}</OverSceneContext>
            <CommonLink
              onPress={onChange}
              accessibilityLabel={t('dailyReading.change')}
              className="ml-auto min-h-[44px] justify-center"
            >
              <Text className="font-bold text-[13px]" style={{ color: INK, ...SHADOW }}>
                {t('dailyReading.changeShort')}
              </Text>
            </CommonLink>
          </View>
          <Text
            style={{
              fontFamily,
              color: INK,
              fontSize: 19,
              lineHeight: 28,
              // Room under the label: the verse starts apart from it.
              marginTop: 24,
              ...SHADOW,
            }}
          >
            {text}
          </Text>
          {reference ? (
            <Text
              numberOfLines={2}
              className="text-[12px] mt-[6px]"
              style={{ color: SOFT_INK, ...SHADOW }}
            >
              {reference}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 'auto' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>{actions}</View>
          <View style={{ flex: 1 }} />
          <View
            className="rounded-full flex-row items-center gap-[6px] px-[16px] min-h-[40px]"
            style={{
              backgroundColor: 'rgba(255,255,255,0.22)',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(255,255,255,0.45)',
            }}
          >
            <Text className="text-[14px] font-medium" style={{ color: INK }}>
              {t('dailyReading.meditate')}
            </Text>
            <FeatherIcon name="chevron-right" size={15} color={INK} />
          </View>
          {footer}
        </View>
      </View>
    </View>
  )
  if (web)
    return (
      // React Native Web passes these DOM props to the block; React Native's types omit them.
      <View style={[cardStyle, { cursor: 'pointer' }]} {...(webOpen as object)}>
        {scene}
      </View>
    )
  return (
    <Link href={href} asChild>
      {/* A Link's child takes one style object, not a list. */}
      <Pressable
        accessibilityRole="button"
        accessibilityHint={t('dailyReading.meditate')}
        style={cardStyle}
      >
        <Link.AppleZoom>{scene}</Link.AppleZoom>
      </Pressable>
    </Link>
  )
}

export default DailySceneCard
