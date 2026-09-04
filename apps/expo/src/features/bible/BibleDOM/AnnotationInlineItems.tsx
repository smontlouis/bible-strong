'use dom'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getWordAnnotationAnchorRange } from '~redux/modules/user/wordAnnotationRanges'
import type { RootStyles, VerseRelationItem, WebViewProps } from './BibleDOMWrapper'
import { getAnnotationInsertionPoint } from './AnnotationMode/annotationDomText'
import { useDispatch } from './DispatchProvider'
import { OPEN_ANNOTATION_TAGS } from './dispatch'
import { getRelationItemNavigationActions } from './relationDisplayActions'
import RelationsText from './RelationsText'
import VerseTags from './VerseTags'
import { getAnnotationInlineAnchorKey } from './annotationInlineModel'

type PortalTarget = {
  annotationId: string
  verseKey: string
  element: HTMLSpanElement
}

type Props = {
  wordAnnotations: WebViewProps['wordAnnotations']
  annotationRelationItems: Record<string, VerseRelationItem[]>
  version: string
  settings: RootStyles['settings']
  annotationMode?: boolean
  contentKey: string
}

const AnnotationInlineItems = ({
  wordAnnotations,
  annotationRelationItems,
  version,
  settings,
  annotationMode,
  contentKey,
}: Props) => {
  const dispatch = useDispatch()
  const [portalTargets, setPortalTargets] = useState<PortalTarget[]>([])
  const relationsAreInline = (settings.relationsDisplay || 'inline') === 'inline'
  const tagsAreInline = settings.tagsDisplay === 'inline'
  const inlineAnchorKey = getAnnotationInlineAnchorKey({
    wordAnnotations,
    relationItemsByAnnotation: annotationRelationItems,
    version,
    relationsAreInline,
    tagsAreInline,
  })

  useEffect(() => {
    const targets: PortalTarget[] = []

    Object.entries(wordAnnotations).forEach(([annotationId, annotation]) => {
      if (annotation.version !== version) return
      const relationItems = annotationRelationItems[annotationId] || []
      const hasRelations = relationsAreInline && relationItems.length > 0
      const hasTags = tagsAreInline && Object.keys(annotation.tags || {}).length > 0
      if (!hasRelations && !hasTags) return

      const anchorRange = getWordAnnotationAnchorRange(annotation, 'end')
      if (!anchorRange) return
      const verseElement = document.getElementById(`verse-text-${anchorRange.verseKey}`)
      if (!verseElement) return

      const insertionPoint = getAnnotationInsertionPoint(verseElement, anchorRange.endWordIndex)
      if (!insertionPoint) return

      const element = document.createElement('span')
      element.dataset.annotationInlineItem = annotationId
      element.dataset.ignoreVerseTouch = 'true'
      const range = document.createRange()
      range.setStart(insertionPoint.node, insertionPoint.offset)
      range.collapse(true)
      range.insertNode(element)
      targets.push({ annotationId, verseKey: anchorRange.verseKey, element })
    })

    setPortalTargets(targets)
    requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('layoutChanged')))

    return () => {
      targets.forEach(target => target.element.remove())
    }
  }, [version, relationsAreInline, tagsAreInline, contentKey, inlineAnchorKey])

  useEffect(() => {
    if (!portalTargets.length) return
    requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('layoutChanged')))
  }, [portalTargets])

  return portalTargets.map(({ annotationId, verseKey, element }) => {
    const annotation = wordAnnotations[annotationId]
    if (!annotation) return null
    const relationItems = relationsAreInline ? annotationRelationItems[annotationId] || [] : []
    const tags = tagsAreInline ? Object.values(annotation.tags || {}) : []

    return createPortal(
      <span data-ignore-verse-touch>
        {relationItems.length > 0 && (
          <RelationsText
            settings={settings}
            relationItems={relationItems}
            isDisabled={annotationMode}
            onClick={item => {
              getRelationItemNavigationActions(verseKey, item).forEach(dispatch)
            }}
          />
        )}
        {tags.length > 0 && (
          <VerseTags
            settings={settings}
            isDisabled={annotationMode}
            tag={{
              date: annotation.date,
              color: annotation.color,
              verseIds: annotation.ranges.map(range => range.verseKey),
              lastVerse: verseKey,
              tags,
            }}
            onOpenTags={() => dispatch({ type: OPEN_ANNOTATION_TAGS, payload: annotationId })}
          />
        )}
      </span>,
      element,
      annotationId
    )
  })
}

export default AnnotationInlineItems
