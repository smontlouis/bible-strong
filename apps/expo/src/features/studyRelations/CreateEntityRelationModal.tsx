import type { Ref } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import type { SheetRef } from '~common/sheet'
import SearchSelectionSheet from '~features/search/SearchSelectionSheet'
import { attachNoteToVerseAction, createStudyRelation } from '~redux/modules/user'
import type { AppDispatch } from '~redux/store'
import { endpointsMatch, type RelationEndpoint } from './domain'
import type { RelationTargetResult } from './targetSearch'

const getNoteVerseAttachmentEndpoints = (
  sourceEndpoint: RelationEndpoint,
  targetEndpoint: RelationEndpoint
) => {
  const endpoints = [sourceEndpoint, targetEndpoint]
  const noteEndpoint = endpoints.find(
    (endpoint): endpoint is Extract<RelationEndpoint, { type: 'note' }> => endpoint.type === 'note'
  )
  const verseEndpoint = endpoints.find(
    (endpoint): endpoint is Extract<RelationEndpoint, { type: 'verse' }> =>
      endpoint.type === 'verse'
  )

  if (!noteEndpoint || !verseEndpoint) return undefined
  return { noteEndpoint, verseEndpoint }
}

type Props = {
  inline?: boolean
  ref?: Ref<SheetRef | null>
  title?: string
  sourceEndpoint: RelationEndpoint | null
  onCreated?: () => void
  onSelectTarget?: (target: RelationTargetResult) => void | Promise<void>
  allowedTypes?: RelationEndpoint['type'][]
}

export default function CreateEntityRelationModal({
  sourceEndpoint,
  onCreated,
  onSelectTarget,
  title,
  ...props
}: Props) {
  const dispatch = useDispatch<AppDispatch>()
  const { t } = useTranslation()
  return (
    <SearchSelectionSheet
      {...props}
      sourceEndpoint={sourceEndpoint}
      title={title || t('Ajouter une relation')}
      onSelectItem={async target => {
        if (!target.endpoint) return
        if (onSelectTarget) {
          await onSelectTarget(target as RelationTargetResult)
          return
        }
        if (!sourceEndpoint || endpointsMatch(sourceEndpoint, target.endpoint)) return
        const attachment = getNoteVerseAttachmentEndpoints(sourceEndpoint, target.endpoint)
        if (attachment) dispatch(attachNoteToVerseAction(attachment))
        else dispatch(createStudyRelation({ endpoints: [sourceEndpoint, target.endpoint] }))
        onCreated?.()
      }}
    />
  )
}
