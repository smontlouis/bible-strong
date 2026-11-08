import type { NaveWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import ResourcePreviewContent from '~features/bibleReferencePreview/ResourcePreviewContent'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import { QuoteBlock, QuoteCut } from './QuoteBlock.web'

/** A topic of Nave: the start of its entry, cut cleanly; the quote opens the whole topic. */
export default function NaveWidget({ widget }: { widget: Descriptor }) {
  const navigate = usePushRouteOnce()
  const { fontFamily } = useTheme()
  return (
    <QuoteBlock
      mark="nave"
      foot={`Nave · ${widget.title}`}
      onPress={() =>
        navigate({
          pathname: '/nave-detail',
          params: { name: widget.topic, name_lower: widget.topic, language: widget.language },
        })
      }
    >
      <QuoteCut maxHeight={132}>
        <ResourcePreviewContent
          typography={{
            fontFamily: resolveFontFamily(fontFamily.text) || 'sans-serif',
            fontSize: 14,
            lineHeight: 22,
          }}
          target={{
            kind: 'nave',
            name: widget.topic,
            title: widget.title,
            source: { kind: 'nave', language: widget.language },
          }}
        />
      </QuoteCut>
    </QuoteBlock>
  )
}
