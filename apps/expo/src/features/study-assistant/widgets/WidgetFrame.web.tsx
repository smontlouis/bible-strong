import { createContext, useContext, useState, type ReactNode, type CSSProperties } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ExpandIcon, XIcon, BookOpenIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import { resolveUniverseColors, type UniverseItem } from '~themes/universeColors'
import './widgets.css'
const WidgetCloseContext = createContext<() => void>(() => {})
export const useCloseExpandedWidget = () => useContext(WidgetCloseContext)
/**
 * A study widget with controls, set in the flow of the answer like a quote (2026-11-12): no
 * card and no fill, a rule in the resource's colour, a head line naming it, then its content.
 */
export default function WidgetFrame({
  title,
  eyebrow,
  children,
  expanded,
  icon,
  tone = 'bible',
}: {
  title: string
  eyebrow: string
  children: ReactNode
  icon?: ReactNode
  expanded?: ReactNode
  /** The resource it holds: its colour draws the rule. */
  tone?: UniverseItem
}) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation(),
    { colors, fontFamily } = useTheme()
  const palette = {
    fontFamily: resolveFontFamily(fontFamily.text),
    '--sw-ink': colors.default,
    '--sw-muted': colors.grey,
    '--sw-line': colors.separator,
    '--sw-accent': colors.link,
  }
  // In the thread a widget sits on the page with no fill, its few wells light grey; expanded,
  // it is a raised dialog whose panels are grey.
  const style = {
    ...palette,
    '--sw-surface': 'transparent',
    '--sw-soft': colors.lightGrey,
    // Passages take the accent, as the verses quoted in an answer do.
    '--sw-rule': tone === 'bible' ? colors.primary : resolveUniverseColors(colors, tone).foreground,
  } as CSSProperties
  const dialogStyle = {
    ...palette,
    '--sw-surface': colors.surfaceRaised,
    '--sw-soft': colors.lightGrey,
  } as CSSProperties
  return (
    <section className="bs-study-widget" style={style}>
      <header className="bs-widget-heading">
        {icon || <BookOpenIcon size={17} />}
        <div>
          <small>{eyebrow}</small>
          <h3>{title}</h3>
        </div>
        {expanded && (
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                className="bs-widget-icon"
                aria-label={t('assistant.widgets.expand')}
              >
                <ExpandIcon size={16} />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="bs-widget-overlay" />
              <Dialog.Content
                className="bs-widget-dialog"
                style={dialogStyle}
                aria-describedby={undefined}
              >
                <header>
                  <div>
                    <small>{eyebrow}</small>
                    <Dialog.Title>{title}</Dialog.Title>
                  </div>
                  <Dialog.Close asChild>
                    <button type="button" className="bs-widget-icon" aria-label={t('Fermer')}>
                      <XIcon size={20} />
                    </button>
                  </Dialog.Close>
                </header>
                <WidgetCloseContext.Provider value={() => setOpen(false)}>
                  <div className="bs-widget-dialog-body">{expanded}</div>
                </WidgetCloseContext.Provider>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </header>
      {children}
    </section>
  )
}
