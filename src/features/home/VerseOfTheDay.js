import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Share } from 'react-native'
import DateTimePicker from 'react-native-modal-datetime-picker'
import { Placeholder, PlaceholderLine, Fade } from 'rn-placeholder'

import { setNotificationVOD } from '~redux/modules/user'
import { zeroFill } from '~helpers/zeroFill'
import LexiqueIcon from '~common/LexiqueIcon'
import { FeatherIcon } from '~common/ui/Icon'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import Empty from '~common/Empty'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import ShowMoreImage from './ShowMoreImage'
import { useImageUrls } from './useImageUrls'
import { useVerseOfTheDay } from './useVerseOfTheDay'

const VerseOfTheDay = () => {
  const verseOfTheDay = useVerseOfTheDay()
  const imageUrls = useImageUrls(verseOfTheDay)
  const [timerPickerOpen, setTimePicker] = useState(false)
  const dispatch = useDispatch()
  const verseOfTheDayTime = useSelector(state => state.user.notifications.verseOfTheDay)
  const [initialHour, initialMinutes] = verseOfTheDayTime.split(':').map(n => Number(n))
  const initialDate = new Date(1, 1, 1, initialHour, initialMinutes)

  const onConfirmTimePicker = date => {
    const dateObject = new Date(date)
    const hours = zeroFill(dateObject.getHours())
    const minutes = zeroFill(dateObject.getMinutes())

    dispatch(setNotificationVOD(`${hours}:${minutes}`))
    setTimePicker(false)
  }

  if (!verseOfTheDay) {
    return (
      <Box padding={20}>
        <Text title fontSize={30} flex>
          Verset du jour
        </Text>
        <Box marginTop={20}>
          <Placeholder Animation={Fade}>
            <PlaceholderLine width={80} style={{ marginTop: 10 }} />
            <PlaceholderLine style={{ marginTop: 5 }} />
            <PlaceholderLine style={{ marginTop: 5 }} />
            <PlaceholderLine width={30} style={{ marginTop: 5 }} />
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
    <>
      <Box padding={20}>
        <Box row alignItems="center">
          <Text title fontSize={30} flex>
            Verset du jour
          </Text>
          <Link paddingSmall onPress={() => setTimePicker(true)}>
            <FeatherIcon size={20} name="bell" />
          </Link>
          <Link paddingSmall onPress={shareVerse}>
            <FeatherIcon size={20} name="share-2" />
          </Link>
        </Box>
        <Link route="BibleView" params={{ isReadOnly: true, book, chapter, verse }}>
          <Paragraph marginTop={20}>{content}</Paragraph>
        </Link>
        <Box marginTop={20} row>
          <Box flex>
            <Link
              route="BibleVerseDetail"
              params={{
                verse: {
                  Livre: book,
                  Chapitre: chapter,
                  Verset: verse
                }
              }}>
              <Box row>
                <LexiqueIcon />
                <Text title color="primary" marginLeft={10}>
                  Strong
                </Text>
              </Box>
            </Link>
          </Box>
          <Text titleItalic>
            {title} - {version}
          </Text>
        </Box>
      </Box>
      <ShowMoreImage imageUrls={imageUrls} />
      <DateTimePicker
        date={initialDate}
        mode="time"
        locale="en_GB"
        isVisible={timerPickerOpen}
        onConfirm={onConfirmTimePicker}
        onCancel={() => setTimePicker(false)}
      />
    </>
  )
}

export default VerseOfTheDay
