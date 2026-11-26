import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Box, { usePageBottomInset } from '~common/ui/Box'
import Container from '~common/ui/Container'
import Card from '~common/ui/Card'
import { useTheme } from '~themes/ThemeProvider'
import { pageContentStyle } from '~common/ui/PageContent'
import VerseMeditationCard from './readings/VerseMeditationCard'
import { getVerseKeys, useVerseMeditation } from './readings/useVerseMeditation'
import { getScheduledPlanDay, isCivilDate } from '~features/plans/readingCalendar'
import ReadingDatePicker from './ReadingDatePicker'
import { useLocalReadingDate } from './useDailyMeditation'
import { useVerseOfTheDay } from '~features/home/useVerseOfTheDay'
import { passageContext } from '~features/study-assistant/resourceContext'
import { useAssistantResourceContext } from '~features/study-assistant/useAssistantResourceContext'

/** Dated standalone-verse notifications must not open a subsequently selected collection. */
const DailyVerseScreen = () => {
  const { date: requestedDate } = useLocalSearchParams<{ date?: string }>()
  const today = useLocalReadingDate()
  const date = requestedDate && isCivilDate(requestedDate) ? requestedDate : today
  const offset = (getScheduledPlanDay(today, date) ?? 1) - 1
  // The verse the card below shows: the meditation's, else the standalone verse it falls back on.
  const meditation = useVerseMeditation(date)
  const verseOfTheDay = useVerseOfTheDay(offset)
  const meditationVerses = meditation.entry?.ref ? getVerseKeys(meditation.entry.ref) : []
  useAssistantResourceContext(
    'panel',
    meditationVerses.length
      ? passageContext({
          verses: meditationVerses,
          version: meditation.version,
          surface: 'Verset du jour',
        })
      : verseOfTheDay && !('error' in verseOfTheDay)
        ? passageContext({
            verses: [`${verseOfTheDay.book}-${verseOfTheDay.chapter}-${verseOfTheDay.verse}`],
            version: verseOfTheDay.version,
            surface: 'Verset du jour',
          })
        : null
  )
  const router = useRouter()
  const { t } = useTranslation()
  const bottomInset = usePageBottomInset()
  const theme = useTheme()
  return (
    <Container className="bg-canvas">
      <Header hasBackButton title={t('dailyReading.default')} />
      <ScrollView
        style={{ backgroundColor: theme.colors.canvas }}
        contentContainerStyle={[pageContentStyle, { padding: 20, paddingBottom: 20 + bottomInset }]}
      >
        <Box className="items-center mb-[16px]">
          <ReadingDatePicker
            value={date}
            label={t('dailyReading.chooseDate')}
            onChange={next => router.setParams({ date: next })}
          />
        </Box>
        <Card className="rounded-[24px]">
          <VerseMeditationCard addDay={offset} desktop />
        </Card>
      </ScrollView>
    </Container>
  )
}
export default DailyVerseScreen
