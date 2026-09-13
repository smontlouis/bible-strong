import {
  getCommentaryInitials,
  getCommentaryAvatarColor,
} from '~features/commentaries/commentaryAvatarIdentity'
import { formatCommentaryExcerpt } from '~features/commentaries/commentaryExcerpt'
import type { InlineCommentaryChip } from '~features/commentaries/inlineCommentaryPlacement'
import type { RootStyles } from './BibleDOMWrapper'
import { useDispatch } from './DispatchProvider'
import { OPEN_INLINE_COMMENTARY } from './dispatch'

export type LabeledCommentaryChip = Omit<InlineCommentaryChip, 'sections'> & {
  label: string
  author?: string
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
        flexDirection: 'column',
        gap: 14,
        padding: 14,
        borderRadius: 18,
        background: colors.lightGrey,
        margin: '8px 0 14px',
        userSelect: 'none',
      }}
      onClick={event => event.stopPropagation()}
    >
      {chips.map(chip => (
        <button
          key={`${chip.resourceId}:${chip.language}:${chip.sectionId}`}
          type="button"
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
            background: 'transparent',
            color: colors.tertiary,
            fontSize: 12,
            padding: 0,
            cursor: 'pointer',
            fontFamily: 'system-ui',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            width: '100%',
            minWidth: 0,
            textAlign: 'left',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 30,
              height: 30,
              flexShrink: 0,
              borderRadius: '50%',
              background: getCommentaryAvatarColor(`${chip.resourceId}:${chip.language}`),
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Georgia, serif',
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            {getCommentaryInitials(chip.author ?? chip.label, chip.label)}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
            <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <span style={{ color: colors.default, fontSize: 13, fontWeight: 600 }}>
                {chip.label}
              </span>
              {(chip.sectionCount > 1 || chip.rangeStartVerse > 0) && (
                <span
                  style={{
                    fontSize: 11,
                    lineHeight: 1.4,
                    background: colors.lightPrimary,
                    borderRadius: 7,
                    padding: '2px 6px',
                  }}
                >
                  {chip.sectionCount > 1
                    ? `· ${chip.sectionCount}`
                    : chip.rangeStartVerse > 0
                      ? `${chip.rangeStartVerse}${chip.rangeEndVerse !== chip.rangeStartVerse ? `–${chip.rangeEndVerse}` : ''}`
                      : ''}
                </span>
              )}
            </span>
            {!!chip.excerpt.trim() && (
              <span
                style={{
                  whiteSpace: 'normal',
                  overflowWrap: 'break-word',
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                {formatCommentaryExcerpt(chip.excerpt)}
              </span>
            )}
          </span>
        </button>
      ))}
    </span>
  )
}
