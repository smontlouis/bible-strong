import { recentCommandTabIdsAtom } from './state'
import PlanPicker from './PlanPicker'
import * as Dialog from '@radix-ui/react-dialog'
import { usePathname } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { activeGroupAtom, activeTabIdAtom, appSwitcherModeAtom } from '~state/tabs'
import { SelectBibleReferenceModalProvider } from '../TabScreen/NewTab/SelectBibleReferenceModalProvider'
import CommandPalette from './CommandPalette.web'

export default function GlobalCommandPalette() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const activeId = useAtomValue(activeTabIdAtom)
  const mode = useAtomValue(appSwitcherModeAtom)
  const group = useAtomValue(activeGroupAtom)
  const activeType = group.tabs[group.activeTabIndex]?.type
  const setRecentIds = useSetAtom(recentCommandTabIdsAtom)
  useEffect(() => {
    if (pathname !== '/' || mode !== 'view' || !activeId || activeType === 'new') return
    setRecentIds(previous => [activeId, ...previous.filter(id => id !== activeId)].slice(0, 50))
  }, [activeId, activeType, pathname, mode, setRecentIds])
  const [open, setOpen] = useState(false)
  const restoreFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        event.altKey ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== 'k'
      )
        return
      event.preventDefault()
      if (event.repeat) return
      const inline =
        pathname === '/' && mode === 'view'
          ? document.getElementById(`command-search-${activeId}`)?.querySelector('input')
          : null
      if (inline) {
        inline.focus()
        return
      }
      if (!open)
        restoreFocus.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
      setOpen(previous => !previous)
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [pathname, activeId, mode, open])
  return (
    <SelectBibleReferenceModalProvider>
      <PlanPicker>
        {openPlans => (
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="bs-command-overlay" />
              <Dialog.Content
                className="bs-command-dialog"
                aria-describedby={undefined}
                onCloseAutoFocus={event => {
                  event.preventDefault()
                  restoreFocus.current?.focus()
                }}
              >
                <Dialog.Title className="bs-command-sr-only">
                  {t('commandPalette.label')}
                </Dialog.Title>
                <CommandPalette onDone={() => setOpen(false)} onPlanPress={openPlans} />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </PlanPicker>
    </SelectBibleReferenceModalProvider>
  )
}
