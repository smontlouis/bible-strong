import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Platform, Pressable, Share, View } from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { isCivilDate } from '~features/plans/readingCalendar'
import { resolveMeditationOpening } from '../meditationPassage'
import { useLocalReadingDate } from '../useDailyMeditation'
import DailyStory from './DailyStory'
import { getVerseMeditationsId, type DailyCard, type DailyStrongWord } from './dailyReadingFormat'
import { useDailyEntry } from './useDailyReadings'
import { useVerseSwap } from './useVerseSwap'

/** The version each verse meditation is written on: the text its Strong words and questions quote. */
const VERSE_VERSIONS: Record<string, string> = {
  'verse-meditations-fr': 'LSG',
  'verse-meditations-en': 'BSB',
}

/**
 * `/daily-story?collectionId=…&date=…&entry=…`: the verse meditation of the day (by default, in
 * the reader's language) or the day of a book, as stories.
 */
const DailyStoryScreen = () => {
  const params = useLocalSearchParams<{ collectionId?: string; date?: string; entry?: string }>()
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const today = useLocalReadingDate()
  const date = params.date && isCivilDate(params.date) ? params.date : today
  const collectionId = params.collectionId || getVerseMeditationsId(i18n.language)
  const version = VERSE_VERSIONS[collectionId]
  const isVerse = Boolean(version)
  const first = useDailyEntry(collectionId, date)
  const swap = useVerseSwap(isVerse ? first.collection : undefined, date)
  const chosen = params.entry ?? (isVerse ? swap.swappedKey : undefined)
  const { collection, key, entry, isError, retry } = useDailyEntry(collectionId, date, chosen)

  useEffect(() => {
    if (Platform.OS === 'web') return
    const bars = SystemBars.pushStackEntry({ style: 'light' })
    return () => SystemBars.popStackEntry(bars)
  }, [])

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'))
  const verse = entry?.cards.find(
    (card): card is Extract<DailyCard, { type: 'verse' }> => card.type === 'verse'
  )
  const share = verse
    ? () => {
        void Share.share({
          message: `${verse.text}\n${verse.label}${version ? ` (${version})` : ''}`,
        })
      }
    : undefined
  const openStrong = (word: DailyStrongWord) => {
    const match = /^([HG])0*(\d+)/.exec(word.code)
    if (!match) return
    router.push({
      pathname: '/strong',
      params: { book: match[1] === 'G' ? '40' : '1', reference: match[2] },
    })
  }
  const language = collection?.language === 'en' ? 'en' : 'fr'
  const splitOpening = (text: string) => {
    const opening = resolveMeditationOpening(
      { slices: [{ id: '0', type: 'Text', subType: 'devotional', description: text }] },
      language
    )
    return { quote: opening?.quote ?? text, reference: opening?.reference }
  }

  if (!entry || !key)
    return (
      <StoryPlaceholder failed={isError || Boolean(collection)} onRetry={retry} onClose={close} />
    )

  return (
    <DailyStory
      key={`${collectionId}:${date}:${key}`}
      entry={entry}
      kicker={isVerse ? t('dailyReading.title') : (entry.title ?? '')}
      version={version}
      splitOpening={isVerse ? undefined : splitOpening}
      onClose={close}
      onChangeVerse={isVerse && collection?.reserve.length ? () => swap.change(key) : undefined}
      onShare={share}
      onOpenStrong={openStrong}
      onOpenPage={
        isVerse
          ? undefined
          : () =>
              router.replace({
                pathname: '/meditation',
                params: { collectionId, date, ...(params.entry ? { readingId: key } : {}) },
              })
      }
    />
  )
}

const StoryPlaceholder = ({
  failed,
  onRetry,
  onClose,
}: {
  failed: boolean
  onRetry: () => void
  onClose: () => void
}) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#1b1a22',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('Fermer')}
        style={{
          position: 'absolute',
          top: insets.top + 16,
          right: 16,
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FeatherIcon name="x" size={22} color="#ffffff" />
      </Pressable>
      {failed ? (
        <>
          <Text className="text-center text-[16px]" style={{ color: '#ffffff' }}>
            {t('dailyReading.storyUnavailable')}
          </Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            className="mt-[16px] min-h-[44px] justify-center"
          >
            <Text className="text-[15px] font-medium" style={{ color: '#ffffff' }}>
              {t('dailyReading.retry')}
            </Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator color="#ffffff" accessibilityLabel={t('Chargement...')} />
      )}
    </View>
  )
}

export default DailyStoryScreen
