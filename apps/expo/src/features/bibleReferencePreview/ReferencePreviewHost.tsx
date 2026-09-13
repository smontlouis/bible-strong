import InlineCommentaryReader from '~features/commentaries/InlineCommentaryReader'
import LinkPreviewContent from './LinkPreviewContent'
import StudyPreviewContent from './StudyPreviewContent'
import { Fragment, useEffect, useRef, useState } from 'react'
import { useAtom } from 'jotai/react'
import { useQuery } from '@tanstack/react-query'
import { ActivityIndicator, useWindowDimensions } from 'react-native'
import { useTranslation } from 'react-i18next'
import ContextualSheet from '~common/ContextualPanel/ContextualSheet'
import { SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useReadingTypography } from '~common/useReadingTypography'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { localQueryOptions } from '~helpers/queryOptions'
import { useTheme } from '~themes/ThemeProvider'
import { previewHistoryAtom, PreviewNestedContext, type ReferencePreviewRequest } from './state'
import NotePreviewContent from './NotePreviewContent'
import ResourcePreviewContent from './ResourcePreviewContent'
import { loadReferencePreview } from './loadPreview'
import { selectBibleReferenceVersion } from '~helpers/bibleReferenceVersion'

export default function ReferencePreviewHost() {
  const [history, setHistory] = useAtom(previewHistoryAtom)
  const request = history.at(-1)
  const rootRequest = history[0]
  const [commentarySelection, setCommentarySelection] = useState<{
    request: typeof request
    sectionId: string
  }>()
  const commentarySectionId =
    request?.kind === 'commentary'
      ? commentarySelection?.request === request
        ? commentarySelection.sectionId
        : request.request.sectionId
      : undefined
  const resources = useResourceAccess()
  const versionQuery = useQuery({
    queryKey: [
      'reference-preview-version',
      request?.kind === 'bible' ? request.version : null,
      request?.kind === 'bible' ? request.selections.map(selection => selection.book) : [],
    ],
    queryFn: () =>
      request?.kind === 'bible'
        ? selectBibleReferenceVersion(
            request.version,
            request.selections.map(selection => selection.book),
            resources.bibleContent
          )
        : Promise.resolve(null),
    enabled: request?.kind === 'bible',
    ...localQueryOptions,
  })
  const { height } = useWindowDimensions()
  const sheet = useRef<SheetRef>(null)
  const { t } = useTranslation()
  useEffect(() => {
    if (rootRequest) sheet.current?.present()
  }, [rootRequest])
  const open = () => {
    if (!request) return
    sheet.current?.dismiss()
    setHistory([])
    if (request.kind === 'commentary') request.open(commentarySectionId)
    else request.open()
  }
  const openButton = (
    <TouchableBox
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={t(
        request?.kind === 'bible' ? 'referencePreview.open' : 'resourcePreview.open'
      )}
      className="p-[10px]"
    >
      <FeatherIcon name="external-link" size={18} color="primary" />
    </TouchableBox>
  )
  return (
    <ContextualSheet
      ref={sheet}
      panelWidth={440}
      header={
        <SheetHeader
          title={
            request
              ? request.kind === 'bible'
                ? `${request.title} · ${versionQuery.data ?? request.version}`
                : request.kind === 'dictionary'
                  ? `${request.title} · ${request.source.dictionaryTitle}`
                  : request.kind === 'study'
                    ? request.title || t('Études')
                    : request.title
              : undefined
          }
          leftComponent={
            history.length > 1 ? (
              <TouchableBox
                accessibilityRole="button"
                accessibilityLabel={t('Retour')}
                onPress={() => setHistory(items => items.slice(0, -1))}
                className="p-[10px]"
              >
                <FeatherIcon name="arrow-left" size={18} />
              </TouchableBox>
            ) : undefined
          }
          rightComponent={openButton}
        />
      }
      onClose={() => setHistory([])}
    >
      <PreviewNestedContext.Provider value={true}>
        {request &&
          (request.kind === 'bible' ? (
            versionQuery.isPending ? (
              <ActivityIndicator />
            ) : (
              <PreviewContent
                key={JSON.stringify(request)}
                request={{ ...request, version: versionQuery.data ?? request.version }}
              />
            )
          ) : request.kind === 'commentary' ? (
            <InlineCommentaryReader
              embedded
              request={{ ...request.request, sectionId: commentarySectionId! }}
              onClose={() => setHistory([])}
              onSelectSection={sectionId => setCommentarySelection({ request, sectionId })}
            />
          ) : (
            <SheetScrollView
              key={JSON.stringify(request)}
              style={{ maxHeight: Math.min(360, height * 0.55), flexGrow: 0 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
            >
              {request.kind === 'link' ? (
                <LinkPreviewContent linkId={request.linkId} />
              ) : request.kind === 'study' ? (
                <StudyPreviewContent studyId={request.studyId} />
              ) : request.kind === 'note' ? (
                <NotePreviewContent noteId={request.noteId} />
              ) : (
                <ResourcePreviewContent key={JSON.stringify(request)} target={request} />
              )}
            </SheetScrollView>
          ))}
      </PreviewNestedContext.Provider>
    </ContextualSheet>
  )
}

function PreviewContent({ request }: { request: ReferencePreviewRequest }) {
  const resources = useResourceAccess()
  const theme = useTheme()
  const typography = useReadingTypography()
  const { height } = useWindowDimensions()
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['bible-reference-preview', request.version, request.selections],
    queryFn: () => loadReferencePreview(request, request.version, resources.bibleContent),
    staleTime: 5 * 60 * 1000,
    ...localQueryOptions,
  })
  return (
    <SheetScrollView
      style={{ maxHeight: Math.min(360, height * 0.55), flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
    >
      {query.isPending ? (
        <ActivityIndicator accessibilityLabel={t('Chargement...')} color={theme.colors.primary} />
      ) : query.isError || !query.data?.length ? (
        <Box className="gap-[12px]">
          <Text className="text-grey text-[14px]">{t('referencePreview.unavailable')}</Text>
          <TouchableBox accessibilityRole="button" onPress={() => void query.refetch()}>
            <Text className="text-primary">{t('Réessayer')}</Text>
          </TouchableBox>
        </Box>
      ) : (
        <Text
          style={{
            fontFamily: typography.fontFamily,
            fontSize: 16,
            lineHeight: 24,
          }}
        >
          {query.data.map(verse => (
            <Fragment key={`${verse.Livre}-${verse.Chapitre}-${verse.Verset}`}>
              <Text className="text-grey text-[11px]">{verse.Verset} </Text>
              {verse.Texte.replace(/<[^>]*>/gu, '')}{' '}
            </Fragment>
          ))}
        </Text>
      )}
    </SheetScrollView>
  )
}
