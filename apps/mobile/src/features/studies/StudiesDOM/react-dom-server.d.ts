declare module 'react-dom/server.browser' {
  import type React from 'react'

  export function renderToString(element: React.ReactElement): string
}
