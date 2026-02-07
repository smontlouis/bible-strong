import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import React, { useEffect, useRef, useState } from 'react'
import { TFunction, useTranslation } from 'react-i18next'
import { Share, View } from 'react-native'
import DateTimePicker from 'react-native-modal-datetime-picker'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import Empty from '~common/Empty'
import Link, { LinkBox } from '~common/Link'
import { toast } from '~helpers/toast'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Switch from '~common/ui/Switch'
import Text from '~common/ui/Text'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { removeBreakLines } from '~helpers/utils'
import { zeroFill } from '~helpers/zeroFill'
import { RootState } from '~redux/modules/reducer'
import { setNotificationVOD } from '~redux/modules/user'
import VerseImageModal from './VerseImageModal'
import { useImageUrls } from './useImageUrls'
import { useVerseOfTheDay } from './useVerseOfTheDay'
import Paragraph from '~common/ui/Paragraph'

export const VERSE_CARD_HEIGHT = 240

interface Props {
  addDay: number
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
    <Animated.View
      style={{
        opacity: pulse ? 0.4 : 1,
        transitionProperty: 'opacity',
        transitionDuration: 800,
      }}
    >
      <View style={{ height: 12, borderRadius: 4, backgroundColor: '#E0E0E0', width: '80%', marginTop: 5 }} />
      <View style={{ height: 12, borderRadius: 4, backgroundColor: '#E0E0E0', width: '100%', marginTop: 8 }} />
      <View style={{ height: 12, borderRadius: 4, backgroundColor: '#E0E0E0', width: '30%', marginTop: 8 }} />
    </Animated.View>
  )
}

const VerseOfTheDay = ({ addDay }: Props) => {
  const { t } = useTranslation()
  const [timerPickerOpen, setTimePicker] = useState(false)
  const verseOfTheDay = useVerseOfTheDay(addDay)
  const imageUrls = useImageUrls(verseOfTheDay)
  const dispatch = useDispatch()
  const imageModalRef = React.useRef<BottomSheetModal>(null)
  const verseOfTheDayTime = useSelector(
    (state: RootState) => state.user.notifications.verseOfTheDay
  )
  const insets = useSafeAreaInsets()
  const ago = dayToAgo(addDay, t)
  const notificationModalRef = React.useRef<BottomSheetModal>(null)

  const [initialHour, initialMinutes] = verseOfTheDayTime.split(':').map((n: any) => Number(n))

  const initialDate = new Date()
  initialDate.setHours(initialHour || 0, initialMinutes || 0, 0, 0)

  const onConfirmTimePicker = (date: Date) => {
    setTimePicker(false)
    const dateObject = new Date(date)
    const hours = zeroFill(dateObject.getHours())
    const minutes = zeroFill(dateObject.getMinutes())

    dispatch(setNotificationVOD(`${hours}:${minutes}`))
    toast(`Le verset du jour sera envoyé chaque jour à ${hours}:${minutes}.`)
  }

  const openTimePicker = () => {
    setTimePicker(true)
  }

  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  if (!verseOfTheDay) {
    return (
      <Box paddingHorizontal={20} borderRadius={30} bg="reverse" py={20} height={VERSE_CARD_HEIGHT}>
        <Text color="grey" fontWeight="bold" fontSize={14}>
          {ago}
        </Text>
        <Box marginTop={10}>
          <SkeletonLines />
        </Box>
      </Box>
    )
  }

  // @ts-ignore
  if (verseOfTheDay.error) {
    return (
      <Box paddingHorizontal={20} borderRadius={30} bg="reverse" py={20} height={VERSE_CARD_HEIGHT}>
        <Empty
          source={require('~assets/images/empty.json')}
          message="Impossible de charger le verset du jour..."
        />
      </Box>
    )
  }

  const { version, content, all, book, chapter, verse, title } = verseOfTheDay
  const shareVerse = () => {
    Share.share({ message: all })
  }

  return (
    <Box paddingHorizontal={20} borderRadius={30} bg="reverse" py={20} height={VERSE_CARD_HEIGHT}>
      <Text color="grey" fontWeight="bold" fontSize={14}>
        {ago}
      </Text>
      <Link
        route="BibleView"
        params={{
          isReadOnly: true,
          book,
          chapter,
          verse,
          version,
          focusVerses: [verse],
        }}
        style={{ marginTop: 10 }}
      >
        <Paragraph numberOfLines={4} fontWeight="bold" scaleLineHeight={-1}>
          {removeBreakLines(content)}
        </Paragraph>
        <Text color="grey" fontSize={12} mt={5}>
          {title} - {version}
        </Text>
      </Link>
      <Box row alignItems="center" mt="auto">
        <Box row center opacity={0.5}>
          {!addDay && (
            <Link onPress={() => notificationModalRef.current?.present()} size={30}>
              <FeatherIcon size={16} name="bell" />
            </Link>
          )}
          <Link size={30} onPress={shareVerse}>
            <FeatherIcon size={16} name="share-2" />
          </Link>
          <Link size={30} onPress={() => imageModalRef.current?.present()}>
            <FeatherIcon size={16} name="image" />
          </Link>
        </Box>
      </Box>
      <VerseImageModal
        modalRef={imageModalRef}
        imageUrls={imageUrls}
        verseOfTheDay={verseOfTheDay}
      />
      <DateTimePicker
        date={initialDate}
        mode="time"
        locale="en_GB"
        isVisible={timerPickerOpen}
        onConfirm={onConfirmTimePicker}
        onCancel={() => setTimePicker(false)}
      />
      <BottomSheetModal
        ref={notificationModalRef}
        enablePanDownToClose
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        key={key}
        {...bottomSheetStyles}
      >
        <BottomSheetScrollView scrollEnabled={false}>
          <Box py={30} px={20} pb={30 + insets.bottom}>
            <Box row alignItems="center">
              <Text bold flex>
                {t('Recevoir une notification quotidienne')}
              </Text>
              <Switch
                value={!!verseOfTheDayTime}
                onValueChange={() => {
                  if (verseOfTheDayTime) {
                    dispatch(setNotificationVOD(''))
                  } else {
                    dispatch(setNotificationVOD('07:00'))
                  }
                }}
              />
            </Box>
            {!!verseOfTheDayTime && (
              <LinkBox row alignItems="center" mt={10} onPress={openTimePicker}>
                <Text>{t("Choisir l'heure")}:</Text>
                <Text bold> {verseOfTheDayTime}</Text>
                <Box ml={5}>
                  <FeatherIcon name="chevron-down" />
                </Box>
              </LinkBox>
            )}
          </Box>
        </BottomSheetScrollView>
      </BottomSheetModal>
    </Box>
  )
}

export default VerseOfTheDay
