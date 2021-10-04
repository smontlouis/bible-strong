import React, { useState } from 'react'
import * as Icon from '@expo/vector-icons'

import styled from '@emotion/native'

import Modal from '~common/Modal'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const TouchableBox = styled.TouchableOpacity({
  flexDirection: 'row',
  alignItems: 'center',
  paddingRight: 15,
})

const StyledText = styled(Text)({
  fontSize: 14,
  fontWeight: 'bold',
  marginRight: 5,
})

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

const DropdownMenu = ({ currentValue, setValue, choices, title }) => {
  const [isOpen, setOpen] = useState(false)
  const { label } = choices.find(l => l.value === currentValue)
  const onItemPress = value => {
    setValue(value)
    setOpen(false)
  }
  return (
    <>
      <Box padding={10}>
        <Text color="grey" fontSize={12}>
          {title}
        </Text>
        <TouchableBox onPress={() => setOpen(true)}>
          <StyledText>{label}</StyledText>
          <StyledIcon name="chevron-down" size={15} />
        </TouchableBox>
      </Box>
      <Modal.Menu
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        adjustToContentHeight
      >
        {choices.map(({ value, label, count }) => (
          <Modal.Item
            key={value}
            tag={count}
            onPress={() => onItemPress(value)}
          >
            {label}
          </Modal.Item>
        ))}
      </Modal.Menu>
    </>
  )
}

export default DropdownMenu
