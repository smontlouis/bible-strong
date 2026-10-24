import type { TFunction } from 'i18next'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { getPlanDayDate } from '../readingCalendar'
import { getPlanDayState, type PlanDayState } from '../planSchedule'

const CELL = 60

export const formatPlanDate = (
  date: string,
  language: string,
  options: Intl.DateTimeFormatOptions
): string => new Date(`${date}T12:00:00`).toLocaleDateString(language, options)

/** What a day's state adds to its name for a screen reader; nothing for a day to come. */
export const getDayStateLabels = (t: TFunction): Record<PlanDayState, string> => ({
  read: t('readingPlans.dayCompleted'),
  missed: t('readingPlans.legendMissed'),
  today: t('dailyReading.today'),
  upcoming: '',
})

/** The circle of a day: filled once read, an empty ring when missed, a coloured ring today. */
export const DayCircle = ({
  state,
  selected,
  label,
  size = 40,
}: {
  state: PlanDayState
  selected: boolean
  label: string
  size?: number
}) => {
  const look = selected
    ? 'bg-primary'
    : {
        read: 'bg-success',
        missed: 'border-[1.5px] border-grey',
        today: 'border-[2px] border-primary',
        upcoming: 'bg-canvas',
      }[state]
  return (
    <Box
      className={`rounded-full items-center justify-center ${look}`}
      style={{ width: size, height: size }}
    >
      {state === 'read' ? (
        <FeatherIcon name="check" size={size / 2} color="white" />
      ) : (
        <Text
          className={`font-bold ${selected ? 'text-white' : state === 'missed' ? 'text-grey' : 'text-default'}`}
          style={{ fontSize: size > 34 ? 15 : 13, fontVariant: ['tabular-nums'] }}
        >
          {label}
        </Text>
      )}
    </Box>
  )
}

/**
 * The days around the one shown: the weekday above each when the plan has a calendar, and the
 * day's state in its circle.
 */
const PlanDayStrip = ({
  done,
  today,
  selectedDay,
  startDate,
  width,
  onSelect,
}: {
  done: boolean[]
  today?: number
  selectedDay: number
  startDate?: string
  width: number
  onSelect: (day: number) => void
}) => {
  const { t, i18n } = useTranslation()
  const total = done.length
  const visible = Math.max(3, Math.min(7, Math.floor(width / (CELL + 12))))
  const start = Math.max(0, Math.min(selectedDay - 1 - Math.floor(visible / 2), total - visible))
  const days = Array.from({ length: Math.min(visible, total) }, (_, index) => start + index + 1)
  const states = getDayStateLabels(t)
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <Box className="flex-1 flex-row justify-between gap-[12px]">
        {days.map(day => {
          const state = getPlanDayState(done, day, today)
          const selected = day === selectedDay
          const date = startDate ? getPlanDayDate(startDate, day) : undefined
          return (
            <Link
              key={day}
              accessibilityRole="button"
              accessibilityLabel={[
                t('readingPlans.day', { day }),
                date &&
                  formatPlanDate(date, i18n.language, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  }),
                states[state],
              ]
                .filter(Boolean)
                .join(', ')}
              accessibilityState={{ selected }}
              onPress={() => onSelect(day)}
            >
              <Box className="items-center gap-[6px]" style={{ width: CELL }}>
                {date && (
                  <Text
                    className={`text-[11px] ${day === today ? 'text-link font-bold' : 'text-grey'}`}
                  >
                    {formatPlanDate(date, i18n.language, { weekday: 'short' })}
                  </Text>
                )}
                <DayCircle state={state} selected={selected} label={String(day)} />
              </Box>
            </Link>
          )
        })}
      </Box>
    </ScrollView>
  )
}

export default PlanDayStrip
