type ControlIconName =
  | 'plus'
  | 'minus'
  | 'reset'
  | 'close'
  | 'overview'
  | 'follow'
  | 'search'
  | 'edit'
  | 'star'

export function ControlIcon({ name }: { name: ControlIconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'plus' && <path d="M5 12h14M12 5v14" />}
      {name === 'minus' && <path d="M5 12h14" />}
      {name === 'close' && <path d="m6 6 12 12M18 6 6 18" />}
      {name === 'reset' && <path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" />}
      {name === 'overview' && <path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" />}
      {name === 'follow' && (
        <>
          <circle cx="12" cy="12" r="6" />
          <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
        </>
      )}
      {name === 'search' && (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </>
      )}
      {name === 'edit' && (
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
        </>
      )}
      {name === 'star' && (
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
      )}
    </svg>
  )
}
