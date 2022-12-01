import { useAtom } from 'jotai'
import React from 'react'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { tabsAtomsAtom } from '../../state/tabs'

export interface AddTabProps {}

const AddTab = ({}: AddTabProps) => {
  const [, dispatch] = useAtom(tabsAtomsAtom)

  return (
    <Box
      position="absolute"
      bottom={40 + getBottomSpace()}
      left={0}
      right={0}
      center
    >
      <TouchableBox
        height={40}
        width={200}
        bg="reverse"
        center
        borderRadius={10}
        onPress={() => {
          dispatch({
            type: 'insert',
            value: {
              id: `new-${Date.now()}`,
              title: 'Nouvelle page',
              isRemovable: true,
              type: 'new',
              data: {},
            },
          })
        }}
      >
        <FeatherIcon name="plus" size={20} color="primary" />
      </TouchableBox>
    </Box>
  )
}

export default AddTab
