import { Command } from 'cmdk'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { usePathname } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { tabCommandsAtom } from '~common/useTabCommands'
import { activeTabIdAtom, appSwitcherModeAtom } from '~state/tabs'
import { matchesQuery } from './results'
import { commandPaletteReturnFocusAtom } from './state'

export default function TabActionResults({
  query,
  onDone,
}: {
  query: string
  onDone?: () => void
}) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const activeId = useAtomValue(activeTabIdAtom)
  const mode = useAtomValue(appSwitcherModeAtom)
  const registry = useAtomValue(tabCommandsAtom)
  const setReturnFocus = useSetAtom(commandPaletteReturnFocusAtom)
  const commands =
    pathname === '/' && mode === 'view'
      ? Object.entries(registry)
          .flatMap(([owner, entry]) =>
            entry.tabId === activeId
              ? entry.commands.map(command => ({ ...command, key: `${owner}:${command.id}` }))
              : []
          )
          .filter(command => matchesQuery(query, command.title))
      : []
  return (
    <Command.Group heading={t('hotkeys.tabActions')}>
      {commands.length ? (
        commands.map(command => (
          <Command.Item
            key={command.key}
            value={command.key}
            disabled={command.disabled}
            onSelect={() => {
              if (command.disabled) return
              setReturnFocus(null)
              onDone?.()
              // Let the modal release focus before an action opens another panel/dialog.
              requestAnimationFrame(() => command.run())
            }}
          >
            <span style={{ color: command.destructive ? 'var(--command-danger)' : undefined }}>
              {command.title}
            </span>
            <small>↵</small>
          </Command.Item>
        ))
      ) : (
        <div className="bs-command-status">{t('hotkeys.noActions')}</div>
      )}
    </Command.Group>
  )
}
