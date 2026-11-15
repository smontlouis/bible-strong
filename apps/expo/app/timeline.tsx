import { useLocalSearchParams } from 'expo-router'
import TimelineStageScreen from '~features/timeline/TimelineStageScreen'
import { IS_FORM_SHEET } from '~helpers/constants'

// `event` locates an event on the timeline and `period` opens it where a period starts; `goTo`,
// the index of a period, is what earlier links carry. `from: 'sheet'` opens it as a sheet over the
// event's sheet that located it (iOS; a page elsewhere).
const TimelineRoute = () => {
  const params = useLocalSearchParams<{
    event?: string
    period?: string
    goTo?: string
    language?: string
    from?: string
  }>()
  const legacyPeriod = params.goTo === undefined ? undefined : String(Number(params.goTo) + 1)
  const language =
    params.language === 'fr' || params.language === 'en' ? params.language : undefined
  return (
    <TimelineStageScreen
      languageOverride={language}
      start={{ event: params.event, period: params.period ?? legacyPeriod }}
      inSheet={IS_FORM_SHEET && params.from === 'sheet'}
    />
  )
}

export default TimelineRoute
