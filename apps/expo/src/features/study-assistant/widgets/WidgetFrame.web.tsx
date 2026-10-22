import { createContext, useContext, useState, type ReactNode, type CSSProperties } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ExpandIcon, XIcon, BookOpenIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import './widgets.css'
const WidgetCloseContext = createContext<() => void>(() => {})
export const useCloseExpandedWidget = () => useContext(WidgetCloseContext)
export default function WidgetFrame({
  title,
  eyebrow,
  children,
  expanded,
  icon,
}: {
  title: string
  eyebrow: string
  children: ReactNode
  icon?: ReactNode
  expanded?: ReactNode
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
  // In the thread a widget is set off by its light grey fill, its inner panels are white;
  // expanded, it is an opaque dialog whose panels are grey.
  const style = {
    ...palette,
    '--sw-surface': colors.lightGrey,
    '--sw-soft': colors.reverse,
  } as CSSProperties
  const dialogStyle = {
    ...palette,
    '--sw-surface': colors.reverse,
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
