import type { InlineCommentaryChip } from '~features/commentaries/inlineCommentaryPlacement'
import type { RootStyles } from './BibleDOMWrapper'
import { useDispatch } from './DispatchProvider'
import { OPEN_INLINE_COMMENTARY } from './dispatch'

export type LabeledCommentaryChip = Omit<InlineCommentaryChip, 'sections'> & {
  label: string
  sectionCount: number
}
export default function InlineCommentaryChips({
  chips,
  settings,
}: {
  chips?: readonly LabeledCommentaryChip[]
  settings: RootStyles['settings']
}) {
  const dispatch = useDispatch()
  if (!chips?.length) return null
  const colors = settings.colors[settings.theme]
  return (
    <span
      contentEditable={false}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        margin: '8px 0 14px',
        userSelect: 'none',
      }}
      onClick={event => event.stopPropagation()}
    >
      {chips.map(chip => (
        <button
          key={`${chip.resourceId}:${chip.language}:${chip.sectionId}`}
          type="button"
          title={chip.excerpt}
          onClick={() =>
            dispatch({
              type: OPEN_INLINE_COMMENTARY,
              payload: {
                sectionId: chip.sectionId,
                resourceId: chip.resourceId,
                language: chip.language,
                revision: chip.revision,
              },
            })
          }
          style={{
            border: 0,
            borderRadius: 9,
            background: colors.lightGrey,
            color: colors.tertiary,
            fontSize: 12,
            padding: '5px 9px',
            cursor: 'pointer',
            fontFamily: 'system-ui',
          }}
        >
          {chip.label}
          {chip.sectionCount > 1
            ? ` · ${chip.sectionCount}`
            : chip.rangeStartVerse > 0
              ? ` · ${chip.rangeStartVerse}${chip.rangeEndVerse !== chip.rangeStartVerse ? `–${chip.rangeEndVerse}` : ''}`
              : ''}
        </button>
      ))}
    </span>
  )
}
