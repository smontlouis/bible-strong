import type { EntityChip } from './entityChips'

// Serializable metadata shared by the Bible and study DOM documents.
export type EntityChipsDOMProps = {
  items: EntityChip[]
  color: string
  backgroundColor: string
  onPress: (type: EntityChip['type'], id: string) => void
}

export default function EntityChipsDOM({
  items,
  color,
  backgroundColor,
  onPress,
}: EntityChipsDOMProps) {
  if (!items.length) return null

  return (
    <div
      data-ignore-verse-touch
      dir="ltr"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 5,
        padding: '12px 20px',
        maxWidth: 600,
        marginInline: 'auto',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {items.map(item => (
        <button
          key={`${item.type}-${item.id}`}
          type="button"
          onClick={event => {
            event.stopPropagation()
            onPress(item.type, item.id)
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            border: 0,
            borderRadius: 20,
            padding: '4px 8px',
            color,
            backgroundColor,
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {item.type === 'tag' ? (
              <>
                <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
                <path d="M7 7h.01" />
              </>
            ) : (
              <>
                <circle cx="6" cy="3" r="3" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="21" r="3" />
                <path d="M6 6v12M18 9a6 6 0 0 1-6 6H6" />
              </>
            )}
          </svg>
          <span
            style={{
              maxWidth: 160,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={item.label}
          >
            {item.label}
          </span>
        </button>
      ))}
    </div>
  )
}
