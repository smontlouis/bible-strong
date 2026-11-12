import BookWidget from './BookWidget.web'
import ReadingWidget from './ReadingWidget.web'
import FurtherResourcesWidget from './FurtherResourcesWidget.web'
import EntityWidget from './EntityWidget.web'
import TimelineWidget from './TimelineWidget.web'
import SourceGroupWidget from './SourceGroupWidget.web'
import NaveWidget from './NaveWidget.web'
import VerseAnalysisWidget from './VerseAnalysisWidget.web'
import type { StudyWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import PassageWidget from './PassageWidget.web'
import StrongWidget from './StrongWidget.web'
import ConcordanceWidget from './ConcordanceWidget.web'
import VerseQuoteWidget from './VerseQuoteWidget.web'
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
  if (!('passages' in widget)) return null
  // A translation comparison keeps its controls in a bare panel; other passages are quotes.
  return widget.kind === 'translation_comparison' ? (
    <PassageWidget widget={widget} />
  ) : (
    <VerseQuoteWidget widget={widget} />
  )
}
