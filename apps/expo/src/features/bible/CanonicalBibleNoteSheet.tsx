import React from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import Text from '~common/ui/Text'
import {
  getCanonicalBibleNoteLabel,
  parseCanonicalBibleNoteMarkup,
  type CanonicalBibleNote,
  type CanonicalBibleNoteMarkupNode,
} from '~helpers/canonicalBibleNotes'

type CanonicalBibleNoteSheetProps = {
  sheetRef: React.RefObject<SheetRef | null>
  note: CanonicalBibleNote | null
  onReferencePress: (osis: string) => void
}

const CanonicalBibleNoteSheet = ({
  sheetRef,
  note,
  onReferencePress,
}: CanonicalBibleNoteSheetProps) => {
  const { t } = useTranslation()
  const label = note ? getCanonicalBibleNoteLabel(note.markup) : undefined
  const nodes = note ? parseCanonicalBibleNoteMarkup(note.markup) : []

  return (
    <Sheet
      ref={sheetRef}
      header={<SheetHeader title={label ? t('Note {{label}}', { label }) : t('Note')} />}
    >
      <SheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 18 }}>
        <Text fontSize={18} lineHeight={29} selectable>
          {renderNoteNodes(nodes, onReferencePress)}
        </Text>
      </SheetScrollView>
    </Sheet>
  )
}

const renderNoteNodes = (
  nodes: CanonicalBibleNoteMarkupNode[],
  onReferencePress: (osis: string) => void,
  keyPrefix = 'note'
): React.ReactNode[] =>
  nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`
    if (node.kind === 'text') return node.text

    const children = renderNoteNodes(node.children, onReferencePress, key)
    switch (node.tag) {
      case 'i':
        return (
          <Text key={key} style={{ fontStyle: 'italic' }}>
            {children}
          </Text>
        )
      case 'divineName':
      case 'small-caps':
        return (
          <Text key={key} style={{ fontVariant: ['small-caps'], letterSpacing: 0.25 }}>
            {children}
          </Text>
        )
      case 'sup':
        return (
          <Text key={key} fontSize={11} style={{ transform: [{ translateY: -4 }] }}>
            {children}
          </Text>
        )
      case 'ref': {
        const osis = node.attributes.id
        return (
          <Text
            key={key}
            color="primary"
            underline
            accessibilityRole={osis ? 'link' : undefined}
            onPress={osis ? () => onReferencePress(osis) : undefined}
          >
            {children}
          </Text>
        )
      }
      case 'note':
      default:
        return <React.Fragment key={key}>{children}</React.Fragment>
    }
  })

export default CanonicalBibleNoteSheet
