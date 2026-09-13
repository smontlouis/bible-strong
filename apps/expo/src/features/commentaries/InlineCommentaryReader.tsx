import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import { getCommentaryByPublicationId } from '@bible-strong/resource-catalog/commentaries'
import ContextualSheet from '~common/ContextualPanel/ContextualSheet'
import { SheetHeader, SheetScrollView, SheetFlatList, type SheetRef } from '~common/sheet'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import SwitchableHTMLView from '~common/SwitchableHTMLView'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { ReadingSectionRequest } from '~features/resources/commentaryReadingAccess'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { resourceFailureFromAccessError } from '~features/resources/resourceFailure'
import { ResourceAccessError } from '~features/resources/resourceAccessError'
import { commentaryHrefToOsis } from './commentaryResourceParams'
import { getCommentaryBibleViewRoute } from './commentaryReferenceNavigation'
import { useRouter } from 'expo-router'
import type { InlineCommentarySection } from './inlineCommentaryPlacement'

export type InlineCommentaryRequest = ReadingSectionRequest & {
  excerpt: string
  sections?: readonly InlineCommentarySection[]
}
export default function InlineCommentaryReader({
  request,
  onClose,
}: {
  request?: InlineCommentaryRequest
  onClose: () => void
}) {
  const sheet = useRef<SheetRef>(null)
  const resources = useResourceAccess()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const router = useRouter()
  const [selection, setSelection] = useState<{ group: string; id: string }>()
  const options = request?.sections ?? []
  const group = request
    ? [
        request.resourceId,
        request.language,
        request.revision,
        request.book,
        request.chapter,
        request.sectionId,
      ].join(':')
    : ''
  const option =
    selection?.group === group ? options.find(item => item.sectionId === selection.id) : undefined
  const selectedRequest =
    request && (options.length <= 1 ? request : option ? { ...request, ...option } : undefined)
  const choosingSection = !!request && options.length > 1 && !selectedRequest
  const close = () => {
    setSelection(undefined)
    onClose()
  }
  useEffect(() => {
    if (request) sheet.current?.present()
  }, [request])
  const query = useQuery({
    queryKey: [
      'inline-commentary-section',
      request?.resourceId,
      request?.language,
      request?.revision,
      request?.book,
      request?.chapter,
      selectedRequest?.sectionId,
    ],
    queryFn: () => resources.commentaryReading.loadSection(selectedRequest!),
    enabled: !!selectedRequest,
    staleTime: Infinity,
    retry: false,
    networkMode: 'always',
  })
  const entry = request
    ? getCommentaryByPublicationId(request.resourceId, request.language)
    : undefined
  const editionUnavailable =
    query.error instanceof ResourceAccessError && query.error.code === 'NOT_FOUND'
  return (
    <ContextualSheet
      ref={sheet}
      panelWidth={500}
      snapPoints={[0.85]}
      onDismiss={close}
      onClose={close}
      header={
        <SheetHeader
          title={entry?.shortName || t('Commentaires')}
          hasBackButton={options.length > 1 && !!selectedRequest}
          onBackPress={() => setSelection(undefined)}
        />
      }
    >
      {choosingSection ? (
        <SheetFlatList
          data={options}
          keyExtractor={item => item.sectionId}
          initialNumToRender={12}
          windowSize={5}
          renderItem={({ item }) => (
            <TouchableBox
              className="mx-[16px] my-[4px] p-[12px] gap-[6px] rounded-xl bg-light-grey"
              accessibilityRole="button"
              onPress={() => setSelection({ group, id: item.sectionId })}
            >
              <Text className="text-[12px] text-tertiary">
                {item.rangeStartVerse === 0 && item.rangeEndVerse === 0
                  ? t('Introduction')
                  : t('inlineCommentary.passage', {
                      start: item.rangeStartVerse,
                      end: item.rangeEndVerse,
                    })}
              </Text>
              <Text className="text-[14px] leading-[20px]" numberOfLines={4}>
                {item.excerpt}
              </Text>
            </TouchableBox>
          )}
        />
      ) : (
        <SheetScrollView contentContainerStyle={{ padding: 20 }}>
          {query.data ? (
            <SwitchableHTMLView
              value={query.data.section.content}
              onLinkPress={href => {
                const osis = commentaryHrefToOsis(href)
                const route = osis ? getCommentaryBibleViewRoute(osis) : undefined
                if (route) router.push(route)
                else if (/^https?:\/\//i.test(href)) void Linking.openURL(href)
              }}
            />
          ) : (
            <Box className="gap-[16px]">
              <Text className="text-[16px] leading-[24px]">{selectedRequest?.excerpt}</Text>
              {editionUnavailable ? (
                <Box className="gap-[12px]">
                  <Text className="text-tertiary">{t('inlineCommentary.editionUnavailable')}</Text>
                  <Text
                    className="text-primary font-semibold"
                    onPress={() => {
                      if (!request) return
                      void queryClient.invalidateQueries({
                        queryKey: ['inline-commentary-index', request.book, request.chapter],
                      })
                      sheet.current?.dismiss()
                    }}
                  >
                    {t('inlineCommentary.refresh')}
                  </Text>
                </Box>
              ) : query.isError ? (
                <ResourceUnavailableView
                  title={t('inlineCommentary.unavailable')}
                  size="small"
                  failure={resourceFailureFromAccessError(query.error)}
                  onRetry={() => void query.refetch()}
                />
              ) : (
                <Text className="text-grey">{t('Chargement...')}</Text>
              )}
            </Box>
          )}
        </SheetScrollView>
      )}
    </ContextualSheet>
  )
}
