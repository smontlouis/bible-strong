import { DatePicker } from '@heroui/react/date-picker'
import { DateField } from '@heroui/react/date-field'
import { Calendar } from '@heroui/react/calendar'
import { parseDate } from '@internationalized/date'
import { I18nProvider } from 'react-aria-components'
import { useTranslation } from 'react-i18next'
import { webFontFamily } from '~helpers/webFontFamily'
import { isCivilDate } from '~features/plans/readingCalendar'
import { useTheme } from '~themes/ThemeProvider'
import './reading-datepicker.generated.web.css'
import type { ReadingDatePickerProps } from './ReadingDatePicker'

const ReadingDatePicker = ({
  value,
  label,
  onChange,
  minimum,
  maximum,
}: ReadingDatePickerProps) => {
  const theme = useTheme()
  const { i18n } = useTranslation()
  const fontFamily = webFontFamily(theme.fontFamily.text)
  return (
    <I18nProvider locale={i18n.language}>
      <DatePicker
        className="reading-datepicker-theme"
        aria-label={label}
        value={isCivilDate(value) ? parseDate(value) : null}
        minValue={minimum && isCivilDate(minimum) ? parseDate(minimum) : undefined}
        maxValue={maximum && isCivilDate(maximum) ? parseDate(maximum) : undefined}
        onChange={date => {
          if (date) onChange(date.toString())
        }}
        granularity="day"
        shouldForceLeadingZeros
        style={{ fontFamily }}
      >
        <DateField.Group>
          <DateField.Input>{segment => <DateField.Segment segment={segment} />}</DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger aria-label={label}>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DatePicker.Popover className="reading-datepicker-theme" style={{ fontFamily }}>
          <Calendar aria-label={label}>
            <Calendar.Header>
              <Calendar.YearPickerTrigger>
                <Calendar.YearPickerTriggerHeading />
                <Calendar.YearPickerTriggerIndicator />
              </Calendar.YearPickerTrigger>
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {day => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>{date => <Calendar.Cell date={date} />}</Calendar.GridBody>
            </Calendar.Grid>
            <Calendar.YearPickerGrid>
              <Calendar.YearPickerGridBody>
                {({ year }) => <Calendar.YearPickerCell year={year} />}
              </Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    </I18nProvider>
  )
}
export default ReadingDatePicker
