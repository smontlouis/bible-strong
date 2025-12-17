import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React, { memo } from 'react'
import { Image, StyleSheet } from 'react-native'

import { selectAtom } from 'jotai/vanilla/utils'
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

const selectorb64 = (tab: TabItem) => tab.base64Preview
const selectorTitle = (tab: TabItem) => tab.title
const selectorType = (tab: TabItem) => tab.type

const TabPreview = ({ tabAtom }: TabPreviewProps & BoxProps) => {
  const base64Preview = useAtomValue(selectAtom(tabAtom, selectorb64))
  const title = useAtomValue(selectAtom(tabAtom, selectorTitle))
  const type = useAtomValue(selectAtom(tabAtom, selectorType))

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
          {base64Preview && (
            <Image
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 25,
                opacity: 0.1,
                ...StyleSheet.absoluteFillObject,
              }}
              source={{ uri: `data:image/png;base64,${base64Preview}` }}
            />
          )}
          <Box center>
            <Box center width={80} height={80} borderRadius={40} backgroundColor="lightGrey">
              <Box opacity={0.6}>{getIconByTabType(type, 30)}</Box>
            </Box>
            <Spacer />
            <Text opacity={0.5} fontSize={14} color="grey" bold>
              {title}
            </Text>
          </Box>
        </>
      }
    </AnimatedBox>
  )
}

export default memo(TabPreview)
