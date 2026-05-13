declare module 'react-dom/server' {
  import type React from 'react'

  export function renderToString(element: React.ReactElement): string
}
