const SIGNS = {
  dictionary: 'M7 17 10.8 7h2.4L17 17h-2.4l-.8-2.4h-3.6L9.4 17Zm3.8-4.4h2.4L12 9Z',
  nave: 'M7.5 17V7h2.3l4.4 6.7V7h2.3v10h-2.3L9.8 10.3V17Z',
} as const

export type ResourceMarkKind = keyof typeof SIGNS | 'timeline'

/**
 * The mark of a study resource, drawn like the icons of the app
 * (`apps/expo/src/common/icons/resource-icon-shapes.json`): an item of a resource wears it
 * wherever it appears.
 */
export default function ResourceMark({ kind }: { kind: ResourceMarkKind }) {
  return (
    <svg
      className={`resource-mark resource-mark--${kind}`}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      {kind === 'timeline' ? (
        <>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 7v5l3.5 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <rect x="3" y="2" width="18" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d={SIGNS[kind]} fill="currentColor" />
        </>
      )}
    </svg>
  )
}
