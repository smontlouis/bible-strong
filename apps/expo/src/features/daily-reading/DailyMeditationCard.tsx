import { useRef } from 'react'
import { Image } from 'expo-image'
import { useDispatch, useSelector } from 'react-redux'
import { useFireStorage } from '~features/plans/plan.hooks'
import { SheetView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ModalSheet'
import ReminderSettings from './ReminderSettings'
import { setNotificationVOD } from '~redux/modules/user'
import type { RootState } from '~redux/modules/reducer'
import { selectFontFamily } from '~redux/selectors/user'
import { resolveFontFamily } from '~themes/styleValues'
import { useRouter } from 'expo-router'
import { ActivityIndicator, Platform, Share, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import { FeatherIcon } from '~common/ui/Icon'
import { useDailyMeditation, useLocalReadingDate } from './useDailyMeditation'

export interface DailyMeditationCardProps {
  onFallback?: () => void
  collectionId: string
  addDay: number
  desktop?: boolean
  navigation?: React.ReactNode
  footer?: React.ReactNode
  style?: ViewStyle
}

const DailyMeditationCard = ({
  collectionId,
  onFallback,
  addDay,
  desktop,
  navigation,
  footer,
  style,
}: DailyMeditationCardProps) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const notificationModalRef = useRef<SheetRef>(null)
  const reminderTime = useSelector((state: RootState) => state.user.notifications.verseOfTheDay)
  const router = useRouter()
  const fontFamily = resolveFontFamily(useSelector(selectFontFamily))
  const date = useLocalReadingDate(addDay)
  const { collection, opening, lookup, isError, isOffline, retry } = useDailyMeditation(
    collectionId,
    date
  )
  const cover = useFireStorage(collection?.image)
  const dayLabels = [
    "Aujourd'hui",
    'Hier',
    'Il y a deux jours',
    'Il y a trois jours',
    'Il y a quatre jours',
  ]
  const open = () => router.push({ pathname: '/meditation', params: { collectionId, date } })
  return (
    <Box
      className={
        desktop
          ? 'flex-1 p-[24px] pb-[12px]'
          : 'overflow-hidden border-continuous px-[20px] rounded-[30px] bg-reverse py-[20px]'
      }
      style={desktop ? style : { height: 280 }}
    >
      <Box
        dataSet={desktop ? { 'home-verse-header': '' } : undefined}
        className="flex-row items-center justify-between gap-[12px]"
      >
        <Text
          className={
            desktop
              ? 'text-primary font-bold text-[12px] uppercase tracking-[1.5px]'
              : 'text-grey font-bold text-[14px]'
          }
        >
          {dayLabels[-addDay] ? t(dayLabels[-addDay]) : date}
        </Text>
        {navigation}
        <Link
          onPress={() => router.push('/daily-reading')}
          size={44}
          accessibilityLabel={t('dailyReading.change')}
        >
          <FeatherIcon name="sliders" size={18} color="grey" />
        </Link>
      </Box>
      {opening ? (
        <Link
          onPress={open}
          accessibilityLabel={opening.text}
          accessibilityHint={t('dailyReading.read')}
          style={{ marginTop: desktop ? 22 : 10 }}
        >
          <Paragraph
            numberOfLines={desktop ? undefined : 3}
            scaleLineHeight={-1}
            style={{
              fontFamily,
              fontWeight: 'normal',
              ...(desktop ? { fontSize: 23, lineHeight: 34, maxWidth: 600 } : {}),
            }}
          >
            {opening.quote.replace(/\n+/g, ' ')}
          </Paragraph>
          {opening.reference && (
            <Text
              numberOfLines={2}
              className={
                desktop ? 'text-grey text-[14px] mt-[16px]' : 'text-grey text-[12px] mt-[5px]'
              }
            >
              {opening.reference}
            </Text>
          )}
        </Link>
      ) : isError ? (
        <Link
          onPress={() => {
            void retry()
          }}
          className="py-[12px]"
        >
          <Text className="text-grey">
            {isOffline ? t('dailyReading.offlineContent') : t('dailyReading.downloadError')}
          </Text>
          <Text className="text-primary mt-[8px]">{t('dailyReading.retry')}</Text>
        </Link>
      ) : lookup ? (
        <Box className="gap-[8px] mt-[12px]">
          <Text className="text-grey">{t('dailyReading.noEntry')}</Text>
          {onFallback && (
            <Link onPress={onFallback} className="py-[12px]">
              <Text className="text-primary font-bold">{t('dailyReading.fallback')}</Text>
            </Link>
          )}
        </Box>
      ) : (
        <ActivityIndicator accessibilityLabel={t('Chargement...')} />
      )}
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
              size={44}
              accessibilityLabel={t('Recevoir une notification quotidienne')}
              onPress={() => notificationModalRef.current?.present()}
            >
              <FeatherIcon name="bell" size={16} />
            </Link>
          )}
          {opening && (
            <Link
              size={44}
              accessibilityLabel={t('Partager')}
              onPress={() => {
                void Share.share({ message: `${opening.text}\n${collection?.title ?? ''}` })
              }}
            >
              <FeatherIcon name="share-2" size={16} />
            </Link>
          )}
        </Box>
        {opening && (
          <Link
            onPress={() =>
              router.push({ pathname: '/meditation-collection', params: { collectionId } })
            }
            accessibilityLabel={collection?.title ?? t('dailyReading.collection')}
            accessibilityHint={t('dailyReading.browseCollection')}
            className="flex-1 flex-row items-center justify-end gap-[6px] ml-[12px] min-h-[44px]"
          >
            {cover && (
              <Image
                source={{ uri: cover }}
                contentFit="cover"
                style={{ width: 24, height: 24, borderRadius: 5 }}
                accessibilityIgnoresInvertColors
              />
            )}
            {desktop && (
              <Text
                numberOfLines={1}
                className="text-grey text-[11px] shrink max-w-[220px] opacity-[0.6]"
              >
                {collection?.title}
              </Text>
            )}
          </Link>
        )}
        {footer}
      </Box>
      <Sheet modalTitle={t('Recevoir une notification quotidienne')} ref={notificationModalRef}>
        <SheetView className="px-[20px] py-[30px]">
          <ReminderSettings
            time={reminderTime}
            onChange={time => dispatch(setNotificationVOD(time ?? ''))}
          />
        </SheetView>
      </Sheet>
    </Box>
  )
}

export default DailyMeditationCard
