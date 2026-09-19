import type { TimelineEvent, TimelineEventDetail } from '~features/timeline/types'
import { parseSourcedTimelineDates } from '~features/timeline/sourcedDates'
export type TimelineWidgetRow = {
  slug: string
  detail?: TimelineEventDetail
  meta?: TimelineEvent
  position?: { start: number; end: number; approx: boolean }
}
export function orderTimelineRows(rows: TimelineWidgetRow[]): TimelineWidgetRow[] {
  return rows
    .map(row => {
      const meta =
        row.meta && Number.isFinite(row.meta.start) && Number.isFinite(row.meta.end)
          ? row.meta
          : undefined
      const position = meta
        ? { start: meta.start, end: meta.end, approx: Boolean(meta.approx) }
        : row.detail
          ? parseSourcedTimelineDates(row.detail.dates)
          : undefined
      return { ...row, meta, position }
    })
    .sort((a, b) => (a.position?.start ?? Infinity) - (b.position?.start ?? Infinity))
}
