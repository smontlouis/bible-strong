import * as Sentry from 'sentry-expo'
import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Platform } from 'react-native'
import * as Permissions from 'expo-permissions'
import compose from 'recompose/compose'
import { Notifications } from 'expo'
import addDays from 'date-fns/fp/addDays'
import setHours from 'date-fns/fp/setHours'
import setMinutes from 'date-fns/fp/setMinutes'
import VOD from '~assets/bible_versions/bible-vod'
import booksDesc2 from '~assets/bible_versions/books-desc-2'
import getVersesRef from '~helpers/getVersesRef'
import { getDayOfTheYear } from './getDayOfTheYear'

export const useVerseOfTheDay = () => {
  const [verseOfTheDay, setVOD] = useState(false)
  const version = useSelector(state => state.bible.selectedVersion)
  const verseOfTheDayTime = useSelector(state => state.user.notifications.verseOfTheDay)
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
    console.log(verseOfTheDayTime)

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
      try {
        // await Notifications.cancelAllScheduledNotificationsAsync()

        if (!verseOfTheDayTime) {
          return
        }

        if (Platform.OS === 'android') {
          await Notifications.createChannelAndroidAsync('verset-du-jour', {
            name: 'Versets du jour',
            sound: true,
            priority: 'max',
            vibrate: [0, 250, 250, 250]
          })
        }

        const [vodHours, vodMinutes] = verseOfTheDayTime.split(':').map(n => Number(n))
        const nowDate = new Date(Date.now())
        const nowHour = nowDate.getHours()
        const nowMinutes = nowDate.getMinutes()

        nowDate.setMinutes(0, 0)
        const addDay =
          nowHour * 60 * 60 * 1000 + nowMinutes * 60 * 1000 >
          vodHours * 60 * 60 * 1000 + vodMinutes * 60 * 1000
            ? 1
            : 0

        const date = compose(
          setMinutes(vodMinutes),
          setHours(vodHours),
          addDays(addDay)
        )(nowDate)

        console.log('hey')

        await Notifications.presentLocalNotificationAsync({
          title: 'Verset du jour',
          body: 'Bonjour *****, découvre ton verset du jour !'
        })

        console.log('present notif launched')

        const notificationId = await Notifications.scheduleLocalNotificationAsync(
          {
            title: 'Verset du jour',
            body: 'Bonjour *****, découvre ton verset du jour !',
            ios: {
              sound: true
            },
            android: {
              channelId: 'verset-du-jour',
              color: '#0984e3'
            }
          },
          {
            // repeat: 'day',
            time: new Date().getTime() + 10000
          }
        )
        console.log(`Notification ${notificationId} set at ${verseOfTheDayTime} on ${date}`)
      } catch (e) {
        console.log('Erreur', e)
      }
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
  }, [verseOfTheDayTime])
  return verseOfTheDay
}
