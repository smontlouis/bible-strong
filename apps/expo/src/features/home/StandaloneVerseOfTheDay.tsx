import ReminderSettings from '~features/daily-reading/ReminderSettings'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { TFunction, useTranslation } from 'react-i18next'
import { Platform, Share, View, type ViewStyle } from 'react-native'
import { EaseView } from 'react-native-ease'
import { useDispatch, useSelector } from 'react-redux'
import Empty from '~common/Empty'
import Link from '~common/Link'
import { SheetView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ModalSheet'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { removeBreakLines } from '~helpers/utils'
import { RootState } from '~redux/modules/reducer'
import { setNotificationVOD } from '~redux/modules/user'
import VerseImageModal from './VerseImageModal'
import { useImageUrls } from './useImageUrls'
import { useVerseOfTheDay } from './useVerseOfTheDay'
import { resolveFontFamily } from '~themes/styleValues'
import { selectFontFamily } from '~redux/selectors/user'
export const VERSE_CARD_HEIGHT = 280

export interface VerseCardProps {
  addDay: number
  desktop?: boolean
  navigation?: React.ReactNode
  footer?: React.ReactNode
  style?: ViewStyle
}

const dayToAgo = (day: number, t: TFunction<'translation'>) => {
  switch (day) {
    case 0:
      return t("Aujourd'hui")
    case -1:
      return t('Hier')
    case -2:
      return t('Il y a deux jours')
    case -3:
      return t('Il y a trois jours')
    case -4:
      return t('Il y a quatre jours')
    default:
      return undefined
  }
}

const SkeletonLines = () => {
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setPulse(p => !p), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <EaseView
      animate={{ opacity: pulse ? 0.4 : 1 }}
      transition={{
        type: 'timing',
        duration: 800,
        easing: [0.455, 0.03, 0.515, 0.955],
      }}
    >
      <View
        style={{
          height: 12,
          borderRadius: 4,
          backgroundColor: '#E0E0E0',
          width: '80%',
          marginTop: 5,
        }}
      />
      <View
        style={{
          height: 12,
          borderRadius: 4,
          backgroundColor: '#E0E0E0',
          width: '100%',
          marginTop: 8,
        }}
      />
      <View
        style={{
          height: 12,
          borderRadius: 4,
          backgroundColor: '#E0E0E0',
          width: '30%',
          marginTop: 8,
        }}
      />
    </EaseView>
  )
}

const StandaloneVerseOfTheDay = ({
  addDay,
  desktop = false,
  navigation,
  footer,
  style,
}: VerseCardProps) => {
  const { t } = useTranslation()
  const router = useRouter()
  const bibleFont = useSelector(selectFontFamily)
  const verseOfTheDay = useVerseOfTheDay(addDay)
  const imageUrls = useImageUrls(verseOfTheDay)
  const dispatch = useDispatch()
  const imageModalRef = React.useRef<SheetRef>(null)
  const verseOfTheDayTime = useSelector(
    (state: RootState) => state.user.notifications.verseOfTheDay
  )
  const ago = dayToAgo(addDay, t)
  const notificationModalRef = React.useRef<SheetRef>(null)
  const cardClassName = desktop
    ? 'flex-1 p-[24px] pb-[12px]'
    : 'overflow-hidden border-continuous px-[20px] rounded-[30px] bg-reverse py-[20px]'
  const cardStyle = desktop ? style : { height: VERSE_CARD_HEIGHT }
  const dayHeader = (
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
        {ago}
      </Text>
      {navigation}
      <Link
        size={44}
        onPress={() => router.push('/daily-reading')}
        accessibilityLabel={t('dailyReading.change')}
      >
        <FeatherIcon name="sliders" size={18} color="grey" />
      </Link>
    </Box>
  )

  if (!verseOfTheDay) {
    return (
      <Box className={cardClassName} style={cardStyle}>
        {dayHeader}
        <Box className="overflow-hidden border-continuous mt-[10px]">
          <SkeletonLines />
        </Box>
        {desktop && <Box className="mt-auto pt-[12px] items-start">{footer}</Box>}
      </Box>
    )
  }

  if (verseOfTheDay && 'error' in verseOfTheDay) {
    return (
      <Box className={cardClassName} style={cardStyle}>
        {dayHeader}
        <Empty message="Impossible de charger le verset du jour..." />
        {desktop && <Box className="mt-auto pt-[12px] items-start">{footer}</Box>}
      </Box>
    )
  }

  const { version, content, all, book, chapter, verse, title } = verseOfTheDay
  const shareVerse = () => {
    Share.share({ message: all })
  }

  return (
    <Box className={cardClassName} style={cardStyle}>
      {dayHeader}
      <Link
        key={desktop ? `${addDay}:${version}:${title}:${content}` : 'verse'}
        className={desktop ? 'bs-home-verse-fade' : undefined}
        route="BibleView"
        params={{
          contextDisplayMode: 'focused',
          book,
          chapter,
          verse,
          version,
          focusVerses: [verse],
        }}
        style={{ marginTop: desktop ? 22 : 10 }}
      >
        <Paragraph
          numberOfLines={desktop ? undefined : 3}
          scaleLineHeight={-1}
          style={{
            fontFamily: resolveFontFamily(bibleFont),
            fontWeight: 'normal',
            ...(desktop ? { fontSize: 23, lineHeight: 34, maxWidth: 600 } : {}),
          }}
        >
          {removeBreakLines(content)}
        </Paragraph>
        <Text
          className={desktop ? 'text-grey text-[14px] mt-[16px]' : 'text-grey text-[12px] mt-[5px]'}
          numberOfLines={2}
        >
          {title} - {version}
        </Text>
      </Link>
      <Box
        className={
          desktop
            ? 'flex-row flex-wrap items-center gap-[12px] mt-auto pt-[12px]'
            : 'overflow-hidden border-continuous flex-row items-center mt-auto'
        }
      >
        <Box className="overflow-hidden border-continuous flex-row items-center justify-center opacity-[0.5]">
          {!addDay && (
            <Link
              accessibilityLabel={t('Recevoir une notification quotidienne')}
              onPress={() =>
                Platform.OS === 'web'
                  ? router.push('/daily-reading')
                  : notificationModalRef.current?.present()
              }
              size={44}
            >
              <FeatherIcon size={16} name="bell" />
            </Link>
          )}
          <Link accessibilityLabel={t('Partager')} size={44} onPress={shareVerse}>
            <FeatherIcon size={16} name="share-2" />
          </Link>
          <Link
            accessibilityLabel={t('accessibility.createVerseImage')}
            size={44}
            onPress={() => imageModalRef.current?.present()}
          >
            <FeatherIcon size={16} name="image" />
          </Link>
        </Box>
        {footer}
      </Box>
      <VerseImageModal
        modalRef={imageModalRef}
        imageUrls={imageUrls}
        verseOfTheDay={verseOfTheDay}
      />
      <Sheet modalTitle={t('Recevoir une notification quotidienne')} ref={notificationModalRef}>
        <SheetView className="px-[20px] py-[30px]">
          <ReminderSettings
            time={verseOfTheDayTime}
            onChange={time => dispatch(setNotificationVOD(time ?? ''))}
          />
        </SheetView>
      </Sheet>
    </Box>
  )
}

export default StandaloneVerseOfTheDay
