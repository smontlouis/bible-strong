import { useQuery } from '@tanstack/react-query'
import { ActivityIndicator, Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { ReadingTypography } from '~common/readingHtml'
import SwitchableHTMLView from '~common/SwitchableHTMLView'
import type { HTMLViewLinkPayload } from '~common/htmlContentTypes'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { linkifyStrongReferences, normalizeExternalContextLinks } from '~common/stylizedHtmlUtils'
import { linkifyStrongEditorialBibleReferences } from '~features/lexique/strongEditorialHtml'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import { getBibleViewRouteForStrongOsisReference } from '~features/lexique/strongReferenceNavigation'
import { createDictionaryInternalLinkRoute } from '~features/dictionnary/dictionaryInternalNavigation'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { getBook } from '~helpers/bibleBookCatalog'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useTheme } from '~themes/ThemeProvider'
import { parseReferencePreviewLink } from './referenceTarget'
import { parseResourcePreviewLink, type ResourcePreviewTarget } from './resourceTarget'
import { loadResourcePreview } from './loadResourcePreview'

export default function ResourcePreviewContent({
  target,
  typography,
}: {
  target: ResourcePreviewTarget
  typography?: ReadingTypography
}) {
  const resources = useResourceAccess()
  const theme = useTheme()
  const push = usePushRouteOnce()
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['editorial-resource-preview', target],
    queryFn: () => loadResourcePreview(target, resources),
    staleTime: 5 * 60 * 1000,
    networkMode: 'always',
  })
  const open = (payload: HTMLViewLinkPayload) => {
    const bible = parseReferencePreviewLink(payload)
    if (bible) {
      // Retain the full existing OSIS navigation where available.
      const osisRoute = payload.href.startsWith('bible://')
        ? getBibleViewRouteForStrongOsisReference(payload.href.slice(8))
        : undefined
      const first = bible.selections[0]
      const verses = bible.selections
        .filter(s => s.book === first.book && s.chapter === first.chapter)
        .flatMap(s =>
          s.start === undefined
            ? []
            : Array.from({ length: (s.end ?? s.start) - s.start + 1 }, (_, i) => s.start! + i)
        )
      push(
        osisRoute ?? {
          pathname: '/bible-view',
          params: {
            book: JSON.stringify(getBook(first.book)),
            chapter: String(first.chapter),
            verse: String(first.start ?? 1),
            ...(verses.length ? { focusVerses: JSON.stringify(verses) } : {}),
            contextDisplayMode: 'focused',
            version: bible.version,
          },
        }
      )
      return
    }
    const resource = parseResourcePreviewLink(payload, target.source, target.source.language)
    if (resource?.kind === 'dictionary')
      push(createDictionaryInternalLinkRoute(resource.word, resource.source))
    else if (resource?.kind === 'nave')
      push({
        pathname: '/nave-detail',
        params: {
          name: resource.name,
          name_lower: resource.name,
          language: resource.source.language,
        },
      })
    else if (resource?.kind === 'strong')
      push(
        createStrongDetailRoute('index', {
          book: resource.code.startsWith('G') ? 40 : 1,
          identityKind: 'dstrong',
          identityCode: resource.code,
          reference: resource.code,
        })
      )
    else if (/^https?:\/\//iu.test(payload.href)) void Linking.openURL(payload.href)
  }
  if (query.isPending)
    return (
      <ActivityIndicator accessibilityLabel={t('Chargement...')} color={theme.colors.primary} />
    )
  if (!query.data || query.isError)
    return (
      <Box className="gap-[12px]">
        <Text className="text-grey text-[14px]">{t('resourcePreview.unavailable')}</Text>
        <TouchableBox accessibilityRole="button" onPress={() => void query.refetch()}>
          <Text className="text-primary">{t('Réessayer')}</Text>
        </TouchableBox>
      </Box>
    )
  const data = query.data
  const html =
    target.kind === 'strong'
      ? linkifyStrongReferences(
          normalizeExternalContextLinks(
            linkifyStrongEditorialBibleReferences(data.html, theme.colors.primary)
          )
        )
      : data.html
  return (
    <Box className="gap-[8px]">
      {'original' in data && (
        <>
          <Text className="text-[22px]">{data.original}</Text>
          <Text className="text-[13px] text-grey">{data.transliteration}</Text>
          <Text className="text-[16px] font-semibold">{data.gloss}</Text>
        </>
      )}
      <SwitchableHTMLView
        typography={typography}
        compact
        value={html}
        previewSource={target.source}
        onLinkClicked={open}
      />
    </Box>
  )
}
