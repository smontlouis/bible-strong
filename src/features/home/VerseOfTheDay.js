import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Share } from 'react-native'
import DateTimePicker from 'react-native-modal-datetime-picker'
import { Placeholder, PlaceholderLine, Fade } from 'rn-placeholder'
import * as Animatable from 'react-native-animatable'

import SnackBar from '~common/SnackBar'
import { setNotificationVOD } from '~redux/modules/user'
import { zeroFill } from '~helpers/zeroFill'
import LexiqueIcon from '~common/LexiqueIcon'
import { FeatherIcon } from '~common/ui/Icon'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import Empty from '~common/Empty'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import { smallSize, removeBreakLines } from '~helpers/utils'
import ShowMoreImage from './ShowMoreImage'
import { useImageUrls } from './useImageUrls'
import { useVerseOfTheDay } from './useVerseOfTheDay'

const AnimatableBox = Animatable.createAnimatableComponent(Box)

const VerseOfTheDay = () => {
  const [timerPickerOpen, setTimePicker] = useState(false)
  const verseOfTheDay = useVerseOfTheDay()
  const imageUrls = useImageUrls(verseOfTheDay)
  const dispatch = useDispatch()
  const [open, setOpen] = useState(false)
  const verseOfTheDayTime = useSelector(
    state => state.user.notifications.verseOfTheDay
  )

  const [initialHour, initialMinutes] = verseOfTheDayTime
    .split(':')
    .map(n => Number(n))
  const initialDate = new Date(1, 1, 1, initialHour, initialMinutes)

  const onConfirmTimePicker = date => {
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
        >
          <Text marginTop={10} color="grey" fontSize={14} lineHeight={20}>
            {removeBreakLines(content)}
          </Text>
        </Link>
        <Box row alignItems="center">
          {/* <Text flex color="grey" fontSize={smallSize ? 12 : 14}>
            {title} - {version}
          </Text> */}
          <Box row center mt={5} opacity={0.5}>
            <Link onPress={openTimePicker} size={30}>
              <FeatherIcon size={16} name="bell" />
            </Link>
            <Link size={30} onPress={shareVerse}>
              <FeatherIcon size={16} name="share-2" />
            </Link>
            <Link size={30} onPress={() => setOpen(s => !s)}>
              <FeatherIcon size={16} name="image" />
            </Link>
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
    </Box>
  )
}

export default VerseOfTheDay
