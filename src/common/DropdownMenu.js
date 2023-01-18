import * as Icon from '@expo/vector-icons'
import React from 'react'

import styled from '@emotion/native'

import { Portal } from '@gorhom/portal'
import Modal from '~common/Modal'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useModalize } from '~helpers/useModalize'

const StyledText = styled(Text)({
  fontSize: 14,
  fontWeight: 'bold',
  marginRight: 5,
})

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

const DropdownMenu = ({ currentValue, setValue, choices, title }) => {
  const { label } = choices.find(l => l.value === currentValue)
  const { ref, open, close } = useModalize()

  const onItemPress = value => {
    setValue(value)
    close()
  }
  return (
    <>
      <TouchableBox onPress={open} padding={10}>
        <Text color="grey" fontSize={12}>
          {title}
        </Text>
        <Box row pr={15} alignItems="center">
          <StyledText>{label}</StyledText>
          <StyledIcon name="chevron-down" size={15} />
        </Box>
      </TouchableBox>
      <Portal>
        <Modal.Body ref={ref} adjustToContentHeight>
          {choices.map(({ value, label, count }) => (
            <Modal.Item
              key={value}
              tag={count}
              onPress={() => onItemPress(value)}
            >
              {label}
            </Modal.Item>
          ))}
        </Modal.Body>
      </Portal>
    </>
  )
}

export default DropdownMenu
