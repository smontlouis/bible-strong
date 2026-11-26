import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState, type ReactNode } from 'react'
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
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  FadeOutUp,
  Keyframe,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { popIn } from '~common/ui/motion'
import { transliterationTextStyle } from '~common/ui/textTypography'
import { useWorkspaceHeaderInset } from '~features/app-switcher/workspaceHeaderInset'
import { selectFontFamily } from '~redux/selectors/user'
import { resolveFontFamily } from '~themes/styleValues'
import type { DailyCard, DailyEntry, DailyStrongWord } from './dailyReadingFormat'
import { useDailySceneUri } from './useDailyReadings'

const INK = '#ffffff'
const SOFT_INK = 'rgba(255,255,255,0.78)'
const GLASS = 'rgba(255,255,255,0.16)'
const GLASS_EDGE = 'rgba(255,255,255,0.3)'
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

/** A text that arrives: it rises a little as it appears. */
const rise = (delay = 0) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 12 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
  })
    .duration(380)
    .delay(delay)

type StoryCard = Exclude<DailyCard, { type: 'questions' }> | { type: 'end' }

export type DailyStoryProps = {
  entry: DailyEntry
  /** The label above the cards: « Verset du jour », or the book's title. */
  kicker: string
  /** The version of the verse a meditation quotes (LSG, BSB). */
  version?: string
  /** The closing words of the last card, before « Terminer ». */
  blessing: string
  /** The opening card split into its quotation and its reference (books). */
  splitOpening?: (text: string) => { quote: string; reference?: string }
  onClose: () => void
  /** Opens the day as a page (books): its date picker, its settings, the assistant. */
  onOpenPage?: () => void
  onChangeVerse?: () => void
  onShare?: () => void
  onOpenStrong?: (word: DailyStrongWord) => void
  /** The music's button, at the top right. */
  music?: ReactNode
  /**
   * Opens Strobi on one of the meditation's questions (2026-11-26); without it, the questions
   * stay text, for a reader to whom Strobi is not open.
   */
  onAskQuestion?: (question: string) => void
}

/**
 * A verse meditation or a day of a book, card after card, over its painted scene. The last card
 * says a blessing and ends the reading; « Aller plus loin » brings the meditation's questions there.
 */
