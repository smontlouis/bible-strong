import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
  type ReactElement,
} from 'react'
import { Popover } from '@heroui/react/popover'
import { useTheme } from '~themes/ThemeProvider'
import { webFontFamily } from '~helpers/webFontFamily'
import type { SheetProps, SheetRef } from '~common/sheet'
import '~common/FiltersHeader.web.css'

export default function StrongSelectionContainer({
  ref,
  children,
  header,
  onDismissStart,
  onDismiss,
  onClose,
}: SheetProps & { ref?: Ref<SheetRef> }) {
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const anchorRef = useRef<HTMLElement | null>(null)
  const clickedRef = useRef<HTMLElement | null>(null)
  const handleOutsidePointer = useEffectEvent((target: HTMLElement) => {
    if (openRef.current && !anchorRef.current?.contains(target)) close()
  })
  useEffect(() => {
    const capture = (event: PointerEvent) => {
      if (
        event.target instanceof HTMLElement &&
        !event.target.closest('[data-strong-selection-panel]')
      ) {
        handleOutsidePointer(event.target)
        clickedRef.current = event.target
      }
    }
    document.addEventListener('pointerdown', capture, true)
    return () => document.removeEventListener('pointerdown', capture, true)
  }, [])
  const close = () => {
    if (!openRef.current) return
    openRef.current = false
    setOpen(false)
    onDismissStart?.()
    onDismiss?.()
    onClose?.()
  }
  const present = () => {
    const clicked = clickedRef.current
    anchorRef.current = clicked?.isConnected
      ? clicked
      : (document.querySelector<HTMLElement>('[data-testid="workspace-main-surface"]') ??
        document.body)
    openRef.current = true
    setOpen(true)
  }
  useImperativeHandle(ref, () => ({
    present,
    presentAt: present,
    resizeTo: () => {},
    dismiss: close,
    close,
    forceClose: close,
  }))
  const title = (header as ReactElement<{ title?: string }> | undefined)?.props?.title ?? 'Strong'
  return (
    <Popover
      isOpen={open}
      onOpenChange={value => {
        if (!value) close()
      }}
    >
      <Popover.Content
        triggerRef={anchorRef}
        placement="bottom"
        offset={8}
        isNonModal
        shouldCloseOnInteractOutside={element => !anchorRef.current?.contains(element)}
        className="bs-filter-popover"
        data-strong-selection-panel
        style={{
          width: 440,
          background: theme.colors.reverse,
          color: theme.colors.default,
          borderColor: theme.colors.border,
          fontFamily: webFontFamily(theme.fontFamily.text),
          fontSize: 14,
          lineHeight: '20px',
        }}
      >
        <Popover.Dialog>
          <div className="bs-filter-heading">
            <Popover.Heading style={{ fontFamily: webFontFamily(theme.fontFamily.title) }}>
              {title}
            </Popover.Heading>
          </div>
          <div className="bs-filter-options">{children}</div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
