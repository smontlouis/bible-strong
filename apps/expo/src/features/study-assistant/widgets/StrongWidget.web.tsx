import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { LexicalWidget } from '@bible-strong/ai-contract/contract'
import ListenToStrong from '~features/bible/ListenStrong'
import { StrongEditorialPreview } from '~features/lexique/StrongDetailUI'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import { getBibleViewRouteForStrongOsisReference } from '~features/lexique/strongReferenceNavigation'
import { useStrongReadingTypography } from '~features/lexique/useStrongReadingTypography'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { QuoteBlock } from './QuoteBlock.web'

/** A word of the lexicon: the word, its sound and sense, then the first lines of its entry. */
export default function StrongWidget({ widget }: { widget: LexicalWidget }) {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const navigate = usePushRouteOnce()
  const reading = useStrongReadingTypography()
  const query = useQuery({
    queryKey: ['assistant-widget-lexicon', widget.reference, widget.identityKind, widget.language],
    queryFn: () =>
      resources.strongLexicon.loadEntry(
        { kind: widget.identityKind, code: widget.reference },
        widget.language
      ),
    staleTime: 300000,
  })
  const entry = query.data
  const open = (code = widget.reference) =>
    navigate(
      createStrongDetailRoute('index', {
        book: code.startsWith('G') ? 40 : 1,
        identityCode: code,
        identityKind: code === widget.reference ? widget.identityKind : 'dstrong',
      })
    )
  return (
    <QuoteBlock
      mark="strong"
      foot={t('assistant.widgets.strongFoot', { reference: widget.reference })}
      onPress={() => open()}
    >
      {!entry ? (
        <p className="bs-quote-muted">
          {query.isError ? t('assistant.widgets.resourceUnavailable') : widget.title}
        </p>
      ) : (
        <>
          <div className="bs-quote-word">
            <span className="bs-quote-original" dir={entry.language === 'hebrew' ? 'rtl' : 'ltr'}>
              {entry.original}
            </span>
            <span className="bs-quote-sense">
              {[entry.transliteration, entry.gloss].filter(Boolean).join(' · ')}
            </span>
            <ListenToStrong
              type={entry.language === 'hebrew' ? 'hebreu' : 'grec'}
              code={entry.baseCode}
            />
          </div>
          <StrongEditorialPreview
            value={entry.definitionHtml}
            numberOfLines={3}
            readingTypography={{ ...reading, fontSizeScale: reading.fontSizeScale - 2 }}
            onOpenBibleReference={osis => {
              const route = getBibleViewRouteForStrongOsisReference(osis)
              if (route) navigate(route)
            }}
            onOpenStrong={open}
          />
        </>
      )}
    </QuoteBlock>
  )
}
