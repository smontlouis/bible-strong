import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import ReadingPlansScreen from './ReadingPlansScreen'

const PlanSelect = () => {
  const { t } = useTranslation()
  return (
    <Container>
      <Header hasBackButton title={t('readingPlans.tab')} />
      <Box className="w-full flex-1 bg-light-grey">
        <ReadingPlansScreen />
      </Box>
    </Container>
  )
}
export default PlanSelect
