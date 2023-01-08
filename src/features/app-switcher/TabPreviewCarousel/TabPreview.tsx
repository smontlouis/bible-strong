import { PrimitiveAtom, useAtom } from 'jotai'
import React, { memo } from 'react'
import { Image, StyleSheet } from 'react-native'

import Box, { AnimatedBox, BoxProps } from '~common/ui/Box'
import Spacer from '~common/ui/Spacer'
import Text from '~common/ui/Text'
import { TabItem } from '../../../state/tabs'
import getIconByTabType from '../utils/getIconByTabType'
import useTabConstants from '../utils/useTabConstants'

interface TabPreviewProps {
  index: number
  tabAtom: PrimitiveAtom<TabItem>
}

const TabPreview = ({ index, tabAtom }: TabPreviewProps & BoxProps) => {
  const [tab] = useAtom(tabAtom)
  const { WIDTH, HEIGHT, GAP } = useTabConstants()

  return (
    <AnimatedBox
      bg="reverse"
      center
      overflow="visible"
      width={WIDTH}
      height={HEIGHT}
      marginRight={GAP}
    >
      {
        <>
          {tab.base64Preview && (
            <Image
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 25,
                opacity: 0.15,
                ...StyleSheet.absoluteFillObject,
              }}
              source={{ uri: `data:image/png;base64,${tab.base64Preview}` }}
            />
          )}
          <Box center>
            <Box
              center
              width={80}
              height={80}
              borderRadius={40}
              backgroundColor="lightGrey"
            >
              <Box opacity={0.6}>{getIconByTabType(tab.type, 30)}</Box>
            </Box>
            <Spacer />
            <Text opacity={0.5} fontSize={14} color="grey" bold>
              {tab.title}
            </Text>
          </Box>
        </>
      }
    </AnimatedBox>
  )
}

export default memo(TabPreview)
