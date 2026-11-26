import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { transliterationTextStyle } from '~common/ui/textTypography'
import { useWorkspaceHeaderInset } from '~features/app-switcher/workspaceHeaderInset'
import { selectFontFamily } from '~redux/selectors/user'
import { resolveFontFamily } from '~themes/styleValues'
import type { DailyCard, DailyEntry, DailyStrongWord } from './dailyReadingFormat'
import { useDailySceneUri } from './useDailyReadings'

const INK = '#ffffff'
const SOFT_INK = 'rgba(255,255,255,0.78)'
const SOURCE_LINE = /^[A-Z][A-Za-z]{0,6}\s+\d+[.:]\d+\s*$/
const SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.45)',
  textShadowRadius: 14,
  textShadowOffset: { width: 0, height: 1 },
}
const READING_FADE = {
  transitionProperty: 'opacity',
  transitionDuration: 450,
  transitionTimingFunction: 'ease-out',
} as const

export type DailyStoryProps = {
  entry: DailyEntry
  /** The label above the cards: « Verset du jour », or the book's title. */
  kicker: string
  /** The version of the verse a meditation quotes (LSG, BSB). */
  version?: string
  /** The opening card split into its quotation and its reference (books). */
  splitOpening?: (text: string) => { quote: string; reference?: string }
  onClose: () => void
  /** Opens the day as a page (books): its date picker, its settings, the assistant. */
  onOpenPage?: () => void
  onChangeVerse?: () => void
  onShare?: () => void
  onOpenStrong?: (word: DailyStrongWord) => void
}

/**
 * A verse meditation or a day of a book, card after card, over its painted scene. Give it a `key`
 * per entry: another verse or another day starts again on its first card.
 */
