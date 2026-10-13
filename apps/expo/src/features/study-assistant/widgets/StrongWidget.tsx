import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { LexicalWidget } from '@bible-strong/ai-contract/contract'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import ListenToStrong from '~features/bible/ListenStrong'
import { StrongEditorialHtml } from '~features/lexique/StrongDetailUI'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import { getBibleViewRouteForStrongOsisReference } from '~features/lexique/strongReferenceNavigation'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import WidgetFrame, { WidgetIconButton, WidgetLoading, WidgetUnavailable } from './WidgetFrame'

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
    <WidgetFrame title={widget.title} eyebrow={t('assistant.widgets.strong')} icon="type">
      <Box className="px-3 py-[10px]">
        {query.isPending ? (
          <WidgetLoading />
        ) : query.isError || !entry ? (
          <WidgetUnavailable onRetry={() => void query.refetch()} />
        ) : (
          <>
            <HStack className="items-center gap-2">
              <Box className="flex-1">
                <Text
                  className="text-[24px] leading-[34px]"
                  style={{ writingDirection: entry.language === 'hebrew' ? 'rtl' : 'ltr' }}
                >
                  {entry.original}
                </Text>
                <Text className="text-grey text-[13px]">
                  {entry.transliteration}
                  {entry.pronunciation ? ` · ${entry.pronunciation}` : ''}
                </Text>
              </Box>
              <ListenToStrong
                type={entry.language === 'hebrew' ? 'hebreu' : 'grec'}
                code={entry.baseCode}
              />
              <WidgetIconButton
                icon="arrow-up-right"
                label={t('assistant.widgets.open', { reference: widget.reference })}
                onPress={() => open()}
              />
            </HStack>
            <Text className="mt-2 text-[16px] font-bold">{entry.gloss}</Text>
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
          </>
        )}
      </Box>
    </WidgetFrame>
  )
}
