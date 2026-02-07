import React, { useRef, useState } from 'react'
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
  onCloseComplete: externalOnCloseComplete,
  ...restProps
}: Props) => {
  const theme: Theme = useTheme()
  const [showPopover, setShowPopover] = useState(false)
  const closeResolverRef = useRef<(() => void) | null>(null)

  const closeAndWait = (): Promise<void> => {
    if (!showPopover) return Promise.resolve()
    return new Promise<void>(resolve => {
      closeResolverRef.current = resolve
      setShowPopover(false)
    })
  }

  const handleCloseComplete = () => {
    closeResolverRef.current?.()
    closeResolverRef.current = null
    externalOnCloseComplete?.()
  }

  return (
    <Popover
      isVisible={showPopover}
      onRequestClose={() => setShowPopover(false)}
      onCloseComplete={handleCloseComplete}
      popoverStyle={{
        backgroundColor: theme.colors.reverse,
        borderRadius: 10,
      }}
      arrowSize={{
        width: 0,
        height: 0,
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
      {...restProps}
    >
      <PopOverContext.Provider value={{ onClose: () => setShowPopover(false), closeAndWait }}>
        <Box paddingVertical={10}>{popover}</Box>
      </PopOverContext.Provider>
    </Popover>
  )
}

export default PopOverMenu
