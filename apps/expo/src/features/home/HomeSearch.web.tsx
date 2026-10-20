import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { LinkBox } from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import {
  commandPaletteOpenAtom,
  commandPaletteReturnFocusAtom,
} from '~features/app-switcher/commandPalette/state'

/** Opens the command palette, which returns focus here when it closes. */
export default function HomeSearch() {
  const { t } = useTranslation()
  const openCommandPalette = useSetAtom(commandPaletteOpenAtom)
  const setCommandReturnFocus = useSetAtom(commandPaletteReturnFocusAtom)
  return (
    <LinkBox
      onPress={event => {
        if (event?.currentTarget instanceof HTMLElement) setCommandReturnFocus(event.currentTarget)
        openCommandPalette(true)
      }}
      accessibilityLabel={t('commandPalette.label')}
      className="flex-row items-center gap-[12px] bg-surface rounded-[12px] px-[16px] py-[14px]"
    >
      <FeatherIcon name="search" size={19} color="grey" />
      <Text className="text-grey text-[13px] flex-1 min-w-0" numberOfLines={1}>
        {t('home.dashboard.search')}
      </Text>
      <kbd className="bs-home-shortcut">
        {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
          ? '⌘ K'
          : 'Ctrl K'}
      </kbd>
    </LinkBox>
  )
}
