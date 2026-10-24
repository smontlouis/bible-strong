import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { getPlanDayDate, getScheduledPlanDay } from '../readingCalendar'
import { getPlanDayState } from '../planSchedule'
import { DayCircle, formatPlanDate, getDayStateLabels } from './PlanDayStrip'

const pad = (value: number) => String(value).padStart(2, '0')
const monthOf = (date: string) => date.slice(0, 7)
const shiftMonth = (month: string, delta: number) => {
  const [year, index] = month.split('-').map(Number)
  const next = new Date(Date.UTC(year, index - 1 + delta, 1))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`
}

const LegendItem = ({ look, label }: { look: string; label: string }) => (
  <Box className="flex-row items-center gap-[6px]">
    <Box className={`w-[10px] h-[10px] rounded-full ${look}`} />
    <Text className="text-grey text-[12px]">{label}</Text>
  </Box>
)

/**
 * A month of the plan's calendar, each day in its state; another month is a tap away. Touching
 * a day of the plan shows it.
 */
const PlanCalendar = ({
  startDate,
  done,
  today,
  selectedDay,
  onSelect,
}: {
  startDate: string
  done: boolean[]
  today?: number
  selectedDay: number
  onSelect: (day: number) => void
}) => {
  const { t, i18n } = useTranslation()
  const total = done.length
  const first = monthOf(startDate)
  const last = monthOf(getPlanDayDate(startDate, total) ?? startDate)
  const [month, setMonth] = useState(() =>
    monthOf(getPlanDayDate(startDate, selectedDay) ?? startDate)
  )
  const [year, index] = month.split('-').map(Number)
  const length = new Date(Date.UTC(year, index, 0)).getUTCDate()
  const sundayFirst = i18n.language.startsWith('en')
  const offset = (new Date(Date.UTC(year, index - 1, 1)).getUTCDay() + (sundayFirst ? 0 : 6)) % 7
  // Any week does for the weekday names: 2 March 2026 is a Monday.
  const weekdays = Array.from({ length: 7 }, (_, column) =>
    formatPlanDate(`2026-03-${pad(2 + column - (sundayFirst ? 1 : 0))}`, i18n.language, {
      weekday: 'narrow',
    })
  )
  const cells = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length }, (_, day) => `${month}-${pad(day + 1)}`),
  ]
  const title = formatPlanDate(`${month}-01`, i18n.language, { month: 'long', year: 'numeric' })
  const stateLabels = getDayStateLabels(t)
  return (
    <Box className="gap-[12px]">
      <Box className="flex-row items-center justify-between">
        <Text className="text-default font-bold text-[15px]">
          {title.charAt(0).toUpperCase() + title.slice(1)}
        </Text>
        <Box className="flex-row">
          <Link
            size={36}
            accessibilityLabel={t('dailyReading.previousMonth')}
            disabled={month <= first}
            onPress={() => setMonth(shiftMonth(month, -1))}
          >
            <FeatherIcon
              name="chevron-left"
              size={20}
              color={month <= first ? 'grey' : 'primary'}
            />
          </Link>
          <Link
            size={36}
            accessibilityLabel={t('dailyReading.nextMonth')}
            disabled={month >= last}
            onPress={() => setMonth(shiftMonth(month, 1))}
          >
            <FeatherIcon
              name="chevron-right"
              size={20}
              color={month >= last ? 'grey' : 'primary'}
            />
          </Link>
        </Box>
      </Box>
      <Box className="flex-row">
        {weekdays.map((weekday, column) => (
          <Text
            key={column}
            className="text-grey text-[11px] text-center"
            style={{ width: '14.28%' }}
          >
            {weekday}
          </Text>
        ))}
      </Box>
      <Box className="flex-row flex-wrap" style={{ rowGap: 6 }}>
        {cells.map((date, cell) => {
          const scheduled = date ? getScheduledPlanDay(startDate, date) : undefined
          const day =
            scheduled !== undefined && scheduled >= 1 && scheduled <= total ? scheduled : undefined
          const state = day !== undefined ? getPlanDayState(done, day, today) : 'upcoming'
          return (
            <Box key={date ?? `empty-${cell}`} className="items-center" style={{ width: '14.28%' }}>
              {date && day !== undefined ? (
                <Link
                  accessibilityRole="button"
                  accessibilityLabel={[
                    t('readingPlans.day', { day }),
                    formatPlanDate(date, i18n.language, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    }),
                    stateLabels[state],
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  accessibilityState={{ selected: day === selectedDay }}
                  onPress={() => onSelect(day)}
                >
                  <DayCircle
                    size={32}
                    state={state}
                    selected={day === selectedDay}
                    label={String(Number(date.slice(8)))}
                  />
                </Link>
              ) : date ? (
                <Box className="w-[32px] h-[32px] items-center justify-center">
                  <Text className="text-grey text-[13px]" style={{ opacity: 0.4 }}>
                    {Number(date.slice(8))}
                  </Text>
                </Box>
              ) : null}
            </Box>
          )
        })}
      </Box>
      <Box className="flex-row flex-wrap gap-[16px]">
        <LegendItem look="bg-success" label={t('readingPlans.legendRead')} />
        <LegendItem look="border-[1.5px] border-grey" label={t('readingPlans.legendMissed')} />
        <LegendItem look="border-[2px] border-primary" label={t('dailyReading.today')} />
      </Box>
    </Box>
  )
}

export default PlanCalendar
