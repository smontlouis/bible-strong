import type { ReactNode } from 'react'
import Link, { type LinkProps } from '~common/Link'
import Box from '~common/ui/Box'
import * as Icon from '~common/ui/classNameIcons'
import Text from '~common/ui/Text'
import type { MainStackProps } from '~navigation/type'

type HomeRowCardProps = Pick<
  LinkProps<keyof MainStackProps>,
  'route' | 'params' | 'href' | 'onPress'
> & {
  title: string
  description: string
  /** 44px square holding the icon; its background carries the tint. */
  icon: ReactNode
  iconBackground: string
  /** Dark surface for a partner app (Audibible); same sizes as the light row. */
  dark?: boolean
}

/** One-line entry of the compact home: tinted icon, title, description and chevron. */
const HomeRowCard = ({
  title,
  description,
  icon,
  iconBackground,
  dark = false,
  ...link
}: HomeRowCardProps) => (
  <Link
    {...link}
    accessibilityLabel={title}
    accessibilityHint={description}
    className={`flex-row items-center gap-[14px] min-h-[72px] px-[16px] py-[14px] rounded-[18px] shadow-[0_2px_7px_rgba(89,131,240,0.1)] ${dark ? 'bg-[#0F2742]' : 'bg-reverse'}`}
  >
    <Box
      className="w-[44px] h-[44px] rounded-[14px] overflow-hidden items-center justify-center"
      style={{ backgroundColor: iconBackground }}
    >
      {icon}
    </Box>
    <Box className="flex-1 min-w-0 gap-[2px]">
      <Text className={dark ? 'text-[16px] font-bold text-[white]' : 'text-[16px] font-bold'}>
        {title}
      </Text>
      <Text
        className={
          dark
            ? 'text-[13px] leading-[18px] text-[#C3CEDD]'
            : 'text-[13px] leading-[18px] text-grey'
        }
      >
        {description}
      </Text>
    </Box>
    <Icon.Feather name="chevron-right" size={18} color={dark ? '#C3CEDD' : '#9AA5B6'} />
  </Link>
)

export default HomeRowCard
