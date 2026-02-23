import notifee, { EventType } from '@notifee/react-native'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { InteractionManager } from 'react-native'

const navigateToBibleView = (
  router: ReturnType<typeof useRouter>,
  data: Record<string, string>
) => {
  const { book, chapter, verse, version } = data

  router.push({
    pathname: '/bible-view',
    params: {
      isReadOnly: 'true',
      book: book,
      chapter: chapter,
      verse: verse,
      focusVerses: JSON.stringify([Number(verse)]),
      ...(version ? { version } : {}),
    },
  })
}

/**
 * Handles navigation when a verse of the day notification is pressed.
 * Covers both foreground press and cold start (app launched from notification).
 */
const useNotificationNavigation = () => {
  const router = useRouter()

  useEffect(() => {
    // Handle notification press when app is in foreground or returning from background
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (
        type === EventType.PRESS &&
        detail.notification?.data?.type === 'verseOfTheDay'
      ) {
        navigateToBibleView(
          router,
          detail.notification.data as Record<string, string>
        )
      }
    })

    // Handle cold start: app was launched by tapping the notification
    const checkInitialNotification = async () => {
      const initialNotification = await notifee.getInitialNotification()
      if (initialNotification?.notification?.data?.type === 'verseOfTheDay') {
        // Wait for interactions to settle so the router is fully ready
        InteractionManager.runAfterInteractions(() => {
          navigateToBibleView(
            router,
            initialNotification.notification.data as Record<string, string>
          )
        })
      }
    }
    checkInitialNotification()

    return unsubscribe
  }, [router])
}

export default useNotificationNavigation
