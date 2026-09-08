import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { readSheetHeader } from '../readSheetHeader'
import ContextualPanel from './index'
import type { ContextualSheetProps } from './ContextualSheet'
import type { SheetFooterProps } from '~common/sheet'

/** Keeps existing imperative actions while sharing the web panel renderer. */
export default function ContextualSheet({
  ref,
  children,
  header,
  footer: Footer,
  panelTitle,
  panelHeaderRight,
  panelHeaderContent,
  maxWidth,
  panelWidth,
  panelScreens,
  panelInitialScreen,
  onPresent,
  onDismissStart,
  onDismiss,
  onClose,
  onOpenChange,
}: ContextualSheetProps) {
  const control = useRef<{ present: () => void; dismiss: () => void }>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const fallbackRef = useRef<HTMLSpanElement | null>(null)
  const lastAnchor = useRef<HTMLElement | null>(null)
  const [position, setPosition] = useState({ top: 60, left: 0, width: 1, height: 1 })
  const lastPosition = useRef(position)
  useEffect(() => {
    const capture = (event: Event) => {
      if (!(event.target instanceof Element)) return
      const element =
        event.target.closest<HTMLElement>('button, [role="button"], [role="menuitem"], a') ??
        event.target
      if (!(element instanceof HTMLElement)) return
      lastAnchor.current = element
      const rect = element.getBoundingClientRect()
      lastPosition.current = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }
    }
    document.addEventListener('pointerdown', capture, true)
    document.addEventListener('focusin', capture, true)
    return () => {
      document.removeEventListener('pointerdown', capture, true)
      document.removeEventListener('focusin', capture, true)
    }
  }, [])
  useImperativeHandle(ref, () => {
    const present = () => {
      setPosition(lastPosition.current)
      const anchor = lastAnchor.current
      // Menu items disappear as their action runs; keep their opening position.
      anchorRef.current =
        anchor?.isConnected && !anchor.closest('[role="menu"], .bs-filter-popover')
          ? anchor
          : fallbackRef.current
      control.current?.present()
    }
    const dismiss = () => control.current?.dismiss()
    return {
      present,
      presentAt: present,
      resizeTo: () => {},
      dismiss,
      close: dismiss,
      forceClose: dismiss,
    }
  })
  const heading = readSheetHeader(header)
  return (
    <>
      <span
        ref={fallbackRef}
        aria-hidden
        style={{ position: 'fixed', pointerEvents: 'none', ...position }}
      />
      <ContextualPanel
        controllerRef={control}
        anchorRef={anchorRef}
        trigger={null}
        accessibilityLabel={panelTitle ?? heading?.title ?? ''}
        initialScreen={panelInitialScreen ?? 'content'}
        width={panelWidth ?? maxWidth ?? 440}
        onOpen={() => {
          onPresent?.()
          onOpenChange?.(true)
        }}
        onClose={() => {
          onDismissStart?.()
          onDismiss?.()
          onClose?.()
          onOpenChange?.(false)
        }}
        screens={{
          ...panelScreens,
          content: {
            title: panelTitle ?? heading?.title ?? '',
            headerRight: panelHeaderRight ?? heading?.rightComponent,
            headerContent: panelHeaderContent ?? (
              <>
                {heading?.subTitle && (
                  <div style={{ padding: '0 8px 8px', fontSize: 12, opacity: 0.7 }}>
                    {heading.subTitle}
                  </div>
                )}
                {heading?.children}
              </>
            ),
            content: () => children,
            footer: Footer ? <Footer {...({} satisfies SheetFooterProps)} /> : undefined,
          },
        }}
      />
    </>
  )
}
