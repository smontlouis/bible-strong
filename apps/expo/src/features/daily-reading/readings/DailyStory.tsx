import { MaterialCommunityIcons } from '@expo/vector-icons'
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
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { transliterationTextStyle } from '~common/ui/textTypography'
import { useWorkspaceHeaderInset } from '~features/app-switcher/workspaceHeaderInset'
import {
  EntityPortraitTiltSensor,
  useEntityPortraitPointer,
  useEntityPortraitTilt,
} from '~features/lexique/EntityPortraitParallax'
import { selectFontFamily } from '~redux/selectors/user'
import { resolveFontFamily } from '~themes/styleValues'
import type { DailyCard, DailyEntry, DailyStrongWord } from './dailyReadingFormat'
import PrayerMedallion from './PrayerMedallion'
import StoryMotion, { StoryPresence } from './StoryMotion'
import StorySceneLayer from './StorySceneLayer'
import {
  BACKGROUND_DEPTH,
  cameraOf,
  FOCUS_DURATION,
  FOCUS_EASING,
  FOREGROUND_DEPTH,
  TEXT_FOCUS_SCALE,
  TEXT_MOTION,
  TEXT_SHIFT,
  useTiltStyle,
} from './storySceneMotion'
import { useDailySceneUri } from './useDailyReadings'

const INK = '#ffffff'
const SOFT_INK = 'rgba(255,255,255,0.78)'
const GLASS = 'rgba(255,255,255,0.16)'
const GLASS_EDGE = 'rgba(255,255,255,0.3)'
/**
 * The reading texts all have the verse's size (2026-11-26), and the titles more: the cards scroll,
 * behind the near layer of the scene, so a long text has room.
 */
const BODY = { fontSize: 22, lineHeight: 36 }
/** The closing buttons stay narrow, on a wide screen too. */
const CLOSING_BUTTONS_WIDTH = 360
const SOURCE_LINE = /^[A-Z][A-Za-z]{0,6}\s+\d+[.:]\d+\s*$/
const SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.45)',
  textShadowRadius: 14,
  textShadowOffset: { width: 0, height: 1 },
}
const READING_FADE = {
  transitionProperty: 'opacity',
  transitionDuration: FOCUS_DURATION,
  transitionTimingFunction: 'ease-in-out',
} as const

