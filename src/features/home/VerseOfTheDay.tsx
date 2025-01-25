import { useTheme } from '@emotion/react'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { Portal } from '@gorhom/portal'
import React, { memo, useRef, useState } from 'react'
import { TFunction, useTranslation } from 'react-i18next'
import { Share } from 'react-native'
import * as Animatable from 'react-native-animatable'
import DateTimePicker from 'react-native-modal-datetime-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import { Fade, Placeholder, PlaceholderLine } from 'rn-placeholder'
import Empty from '~common/Empty'
import Link, { LinkBox } from '~common/Link'
import SnackBar from '~common/SnackBar'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Switch from '~common/ui/Switch'
import Text from '~common/ui/Text'
import {
  renderBackdrop,
  useBottomSheetStyles,
} from '~helpers/bottomSheetHelpers'
import { removeBreakLines } from '~helpers/utils'
import { zeroFill } from '~helpers/zeroFill'
import { RootState } from '~redux/modules/reducer'
import { setNotificationVOD } from '~redux/modules/user'
import ShowMoreImage from './ShowMoreImage'
import { useImageUrls } from './useImageUrls'
import { useVerseOfTheDay } from './useVerseOfTheDay'

const AnimatableBox = Animatable.createAnimatableComponent(Box)

interface Props {
  addDay: number
  isFirst: boolean
  isLast: boolean
  currentVOD: boolean
  setCurrentVOD: React.Dispatch<React.SetStateAction<number>>
}

const dayToAgo = (day: number, t: TFunction<'translation'>) => {
  switch (day) {
    case -1:
      return t('Hier')
    case -2:
      return t('Il y a deux jours')
    case -3:
      return t('Il y a trois jours')
    case -4:
      return t('Il y a quatre jours')
    case -5:
      return t('Il y a cinq jours')
    default:
      return undefined
  }
}

const VerseOfTheDay = ({
  addDay,
  isFirst,
  isLast,
  currentVOD,
  setCurrentVOD,
}: Props) => {
  const { t } = useTranslation()
  const [timerPickerOpen, setTimePicker] = useState(false)
  const verseOfTheDay = useVerseOfTheDay(addDay)
  const imageUrls = useImageUrls(verseOfTheDay)
  const dispatch = useDispatch()
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const verseOfTheDayTime = useSelector(
    (state: RootState) => state.user.notifications.verseOfTheDay
  )
  const insets = useSafeAreaInsets()
  const { current: ago } = useRef(dayToAgo(addDay, t))
  const notificationModalRef = React.useRef<BottomSheet>(null)

  const [initialHour, initialMinutes] = verseOfTheDayTime
    .split(':')
    .map(n => Number(n))

  const initialDate = new Date()
  initialDate.setHours(initialHour || 0, initialMinutes || 0, 0, 0)

  const onConfirmTimePicker = (date: Date) => {
    setTimePicker(false)
    const dateObject = new Date(date)
    const hours = zeroFill(dateObject.getHours())
    const minutes = zeroFill(dateObject.getMinutes())

    dispatch(setNotificationVOD(`${hours}:${minutes}`))
    SnackBar.show(
      `Le verset du jour sera envoyé chaque jour à ${hours}:${minutes}.`
    )
  }

  const openTimePicker = () => {
    setTimePicker(true)
  }

  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  if (!currentVOD) {
    return null
  }

  if (!verseOfTheDay) {
    return (
      <Box>
        <Box marginTop={10}>
          <Placeholder Animation={Fade}>
            <PlaceholderLine width={80} style={{ marginTop: 5 }} />
            <PlaceholderLine style={{ marginTop: 2 }} />
            <PlaceholderLine width={30} style={{ marginTop: 3 }} />
          </Placeholder>
        </Box>
      </Box>
    )
  }

  if (verseOfTheDay.error) {
    return (
      <Empty
        source={require('~assets/images/empty.json')}
        message="Impossible de charger le verset du jour..."
      />
    )
  }

  const { title, version, content, all, book, chapter, verse } = verseOfTheDay
  const shareVerse = () => {
    Share.share({ message: all })
  }

  return (
    <Box>
      <AnimatableBox animation="fadeIn">
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
          {ago && (
            <Text color="grey" fontSize={10}>
              {ago}
            </Text>
          )}
          <Text color="grey" fontSize={14} lineHeight={20}>
            {removeBreakLines(content)}
          </Text>
        </Link>
        <Box row alignItems="center">
          <Box row center mt={5} opacity={0.5}>
            {!addDay && (
              <Link
                onPress={() => notificationModalRef.current?.expand()}
                size={30}
              >
                <FeatherIcon size={16} name="bell" />
              </Link>
            )}
            <Link size={30} onPress={shareVerse}>
              <FeatherIcon size={16} name="share-2" />
            </Link>
            <Link size={30} onPress={() => setOpen(s => !s)}>
              <FeatherIcon size={16} name="image" />
            </Link>
            {!isLast && (
              <Link size={30} onPress={() => setCurrentVOD(s => s - 1)}>
                <FeatherIcon size={16} name="chevron-left" />
              </Link>
            )}
            {!isFirst && (
              <Link size={30} onPress={() => setCurrentVOD(s => s + 1)}>
                <FeatherIcon size={16} name="chevron-right" />
              </Link>
            )}
          </Box>
        </Box>
      </AnimatableBox>
      <ShowMoreImage
        imageUrls={imageUrls}
        verseOfTheDay={verseOfTheDay}
        open={open}
        setOpen={setOpen}
      />
      <DateTimePicker
        date={initialDate}
        mode="time"
        locale="en_GB"
        isVisible={timerPickerOpen}
        onConfirm={onConfirmTimePicker}
        onCancel={() => setTimePicker(false)}
      />
      <Portal>
        <BottomSheet
          ref={notificationModalRef}
          index={-1}
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
                <LinkBox
                  row
                  alignItems="center"
                  mt={10}
                  onPress={openTimePicker}
                >
                  <Text>{t("Choisir l'heure")}:</Text>
                  <Text bold> {verseOfTheDayTime}</Text>
                  <Box ml={5}>
                    <FeatherIcon name="chevron-down" />
                  </Box>
                </LinkBox>
              )}
            </Box>
          </BottomSheetScrollView>
        </BottomSheet>
      </Portal>
    </Box>
  )
}

export default memo(VerseOfTheDay)
