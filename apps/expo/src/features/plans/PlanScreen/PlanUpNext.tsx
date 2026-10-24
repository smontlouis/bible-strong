import { useTranslation } from 'react-i18next'
import type { ReadingSlice } from '~common/types'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Card from '~common/ui/Card'
import { FeatherIcon } from '~common/ui/Icon'
import { ListSectionTitle, ListSeparator } from '~common/ui/ListSection'
import Text from '~common/ui/Text'
import { getReadingSliceLabel } from '../entitySliceTitle'
import { getPlanDayDate } from '../readingCalendar'
import { formatPlanDate } from './PlanDayStrip'

/** The three days after the one shown, by what they hold; touching one shows it. */
const PlanUpNext = ({
  readings,
  day,
  startDate,
  onSelect,
}: {
  readings: ReadingSlice[]
  day: number
  startDate?: string
  onSelect: (day: number) => void
}) => {
  const { t, i18n } = useTranslation()
  const next = readings.slice(day, day + 3)
  if (!next.length) return null
  return (
    <Box>
      <ListSectionTitle>{t('readingPlans.upNext')}</ListSectionTitle>
      <Card>
        {next.map((reading, index) => {
          const number = day + index + 1
          const date = startDate ? getPlanDayDate(startDate, number) : undefined
          const label = getReadingSliceLabel(reading, t)
          return (
            <Box key={reading.id}>
              {index > 0 && <ListSeparator inset={16} />}
              <Link
                accessibilityRole="button"
                accessibilityLabel={`${t('readingPlans.day', { day: number })}, ${label}`}
                className="flex-row items-center gap-[12px] px-[16px] py-[12px]"
                onPress={() => onSelect(number)}
              >
                <Box className="flex-1 gap-[2px]">
                  <Text className="text-grey text-[12px]">
                    {[
                      t('readingPlans.day', { day: number }),
                      date && formatPlanDate(date, i18n.language, { weekday: 'long' }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text className="text-default text-[15px]" numberOfLines={1}>
                    {label}
                  </Text>
                </Box>
                <FeatherIcon name="chevron-right" size={18} color="grey" />
              </Link>
            </Box>
          )
        })}
      </Card>
    </Box>
  )
}

export default PlanUpNext
