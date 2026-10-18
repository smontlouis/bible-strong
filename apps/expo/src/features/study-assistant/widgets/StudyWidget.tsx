import type { StudyWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import BookWidget from './BookWidget'
import ConcordanceWidget from './ConcordanceWidget'
import EntityWidget from './EntityWidget'
import FurtherResourcesWidget from './FurtherResourcesWidget'
import NaveWidget from './NaveWidget'
import PassageWidget from './PassageWidget'
import ReadingWidget from './ReadingWidget'
import SourceGroupWidget from './SourceGroupWidget'
import StrongWidget from './StrongWidget'
import TimelineWidget from './TimelineWidget'
import VerseAnalysisWidget from './VerseAnalysisWidget'

export default function StudyWidget({ widget }: { widget: Descriptor }) {
  if (widget.kind === 'book_overview') return <BookWidget widget={widget} />
  if (widget.kind === 'reading_plan' || widget.kind === 'meditation')
    return <ReadingWidget widget={widget} />
  if (widget.kind === 'further_resources') return <FurtherResourcesWidget widget={widget} />
  if ('entityKey' in widget) return <EntityWidget widget={widget} />
  if (widget.kind === 'event_timeline') return <TimelineWidget widget={widget} />
  if (widget.kind === 'commentary_comparison' || widget.kind === 'dictionary_articles')
    return <SourceGroupWidget widget={widget} />
  if (widget.kind === 'nave_topic') return <NaveWidget widget={widget} />
  if (widget.kind === 'verse_analysis') return <VerseAnalysisWidget widget={widget} />
  if (widget.kind === 'concordance') return <ConcordanceWidget widget={widget} />
  if (widget.kind === 'strong_entry') return <StrongWidget widget={widget} />
  return 'passages' in widget ? <PassageWidget widget={widget} /> : null
}
