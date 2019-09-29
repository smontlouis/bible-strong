import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import Sentry from 'sentry-expo'
import { Share } from 'react-native'
import * as Permissions from 'expo-permissions'
import { Placeholder, PlaceholderLine, Fade } from 'rn-placeholder'
import { Notifications } from 'expo'
import addDays from 'date-fns/addDays'
import setHours from 'date-fns/setHours'

import LexiqueIcon from '~common/LexiqueIcon'
import { FeatherIcon } from '~common/ui/Icon'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import Empty from '~common/Empty'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import VOD from '~assets/bible_versions/bible-vod'
import booksDesc2 from '~assets/bible_versions/books-desc-2'
import getVersesRef from '~helpers/getVersesRef'
import ShowMoreImage from './ShowMoreImage'

const getDayOfTheYear = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now - start + (start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000
  const oneDay = 1000 * 60 * 60 * 24
  const day = Math.floor(diff / oneDay)
  return day
}

const useVerseOfTheDay = () => {
  const [verseOfTheDay, setVOD] = useState(false)
  const version = useSelector(state => state.bible.selectedVersion)

  useEffect(() => {
    const dayOfTheYear =
      getDayOfTheYear() + 1 < 1 || getDayOfTheYear() + 1 > 366 ? 1 : getDayOfTheYear() + 1

    const loadVerse = async () => {
      try {
        const [bookName, chapter, verse] = VOD[dayOfTheYear].split('.')
        const book = booksDesc2.find(b => b[1] === bookName)[0]
        const vod = await getVersesRef(`${book}-${chapter}-${verse}`, version)
        setVOD({
          v: VOD[dayOfTheYear],
          book: Number(book),
          chapter: Number(chapter),
          verse: Number(verse),
          ...vod
        })
      } catch (e) {
        Sentry.captureMessage('Error in verse of the day', {
          extra: {
            error: e.toString(),
            doy: dayOfTheYear
          }
        })
        setVOD({ error: true })
      }
    }
    loadVerse()
  }, [version])

  useEffect(() => {
    const askPermissions = async () => {
      const { status: existingStatus } = await Permissions.getAsync(Permissions.NOTIFICATIONS)
      let finalStatus = existingStatus
      if (existingStatus !== 'granted') {
        const { status } = await Permissions.askAsync(Permissions.NOTIFICATIONS)
        finalStatus = status
      }
      if (finalStatus !== 'granted') {
        return false
      }
      return true
    }

    const scheduleNotification = async () => {
      const vodHour = 7
      const nowDate = new Date(Date.now())
      const nowHour = nowDate.getHours()

      nowDate.setMinutes(0, 0)

      const addDay = nowHour > vodHour ? 1 : 0
      const date = addDays(setHours(nowDate, vodHour), addDay)

      const notificationId = Notifications.scheduleLocalNotificationAsync(
        {
          title: 'Verset du jour',
          body: 'Wow, I can show up even when app is closed',
          ios: {
            sound: true
          },
          android: {
            sound: true
          }
        },
        {
          time: new Date().getTime() + 20000
        }
      )
      console.log(notificationId)
    }

    const initNotifications = async () => {
      const canSendNotification = await askPermissions()

      Notifications.addListener(a => {
        console.log('notifications launched', a)
      })

      if (canSendNotification) {
        scheduleNotification()
      }
    }

    initNotifications()
  }, [])

  return verseOfTheDay
}

const useImageUrls = verseOfTheDay => {
  const [imageUrls, setImageUrls] = useState(null)

  useEffect(() => {
    const loadImageUrls = async () => {
      try {
        const imageRes = await fetch(
          `https://nodejs.bible.com/api/images/items/3.1?page=1&category=prerendered&usfm%5B0%5D=${verseOfTheDay.v}&language_tag=fr`
        )
        const imageJSON = await imageRes.json()

        setImageUrls({
          small: `https:${imageJSON.images[imageJSON.images.length - 1].renditions[0].url}`,
          large: `https:${imageJSON.images[imageJSON.images.length - 1].renditions[2].url}`
        })
      } catch (e) {
        setImageUrls({
          error: true
        })
      }
    }

    if (verseOfTheDay.v) {
      loadImageUrls()
    }
  }, [verseOfTheDay.v])

  return imageUrls
}

const VerseOfTheDay = () => {
  const verseOfTheDay = useVerseOfTheDay()
  const imageUrls = useImageUrls(verseOfTheDay)

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
        <Box row>
          <Text title fontSize={30} flex>
            Verset du jour
          </Text>
          <Link padding onPress={shareVerse}>
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
    </>
  )
}

export default VerseOfTheDay
