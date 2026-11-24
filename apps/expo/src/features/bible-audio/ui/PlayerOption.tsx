import type { ComponentProps } from 'react'
import Box from '~common/ui/Box'
import { IonIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { twMerge } from '~common/ui/classNames'

type PlayerOptionProps = {
  isActive?: boolean
  /** An Ionicons outline glyph, or nothing when the option shows its value as text. */
  icon?: ComponentProps<typeof IonIcon>['name']
  /** A value shown as text in place of the icon, such as « x1.25 ». */
  value?: string
  /** A short value under the icon, such as the time left on the sleep timer. */
  caption?: string
}

/** One of the large options of the player: an icon or a value, in the accent when it is on. */
const PlayerOption = ({ isActive, icon, value, caption }: PlayerOptionProps) => (
  <Box className="w-[48px] h-[48px] items-center justify-center">
    {icon ? (
      <IonIcon name={icon} size={24} color={isActive ? 'primary' : 'default'} />
    ) : (
      <Text className={twMerge(isActive ? 'text-link' : 'text-default', 'text-[16px] font-bold')}>
        {value}
      </Text>
    )}
    {!!caption && (
      <Text
        className={twMerge(isActive ? 'text-link' : 'text-grey', 'text-[10px] font-semibold')}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {caption}
      </Text>
    )}
  </Box>
)

export default PlayerOption
