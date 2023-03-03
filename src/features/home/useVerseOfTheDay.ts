import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native'
import * as Sentry from '@sentry/react-native'
import addDays from 'date-fns/fp/addDays'
import setHours from 'date-fns/fp/setHours'
import setMinutes from 'date-fns/fp/setMinutes'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import compose from 'recompose/compose'
import Snackbar from '~common/SnackBar'

import { useAtomValue } from 'jotai/react'
import { selectAtom } from 'jotai/vanilla/utils'
import VOD from '~assets/bible_versions/bible-vod.json'
import booksDesc2 from '~assets/bible_versions/books-desc-2'
import extractFirstName from '~helpers/extractFirstName'
import getVersesContent from '~helpers/getVersesContent'
import useLogin from '~helpers/useLogin'
import { removeBreakLines } from '~helpers/utils'
import { RootState } from '~redux/modules/reducer'
import { setNotificationVOD } from '~redux/modules/user'
import { BibleTab, defaultBibleAtom, VersionCode } from '../../state/tabs'
import { getDayOfTheYear } from './getDayOfTheYear'

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
  const dispatch = useDispatch()
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
        await notifee.cancelAllNotifications()

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

        const date = (compose(
          setMinutes(vodMinutes),
          setHours(vodHours),
          addDays(addDay)
        )(nowDate) as unknown) as Date

        const channelId = await notifee.createChannel({
          id: 'vod-notifications',
          name: 'Verse of the day notifications',
          importance: AndroidImportance.HIGH,
          vibration: true,
          visibility: AndroidVisibility.PUBLIC,
          sound: 'default',
        })

        const trigger: TimestampTrigger = {
          type: TriggerType.TIMESTAMP,
          timestamp: date.getTime(),
        }

        await notifee.createTriggerNotification(
          {
            title: `${t('Bonjour')} ${extractFirstName(displayName)}`,
            body: !addDay
              ? removeBreakLines(verseOfTheDayContent)
              : removeBreakLines(verseOfTheDayPlus1Content),
            android: {
              channelId,
              pressAction: {
                id: 'default',
              },
              importance: AndroidImportance.HIGH,
              visibility: AndroidVisibility.PUBLIC,
            },
          },
          trigger
        )

        console.log(
          `Notification set at ${verseOfTheDayTime} on ${date} | addDay: ${addDay} | content: ${
            !addDay
              ? removeBreakLines(verseOfTheDayContent)
              : removeBreakLines(verseOfTheDayPlus1Content)
          }`
        )
      } catch (e) {
        console.log(e)
      }
    }
    const initNotifications = async () => {
      const hasPermissions = await new Promise(resolve => {
        notifee
          .requestPermission()
          .then(settings => {
            resolve(
              settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED
            )
          })
          .catch(() => {
            resolve(false)
          })
      })

      console.log('has permissions', hasPermissions)

      if (hasPermissions) {
        scheduleNotification()
      } else {
        dispatch(setNotificationVOD(''))
        Snackbar.show(t('vod.permissionNeeded'))
      }
    }
    initNotifications()
  }, [
    verseOfTheDayTime,
    verseOfTheDayContent,
    verseOfTheDayPlus1Content,
    displayName,
    addDay,
    dispatch,
    t,
  ])
  return verseOfTheDay
}