const DailyStory = ({
  entry,
  kicker,
  version,
  blessing,
  splitOpening,
  onClose,
  onOpenPage,
  onChangeVerse,
  onShare,
  onOpenStrong,
  music,
  onAskQuestion,
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
  const [deeper, setDeeper] = useState(false)
  // Another verse or another day starts again on its first card; its scene fades in over the last.
  const [shownEntry, setShownEntry] = useState(entry)
  if (shownEntry !== entry) {
    setShownEntry(entry)
    setIndex(0)
    setDeeper(false)
  }
  const questions = entry.cards.find(card => card.type === 'questions')?.items ?? []
  const cards: StoryCard[] = [
    ...entry.cards.flatMap(card => (card.type === 'questions' ? [] : [card])),
    { type: 'end' },
  ]
  const card = cards[Math.min(index, cards.length - 1)]!
  const isOpening = card.type === 'verse' || card.type === 'opening'
  const isEnd = card.type === 'end'
  // The verse and the closing blessing sit on the sharp scene; reading cards on the blurred one.
  const sharpScene = isOpening || (isEnd && !deeper)

  const go = (step: number) => {
    // The last card ends with « Terminer », never with a stray tap.
    if (step > 0 && isEnd) return
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

  const renderCard = (current: StoryCard) => {
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
            <Animated.View entering={rise()}>
              <Text style={[reading, { fontSize: 22, lineHeight: 32, textAlign: 'center' }]}>
                {quote}
              </Text>
            </Animated.View>
            {reference ? (
              <Animated.View entering={rise(160)}>
                <Text
                  className="text-[12px] uppercase tracking-[1.2px] mt-[16px] text-center"
                  style={{ color: SOFT_INK, ...SHADOW }}
                >
                  {reference}
                </Text>
              </Animated.View>
            ) : null}
          </>
        )
      }
      case 'hook':
        return (
          <Animated.View entering={rise()}>
            <Text style={[reading, { fontSize: 25, lineHeight: 35, textAlign: 'center' }]}>
              {current.text}
            </Text>
          </Animated.View>
        )
      case 'part':
        return (
          <>
            {current.strong ? (
              <Animated.View entering={popIn.delay(220)} style={{ alignSelf: 'flex-start' }}>
                <Pressable
                  disabled={!onOpenStrong}
                  onPress={() => current.strong && onOpenStrong?.(current.strong)}
                  accessibilityRole="button"
                  accessibilityLabel={`${current.strong.word}, ${current.strong.translit}, ${current.strong.code}`}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    gap: 6,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    marginBottom: 16,
                    backgroundColor: GLASS,
                    borderWidth: 1,
                    borderColor: GLASS_EDGE,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  })}
                >
                  <Text style={[transliterationTextStyle, { color: INK, fontSize: 14 }]}>
                    {current.strong.translit}
                  </Text>
                  <Text className="text-[12px] font-medium" style={{ color: SOFT_INK }}>
                    {current.strong.code}
                  </Text>
                </Pressable>
              </Animated.View>
            ) : null}
            <Animated.View entering={rise()}>
              <Text style={[reading, { fontSize: 23, lineHeight: 30, marginBottom: 14 }]}>
                {current.title}
              </Text>
            </Animated.View>
            <Animated.View entering={rise(110)}>
              <Text style={[reading, { fontSize: 17, lineHeight: 28 }]}>{current.text}</Text>
            </Animated.View>
          </>
        )
      case 'prayer':
        return (
          <>
            <Animated.View entering={rise()}>
              <Kicker>{t('dailyReading.prayer')}</Kicker>
            </Animated.View>
            <Animated.View entering={rise(110)}>
              <Text style={[reading, { fontSize: 19, lineHeight: 31 }]}>{current.text}</Text>
            </Animated.View>
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
                <Animated.View key={paragraphIndex} entering={rise(paragraphIndex * 90)}>
                  <Text style={[reading, { fontSize: 17, lineHeight: 28 }]}>
                    {lines.join('\n')}
                  </Text>
                  {source ? (
                    <Text className="text-[12px] mt-[4px]" style={{ color: SOFT_INK, ...SHADOW }}>
                      {source}
                    </Text>
                  ) : null}
                </Animated.View>
              )
            })}
          </Box>
        )
      case 'end':
        return deeper ? (
          <>
            <Animated.View entering={rise()}>
              <Kicker>{t('dailyReading.goDeeper')}</Kicker>
            </Animated.View>
            <Box className={onAskQuestion ? 'gap-[12px]' : 'gap-[20px]'}>
              {questions.map((item, itemIndex) => (
                <Animated.View key={item} entering={rise(140 + itemIndex * 140)}>
                  {onAskQuestion ? (
                    <Pressable
                      onPress={() => onAskQuestion(item)}
                      accessibilityRole="button"
                      accessibilityHint={t('dailyReading.askStrobiHint')}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                        paddingVertical: 14,
                        paddingLeft: 18,
                        paddingRight: 14,
                        borderRadius: 20,
                        backgroundColor: GLASS,
                        borderWidth: 1,
                        borderColor: GLASS_EDGE,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <Text style={[reading, { flex: 1, fontSize: 19, lineHeight: 27 }]}>
                        {item}
                      </Text>
                      <FeatherIcon name="message-circle" size={18} color={INK} />
                    </Pressable>
                  ) : (
                    <Text style={[reading, { fontSize: 20, lineHeight: 29 }]}>{item}</Text>
                  )}
                </Animated.View>
              ))}
            </Box>
            {onAskQuestion ? (
              <Animated.View entering={rise(140 + questions.length * 140)}>
                <Text
                  className="text-[13px] mt-[16px] text-center"
                  style={{ color: SOFT_INK, ...SHADOW }}
                >
                  {t('dailyReading.askStrobiHint')}
                </Text>
              </Animated.View>
            ) : null}
          </>
        ) : (
          <Animated.View exiting={FadeOutUp.duration(220)}>
            <Animated.View entering={rise()}>
              <Text
                className="text-[11px] font-semibold uppercase tracking-[1.4px] mb-[16px] text-center"
                style={{ color: SOFT_INK, ...SHADOW }}
              >
                {t('dailyReading.forTheRoad')}
              </Text>
            </Animated.View>
            <Animated.View entering={rise(120)}>
              <Text style={[reading, { fontSize: 25, lineHeight: 36, textAlign: 'center' }]}>
                {blessing}
              </Text>
            </Animated.View>
          </Animated.View>
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
            transition={{ duration: 500, effect: 'cross-dissolve' }}
            accessibilityIgnoresInvertColors
          />
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', inset: 0, opacity: sharpScene ? 0 : 1 }, READING_FADE]}
          >
            <Image
              source={{ uri: background }}
              contentFit="cover"
              blurRadius={18}
              transition={{ duration: 500, effect: 'cross-dissolve' }}
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
          bottom: insets.bottom + (isEnd ? 156 : isOpening ? 132 : 96),
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
            <View accessibilityLiveRegion="polite">{renderCard(card)}</View>
          </Pressable>
        </ScrollView>
      </View>

      {/* The near layer passes in front of the text. */}
      {foreground ? (
        <Image
          source={{ uri: foreground }}
          contentFit="cover"
          blurRadius={sharpScene ? 1 : 3}
          pointerEvents="none"
          style={{ position: 'absolute', inset: 0 }}
          transition={{ duration: 500, effect: 'cross-dissolve' }}
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
        <View
          style={{ flexDirection: 'row', gap: 4 }}
          // With a screen reader, the bars move from card to card (swipe up or down).
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('dailyReading.cardPosition', {
            index: index + 1,
            count: cards.length,
          })}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={event => go(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
        >
          {cards.map((item, cardIndex) => (
            <ProgressBar key={cardIndex} filled={cardIndex <= index} />
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {music}
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

      {index === 0 && onChangeVerse ? (
        <Animated.View
          entering={FadeIn.duration(300).delay(250)}
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 24,
            right: 24,
            bottom: insets.bottom + 28,
            alignItems: 'center',
          }}
        >
          <StoryButton
            icon="refresh-cw"
            label={t('dailyReading.changeVerse')}
            onPress={onChangeVerse}
          />
        </Animated.View>
      ) : null}

      {isEnd ? (
        <Animated.View
          entering={rise(260)}
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 24,
            right: 24,
            bottom: insets.bottom + 24,
            alignItems: 'center',
          }}
        >
          <View style={{ width: '100%', maxWidth: 420, gap: 10 }}>
            <Animated.View
              layout={LinearTransition.duration(240)}
              style={{ flexDirection: 'row', gap: 10 }}
            >
              {onShare ? (
                <Animated.View layout={LinearTransition.duration(240)} style={{ flex: 1 }}>
                  <StoryButton icon="share-2" label={t('Partager')} onPress={onShare} />
                </Animated.View>
              ) : null}
              {questions.length && !deeper ? (
                <Animated.View exiting={FadeOut.duration(160)} style={{ flex: 1 }}>
                  <StoryButton
                    icon="compass"
                    label={t('dailyReading.goFurther')}
                    onPress={() => setDeeper(true)}
                  />
                </Animated.View>
              ) : null}
            </Animated.View>
            <StoryButton solid label={t('dailyReading.finish')} onPress={onClose} />
          </View>
        </Animated.View>
      ) : null}
    </View>
  )
}

/** One bar of the progress: it fills from the left when its card comes, and empties going back. */
const ProgressBar = ({ filled }: { filled: boolean }) => {
  const fill = useSharedValue(0)
  useEffect(() => {
    fill.set(
      withTiming(filled ? 1 : 0, { duration: filled ? 420 : 200, easing: Easing.out(Easing.cubic) })
    )
  }, [filled, fill])
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.get() }] }))
  return (
    <View
      className="rounded-full overflow-hidden"
      style={{ flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.35)' }}
    >
      <Animated.View
        style={[
          { position: 'absolute', inset: 0, backgroundColor: INK, transformOrigin: 'left' },
          fillStyle,
        ]}
      />
    </View>
  )
}

