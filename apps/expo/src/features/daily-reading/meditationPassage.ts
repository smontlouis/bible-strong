import type { Plan, ReadingSlice } from '~common/types'
import { parseInlineBibleReferences } from '~helpers/bcvParser'
import { getMeditationOpening } from '~features/plans/readingCalendar'

/** Keep the quotation's own wording. Only split a single, unambiguous trailing reference. */
export const resolveMeditationOpening = (
  reading: Pick<ReadingSlice, 'slices'>,
  language: Plan['lang']
) => {
  const opening = getMeditationOpening(reading)
  if (!opening?.text) return undefined
  const references = parseInlineBibleReferences(opening.text, language)
  const reference = references.length === 1 ? references[0] : undefined
  const hasTrailingReference =
    reference && reference.start > 0 && /^[\s.)\]}]*$/.test(opening.text.slice(reference.end))
  const quote = hasTrailingReference
    ? opening.text
        .slice(0, reference.start)
        .replace(/\s*[(\[]\s*$/, '')
        .trim()
    : opening.text
  return {
    ...opening,
    quote: quote || opening.text,
    reference: quote && hasTrailingReference ? reference.text : undefined,
    target: quote && hasTrailingReference ? reference.target : undefined,
  }
}
