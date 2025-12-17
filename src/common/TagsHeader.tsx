import styled from '@emotion/native'
import React, { memo } from 'react'

import { useTranslation } from 'react-i18next'
import Back from '~common/Back'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

const TouchableBox = styled.TouchableOpacity({
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-end',
  paddingRight: 15,
  paddingVertical: 15,
})

const StyledText = styled(Text)({
  fontSize: 14,
  marginRight: 5,
})

const HeaderBox = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  borderBottomColor: theme.colors.border,
}))

const Header = ({ title, setIsOpen, isOpen, selectedChip, hasBackButton }: any) => {
  const { t } = useTranslation()
  return (
    <HeaderBox row bg="reverse">
      {hasBackButton ? (
        <Back padding>
          <FeatherIcon name="arrow-left" size={20} />
        </Back>
      ) : (
        <Box width={15} />
      )}
      <Box flex justifyContent="center">
        <Text fontSize={20} title>
          {title}{' '}
        </Text>
      </Box>
      <TouchableBox onPress={() => setIsOpen(!isOpen)}>
        <StyledText numberOfLines={1}>{selectedChip ? selectedChip.name : t('Filtrer')}</StyledText>
        <FeatherIcon name="chevron-down" size={15} />
      </TouchableBox>
    </HeaderBox>
  )
}

export default memo(Header)
