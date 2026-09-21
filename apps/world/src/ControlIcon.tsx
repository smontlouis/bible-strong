export function ControlIcon({ name }: { name: 'plus' | 'minus' | 'reset' | 'close' | 'overview' | 'follow' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {name === 'plus' && <path d="M5 12h14M12 5v14" />}
      {name === 'minus' && <path d="M5 12h14" />}
      {name === 'close' && <path d="m6 6 12 12M18 6 6 18" />}
      {name === 'reset' && <path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" />}
      {name === 'overview' && <path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" />}
      {name === 'follow' && <><circle cx="12" cy="12" r="6" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></>}
    </svg>
  )
}
