import { useRef, useState } from 'react'
import { Image } from 'expo-image'
import { useFireStorage } from '~features/plans/plan.hooks'
import MeditationContent from './MeditationContent'
import { type SheetRef } from '~common/sheet'
import ParamsModal from '~features/plans/PlanSliceScreen/ParamsModal'
import ReadingDatePicker from './ReadingDatePicker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, Platform, ScrollView, Share } from 'react-native'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import ContextualMenu from '~common/ContextualPanel/ContextualMenu'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { READING_TEXT_MAX_WIDTH } from '~common/readingLayout'
import { getMeditationTitle, toCivilDate, isCivilDate } from '~features/plans/readingCalendar'
import { useReadingContent, useLocalReadingDate } from './useDailyMeditation'
import { resolveMeditationReading } from './resolveMeditationReading'

interface MeditationReaderProps {
  collectionId: string
  readingId?: string
  date?: string
  onBack?: () => void
  onBrowse?: () => void
  onDateChange?: (date: string) => void
}

export const MeditationReader = ({
  collectionId,
  readingId,
  date: requestedDate,
  onBack,
  onBrowse,
  onDateChange,
}: MeditationReaderProps) => {
  const today = useLocalReadingDate()
  const { collection, isError, retry } = useReadingContent(collectionId)
  const resolved = collection
    ? resolveMeditationReading(collection, readingId, requestedDate, today)
    : undefined
  const [availableWidth, setAvailableWidth] = useState(0)
  const isWeb = Platform.OS === 'web'
  const wide = isWeb && availableWidth >= 860
  const cover = useFireStorage(collection?.image)
  const reading = resolved?.reading
  const date =
    resolved?.date ??
    (!readingId ? (requestedDate && isCivilDate(requestedDate) ? requestedDate : today) : undefined)
  const { t } = useTranslation()
  const router = useRouter()
  const paramsSheet = useRef<SheetRef>(null)
  const changeDate = (next: string) => {
    if (onDateChange) onDateChange(next)
    else router.setParams({ date: next, readingId: undefined })
  }
  const move = (offset: number) => {
    if (!date) return
    const current = new Date(`${date}T12:00:00`)
    current.setDate(current.getDate() + offset)
    changeDate(toCivilDate(current))
  }
  const browseCollection =
    onBrowse ??
    (() => router.push({ pathname: '/meditation-collection', params: { collectionId } }))
  const shareReading = () => {
    if (!reading) return
    void Share.share({
      message: [
        getMeditationTitle(reading),
        ...reading.slices.flatMap(slice => (slice.type === 'Text' ? [slice.description] : [])),
        collection?.title,
      ]
        .filter(Boolean)
        .join('\n\n'),
    })
  }
  return (
    <Container>
      <Header
        maxWidth={940}
        hasBackButton
        onCustomBackPress={onBack}
        title={reading ? getMeditationTitle(reading) : t('dailyReading.meditationHeading')}
        rightComponent={
          <ContextualMenu
            panelTitle={t('dailyReading.meditationHeading') ?? ''}
            accessibilityLabel={t('accessibility.options')}
            icons={{ format: 'type', share: 'share-2', collection: 'book-open' }}
            screens={{
              format: { title: t('Mise en forme'), content: () => <ParamsModal inline /> },
            }}
            actions={[
              { id: 'format', title: t('Mise en forme'), image: 'textformat' },
              {
                id: 'share',
                title: t('Partager'),
                image: 'square.and.arrow.up',
                attributes: { disabled: !reading },
              },
              {
                id: 'collection',
                title: t('dailyReading.browseCollection'),
                image: 'book',
                attributes: { disabled: !collection },
              },
            ]}
            onPressAction={({ nativeEvent }) => {
              if (nativeEvent.event === 'format') paramsSheet.current?.present()
              if (nativeEvent.event === 'share') shareReading()
              if (nativeEvent.event === 'collection') browseCollection()
            }}
          >
            <Box className="w-[54px] h-[54px] items-center justify-center">
              <FeatherIcon name="more-vertical" size={18} />
            </Box>
          </ContextualMenu>
        }
      />
      <ScrollView
        key={`${collectionId}:${reading?.id ?? date ?? readingId}`}
        onLayout={event => setAvailableWidth(event.nativeEvent.layout.width)}
        contentContainerStyle={{
          width: '100%',
          maxWidth: wide ? 940 : READING_TEXT_MAX_WIDTH + 40,
          alignSelf: 'center',
          padding: wide ? 32 : 20,
          paddingBottom: 64,
        }}
      >
        <Box className={wide ? 'flex-row items-start gap-[40px]' : 'gap-[28px]'}>
          <Box
            className={
              wide ? 'w-[176px] shrink-0 border-r border-border pr-[24px] gap-[24px]' : 'gap-[20px]'
            }
          >
            {isWeb && (
              <Link
                onPress={
                  onBrowse ??
                  (() =>
                    router.push({ pathname: '/meditation-collection', params: { collectionId } }))
                }
                accessibilityLabel={collection?.title ?? t('dailyReading.collection')}
                accessibilityHint={t('dailyReading.browseCollection')}
                className={wide ? 'gap-[16px]' : 'flex-row items-center gap-[12px]'}
              >
                {cover && (
                  <Image
                    source={{ uri: cover }}
                    contentFit="cover"
                    style={{
                      width: wide ? 144 : 40,
                      height: wide ? 144 : 40,
                      borderRadius: wide ? 12 : 8,
                    }}
                  />
                )}
                <Box className="min-h-[44px] flex-row items-center gap-[8px] flex-1">
                  <Text className="text-primary text-[14px] flex-1">
                    {collection?.title ?? t('dailyReading.collection')}
                  </Text>
                  <FeatherIcon name="chevron-right" size={18} color="primary" />
                </Box>
              </Link>
            )}
            {date && (
              <Box
                className={
                  wide
                    ? 'border-t border-border pt-[20px] gap-[12px]'
                    : isWeb
                      ? 'flex-row items-center justify-between border-t border-border pt-[16px]'
                      : 'flex-row items-center justify-between'
                }
              >
                {!wide && (
                  <Link
                    size={36}
                    hitSlop={4}
                    className="bg-light-grey rounded-[18px]"
                    accessibilityLabel={t('dailyReading.previous')}
                    onPress={() => move(-1)}
                  >
                    <FeatherIcon name="chevron-left" size={20} color="primary" />
                  </Link>
                )}
                <Box className={wide ? '' : 'flex-1 mx-[12px]'}>
                  <ReadingDatePicker
                    variant="pill"
                    value={date}
                    label={t('dailyReading.chooseDate')}
                    onChange={changeDate}
                  />
                </Box>
                {wide ? (
                  <Box className="flex-row items-center justify-between">
                    <Link
                      size={36}
                      hitSlop={4}
                      accessibilityLabel={t('dailyReading.previous')}
                      onPress={() => move(-1)}
                      className="bg-light-grey rounded-[18px]"
                    >
                      <FeatherIcon name="chevron-left" size={20} color="primary" />
                    </Link>
                    <Link
                      size={36}
                      hitSlop={4}
                      accessibilityLabel={t('dailyReading.next')}
                      onPress={() => move(1)}
                      className="bg-light-grey rounded-[18px]"
                    >
                      <FeatherIcon name="chevron-right" size={20} color="primary" />
                    </Link>
                  </Box>
                ) : (
                  <Link
                    size={36}
                    hitSlop={4}
                    className="bg-light-grey rounded-[18px]"
                    accessibilityLabel={t('dailyReading.next')}
                    onPress={() => move(1)}
                  >
                    <FeatherIcon name="chevron-right" size={20} color="primary" />
                  </Link>
                )}
              </Box>
            )}
            {!date && reading && (
              <Text className="text-grey text-[13px]">{t('dailyReading.additionalReadings')}</Text>
            )}
          </Box>
          <Box className="flex-1 min-w-0" style={{ maxWidth: READING_TEXT_MAX_WIDTH }}>
            {reading && collection && (
              <MeditationContent reading={reading} language={collection.lang} wide={wide} />
            )}
            {isError && (
              <Button
                onPress={() => {
                  void retry()
                }}
              >
                {t('dailyReading.retry')}
              </Button>
            )}
            {!collection && !isError && (
              <ActivityIndicator accessibilityLabel={t('Chargement...')} />
            )}
            {collection && !reading && (
              <Text className="text-grey">{t('dailyReading.noEntry')}</Text>
            )}
          </Box>
        </Box>
      </ScrollView>
      <ParamsModal paramsModalRef={paramsSheet} />
    </Container>
  )
}

const MeditationScreen = () => {
  const {
    collectionId = '',
    readingId,
    date,
  } = useLocalSearchParams<{ collectionId?: string; readingId?: string; date?: string }>()
  return <MeditationReader collectionId={collectionId} readingId={readingId} date={date} />
}
export default MeditationScreen
