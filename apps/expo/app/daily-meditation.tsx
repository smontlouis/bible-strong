import { Redirect, useLocalSearchParams } from 'expo-router'

export default function LegacyDailyMeditationRoute() {
  const {
    collectionId = '',
    date,
    readingId,
  } = useLocalSearchParams<{ collectionId?: string; date?: string; readingId?: string }>()
  return (
    <Redirect
      href={{
        pathname: '/meditation',
        params: { collectionId, ...(date ? { date } : {}), ...(readingId ? { readingId } : {}) },
      }}
    />
  )
}
