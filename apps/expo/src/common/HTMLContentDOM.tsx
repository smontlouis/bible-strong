'use dom'

import { useEffect, useRef, type CSSProperties } from 'react'
import { IS_DOM, type DOMProps } from 'expo/dom'
import { useFonts } from 'expo-font'
import type { HTMLViewLinkPayload } from './htmlContentTypes'
import {
  cleanReadingHTML,
  defaultReadingTypography,
  readingHtmlCSS,
  webFontFamily,
  type ReadingTypography,
} from './readingHtml'

type Props = {
  html: string
  colors: { background: string; text: string; link: string; emphasis: string }
  onLinkClicked: (payload: HTMLViewLinkPayload) => Promise<void>
  onSizeChange: (height: number) => Promise<void>
  typography?: ReadingTypography
  padded?: boolean
  dom?: DOMProps
}

export default function HTMLContentDOM({
  html,
  colors,
  onLinkClicked,
  onSizeChange,
  typography = defaultReadingTypography,
  padded = true,
}: Props) {
  useFonts({ 'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf') })
  const containerRef = useRef<HTMLDivElement>(null)
  const content = cleanReadingHTML(html)

  useEffect(() => {
    if (!IS_DOM) return
    const container = containerRef.current
    if (!container) return

    // Measure the content root, not the document: the document can retain the
    // native viewport height and prevent shorter entries from shrinking.
    const reportSize = () => {
      void onSizeChange(
        Math.ceil(Math.max(container.offsetHeight, container.scrollHeight, padded ? 200 : 1))
      )
    }
    reportSize()
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(reportSize)
    observer?.observe(container)
    return () => observer?.disconnect()
  }, [content, onSizeChange, padded])

  return (
    <div
      ref={containerRef}
      className="editorial-html"
      style={
        {
          '--html-font-family': webFontFamily(typography.fontFamily),
          '--html-background': colors.background,
          '--html-text': colors.text,
          '--html-link': colors.link,
          '--html-emphasis': colors.emphasis,
        } as CSSProperties
      }
      onClick={event => {
        const target = event.target
        if (!(target instanceof Element)) return
        const link = target.closest('a')
        if (!link || !event.currentTarget.contains(link)) return
        event.preventDefault()
        const href = link.getAttribute('href')
        if (href)
          void onLinkClicked({ href, content: link.textContent ?? '', type: link.className })
      }}
    >
      <style>{`
        ${IS_DOM ? 'html, body { margin: 0; padding: 0; }' : ''}
        .editorial-html { display: flow-root; box-sizing: border-box; width: 100%; min-height: ${padded ? 200 : 0}px; padding: ${padded ? '8px 28px 48px' : '0'}; font-family: var(--html-font-family); font-size: ${typography.fontSize}px; line-height: ${typography.lineHeight}px; color: var(--html-text); overflow-wrap: break-word; -webkit-text-size-adjust: none; }
        ${readingHtmlCSS(typography, colors)}
        .editorial-html a { cursor: pointer; border: none; }
        .editorial-html img { max-width: 100%; height: auto; }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  )
}
