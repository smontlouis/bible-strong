'use dom'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { IS_DOM, type DOMProps } from 'expo/dom'
import literata from '~assets/fonts/literata'
import type { HTMLViewLinkPayload } from './htmlContentTypes'

type Props = {
  html: string
  colors: { background: string; text: string; link: string; emphasis: string }
  onLinkClicked: (payload: HTMLViewLinkPayload) => Promise<void>
  onSizeChange: (height: number) => Promise<void>
  dom?: DOMProps
}

// Editorial HTML is now in the application document on Web. Keep content
// formatting, but never allow embedded scripts or event handlers to execute.
function cleanHTML(html: string) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  document
    .querySelectorAll('script, style, iframe, object, embed, link, meta, base, form, svg, math')
    .forEach(node => node.remove())
  document.body.querySelectorAll('*').forEach(element => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on') || ['srcdoc', 'style', 'id'].includes(name))
        element.removeAttribute(attribute.name)
      if (
        ['href', 'src', 'xlink:href'].includes(name) &&
        /^(javascript|vbscript|data):/i.test(attribute.value.replace(/[\s\u0000-\u001f]/g, ''))
      )
        element.removeAttribute(attribute.name)
    }
  })
  return document.body.innerHTML
}

export default function HTMLContentDOM({ html, colors, onLinkClicked, onSizeChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [content, setContent] = useState('')
  useEffect(() => {
    setContent(cleanHTML(html))
  }, [html])

  useEffect(() => {
    if (!IS_DOM) return
    const container = containerRef.current
    if (!container) return

    // Measure the content root, not the document: the document can retain the
    // native viewport height and prevent shorter entries from shrinking.
    const reportSize = () => {
      void onSizeChange(Math.ceil(Math.max(container.offsetHeight, container.scrollHeight, 200)))
    }
    reportSize()
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(reportSize)
    observer?.observe(container)
    return () => observer?.disconnect()
  }, [content, onSizeChange])

  return (
    <div
      ref={containerRef}
      className="editorial-html"
      style={
        {
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
        @font-face { font-family: 'Literata Book'; src: local('Literata Book'), url('${literata}') format('woff'); }
        .editorial-html { box-sizing: border-box; width: 100%; min-height: 200px; padding: 8px 28px 48px; font-family: 'Literata Book', Georgia, serif; font-size: 18px; line-height: 26px; color: var(--html-text); background: var(--html-background); overflow-wrap: break-word; }
        .editorial-html a { color: var(--html-link); text-decoration: underline; border: none; cursor: pointer; }
        .editorial-html strong, .editorial-html bold { color: var(--html-emphasis); }
        .editorial-html ul { margin: 0; padding: 0; list-style: none; }
        .editorial-html img { max-width: 100%; height: auto; }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  )
}
