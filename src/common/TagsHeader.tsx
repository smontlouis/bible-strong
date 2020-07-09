import React from 'react'
import { pure } from 'recompose'
import styled from '@emotion/native'

import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import Back from '~common/Back'
import { FeatherIcon } from '~common/ui/Icon'
import { useTranslation } from 'react-i18next'

const TouchableBox = styled.TouchableOpacity({
  flexDirection: 'row',
  alignItems: 'center',
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

const Header = ({ title, setIsOpen, isOpen, selectedChip, hasBackButton }) => {
  const { t } = useTranslation()
  return (
    <HeaderBox row>
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
        <StyledText>
          {selectedChip ? selectedChip.name : t('Filtrer')}
        </StyledText>
        <FeatherIcon name="chevron-down" size={15} />
      </TouchableBox>
    </HeaderBox>
  )
}

export default pure(Header)
