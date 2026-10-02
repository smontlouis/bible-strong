import { lazy, Suspense } from 'react'
import Box from '~common/ui/Box'
import './reading-datepicker.generated.web.css'
import type { ReadingDatePickerProps } from './ReadingDatePicker'

// HeroUI and React Aria weigh ~1.2 MB on web: load them only when a date picker renders.
const ReadingDatePickerField = lazy(() => import('./ReadingDatePickerField.web'))

const ReadingDatePicker = (props: ReadingDatePickerProps) => (
  <Suspense fallback={<Box className="h-9 min-w-36" />}>
    <ReadingDatePickerField {...props} />
  </Suspense>
)

export default ReadingDatePicker
