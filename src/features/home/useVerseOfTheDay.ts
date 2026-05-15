import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native'
import addDays from 'date-fns/fp/addDays'
import setHours from 'date-fns/fp/setHours'
import setMinutes from 'date-fns/fp/setMinutes'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from '~helpers/toast'

import VOD from '~assets/bible_versions/bible-vod.json'
import booksDesc2 from '~assets/bible_versions/books-desc-2'
import type { VerseRefContent } from '~common/types'
import extractFirstName from '~helpers/extractFirstName'
import getVersesContent from '~helpers/getVersesContent'
import useLogin from '~helpers/useLogin'
import { removeBreakLines } from '~helpers/utils'
import { RootState } from '~redux/modules/reducer'
import { setNotificationVOD } from '~redux/modules/user'
import { VersionCode } from '../../state/tabs'
import { useDefaultBibleVersion } from '../../state/useDefaultBibleVersion'
import { getDayOfTheYear } from './getDayOfTheYear'

export type VerseOfTheDayData =
  | (VerseRefContent & {
      v: string
      book: number
      chapter: number
      verse: number
    })
  | { error: true }
  | false

const versesOfTheDay = VOD as Record<number, string>

const hasVerseContent = (
  verseOfTheDay: VerseOfTheDayData
): verseOfTheDay is Exclude<VerseOfTheDayData, false | { error: true }> =>
  !!verseOfTheDay && 'content' in verseOfTheDay

const useGetVerseOfTheDay = (version: VersionCode, addDay: number) => {
  const [verseOfTheDay, setVOD] = useState<VerseOfTheDayData>(false)

  useEffect(() => {
    const dayOfTheYear =
      getDayOfTheYear(addDay) + 1 < 1 || getDayOfTheYear(addDay) + 1 > 366
        ? 1
        : getDayOfTheYear(addDay) + 1
    const loadVerse = async () => {
      try {
        const reference = versesOfTheDay[dayOfTheYear]
        const [bookName, chapter, verse] = reference.split('.')
        const book = booksDesc2.find(b => b[1] === bookName)?.[0]
        const vod = await getVersesContent({
          verses: `${book}-${chapter}-${verse}`,
          version,
        })
        setVOD({
          v: reference,
          book: Number(book),
          chapter: Number(chapter),
          verse: Number(verse),
          ...vod,
        })
      } catch {
        setVOD({ error: true })
      }
    }
    loadVerse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  return verseOfTheDay
}

export const useVerseOfTheDay = (addDay: number) => {
  const { user } = useLogin()
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const version = useDefaultBibleVersion()

  const verseOfTheDayTime = useSelector(
    (state: RootState) => state.user.notifications.verseOfTheDay
  )
  const displayName = user?.displayName
  const verseOfTheDay = useGetVerseOfTheDay(version, addDay)
  const verseOfTheDayPlus1 = useGetVerseOfTheDay(version, 1 + addDay)

  const verseOfTheDayContent = hasVerseContent(verseOfTheDay) ? verseOfTheDay.content : undefined
  const verseOfTheDayReference = hasVerseContent(verseOfTheDay)
    ? `${verseOfTheDay.title} ${verseOfTheDay.version}`
    : undefined
  const verseOfTheDayPlus1Content = hasVerseContent(verseOfTheDayPlus1)
    ? verseOfTheDayPlus1.content
    : undefined
  const verseOfTheDayPlus1Reference = hasVerseContent(verseOfTheDayPlus1)
    ? `${verseOfTheDayPlus1.title} ${verseOfTheDayPlus1.version}`
    : undefined

  useEffect(() => {
    if (
      addDay ||
      !verseOfTheDayContent ||
      !verseOfTheDayReference ||
      !verseOfTheDayPlus1Content ||
      !verseOfTheDayPlus1Reference ||
      !verseOfTheDayTime
    )
      return

    const scheduleNotification = async () => {
      try {
        await notifee.cancelAllNotifications()

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

        const date = setMinutes(vodMinutes)(setHours(vodHours)(addDays(addDay)(nowDate)))

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
              ? `${removeBreakLines(verseOfTheDayContent)}\n${verseOfTheDayReference}`
              : `${removeBreakLines(verseOfTheDayPlus1Content)}\n${verseOfTheDayPlus1Reference}`,
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
          `[Notification] Notificationset at ${verseOfTheDayTime} on ${date} | addDay: ${addDay} | content: ${
            !addDay
              ? `${removeBreakLines(verseOfTheDayContent)} ${verseOfTheDayReference}`
              : `${removeBreakLines(verseOfTheDayPlus1Content)} ${verseOfTheDayPlus1Reference}`
          }`
        )
      } catch (e) {
        console.log(e)
      }
    }
    const initNotifications = async () => {
      const hasPermissions = await new Promise<boolean>(resolve => {
        notifee
          .requestPermission()
          .then(settings => {
            resolve(settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED)
          })
          .catch(() => {
            resolve(false)
          })
      })

      console.log('[Home] Has permissions:', hasPermissions)

      if (hasPermissions) {
        scheduleNotification()
      } else {
        dispatch(setNotificationVOD(''))
        toast(t('vod.permissionNeeded'))
      }
    }
    initNotifications()
  }, [
    verseOfTheDayTime,
    verseOfTheDayContent,
    verseOfTheDayReference,
    verseOfTheDayPlus1Content,
    verseOfTheDayPlus1Reference,
    displayName,
    addDay,
    dispatch,
    t,
  ])
  return verseOfTheDay
}