/** iOS and Android: what is not the web. */
const native = Platform.OS !== 'web'

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
  const [prayerOpen, setPrayerOpen] = useState(false)
  // Wider than tall, the scene keeps its square and stands in the middle: the sides show it
  // blurred and dark, so a 21:9 screen does not stretch it into a strip (2026-11-26).
  const [area, setArea] = useState<{ width: number; height: number } | null>(null)
  const stageWidth = area && area.width > area.height ? area.height : undefined
  // The web draws the blurred sides and the square until it knows the area is not wide; the
  // square itself is CSS there (as tall as the area), so the first frame of a wide window is
  // already right.
  const wide = native ? Boolean(stageWidth) : !area || area.width > area.height
  // Another verse or another day starts again on its first card; its scene fades in over the last.
  const [shownEntry, setShownEntry] = useState(entry)
  // Each day or verse shown counts a round: its first card comes as a new one.
  const [round, setRound] = useState(0)
  if (shownEntry !== entry) {
    setShownEntry(entry)
    setIndex(0)
    setDeeper(false)
    setPrayerOpen(false)
    setRound(round + 1)
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
  // Going into the scene and stepping back out of it (storySceneMotion): 0 sharp, 1 in focus.
  const focus = useSharedValue(sharpScene ? 0 : 1)
  useEffect(() => {
    focus.set(withTiming(sharpScene ? 0 : 1, { duration: FOCUS_DURATION, easing: FOCUS_EASING }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharpScene])
  // The tilt of the phone, or the pointer on a wide screen; nothing moves for a reader who asked
  // for less motion.
  const still = useReducedMotion()
  // The journey through the scene: the eye goes from its left edge on the first reading card to
  // its right one on the last, and comes back to the middle for the closing blessing.
  const readingCards = cards.filter(
    current => current.type !== 'verse' && current.type !== 'opening' && current.type !== 'end'
  )
  const cameraAt = still
    ? 0
    : cameraOf(
        sharpScene ? -1 : isEnd ? readingCards.length - 1 : readingCards.indexOf(card),
        readingCards.length
      )
  const camera = useSharedValue(cameraAt)
  useEffect(() => {
    camera.set(withTiming(cameraAt, { duration: FOCUS_DURATION, easing: FOCUS_EASING }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraAt])
  // The stage, once measured: the whole area when it is taller than wide (a phone, a narrow
  // window), or the square in the middle of a wide one.
  const stage = area ? { width: stageWidth ?? area.width, height: area.height } : null
  const tilt = useEntityPortraitTilt()
  const pointer = useEntityPortraitPointer(tilt)
  const textTilt = useTiltStyle(tilt, TEXT_SHIFT, 1, still)
  const textFocus = useAnimatedStyle(() => ({
    transform: [{ scale: still ? 1 : 1 + (TEXT_FOCUS_SCALE - 1) * focus.get() }],
  }))

  const go = (step: number) => {
    // The last card ends with « Terminer », never with a stray tap.
    if (step > 0 && isEnd) return
    setPrayerOpen(false)
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

  /**
   * The closing buttons, just under the blessing or the questions (2026-11-26): they come after
   * the text and leave with the card.
   */
  const closingButtons = (delay: number) => (
    <StoryMotion
      delay={delay}
      duration={TEXT_MOTION.buttonsDuration}
      style={{
        alignSelf: 'center',
        width: '100%',
        maxWidth: CLOSING_BUTTONS_WIDTH,
        gap: 10,
        marginTop: 36,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {onShare ? (
          <View style={{ flex: 1 }}>
            <StoryButton icon="share-2" label={t('Partager')} onPress={onShare} />
          </View>
        ) : null}
        {questions.length && !deeper ? (
          <View style={{ flex: 1 }}>
            <StoryButton
              icon="compass"
              label={t('dailyReading.goFurther')}
              onPress={() => setDeeper(true)}
            />
          </View>
        ) : null}
      </View>
      <StoryButton solid label={t('dailyReading.finish')} onPress={onClose} />
    </StoryMotion>
  )

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
            <StoryMotion>
              <Text style={[reading, { fontSize: 22, lineHeight: 36, textAlign: 'center' }]}>
                {quote}
              </Text>
            </StoryMotion>
            {reference ? (
              <StoryMotion delay={TEXT_MOTION.step}>
                <Text
                  className="text-[12px] uppercase tracking-[1.2px] mt-[16px] text-center"
                  style={{ color: SOFT_INK, ...SHADOW }}
                >
                  {reference}
                </Text>
              </StoryMotion>
            ) : null}
          </>
        )
      }
      case 'hook':
        return (
          <StoryMotion>
            <Text style={[reading, { fontSize: 28, lineHeight: 40, textAlign: 'center' }]}>
              {current.text}
            </Text>
          </StoryMotion>
        )
      case 'part':
        return (
          <>
            {current.strong ? (
              <StoryMotion
                enter="pop"
                delay={TEXT_MOTION.popDelay}
                style={{ alignSelf: 'flex-start' }}
              >
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
              </StoryMotion>
            ) : null}
            <StoryMotion>
              <Text style={[reading, { fontSize: 30, lineHeight: 40, marginBottom: 18 }]}>
                {current.title}
              </Text>
            </StoryMotion>
            <StoryMotion delay={TEXT_MOTION.step}>
              <Text style={[reading, BODY]}>{current.text}</Text>
            </StoryMotion>
          </>
        )
      case 'prayer':
        // A time of prayer (2026-11-26): the prayer shows when the reader asks for it, and a tap
        // elsewhere goes on without it.
        return prayerOpen ? (
          <>
            <StoryMotion enter="fade">
              <MaterialCommunityIcons
                name="hands-pray"
                size={22}
                color={SOFT_INK}
                style={{ marginBottom: 10 }}
              />
            </StoryMotion>
            <StoryMotion>
              <Kicker>{t('dailyReading.prayer')}</Kicker>
            </StoryMotion>
            <StoryMotion delay={TEXT_MOTION.step}>
              <Text style={[reading, BODY]}>{current.text}</Text>
            </StoryMotion>
          </>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <StoryMotion enter="pop" duration={TEXT_MOTION.riseDuration}>
              <PrayerMedallion
                label={t('dailyReading.pray')}
                still={still}
                onPress={() => setPrayerOpen(true)}
              />
            </StoryMotion>
            <StoryMotion delay={TEXT_MOTION.step} style={{ marginTop: 32 }}>
              <Text style={[reading, { fontSize: 30, lineHeight: 40, textAlign: 'center' }]}>
                {t('dailyReading.prayerTime')}
              </Text>
            </StoryMotion>
            <StoryMotion delay={TEXT_MOTION.step * 2}>
              <Text
                className="text-[13px] mt-[12px] text-center"
                style={{ color: SOFT_INK, ...SHADOW }}
              >
                {t('dailyReading.prayHint')}
              </Text>
            </StoryMotion>
          </View>
        )
      case 'text':
        return (
          <Box className="gap-[20px]">
            {current.text.split(/\n\s*\n/).map((paragraph, paragraphIndex) => {
              // A publisher's source line (« AD 351.2 ») closes its paragraph, set as a source.
              const lines = paragraph.split('\n')
              const source =
                lines.length > 1 && SOURCE_LINE.test(lines.at(-1)!) ? lines.pop() : undefined
              return (
                <StoryMotion
                  key={paragraphIndex}
                  delay={paragraphIndex * TEXT_MOTION.paragraphStep}
                >
                  <Text style={[reading, BODY]}>{lines.join('\n')}</Text>
                  {source ? (
                    <Text className="text-[12px] mt-[4px]" style={{ color: SOFT_INK, ...SHADOW }}>
                      {source}
                    </Text>
                  ) : null}
                </StoryMotion>
              )
            })}
          </Box>
        )
      case 'end':
        return deeper ? (
          <>
            <StoryMotion>
              <Kicker>{t('dailyReading.goDeeper')}</Kicker>
            </StoryMotion>
            <Box className={onAskQuestion ? 'gap-[12px]' : 'gap-[20px]'}>
              {questions.map((item, itemIndex) => (
                <StoryMotion key={item} delay={(itemIndex + 1) * TEXT_MOTION.questionStep}>
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
                      <Text style={[reading, BODY, { flex: 1 }]}>{item}</Text>
                      <FeatherIcon name="message-circle" size={18} color={INK} />
                    </Pressable>
                  ) : (
                    <Text style={[reading, BODY]}>{item}</Text>
                  )}
                </StoryMotion>
              ))}
            </Box>
            {onAskQuestion ? (
              <StoryMotion delay={(questions.length + 1) * TEXT_MOTION.questionStep}>
                <Text
                  className="text-[13px] mt-[16px] text-center"
                  style={{ color: SOFT_INK, ...SHADOW }}
                >
                  {t('dailyReading.askStrobiHint')}
                </Text>
              </StoryMotion>
            ) : null}
            {closingButtons((questions.length + 2) * TEXT_MOTION.questionStep)}
          </>
        ) : (
          <View>
            <StoryMotion>
              <Text
                className="text-[11px] font-semibold uppercase tracking-[1.4px] mb-[16px] text-center"
                style={{ color: SOFT_INK, ...SHADOW }}
              >
                {t('dailyReading.forTheRoad')}
              </Text>
            </StoryMotion>
            <StoryMotion delay={TEXT_MOTION.step}>
              <Text style={[reading, { fontSize: 28, lineHeight: 40, textAlign: 'center' }]}>
                {blessing}
              </Text>
            </StoryMotion>
            {closingButtons(TEXT_MOTION.buttonsDelay)}
          </View>
        )
    }
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: '#1b1a22', alignItems: 'center' }}
      // On a wide screen the pointer stands for the tilt of a phone.
      {...(!native && !still ? pointer : {})}
      onLayout={({ nativeEvent }) => {
        const { width: areaWidth, height: areaHeight } = nativeEvent.layout
        setArea(previous =>
          previous?.width === areaWidth && previous.height === areaHeight
            ? previous
            : { width: areaWidth, height: areaHeight }
        )
      }}
    >
      {native && !still ? <EntityPortraitTiltSensor tilt={tilt} /> : null}
      {wide && background ? (
        <>
          <Image
            source={{ uri: background }}
            contentFit="cover"
            blurRadius={Platform.OS === 'web' ? 48 : 30}
            transition={{ duration: 500, effect: 'cross-dissolve' }}
            style={{ position: 'absolute', inset: 0, transform: [{ scale: 1.15 }] }}
            accessibilityIgnoresInvertColors
          />
          <View
            pointerEvents="none"
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
          />
        </>
      ) : null}
      <View
        style={
          native || !wide
            ? { flex: 1, width: stageWidth ?? '100%', overflow: 'hidden' }
            : // A narrow window fills its whole height like a phone (2026-11-26); a wide one
              // keeps the square in the middle.
              { height: '100%', aspectRatio: 1, maxWidth: '100%', overflow: 'hidden' }
        }
      >
        {/* The far layer: sharp on the verse, blurred and darker behind the text. */}
        {background ? (
          <StorySceneLayer
            uri={background}
            depth={BACKGROUND_DEPTH}
            focus={focus}
            focused={!sharpScene}
            camera={camera}
            cameraAt={cameraAt}
            stage={stage}
            tilt={tilt}
            still={still}
          />
        ) : null}
        {/* Darker behind the reading cards, as the scene blurs. */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.36)',
              opacity: sharpScene ? 0 : 1,
            },
            READING_FADE,
          ]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0.34)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.3)']}
          locations={[0, 0.22, 0.75, 1]}
          style={{ position: 'absolute', inset: 0 }}
        />

        <Pressable onPress={tap} accessible={false} style={{ position: 'absolute', inset: 0 }} />

        {/* The text floats a little with the tilt, between the far and the near layer. */}
        <Animated.View
          pointerEvents="box-none"
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              top: insets.top + 64,
              // The area stays the same from card to card, down to the bottom edge, so a card
              // that leaves never moves: each card keeps its own room at the bottom instead.
              bottom: 0,
              alignItems: 'center',
            },
            // The browser draws the text once on its own layer and slides that layer, as it
            // does the scene's pictures: drawn again at each step, the lines snapped to the
            // pixels one after the other and the text moved in small jumps (2026-11-26).
            native ? null : ({ willChange: 'transform' } as object),
            textTilt,
          ]}
        >
          {/* The focus: the text comes a little closer on the reading cards. */}
          <Animated.View
            pointerEvents="box-none"
            style={[{ flex: 1, alignSelf: 'stretch', alignItems: 'center' }, textFocus]}
          >
            {/* One card at a time: the one that leaves fades out, then the next one's texts rise. */}
            <StoryPresence>
              <StoryMotion
                key={`${round}:${index}:${deeper ? 'deeper' : ''}:${prayerOpen ? 'prayer' : ''}`}
                enter="none"
                leave
                // A click beside the text, on a wide screen, reaches the tap area under it.
                pointerEvents="box-none"
                style={{ position: 'absolute', inset: 0, alignItems: 'center' }}
              >
                <ScrollView
                  style={{ width: '100%', maxWidth: 560 }}
                  contentContainerStyle={{
                    flexGrow: 1,
                    // The verse leaves room for « Changer de verset »; a reading card scrolls
                    // behind the near layer, its last line stopping above it.
                    paddingBottom: insets.bottom + (isOpening ? 132 : 96),
                  }}
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
              </StoryMotion>
            </StoryPresence>
          </Animated.View>
        </Animated.View>

        {/* The near layer passes in front of the text. */}
        {foreground ? (
          <StorySceneLayer
            uri={foreground}
            depth={FOREGROUND_DEPTH}
            focus={focus}
            focused={!sharpScene}
            camera={camera}
            cameraAt={cameraAt}
            stage={stage}
            tilt={tilt}
            still={still}
            cutOut
          />
        ) : null}

        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            // Centred in a wide area, the scene leaves the sidebar button its corner.
            left: 16 + (wide ? 0 : workspaceInset),
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
            onAccessibilityAction={event =>
              go(event.nativeEvent.actionName === 'increment' ? 1 : -1)
            }
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

        {/* Shown on the verse only: it fades in with it and out as the reading starts. */}
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
          <StoryPresence>
            {index === 0 && onChangeVerse ? (
              <StoryMotion key="change-verse" enter="fade" delay={TEXT_MOTION.buttonsDelay} leave>
                <StoryButton
                  icon="refresh-cw"
                  label={t('dailyReading.changeVerse')}
                  onPress={onChangeVerse}
                />
              </StoryMotion>
            ) : null}
          </StoryPresence>
        </View>
      </View>
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
