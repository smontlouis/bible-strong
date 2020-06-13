import React, { useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Share } from 'react-native'
import DateTimePicker from 'react-native-modal-datetime-picker'
import { Placeholder, PlaceholderLine, Fade } from 'rn-placeholder'
import * as Animatable from 'react-native-animatable'
import { Switch } from 'react-native-paper'

import SnackBar from '~common/SnackBar'
import { setNotificationVOD } from '~redux/modules/user'
import { zeroFill } from '~helpers/zeroFill'
import LexiqueIcon from '~common/LexiqueIcon'
import { FeatherIcon } from '~common/ui/Icon'
import Link, { LinkBox } from '~common/Link'
import Text from '~common/ui/Text'
import Empty from '~common/Empty'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import { smallSize, removeBreakLines } from '~helpers/utils'
import ShowMoreImage from './ShowMoreImage'
import { useImageUrls } from './useImageUrls'
import { useVerseOfTheDay } from './useVerseOfTheDay'
import { Modalize } from 'react-native-modalize'
import { RootState } from '~redux/modules/reducer'
import { Portal } from 'react-native-paper'
import { getBottomSpace } from 'react-native-iphone-x-helper'

const AnimatableBox = Animatable.createAnimatableComponent(Box)

interface Props {
  addDay: number
  isFirst: boolean
  isLast: boolean
  currentVOD: boolean
  setCurrentVOD: React.Dispatch<React.SetStateAction<number>>
}

const dayToAgo = (day: number) => {
  switch (day) {
    case -1:
      return 'Hier'
    case -2:
      return 'Il y a deux jours'
    case -3:
      return 'Il y a trois jours'
    case -4:
      return 'Il y a quatre jours'
    case -5:
      return 'Il y a cinq jours'
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
  const [timerPickerOpen, setTimePicker] = useState(false)
  const verseOfTheDay = useVerseOfTheDay(addDay)
  const imageUrls = useImageUrls(verseOfTheDay)
  const dispatch = useDispatch()
  const [open, setOpen] = useState(false)
  const verseOfTheDayTime = useSelector(
    (state: RootState) => state.user.notifications.verseOfTheDay
  )
  const { current: ago } = useRef(dayToAgo(addDay))
  const notificationModalRef = React.useRef<Modalize>(null)

  const [initialHour, initialMinutes] = verseOfTheDayTime
    .split(':')
    .map(n => Number(n))
  const initialDate = new Date(1, 1, 1, initialHour, initialMinutes)

  const onConfirmTimePicker = (date: string) => {
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
                onPress={() => notificationModalRef.current?.open()}
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
        <Modalize
          ref={notificationModalRef}
          modalStyle={{
            marginLeft: 'auto',
            marginRight: 'auto',
            maxWidth: 400,
            width: '100%',
          }}
          adjustToContentHeight
        >
          <Box py={30} px={20} pb={30 + getBottomSpace()}>
            <Box row alignItems="center">
              <Text bold flex>
                Recevoir une notification quotidienne
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
                <Text>Choisir l'heure:</Text>
                <Text bold> {verseOfTheDayTime}</Text>
                <Box ml={5}>
                  <FeatherIcon name="chevron-down" />
                </Box>
              </LinkBox>
            )}
          </Box>
        </Modalize>
      </Portal>
    </Box>
  )
}

export default VerseOfTheDay
