import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getCommentaryByPublicationId } from '@bible-strong/resource-catalog/commentaries'
import ContextualSheet from '~common/ContextualPanel/ContextualSheet'
import { SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import CommentarySectionCard from './CommentarySectionCard'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { ReadingSectionRequest } from '~features/resources/commentaryReadingAccess'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { resourceFailureFromAccessError } from '~features/resources/resourceFailure'
import { ResourceAccessError } from '~features/resources/resourceAccessError'
import type { InlineCommentarySection } from './inlineCommentaryPlacement'

export type InlineCommentaryRequest = ReadingSectionRequest & {
  excerpt: string
  sections?: readonly InlineCommentarySection[]
}
export default function InlineCommentaryReader({
  request,
  onClose,
  embedded = false,
  onSelectSection,
}: {
  request?: InlineCommentaryRequest
  onClose: () => void
  embedded?: boolean
  onSelectSection?: (sectionId: string) => void
}) {
  const sheet = useRef<SheetRef>(null)
  const resources = useResourceAccess()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
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
  const selectedId = selection?.group === group ? selection.id : request?.sectionId
  const option = options.find(item => item.sectionId === selectedId)
  const selectedRequest = request ? { ...request, ...option } : undefined
  const sectionIndex = options.findIndex(item => item.sectionId === selectedId)
  const select = (id: string) => {
    setSelection({ group, id })
    onSelectSection?.(id)
  }
  const close = () => {
    setSelection(undefined)
    onClose()
  }
  useEffect(() => {
    if (request && !embedded) sheet.current?.present()
  }, [request, embedded])
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
  const content = (
    <>
      {query.data && entry && request ? (
        <CommentarySectionCard
          preview
          entry={entry}
          language={request.language}
          book={request.book}
          chapter={request.chapter}
          section={query.data.section}
          onPrevious={
            sectionIndex > 0 ? () => select(options[sectionIndex - 1].sectionId) : undefined
          }
          onNext={
            sectionIndex >= 0 && sectionIndex < options.length - 1
              ? () => select(options[sectionIndex + 1].sectionId)
              : undefined
          }
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
                  if (embedded) onClose()
                  else sheet.current?.dismiss()
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
    </>
  )
  if (embedded)
    return (
      <Box key={selectedId} className="p-[16px]">
        {content}
      </Box>
    )
  return (
    <ContextualSheet
      ref={sheet}
      panelWidth={500}
      snapPoints={[0.85]}
      onDismiss={close}
      onClose={close}
      header={<SheetHeader title={entry?.shortName || t('Commentaires')} />}
    >
      <SheetScrollView key={selectedId} contentContainerStyle={{ padding: 16 }}>
        {content}
      </SheetScrollView>
    </ContextualSheet>
  )
}
