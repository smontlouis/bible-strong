import { useState } from 'react'
import { useSelector } from 'react-redux'
import DailyMeditationCard from '~features/daily-reading/DailyMeditationCard'
import { useLocalReadingDate } from '~features/daily-reading/useDailyMeditation'
import type { RootState } from '~redux/modules/reducer'
import StandaloneVerseOfTheDay, { type VerseCardProps } from './StandaloneVerseOfTheDay'
export { VERSE_CARD_HEIGHT } from './StandaloneVerseOfTheDay'

const VerseOfTheDay = (props: VerseCardProps) => {
  const collectionId = useSelector(
    (state: RootState) => state.user.bible.settings.dailyMeditationId
  )
  const date = useLocalReadingDate(props.addDay)
  const [fallbackKey, setFallbackKey] = useState<string | null>(null)
  const currentKey = `${collectionId}:${date}`
  return collectionId && fallbackKey !== currentKey ? (
    <DailyMeditationCard
      {...props}
      collectionId={collectionId}
      onFallback={() => setFallbackKey(currentKey)}
    />
  ) : (
    <StandaloneVerseOfTheDay {...props} />
  )
}
export default VerseOfTheDay