const DailyStory = ({
  entry,
  kicker,
  version,
  splitOpening,
  onClose,
  onOpenPage,
  onChangeVerse,
  onShare,
  onOpenStrong,
}: DailyStoryProps) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  // On a wide workspace the sidebar button keeps the top left corner.
  const workspaceInset = useWorkspaceHeaderInset()
  const { width, height } = useWindowDimensions()
  const fontFamily = resolveFontFamily(useSelector(selectFontFamily))
  const sceneWidth = Math.max(width, height) * Math.min(3, PixelRatio.get())
  const background = useDailySceneUri(entry.scene, 'bg', sceneWidth)
  const foreground = useDailySceneUri(entry.scene, 'fg', sceneWidth)
  const [index, setIndex] = useState(0)
  const cards = entry.cards
  const card = cards[Math.min(index, cards.length - 1)]
  const isOpening = card.type === 'verse' || card.type === 'opening'
  const isLast = index >= cards.length - 1

  const go = (step: number) => {
    if (step > 0 && isLast) return onClose()
    setIndex(current => Math.max(0, Math.min(cards.length - 1, current + step)))
  }
  const tap = (event: GestureResponderEvent) => go(event.nativeEvent.pageX < width * 0.35 ? -1 : 1)

  useEffect(() => {
    if (Platform.OS !== 'web') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ') go(1)
      else if (event.key === 'ArrowLeft') go(-1)
      else if (event.key === 'Escape') onClose()
      else return
      event.preventDefault()
    }
    globalThis.addEventListener?.('keydown', onKey)
    return () => globalThis.removeEventListener?.('keydown', onKey)
  })

  const reading = { fontFamily, color: INK, ...SHADOW }

  const renderCard = (current: DailyCard) => {
    switch (current.type) {
      case 'verse':
      case 'opening': {
        const split =
          current.type === 'opening' && splitOpening ? splitOpening(current.text) : undefined
        const quote = current.type === 'verse' ? current.text : (split?.quote ?? current.text)
        const reference =
          current.type === 'verse'
            ? [current.label, version].filter(Boolean).join(' · ')
            : split?.reference
        return (
          <>
            <Text style={[reading, { fontSize: 22, lineHeight: 32, textAlign: 'center' }]}>
              {quote}
            </Text>
            {reference ? (
              <Text
                className="text-[12px] uppercase tracking-[1.2px] mt-[16px] text-center"
                style={{ color: SOFT_INK, ...SHADOW }}
              >
                {reference}
              </Text>
            ) : null}
          </>
        )
      }
      case 'hook':
        return (
          <Text style={[reading, { fontSize: 25, lineHeight: 35, textAlign: 'center' }]}>
            {current.text}
          </Text>
        )
      case 'part':
        return (
          <>
            {current.strong ? (
              <Pressable
                disabled={!onOpenStrong}
                onPress={() => current.strong && onOpenStrong?.(current.strong)}
                accessibilityRole="button"
                accessibilityLabel={`${current.strong.word}, ${current.strong.translit}, ${current.strong.code}`}
                className="self-start flex-row items-baseline gap-[6px] rounded-full px-[12px] py-[6px] mb-[16px]"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.28)',
                }}
              >
                <Text style={[transliterationTextStyle, { color: INK, fontSize: 14 }]}>
                  {current.strong.translit}
                </Text>
                <Text className="text-[12px] font-medium" style={{ color: SOFT_INK }}>
                  {current.strong.code}
                </Text>
              </Pressable>
            ) : null}
            <Text style={[reading, { fontSize: 23, lineHeight: 30, marginBottom: 14 }]}>
              {current.title}
            </Text>
            <Text style={[reading, { fontSize: 17, lineHeight: 28 }]}>{current.text}</Text>
          </>
        )
      case 'prayer':
        return (
          <>
            <Kicker>{t('dailyReading.prayer')}</Kicker>
            <Text style={[reading, { fontSize: 19, lineHeight: 31 }]}>{current.text}</Text>
          </>
        )
      case 'questions':
        return (
          <>
            <Kicker>{t('dailyReading.goDeeper')}</Kicker>
            <Box className="gap-[18px]">
              {current.items.map(item => (
                <Text key={item} style={[reading, { fontSize: 20, lineHeight: 29 }]}>
                  {item}
                </Text>
              ))}
            </Box>
          </>
        )
      case 'text':
        return (
          <Box className="gap-[14px]">
            {current.text.split(/\n\s*\n/).map((paragraph, paragraphIndex) => {
              // A publisher's source line (« AD 351.2 ») closes its paragraph, set as a source.
              const lines = paragraph.split('\n')
              const source =
                lines.length > 1 && SOURCE_LINE.test(lines.at(-1)!) ? lines.pop() : undefined
              return (
                <Box key={paragraphIndex}>
                  <Text style={[reading, { fontSize: 17, lineHeight: 28 }]}>
                    {lines.join('\n')}
                  </Text>
                  {source ? (
                    <Text className="text-[12px] mt-[4px]" style={{ color: SOFT_INK, ...SHADOW }}>
                      {source}
                    </Text>
                  ) : null}
                </Box>
              )
            })}
          </Box>
        )
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#1b1a22' }}>
      {/* The far layer: sharp on the verse, blurred and darker behind the text. */}
      {background ? (
        <>
          <Image
            source={{ uri: background }}
            contentFit="cover"
            style={{ position: 'absolute', inset: 0 }}
            transition={250}
            accessibilityIgnoresInvertColors
          />
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', inset: 0, opacity: isOpening ? 0 : 1 }, READING_FADE]}
          >
            <Image
              source={{ uri: background }}
              contentFit="cover"
              blurRadius={18}
              style={{ position: 'absolute', inset: 0, transform: [{ scale: 1.1 }] }}
              accessibilityIgnoresInvertColors
            />
            <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.36)' }} />
          </Animated.View>
        </>
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.34)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.3)']}
        locations={[0, 0.22, 0.75, 1]}
        style={{ position: 'absolute', inset: 0 }}
      />

      <Pressable onPress={tap} accessible={false} style={{ position: 'absolute', inset: 0 }} />

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: insets.top + 64,
          bottom: insets.bottom + (isOpening || isLast ? 132 : 96),
          alignItems: 'center',
        }}
      >
        <ScrollView
          key={index}
          style={{ width: '100%', maxWidth: 560 }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* The whole height answers a tap, above and below a short text too. */}
          <Pressable
            onPress={tap}
            accessible={false}
            style={{
              flexGrow: 1,
              justifyContent: 'center',
              paddingHorizontal: 28,
              paddingVertical: 12,
            }}
          >
            <Animated.View entering={FadeIn.duration(260)} accessibilityLiveRegion="polite">
              {renderCard(card)}
            </Animated.View>
          </Pressable>
        </ScrollView>
      </View>

      {/* The near layer passes in front of the text. */}
      {foreground ? (
        <Image
          source={{ uri: foreground }}
          contentFit="cover"
          blurRadius={isOpening ? 1 : 3}
          pointerEvents="none"
          style={{ position: 'absolute', inset: 0 }}
          transition={250}
          accessibilityIgnoresInvertColors
        />
      ) : null}

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 16 + workspaceInset,
          right: 16,
          top: insets.top + 10,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {cards.map((item, cardIndex) => (
            <View
              key={cardIndex}
              className="rounded-full"
              style={{
                flex: 1,
                height: 3,
                backgroundColor: cardIndex <= index ? INK : 'rgba(255,255,255,0.35)',
              }}
            />
          ))}
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 6,
          }}
        >
          <Text
            numberOfLines={1}
            className="text-[12px] font-semibold uppercase tracking-[1px] shrink"
            style={{ color: INK, ...SHADOW }}
          >
            {kicker}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            {onOpenPage ? (
              <Pressable
                onPress={onOpenPage}
                accessibilityRole="button"
                accessibilityLabel={t('dailyReading.readAsPage')}
                hitSlop={8}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <FeatherIcon name="file-text" size={19} color={INK} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('Fermer')}
              hitSlop={8}
              style={{ width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' }}
            >
              <FeatherIcon name="x" size={22} color={INK} />
            </Pressable>
          </View>
        </View>
      </View>

      {(index === 0 && onChangeVerse) || (isLast && onShare) ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 24,
            right: 24,
            bottom: insets.bottom + 28,
            alignItems: 'center',
          }}
        >
          {index === 0 && onChangeVerse ? (
            <Pressable
              onPress={onChangeVerse}
              accessibilityRole="button"
              className="rounded-full px-[18px] min-h-[44px] items-center justify-center flex-row gap-[8px]"
              style={{
                backgroundColor: 'rgba(255,255,255,0.16)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.3)',
              }}
            >
              <FeatherIcon name="refresh-cw" size={15} color={INK} />
              <Text className="text-[14px] font-medium" style={{ color: INK }}>
                {t('dailyReading.changeVerse')}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={onShare}
              accessibilityRole="button"
              className="rounded-full px-[22px] min-h-[48px] items-center justify-center self-stretch"
              style={{ backgroundColor: INK, maxWidth: 420, width: '100%' }}
            >
              <Text className="text-[15px] font-medium" style={{ color: '#1c1d22' }}>
                {t('dailyReading.shareVerse')}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  )
}

const Kicker = ({ children }: { children: string }) => (
  <Text
    className="text-[11px] font-semibold uppercase tracking-[1.4px] mb-[14px]"
    style={{ color: SOFT_INK, ...SHADOW }}
  >
    {children}
  </Text>
)

export default DailyStory
