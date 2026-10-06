import ResourceShell from '../resources/ResourceShell'
import type { TimelineIndexPageData } from './timeline.functions'
import { buildTimelineIndexPath, buildWebAppTimelineUrl } from './timelineRoutes'
import TimelineStage from './TimelineStage'

/** `/timeline/:language` — the timeline, travelled on a stage that fills the window. */
export default function TimelineIndexPage({ page }: { page: TimelineIndexPageData }) {
  const { language } = page
  return (
    <ResourceShell
      section="timeline"
      alternatePath={
        page.translated ? buildTimelineIndexPath(language === 'fr' ? 'en' : 'fr') : undefined
      }
      appUrl={buildWebAppTimelineUrl(language)}
      immersive
    >
      <TimelineStage page={page} />
    </ResourceShell>
  )
}
