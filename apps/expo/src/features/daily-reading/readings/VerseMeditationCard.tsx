import { useRouter } from 'expo-router'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Platform, Share } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import Link from '~common/Link'
import Sheet from '~common/ModalSheet'
import { SheetView, type SheetRef } from '~common/sheet'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import StandaloneVerseOfTheDay, {
  type VerseCardProps,
} from '~features/home/StandaloneVerseOfTheDay'
import VerseImageModal from '~features/home/VerseImageModal'
import { useImageUrls } from '~features/home/useImageUrls'
import { getVerseCardHeight, VERSE_CARD_HEIGHT } from '~features/home/verseCardLayout'
import type { VerseOfTheDayData } from '~features/home/verseOfTheDayQuery'
import type { RootState } from '~redux/modules/reducer'
import { setNotificationVOD } from '~redux/modules/user'
import { selectFontFamily } from '~redux/selectors/user'
import { resolveFontFamily } from '~themes/styleValues'
import ReminderSettings from '../ReminderSettings'
import { useLocalReadingDate } from '../useDailyMeditation'
import DailySceneCard from './DailySceneCard'
import { getVerseKeys, useVerseMeditation, type VerseCard } from './useVerseMeditation'

const DAY_LABELS = [
  "Aujourd'hui",
  'Hier',
  'Il y a deux jours',
  'Il y a trois jours',
  'Il y a quatre jours',
]

