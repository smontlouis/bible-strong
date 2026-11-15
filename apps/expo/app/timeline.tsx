import { useLocalSearchParams } from 'expo-router'
import TimelineStageScreen from '~features/timeline/TimelineStageScreen'

// `event` locates an event on the timeline and `period` opens it where a period starts; `goTo`,
// the index of a period, is what earlier links carry.
const TimelineRoute = () => {
  const params = useLocalSearchParams<{
    event?: string
    period?: string
    goTo?: string
    language?: string
  }>()
  const legacyPeriod = params.goTo === undefined ? undefined : String(Number(params.goTo) + 1)
  const language =
    params.language === 'fr' || params.language === 'en' ? params.language : undefined
  return (
    <TimelineStageScreen
      languageOverride={language}
      start={{ event: params.event, period: params.period ?? legacyPeriod }}
    />
  )
}

export default TimelineRoute
