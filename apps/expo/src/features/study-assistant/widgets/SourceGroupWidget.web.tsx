import { useTranslation } from 'react-i18next'
import { ArrowUpRightIcon, FileTextIcon } from 'lucide-react'
import { useSetAtom } from 'jotai'
import type {
  SourceGroupWidget as Descriptor,
  StudySource,
} from '@bible-strong/ai-contract/contract'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { previewHistoryAtom } from '~features/bibleReferencePreview/state'
import { sourceRoute, sourceDisplayTitle } from '../sourceNavigation'
import WidgetFrame, { useCloseExpandedWidget } from './WidgetFrame.web'
function SourceCard({ source }: { source: StudySource }) {
  const { t } = useTranslation(),
    navigate = usePushRouteOnce(),
    setPreview = useSetAtom(previewHistoryAtom),
    close = useCloseExpandedWidget()
  const title = sourceDisplayTitle(source)
  const open = () => {
    close()
    navigate(sourceRoute(source))
  }
  return (
    <article className="bs-widget-source-card">
      <header>
        <FileTextIcon size={15} />
        <button
          type="button"
          onClick={() => {
            close()
            setPreview([{ kind: 'excerpt', title, text: source.excerpt, open }])
          }}
        >
          {title}
        </button>
        <button
          className="bs-widget-icon"
          type="button"
          aria-label={t('assistant.widgets.open', { reference: title })}
          onClick={open}
        >
          <ArrowUpRightIcon size={16} />
        </button>
      </header>
      <small>{t('assistant.widgets.sourceExcerpt')}</small>
      <p>{source.excerpt}</p>
    </article>
  )
}
export default function SourceGroupWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation()
  const content = (expanded: boolean) => (
    <div className={expanded ? 'bs-widget-source-comparison' : 'bs-widget-source-list'}>
      {widget.sources.map(source => (
        <SourceCard key={source.id} source={source} />
      ))}
    </div>
  )
  return (
    <WidgetFrame
      title={widget.title}
      eyebrow={t(`assistant.widgets.${widget.kind}`)}
      expanded={content(true)}
    >
      {content(false)}
    </WidgetFrame>
  )
}
