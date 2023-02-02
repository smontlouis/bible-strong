import * as Sentry from '@sentry/react-native'
import { useState, useEffect } from 'react'
import { shallowEqual, useSelector } from 'react-redux'
import PushNotification from 'react-native-push-notification'
import compose from 'recompose/compose'
import addDays from 'date-fns/fp/addDays'
import setHours from 'date-fns/fp/setHours'
import setMinutes from 'date-fns/fp/setMinutes'
import Snackbar from '~common/SnackBar'
import { useTranslation } from 'react-i18next'

import useLogin from '~helpers/useLogin'
import extractFirstName from '~helpers/extractFirstName'
import VOD from '~assets/bible_versions/bible-vod.json'
import booksDesc2 from '~assets/bible_versions/books-desc-2'
import getVersesContent from '~helpers/getVersesContent'
import { getDayOfTheYear } from './getDayOfTheYear'
import { removeBreakLines } from '~helpers/utils'
import i18n from '~i18n'
import { BibleTab, defaultBibleAtom, VersionCode } from '../../state/tabs'
import { useAtom, useAtomValue } from 'jotai/react'
import { selectAtom } from 'jotai/vanilla/utils'
import { RootState } from '~redux/modules/reducer'

const useGetVerseOfTheDay = (version: VersionCode, addDay: number) => {
  const [verseOfTheDay, setVOD] = useState(false)

  useEffect(() => {
    const dayOfTheYear =
      getDayOfTheYear(addDay) + 1 < 1 || getDayOfTheYear(addDay) + 1 > 366
        ? 1
        : getDayOfTheYear(addDay) + 1
    const loadVerse = async () => {
      try {
        const [bookName, chapter, verse] = VOD[dayOfTheYear].split('.')
        const book = booksDesc2.find(b => b[1] === bookName)?.[0]
        const vod = await getVersesContent({
          verses: `${book}-${chapter}-${verse}`,
          version,
        })
        setVOD({
          v: VOD[dayOfTheYear],
          book: Number(book),
          chapter: Number(chapter),
          verse: Number(verse),
          ...vod,
        })
      } catch (e) {
        setVOD({ error: true })
      }
    }
    loadVerse()
  }, [version])

  return verseOfTheDay
}

const selectorVersion = (atom: BibleTab) => atom.data.selectedVersion

export const useVerseOfTheDay = (addDay: number) => {
  const { user } = useLogin()
  const { t } = useTranslation()
  const version = useAtomValue(selectAtom(defaultBibleAtom, selectorVersion))

  const verseOfTheDayTime = useSelector(
    (state: RootState) => state.user.notifications.verseOfTheDay
  )
  const displayName = user?.displayName
  const verseOfTheDay = useGetVerseOfTheDay(version, addDay)
  const verseOfTheDayPlus1 = useGetVerseOfTheDay(version, 1 + addDay)

  const verseOfTheDayContent = verseOfTheDay?.content
  const verseOfTheDayPlus1Content = verseOfTheDayPlus1?.content

  useEffect(() => {
    if (
      addDay ||
      !verseOfTheDayContent ||
      !verseOfTheDayPlus1Content ||
      !verseOfTheDayTime
    )
      return

    const scheduleNotification = async () => {
      try {
        await PushNotification.cancelAllLocalNotifications()

        const [vodHours, vodMinutes] = verseOfTheDayTime
          .split(':')
          .map((n: string) => Number(n))
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

        await PushNotification.localNotificationSchedule({
          channelId: 'vod-notifications',
          title: `${i18n.t('Bonjour')} ${extractFirstName(displayName)}`,
          message: !addDay
            ? removeBreakLines(verseOfTheDayContent)
            : removeBreakLines(verseOfTheDayPlus1Content),
          category: 'NOTIFICATIONS',
          allowWhileIdle: true,
          date,
        })

        console.log(
          `Notification set at ${verseOfTheDayTime} on ${date} | addDay: ${addDay} | content: ${
            !addDay
              ? removeBreakLines(verseOfTheDayContent)
              : removeBreakLines(verseOfTheDayPlus1Content)
          }`
        )
        // dispatch(setNotificationId(randomId))
      } catch (e) {
        Snackbar.show('Erreur de notification.')
        console.log(e)
        Sentry.captureException(e)
      }
    }
    const initNotifications = async () => {
      const hasPermissions = await new Promise(resolve => {
        PushNotification.checkPermissions(({ alert }) => resolve(alert))
      })

      console.log('has permissions', hasPermissions)

      if (hasPermissions) {
        scheduleNotification()
      } else {
        Snackbar.show(t('home.notificationPermissionNeeded'))
      }
    }
    initNotifications()
  }, [
    verseOfTheDayTime,
    verseOfTheDayContent,
    verseOfTheDayPlus1Content,
    displayName,
    addDay,
  ])
  return verseOfTheDay
}