type FeatherName = 'refresh-cw' | 'share-2' | 'compass'

/** A button over the scene: glass, or the one solid white button of the card. */
const StoryButton = ({
  label,
  icon,
  solid = false,
  onPress,
}: {
  label: string
  icon?: FeatherName
  solid?: boolean
  onPress: () => void
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    style={({ pressed }) => ({
      minHeight: solid ? 50 : 46,
      borderRadius: 999,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: solid ? INK : GLASS,
      borderWidth: solid ? 0 : 1,
      borderColor: GLASS_EDGE,
      transform: [{ scale: pressed ? 0.97 : 1 }],
      opacity: pressed ? 0.92 : 1,
    })}
  >
    {icon ? <FeatherIcon name={icon} size={15} color={solid ? '#1c1d22' : INK} /> : null}
    <Text
      numberOfLines={1}
      className="text-[15px] font-medium"
      style={{ color: solid ? '#1c1d22' : INK }}
    >
      {label}
    </Text>
  </Pressable>
)

const Kicker = ({ children }: { children: string }) => (
  <Text
    className="text-[11px] font-semibold uppercase tracking-[1.4px] mb-[14px]"
    style={{ color: SOFT_INK, ...SHADOW }}
  >
    {children}
  </Text>
)

export default DailyStory
