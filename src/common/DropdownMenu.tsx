import * as Icon from '@expo/vector-icons'
import React from 'react'

import styled from '@emotion/native'

import { Portal } from '@gorhom/portal'
import Modal from '~common/Modal'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useBottomSheet } from '~helpers/useBottomSheet'

const StyledText = styled(Text)({
  fontSize: 14,
  fontWeight: 'bold',
  marginRight: 5,
})

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

interface DropdownMenuProps {
  currentValue?: string
  setValue: (value: string) => void
  choices: { value: string; label: string; subLabel?: string }[]
  title: string
  customRender?: React.ReactNode
}

const DropdownMenu = ({
  currentValue,
  setValue,
  choices,
  title,
  customRender,
}: DropdownMenuProps) => {
  const choice = choices.find(l => l.value === currentValue)
  const { ref, open, close } = useBottomSheet()

  const onItemPress = (value: string) => {
    setValue(value)
    close()
  }
  return (
    <>
      <TouchableBox onPress={() => open()}>
        {customRender || (
          <Box padding={10}>
            <Text color="grey" fontSize={12}>
              {title}
            </Text>
            <Box row pr={15} alignItems="center">
              <StyledText>{choice?.label}</StyledText>
              <StyledIcon name="chevron-down" size={15} />
            </Box>
          </Box>
        )}
      </TouchableBox>
      <Portal>
        <Modal.Body ref={ref} adjustToContentHeight>
          <Box
            px={20}
            pt={30}
            pb={20}
            center
            borderColor="border"
            borderBottomWidth={1}
          >
            <Text bold fontSize={20}>
              {title}
            </Text>
          </Box>
          {choices.map(({ value, label, subLabel }) => (
            <Modal.Item
              key={value}
              tag={subLabel}
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
