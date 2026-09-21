import { useEffect, useRef } from 'react'
import { useAtom, useAtomValue } from 'jotai/react'
import { Keyboard } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { SheetRef } from '~common/sheet'
import SearchSelectionSheet from '~features/search/SearchSelectionSheet'
import { useSelectCatalogResult } from '~features/search/discovery/useSelectCatalogResult'
import { commandPaletteOpenAtom, commandPaletteScopeAtom } from './state'
import { getPickerAllowedSources, getPickerResultTab } from './pickerSelection'
import { useOpenInNewTab } from '../utils/useOpenInNewTab'

export default function GlobalCommandPalette() {
  const [open, setOpen] = useAtom(commandPaletteOpenAtom)
  const scope = useAtomValue(commandPaletteScopeAtom)
  const sheet = useRef<SheetRef>(null)
  const openTab = useOpenInNewTab()
  const { t } = useTranslation()
  useEffect(() => {
    if (open) sheet.current?.present()
    else sheet.current?.close()
  }, [open])
  const close = () => {
    Keyboard.dismiss()
    setOpen(false)
  }
  const selection = useSelectCatalogResult(tab => {
    close()
    openTab(tab, { autoRedirect: true })
  })
  return (
    <SearchSelectionSheet
      ref={sheet}
      active={open}
      browsePassages
      requirePassageVerse={scope === 'compare'}
      title={t('Rechercher')}
      allowedSources={getPickerAllowedSources(scope)}
      allowedTypes={['verse', 'note', 'study', 'strong', 'dictionary', 'nave']}
      onDismiss={close}
      onSelectItem={async (item, version) => {
        const tab = getPickerResultTab(item, version, scope)
        if (tab) await selection.select(tab)
      }}
    />
  )
}
