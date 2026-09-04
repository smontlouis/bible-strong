import styled from '@emotion/native'
import { Theme } from '@emotion/react'
import Link, { LinkProps } from '~common/Link'
import { MainStackProps } from '~navigation/type'

interface CardLinkItemProps {
  isLast?: boolean
}

const CardLinkItem = styled(Link)<LinkProps<keyof MainStackProps> & CardLinkItemProps>(
  ({ theme, isLast }: { theme: Theme; isLast?: boolean }) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: isLast ? 12 : 0,
  })
)

export default CardLinkItem
