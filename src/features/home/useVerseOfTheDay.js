import * as Sentry from '@sentry/react-native'
import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Platform } from 'react-native'
// import { Notifications } from 'react-native-notifications'
import compose from 'recompose/compose'
import addDays from 'date-fns/fp/addDays'
import setHours from 'date-fns/fp/setHours'
import setMinutes from 'date-fns/fp/setMinutes'
import Snackbar from '~common/SnackBar'
import { setNotificationId } from '~redux/modules/user'

import useLogin from '~helpers/useLogin'
import VOD from '~assets/bible_versions/bible-vod'
import booksDesc2 from '~assets/bible_versions/books-desc-2'
import getVersesRef from '~helpers/getVersesRef'
import { getDayOfTheYear } from './getDayOfTheYear'

export const useVerseOfTheDay = () => {
  const { user } = useLogin()
  const dispatch = useDispatch()
  const [verseOfTheDay, setVOD] = useState(false)
  const version = useSelector(state => state.bible.selectedVersion)
  const verseOfTheDayTime = useSelector(
    state => state.user.notifications.verseOfTheDay
  )
  const notificationId = useSelector(
    state => state.user.notifications.notificationId
  )

  useEffect(() => {
    const dayOfTheYear =
      getDayOfTheYear() + 1 < 1 || getDayOfTheYear() + 1 > 366
        ? 1
        : getDayOfTheYear() + 1
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
        setVOD({ error: true })
      }
    }
    loadVerse()
  }, [version])

  // useEffect(() => {
  //   const scheduleNotification = async () => {
  //     try {
  //       if (notificationId)
  //         await Notifications.cancelLocalNotification(notificationId)

  //       if (!verseOfTheDayTime) {
  //         console.log(
  //           "User is not logged or there is not verse of the day timeset, don't do anything"
  //         )
  //         return
  //       }

  //       const [vodHours, vodMinutes] = verseOfTheDayTime
  //         .split(':')
  //         .map(n => Number(n))
  //       const nowDate = new Date(Date.now())
  //       const nowHour = nowDate.getHours()
  //       const nowMinutes = nowDate.getMinutes()

  //       nowDate.setMinutes(0, 0)
  //       const addDay =
  //         nowHour * 60 * 60 * 1000 + nowMinutes * 60 * 1000 >
  //         vodHours * 60 * 60 * 1000 + vodMinutes * 60 * 1000
  //           ? 1
  //           : 0

  //       const date = compose(
  //         setMinutes(vodMinutes),
  //         setHours(vodHours),
  //         addDays(addDay)
  //       )(nowDate)

  //       const notification = Notifications.postLocalNotification({
  //         title: `Bonjour ${
  //           user.displayName ? user.displayName.split(' ')[0] : ''
  //         }`, // @TODO: Extract to function
  //         body: 'Découvre ton verset du jour !',
  //         category: 'NOTIFICATIONS',
  //         fireDate: date.getTime()
  //       })

  //       console.log(
  //         `Notification ${notification} set at ${verseOfTheDayTime} on ${date}`
  //       )
  //       dispatch(setNotificationId(notification))
  //     } catch (e) {
  //       Snackbar.show('Erreur de notification.')
  //       console.log(e)
  //       Sentry.captureException(e)
  //     }
  //   }
  //   // const initNotifications = async () => {
  //   //   const hasPermissions = await Notifications.isRegisteredForRemoteNotifications()

  //   //   if (hasPermissions) {
  //   //     scheduleNotification()
  //   //   }
  //   // }
  //   // initNotifications()
  // }, [dispatch, notificationId, user.displayName, verseOfTheDayTime])
  return verseOfTheDay
}
