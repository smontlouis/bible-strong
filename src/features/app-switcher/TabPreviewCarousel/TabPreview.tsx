import { Image } from 'expo-image'
import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React, { useDeferredValue } from 'react'
import { StyleSheet } from 'react-native'

import { selectAtom } from 'jotai/vanilla/utils'
import Box, { AnimatedBox, BoxProps } from '~common/ui/Box'
import Spacer from '~common/ui/Spacer'
import Text from '~common/ui/Text'
import { TabItem } from '../../../state/tabs'
import TabIcon from '../utils/getIconByTabType'
import useTabConstants from '../utils/useTabConstants'

const styles = StyleSheet.create({
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    opacity: 0.1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
})

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

  // Différer le rendu de l'image car ce composant n'est pas prioritaire
  const deferredBase64 = useDeferredValue(base64Preview)

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
      {deferredBase64 && (
        <Image
          style={styles.previewImage}
          source={{ uri: `data:image/png;base64,${deferredBase64}` }}
          cachePolicy="memory-disk"
          priority="low"
        />
      )}
      <Box center>
        <Box center width={80} height={80} borderRadius={40} backgroundColor="lightGrey">
          <Box opacity={0.6}>
            <TabIcon type={type} size={30} />
          </Box>
        </Box>
        <Spacer />
        <Text opacity={0.5} fontSize={14} color="grey" bold>
          {title}
        </Text>
      </Box>
    </AnimatedBox>
  )
}

export default TabPreview
