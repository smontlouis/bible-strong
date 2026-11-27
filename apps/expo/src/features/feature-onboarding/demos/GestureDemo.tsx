import { useTranslation } from 'react-i18next'
import type { GestureDemoId } from './gestureDemoIds'
import {
  AnnotationDoubleTapDemo,
  BookSelectorDisplayDemo,
  ChapterLongPressDemo,
  WordDoubleTapDemo,
} from './readerDemos'
import { ParallelColumnVersionDemo, ParallelMenuDemo, StrongWordTapDemo } from './readingModeDemos'
import { ColorLongPressDemo, SelectionTabsSwipeDemo } from './selectionDemos'
import { AudioSwipeUpDemo, StudyInsertDemo } from './studyAudioDemos'
import { TabBarSwipeDemo, TabGroupsSwipeDemo } from './workspaceDemos'

const DEMOS: Record<GestureDemoId, (props: { label: string }) => React.JSX.Element> = {
  'selection-tabs-swipe': SelectionTabsSwipeDemo,
  'color-long-press': ColorLongPressDemo,
  'chapter-long-press': ChapterLongPressDemo,
  'book-selector-display': BookSelectorDisplayDemo,
  'tab-bar-swipe': TabBarSwipeDemo,
  'tab-groups-swipe': TabGroupsSwipeDemo,
  'study-insert': StudyInsertDemo,
  'audio-swipe-up': AudioSwipeUpDemo,
  'word-double-tap': WordDoubleTapDemo,
  'annotation-double-tap': AnnotationDoubleTapDemo,
  'parallel-column-version': ParallelColumnVersionDemo,
  'parallel-menu': ParallelMenuDemo,
  'strong-word-tap': StrongWordTapDemo,
}

/** The gesture a step teaches, drawn and played a few times; touched, it plays again. */
export default function GestureDemo({ id }: { id: GestureDemoId }) {
  const { t } = useTranslation()
  const Demo = DEMOS[id]
  return <Demo label={t('onboarding.demo.label')} />
}
