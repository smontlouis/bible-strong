import { useSetAtom } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { LinkBox } from '~common/Link'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import type { TabItem } from '~state/tabs'
import {
  commandPaletteOpenAtom,
  commandPaletteReturnFocusAtom,
  commandPaletteScopeAtom,
} from '../../commandPalette/state'

export default function NewTabSearch(_props: {
  tabAtom: PrimitiveAtom<TabItem>
  onPlanPress?: () => void
}) {
  const { t } = useTranslation()
  const setScope = useSetAtom(commandPaletteScopeAtom)
  const setOpen = useSetAtom(commandPaletteOpenAtom)
  const setReturnFocus = useSetAtom(commandPaletteReturnFocusAtom)
  return (
    <LinkBox
      accessibilityLabel={t('commandPalette.label')}
      className="flex-row items-center gap-[12px] bg-reverse border border-border rounded-[16px] px-[16px] py-[16px]"
      onPress={event => {
        if (event?.currentTarget instanceof HTMLElement) setReturnFocus(event.currentTarget)
        setScope(undefined)
        setOpen(true)
      }}
    >
      <FeatherIcon name="search" size={20} color="grey" />
      <Text className="flex-1 text-grey text-[15px]">{t('commandPalette.placeholder')}</Text>
      <Text className="text-grey text-[12px] bg-light-grey rounded-[6px] px-[7px] py-[4px]">
        {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
          ? '⌘ K'
          : 'Ctrl K'}
      </Text>
    </LinkBox>
  )
}
