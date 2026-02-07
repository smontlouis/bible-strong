import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

import Back from '~common/Back'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const HeaderBox = styled(Box)(({ theme }) => ({
  height: 60,
  alignItems: 'center',
  borderBottomColor: theme.colors.border,
}))

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

interface PericopeHeaderProps {
  hasBackButton?: boolean
  title: string
}

function PericopeHeader({ hasBackButton, title }: PericopeHeaderProps) {
  return (
    // @ts-ignore
    <HeaderBox row overflow="visibility">
      <Box justifyContent="center">
        {hasBackButton && (
          <Back padding>
            <FeatherIcon name="arrow-left" size={20} />
          </Back>
        )}
      </Box>
      <Box center flex>
        <Text fontSize={16} title marginLeft={10} marginRight={10}>
          {title}
        </Text>
      </Box>
      <Box width={30} />
    </HeaderBox>
  )
}

export default PericopeHeader
