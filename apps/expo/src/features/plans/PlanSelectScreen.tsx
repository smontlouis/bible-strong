import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import { PAGE_CONTENT_MAX_WIDTH } from '~common/ui/PageContent'
import DailyReadingSourceScreen from '~features/daily-reading/DailyReadingSourceScreen'
import ReadingPlansScreen from './ReadingPlansScreen'

const PlanSelect = () => {
  const [selected, setSelected] = useState<'plans' | 'meditations'>('plans')
  const { t } = useTranslation()
  return (
    <Container>
      <Header hasBackButton title={t('Plans & Méditations')} />
      <Box
        className="w-full flex-1 self-center bg-light-grey"
        style={{ maxWidth: PAGE_CONTENT_MAX_WIDTH }}
      >
        <Box className="flex-row bg-reverse rounded-[16px] p-[4px] mx-[24px] mt-[16px] mb-[4px]">
          {(['plans', 'meditations'] as const).map(value => (
            <Link
              key={value}
              onPress={() => setSelected(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: selected === value }}
              className={`flex-1 rounded-[12px] items-center py-[14px] ${selected === value ? 'bg-light-grey' : ''}`}
            >
              <Text
                className={`font-bold text-[14px] ${selected === value ? 'text-primary' : 'text-grey'}`}
              >
                {t(value === 'plans' ? 'readingPlans.tab' : 'dailyReading.collections')}
              </Text>
            </Link>
          ))}
        </Box>
        {selected === 'plans' ? <ReadingPlansScreen /> : <DailyReadingSourceScreen embedded />}
      </Box>
    </Container>
  )
}
export default PlanSelect