/** The verse of the day of the home, from the verse meditations: tapping it opens the meditation. */
const VerseMeditationCard = (props: VerseCardProps) => {
  const { addDay, desktop = false, navigation, footer, style, onContentHeight, active } = props
  const { t } = useTranslation()
  const router = useRouter()
  const dispatch = useDispatch()
  const fontFamily = resolveFontFamily(useSelector(selectFontFamily))
  const reminderTime = useSelector((state: RootState) => state.user.notifications.verseOfTheDay)
  const date = useLocalReadingDate(addDay)
  const { collectionId, version, entry, verse, isError, isLoading } = useVerseMeditation(date)
  const imageSource = entry?.ref ? toImageSource(entry.ref, verse, version) : undefined
  const imageUrls = useImageUrls(imageSource ?? false)
  const imageModalRef = useRef<SheetRef>(null)
  const notificationModalRef = useRef<SheetRef>(null)

  // Without its meditation (none kept yet and no network, a date outside the panel), the card
  // keeps today's standalone verse.
  if (isError || (!isLoading && !entry)) return <StandaloneVerseOfTheDay {...props} />

  const open = () => router.push({ pathname: '/daily-story', params: { collectionId, date } })
  const label =
    addDay === 0 ? t('dailyReading.title') : DAY_LABELS[-addDay] ? t(DAY_LABELS[-addDay]) : date

  const sheets = (
    <>
      {imageSource && (
        <VerseImageModal
          modalRef={imageModalRef}
          imageUrls={imageUrls}
          verseOfTheDay={imageSource}
        />
      )}
      <Sheet modalTitle={t('Recevoir une notification quotidienne')} ref={notificationModalRef}>
        <SheetView className="px-[20px] py-[30px]">
          <ReminderSettings
            time={reminderTime}
            onChange={time => dispatch(setNotificationVOD(time ?? ''))}
          />
        </SheetView>
      </Sheet>
    </>
  )

  // On a phone the card is a window on the day's scene, which grows into the stories.
  if (!desktop && entry && verse) {
    const icon = (
      name: 'bell' | 'share-2' | 'image',
      accessibilityLabel: string,
      onPress: () => void
    ) => (
      <Link accessibilityLabel={accessibilityLabel} size={44} onPress={onPress}>
        <FeatherIcon size={16} name={name} color="#ffffff" />
      </Link>
    )
    return (
      <>
        <DailySceneCard
          href={{ pathname: '/daily-story', params: { collectionId, date } }}
          sceneId={entry.scene}
          label={label}
          text={verse.text}
          reference={`${verse.label} - ${version}`}
          navigation={navigation}
          footer={footer}
          style={style}
          onContentHeight={onContentHeight}
          active={active}
          onChange={() => router.push('/daily-reading')}
          actions={
            <>
              {!addDay &&
                Platform.OS !== 'web' &&
                icon('bell', t('Recevoir une notification quotidienne'), () =>
                  notificationModalRef.current?.present()
                )}
              {icon('share-2', t('Partager'), () => {
                void Share.share({ message: `${verse.text}\n${verse.label} (${version})` })
              })}
              {imageSource &&
                icon('image', t('accessibility.createVerseImage'), () =>
                  imageModalRef.current?.present()
                )}
            </>
          }
        />
        {sheets}
      </>
    )
  }

  return (
    <Box
      className={
        desktop
          ? 'flex-1 p-[24px] pb-[12px]'
          : 'overflow-hidden border-continuous px-[20px] rounded-[24px] bg-surface py-[20px]'
      }
      style={desktop ? style : { minHeight: VERSE_CARD_HEIGHT, ...style }}
    >
      <Box
        onLayout={({ nativeEvent }) =>
          onContentHeight?.(getVerseCardHeight(nativeEvent.layout.height))
        }
      >
        <Box
          className={`flex-row items-center justify-between gap-[12px] ${desktop ? 'flex-wrap' : ''}`}
        >
          <Text className="text-grey text-[12px] font-medium uppercase tracking-[1.5px]">
            {label}
          </Text>
          {navigation}
          <Link
            onPress={() => router.push('/daily-reading')}
            accessibilityLabel={t('dailyReading.change')}
            className="min-h-[44px] justify-center"
          >
            <Text className="text-link font-bold text-[13px]">{t('dailyReading.changeShort')}</Text>
          </Link>
        </Box>
        {verse ? (
          <Link
            onPress={open}
            accessibilityHint={t('dailyReading.meditate')}
            style={{ marginTop: desktop ? 14 : 10 }}
          >
            <Paragraph
              scaleLineHeight={-1}
              style={{
                fontFamily,
                fontWeight: 'normal',
                ...(desktop ? { fontSize: 16, lineHeight: 26 } : {}),
              }}
            >
              {verse.text}
            </Paragraph>
            <Text
              className={
                desktop ? 'text-grey text-[13px] mt-[10px]' : 'text-grey text-[12px] mt-[5px]'
              }
              numberOfLines={2}
            >
              {verse.label} - {version}
            </Text>
          </Link>
        ) : (
          <ActivityIndicator accessibilityLabel={t('Chargement...')} style={{ marginTop: 16 }} />
        )}
      </Box>
      <Box
        className={
          desktop
            ? 'flex-row flex-wrap items-center gap-[12px] mt-auto pt-[12px]'
            : 'overflow-hidden border-continuous flex-row items-center mt-auto'
        }
      >
        <Box className="overflow-hidden border-continuous flex-row items-center justify-center opacity-[0.5]">
          {!addDay && Platform.OS !== 'web' && (
            <Link
              accessibilityLabel={t('Recevoir une notification quotidienne')}
              onPress={() => notificationModalRef.current?.present()}
              size={44}
            >
              <FeatherIcon size={16} name="bell" />
            </Link>
          )}
          {verse && (
            <Link
              accessibilityLabel={t('Partager')}
              size={44}
              onPress={() => {
                void Share.share({ message: `${verse.text}\n${verse.label} (${version})` })
              }}
            >
              <FeatherIcon size={16} name="share-2" />
            </Link>
          )}
          {imageSource && (
            <Link
              accessibilityLabel={t('accessibility.createVerseImage')}
              size={44}
              onPress={() => imageModalRef.current?.present()}
            >
              <FeatherIcon size={16} name="image" />
            </Link>
          )}
        </Box>
        {verse && (
          <Link
            onPress={open}
            className="flex-1 flex-row items-center justify-end gap-[6px] ml-[12px] min-h-[44px]"
          >
            <Text className="text-link font-bold text-[13px]">{t('dailyReading.meditate')}</Text>
            <FeatherIcon size={14} name="chevron-right" className="text-link" />
          </Link>
        )}
        {footer}
      </Box>
      {sheets}
    </Box>
  )
}

/** The verse in the shape the image of the verse reads (its first verse locates it). */
const toImageSource = (
  ref: string,
  verse: VerseCard | undefined,
  version: string
): VerseOfTheDayData | undefined => {
  const [first] = getVerseKeys(ref)
  if (!verse || !first) return undefined
  const [book, chapter, verseNumber] = first.split('-').map(Number)
  return {
    v: ref,
    book,
    chapter,
    verse: verseNumber,
    title: verse.label,
    version,
    content: verse.text,
    all: `${verse.text}\n${verse.label} (${version})`,
  }
}

export default VerseMeditationCard
