import type { ComponentProps } from 'react'
import Box from '~common/ui/Box'
import { IonIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { twMerge } from '~common/ui/classNames'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'

type PlayerPillProps = {
  icon: ComponentProps<typeof IonIcon>['name']
  label: string
  /** In the accent, for a setting that is on (the background music). */
  isActive?: boolean
}

/**
 * A pill above the transport, as in Audibible: what the passage is heard with, and its music.
 * Its panel opens on a press, given by the ContextualPanel around it.
 */
const PlayerPill = ({ icon, label, isActive }: PlayerPillProps) => {
  const theme = useTheme()
  return (
    <Box
      className="flex-row items-center h-[36px] pl-[12px] pr-[10px] rounded-full max-w-[220px]"
      style={{
        backgroundColor: isActive
          ? (colorWithOpacity(theme.colors.primary, 0.14) ?? theme.colors.lightPrimary)
          : (colorWithOpacity(theme.colors.default, 0.07) ?? 'transparent'),
      }}
    >
      <IonIcon name={icon} size={17} color={isActive ? 'primary' : 'default'} />
      <Text
        className={twMerge(
          isActive ? 'text-link' : 'text-default',
          'text-[13px] font-semibold ml-[6px] shrink'
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
      <IonIcon
        name="chevron-down"
        size={13}
        color={isActive ? 'primary' : 'grey'}
        style={{ marginLeft: 4 }}
      />
    </Box>
  )
}

export default PlayerPill
