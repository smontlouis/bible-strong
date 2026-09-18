import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowUpRightIcon } from 'lucide-react'
import type { LexicalWidget } from '@bible-strong/ai-contract/contract'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import { getBibleViewRouteForStrongOsisReference } from '~features/lexique/strongReferenceNavigation'
import { StrongEditorialHtml } from '~features/lexique/StrongDetailUI'
import ListenToStrong from '~features/bible/ListenStrong'
import WidgetFrame from './WidgetFrame.web'
export default function StrongWidget({ widget }: { widget: LexicalWidget }) {
  const { fontFamily } = useTheme()
  const { t } = useTranslation(),
    resources = useResourceAccess(),
    navigate = usePushRouteOnce()
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
    <WidgetFrame title={widget.title} eyebrow={t('assistant.widgets.strong')}>
      <div className="bs-widget-lexicon">
        {query.isPending ? (
          <p role="status">{t('Chargement...')}</p>
        ) : query.isError || !entry ? (
          <div>
            <p>{t('assistant.widgets.resourceUnavailable')}</p>
            <button type="button" onClick={() => void query.refetch()}>
              {t('assistant.errors.retry')}
            </button>
          </div>
        ) : (
          <>
            <div className="bs-widget-lexicon-heading">
              <div>
                <small>{widget.reference}</small>
                <div
                  className="bs-widget-original"
                  dir={entry.language === 'hebrew' ? 'rtl' : 'ltr'}
                >
                  {entry.original}
                </div>
                <p>
                  {entry.transliteration}
                  {entry.pronunciation ? ` · ${entry.pronunciation}` : ''}
                </p>
              </div>
              <ListenToStrong
                type={entry.language === 'hebrew' ? 'hebreu' : 'grec'}
                code={entry.baseCode}
              />
              <button
                type="button"
                className="bs-widget-icon"
                aria-label={t('assistant.widgets.open', { reference: widget.reference })}
                onClick={() => open()}
              >
                <ArrowUpRightIcon size={17} />
              </button>
            </div>
            <h4>{entry.gloss}</h4>
            <div className="bs-widget-definition">
              <StrongEditorialHtml
                typography={{
                  fontFamily: resolveFontFamily(fontFamily.text) || 'sans-serif',
                  fontSize: 14,
                  lineHeight: 24,
                }}
                value={entry.definitionHtml}
                onOpenBibleReference={osis => {
                  const route = getBibleViewRouteForStrongOsisReference(osis)
                  if (route) navigate(route)
                }}
                onOpenStrong={open}
              />
            </div>
          </>
        )}
      </div>
    </WidgetFrame>
  )
}
