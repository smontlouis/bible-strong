import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Link, type Href } from 'expo-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native'
import { useSelector } from 'react-redux'
import CommonLink from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { radii } from '~common/ui/surfaces'
import { getVerseCardHeight, VERSE_CARD_HEIGHT } from '~features/home/verseCardLayout'
import { selectFontFamily } from '~redux/selectors/user'
import { resolveFontFamily } from '~themes/styleValues'
import { useDailySceneUri } from './useDailyReadings'

const INK = '#ffffff'
const SOFT_INK = 'rgba(255,255,255,0.82)'
const SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.4)',
  textShadowRadius: 10,
  textShadowOffset: { width: 0, height: 1 },
}

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
}: DailySceneCardProps) => {
  const { t } = useTranslation()
  const fontFamily = resolveFontFamily(useSelector(selectFontFamily))
  // The small file, drawn at the size the stories give it: the card shows the middle of the
  // full-screen scene, at its scale, and the zoom into the stories keeps the same picture.
  const background = useDailySceneUri(sceneId, 'bg', 768)
  const { width, height } = useWindowDimensions()
  const sceneSize = Math.max(width, height)
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={t('dailyReading.meditate')}
        // A Link's child takes one style object, not a list.
        style={StyleSheet.flatten([
          { minHeight: VERSE_CARD_HEIGHT, borderRadius: radii.sheet },
          style,
        ])}
      >
        <Link.AppleZoom>
          <View
            style={{
              flex: 1,
              borderRadius: radii.sheet,
              borderCurve: 'continuous',
              overflow: 'hidden',
              backgroundColor: '#1b1a22',
            }}
          >
            {background ? (
              <Image
                source={{ uri: background }}
                contentFit="cover"
                transition={300}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: sceneSize,
                  height: sceneSize,
                  marginLeft: -sceneSize / 2,
                  marginTop: -sceneSize / 2,
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
                onLayout={({ nativeEvent }) =>
                  onContentHeight?.(getVerseCardHeight(nativeEvent.layout.height))
                }
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <Text
                    className="text-[12px] font-medium uppercase tracking-[1.5px]"
                    style={{ color: SOFT_INK, ...SHADOW }}
                  >
                    {label}
                  </Text>
                  {navigation}
                  <CommonLink
                    onPress={onChange}
                    accessibilityLabel={t('dailyReading.change')}
                    className="min-h-[44px] justify-center"
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
                    marginTop: 10,
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
        </Link.AppleZoom>
      </Pressable>
    </Link>
  )
}

export default DailySceneCard
