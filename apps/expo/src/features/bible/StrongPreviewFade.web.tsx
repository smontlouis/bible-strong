import type { ReactNode } from 'react'

export default function StrongPreviewFade({ children }: { children: ReactNode }) {
  const gradient = 'linear-gradient(to bottom, black 0%, black 65%, transparent 100%)'
  return (
    <div style={{ height: 72, overflow: 'hidden', maskImage: gradient, WebkitMaskImage: gradient }}>
      {children}
    </div>
  )
}
