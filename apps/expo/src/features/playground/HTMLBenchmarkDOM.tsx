'use dom'

import { useEffect, useRef } from 'react'
import type { DOMProps } from 'expo/dom'
import HTMLContentDOM from '~common/HTMLContentDOM'
import type { ReadingTypography } from '~common/readingHtml'

// Separate benchmark entry: production readers remain untouched.
export default function HTMLBenchmarkDOM({
  html,
  typography,
  colors,
  onSizeChange,
  onReady,
  onLinkClicked,
}: {
  html: string
  typography: ReadingTypography
  colors: { background: string; text: string; link: string; emphasis: string }
  onSizeChange: (height: number) => Promise<void>
  onReady: () => Promise<void>
  onLinkClicked: (payload: { href: string; content: string; type: string }) => Promise<void>
  dom?: DOMProps
}) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let stopped = false
    let reported = false
    const check = async () => {
      if (reported || !root.current?.querySelector('.editorial-html > div')?.textContent?.trim())
        return
      reported = true
      await document.fonts.ready
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!stopped) void onReady()
        })
      )
    }
    const observer = new MutationObserver(() => {
      void check()
    })
    if (root.current) observer.observe(root.current, { childList: true, subtree: true })
    void check()
    return () => {
      stopped = true
      observer.disconnect()
    }
  }, [onReady])
  return (
    <div ref={root}>
      <HTMLContentDOM
        html={html}
        typography={typography}
        colors={colors}
        onSizeChange={onSizeChange}
        onLinkClicked={onLinkClicked}
      />
    </div>
  )
}
