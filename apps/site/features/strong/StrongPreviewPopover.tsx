import { useEffect, useRef, useState, type RefObject } from 'react'
import { useI18n } from '@/locales'
import type { ResourceLanguage } from '../resources/publicSite'
import { loadStrongPreview, type StrongPreviewData } from './strong.functions'
import { buildStrongConcordancePath, buildStrongPath, displayStrongCode } from './strongRoutes'

type PreviewState = {
  code: string
  status: 'loading' | 'ready' | 'error'
  preview?: StrongPreviewData
}

// One request per entry and language for the life of the page.
const previews = new Map<string, Promise<StrongPreviewData>>()

const SHEET_BREAKPOINT = 640
const POPOVER_WIDTH = 360
const GUTTER = 12

/** Anchors the card under its Strong number, or above when the page ends below it. */
const placePopover = (popover: HTMLElement, anchor: Element) => {
  if (window.innerWidth < SHEET_BREAKPOINT) {
    popover.dataset.placement = 'sheet'
    popover.removeAttribute('style')
    return
  }
  const rect = anchor.getBoundingClientRect()
  const width = Math.min(POPOVER_WIDTH, window.innerWidth - GUTTER * 2)
  const left = Math.min(
    Math.max(GUTTER, rect.left + rect.width / 2 - width / 2),
    window.innerWidth - width - GUTTER
  )
  const spaceBelow = window.innerHeight - rect.bottom
  popover.dataset.placement = 'anchored'
  popover.style.width = `${width}px`
  popover.style.left = `${left}px`
  if (spaceBelow < 280 && rect.top > spaceBelow) {
    popover.style.top = 'auto'
    popover.style.bottom = `${window.innerHeight - rect.top + 8}px`
  } else {
    popover.style.bottom = 'auto'
    popover.style.top = `${rect.bottom + 8}px`
  }
}

/**
 * The card opened by a Strong number, as in the study workspace. Strong numbers are plain
 * links to their entry; where the browser supports popovers, a click previews the entry
 * instead of leaving the passage.
 */
export default function StrongPreviewPopover({
  containerRef,
  language,
}: {
  /** The element whose `a[data-strong]` links open the card. */
  containerRef: RefObject<HTMLElement | null>
  language: ResourceLanguage
}) {
  const t = useI18n()
  const popoverRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<PreviewState>()

  useEffect(() => {
    const container = containerRef.current
    const popover = popoverRef.current
    if (!container || !popover || typeof popover.showPopover !== 'function') return

    const onClick = (event: MouseEvent) => {
      const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      if (event.defaultPrevented || event.button !== 0 || modified) return
      const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[data-strong]')
      const code = anchor?.dataset.strong
      if (!anchor || !code) return
      event.preventDefault()

      if (popover.matches(':popover-open')) popover.hidePopover()
      placePopover(popover, anchor)
      setState({ code, status: 'loading' })
      popover.showPopover()

      const key = `${language}:${code}`
      let request = previews.get(key)
      if (!request) {
        request = loadStrongPreview({ data: { language, code } })
        previews.set(key, request)
        request.catch(() => previews.delete(key))
      }
      request.then(
        preview =>
          setState(current =>
            current?.code === code ? { code, status: 'ready', preview } : current
          ),
        () => setState(current => (current?.code === code ? { code, status: 'error' } : current))
      )
    }
    // An anchored card would drift away from its number while the page scrolls.
    const onScroll = () => {
      if (popover.dataset.placement === 'anchored' && popover.matches(':popover-open')) {
        popover.hidePopover()
      }
    }

    container.addEventListener('click', onClick)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('click', onClick)
      window.removeEventListener('scroll', onScroll)
    }
  }, [containerRef, language])

  const preview = state?.preview
  const hebrew = state?.code.startsWith('H')

  return (
    // `popover` is not typed by React 18; the attribute reaches the DOM as written.
    <div ref={popoverRef} {...{ popover: 'auto' }} className="strong-popover">
      {state && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="resource-chip font-semibold">
              Strong {displayStrongCode(state.code)}
            </span>
            {preview && (
              <span className="font-serif text-2xl" lang={hebrew ? 'he' : 'grc'} dir="auto">
                {preview.original}
              </span>
            )}
          </div>

          {state.status === 'loading' && (
            <p className="resource-muted mt-4 text-sm">{t('strong.preview.loading')}</p>
          )}
          {state.status === 'error' && (
            <p className="mt-4 text-sm">{t('strong.preview.error')}</p>
          )}
          {preview && (
            <>
              <p className="mt-3 text-lg font-semibold">{preview.gloss}</p>
              <p className="resource-muted text-sm italic">
                {[preview.transliteration, preview.pronunciation].filter(Boolean).join(' · ')}
              </p>
              {preview.morphology && (
                <p className="resource-muted mt-1 text-sm">{preview.morphology}</p>
              )}
              {preview.definitionHtml && (
                <div
                  className="resource-prose strong-popover__definition"
                  dangerouslySetInnerHTML={{ __html: preview.definitionHtml }}
                />
              )}
            </>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <a className="resource-cta" href={buildStrongPath(language, state.code)}>
              {t('strong.preview.open')}
            </a>
            <a
              className="resource-link text-sm font-semibold"
              href={buildStrongConcordancePath(language, state.code)}
            >
              {t('strong.preview.concordance')}
            </a>
          </div>
        </>
      )}
    </div>
  )
}
