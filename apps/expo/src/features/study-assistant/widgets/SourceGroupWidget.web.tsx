import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSetAtom } from 'jotai'
import type {
  SourceGroupWidget as Descriptor,
  StudySource,
} from '@bible-strong/ai-contract/contract'
import { previewHistoryAtom } from '~features/bibleReferencePreview/state'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { sourceDisplayTitle, sourceRoute } from '../sourceNavigation'
import { QuoteBlock, QuoteMore } from './QuoteBlock.web'

const SHOWN_SOURCES = 2

function SourceQuote({ source }: { source: StudySource }) {
  const navigate = usePushRouteOnce()
  const setPreview = useSetAtom(previewHistoryAtom)
  const title = sourceDisplayTitle(source)
  return (
    <QuoteBlock
      mark={source.kind === 'dictionary' ? 'dictionary' : 'commentary'}
      foot={title}
      // The whole excerpt opens in the preview, as the sheet does on the phone.
      onPress={() =>
        setPreview([
          {
            kind: 'excerpt',
            title,
            text: source.excerpt,
            open: () => navigate(sourceRoute(source)),
          },
        ])
      }
    >
      <p className="bs-quote-text" style={{ WebkitLineClamp: 4 }}>
        {source.excerpt}
      </p>
    </QuoteBlock>
  )
}

/** Commentaries and dictionary articles: each excerpt reads as a quotation of its work. */
export default function SourceGroupWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation()
  const [all, setAll] = useState(false)
  const shown = all ? widget.sources : widget.sources.slice(0, SHOWN_SOURCES)
  const rest = widget.sources.length - shown.length
  return (
    <div className="bs-quote-group">
      {shown.map(source => (
        <SourceQuote key={source.id} source={source} />
      ))}
      {rest > 0 && (
        <QuoteMore
          label={t('assistant.widgets.moreExcerpts', { count: rest })}
          onPress={() => setAll(true)}
        />
      )}
    </div>
  )
}
