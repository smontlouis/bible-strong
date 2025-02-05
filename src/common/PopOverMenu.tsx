import React, { useState } from 'react'
import { useTheme } from '@emotion/react'
import Popover from 'react-native-popover-view'

import Box from '~common/ui/Box'
import { Theme } from '~themes'
import { FeatherIcon } from './ui/Icon'
import { TouchableOpacity } from 'react-native'
import { PopOverContext } from './PopOverContext'
import { PopoverProps } from 'react-native-popover-view/dist/Types'

interface Props extends PopoverProps {
  element?: React.ReactNode
  popover: React.ReactNode
  width?: number
  height?: number
}

const PopOverMenu = ({
  element,
  popover,
  width = 60,
  height = 60,
  ...props
}: Props) => {
  const theme: Theme = useTheme()
  const [showPopover, setShowPopover] = useState(false)

  return (
    <Popover
      isVisible={showPopover}
      onRequestClose={() => setShowPopover(false)}
      popoverStyle={{
        backgroundColor: theme.colors.reverse,
        borderRadius: 10,
      }}
      from={
        <TouchableOpacity onPress={() => setShowPopover(true)}>
          {element || (
            <Box row center height={height} width={width}>
              <FeatherIcon name="more-vertical" size={18} />
            </Box>
          )}
        </TouchableOpacity>
      }
      {...props}
    >
      <PopOverContext.Provider value={{ onClose: () => setShowPopover(false) }}>
        <Box paddingVertical={10}>{popover}</Box>
      </PopOverContext.Provider>
    </Popover>
  )
}

export default PopOverMenu
