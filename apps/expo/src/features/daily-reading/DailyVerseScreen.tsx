import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Box, { usePageBottomInset } from '~common/ui/Box'
import Container from '~common/ui/Container'
import Card from '~common/ui/Card'
import { useTheme } from '~themes/ThemeProvider'
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
          <StandaloneVerseOfTheDay addDay={offset} desktop />
        </Card>
      </ScrollView>
    </Container>
  )
}
export default DailyVerseScreen
