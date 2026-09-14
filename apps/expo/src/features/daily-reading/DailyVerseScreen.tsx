import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { pageContentStyle } from '~common/ui/PageContent'
import StandaloneVerseOfTheDay from '~features/home/StandaloneVerseOfTheDay'
import { getScheduledPlanDay, isCivilDate } from '~features/plans/readingCalendar'
import ReadingDatePicker from './ReadingDatePicker'
import { useLocalReadingDate } from './useDailyMeditation'

/** Dated standalone-verse notifications must not open a subsequently selected collection. */
const DailyVerseScreen = () => {
  const { date: requestedDate } = useLocalSearchParams<{ date?: string }>()
  const today = useLocalReadingDate()
  const date = requestedDate && isCivilDate(requestedDate) ? requestedDate : today
  const offset = (getScheduledPlanDay(today, date) ?? 1) - 1
  const router = useRouter()
  const { t } = useTranslation()
  return (
    <Container>
      <Header hasBackButton title={t('dailyReading.default')} />
      <ScrollView contentContainerStyle={[pageContentStyle, { padding: 20 }]}>
        <Box className="items-center mb-[16px]">
          <ReadingDatePicker
            value={date}
            label={t('dailyReading.chooseDate')}
            onChange={next => router.setParams({ date: next })}
          />
        </Box>
        <StandaloneVerseOfTheDay addDay={offset} desktop />
      </ScrollView>
    </Container>
  )
}
export default DailyVerseScreen
