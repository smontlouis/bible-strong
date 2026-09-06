import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, useTheme } from '~themes/ThemeProvider'
import { twMerge } from '~common/ui/classNames'
import Color from 'color'
import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { Image, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Box, { AnimatedBox, AnimatedTouchableBox, BoxProps } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { TabItem } from '../../../state/tabs'
import TabIcon from '../utils/getIconByTabType'
import useTabConstants from '../utils/useTabConstants'
import useTabPreview from './useTabPreview'
import { LinearTransition, ZoomOut } from 'react-native-reanimated'
// Styles statiques hors du composant pour éviter les re-créations
const styles = StyleSheet.create({
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    opacity: 0.15,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradient: {
    height: 60,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
})

interface TabPreviewProps {
  index: number
  tabAtom: PrimitiveAtom<TabItem>
  groupId: string
}

const TabPreview = ({ index, tabAtom, groupId, ...props }: TabPreviewProps & BoxProps) => {
  const theme = useTheme()
  const tab = useAtomValue(tabAtom)

  const { base64Preview, type, isRemovable } = tab

  const { GAP, TAB_PREVIEW_WIDTH, TAB_PREVIEW_HEIGHT } = useTabConstants()

  const { ref, boxStyles, previewImageStyles, textStyles, xStyles, onOpen, onClose } =
    useTabPreview({
      index,
      tabAtom,
      groupId,
    })

  return (
    <AnimatedBox
      className="border-continuous overflow-visible"
      style={[
        { marginBottom: GAP, width: TAB_PREVIEW_WIDTH, height: TAB_PREVIEW_HEIGHT },
        boxStyles,
      ]}
      layout={LinearTransition}
      // entering={ZoomIn}
      exiting={ZoomOut}
    >
      <AnimatedTouchableBox
        onPress={onOpen}
        activeOpacity={1}
        {...props}
        style={[{ width: TAB_PREVIEW_WIDTH, height: TAB_PREVIEW_HEIGHT }, props.style]}
        className={twMerge(
          'overflow-hidden border-continuous',
          twMerge('overflow-visible', props.className)
        )}
      >
        <AnimatedBox
          className="border-continuous overflow-visible bg-reverse items-center justify-center"
          ref={ref}
          style={[
            previewImageStyles,
            {
              shadowColor: theme.colors.default,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 7,
              elevation: 2,
            },
          ]}
        >
          <>
            {base64Preview && (
              <Image
                style={styles.previewImage}
                source={{ uri: `data:image/jpeg;base64,${base64Preview}` }}
              />
            )}
            <Box className="overflow-hidden border-continuous items-center justify-center w-[80px] h-[80px] rounded-[40px] bg-reverse">
              <Box className="overflow-hidden border-continuous">
                <TabIcon type={type} size={30} />
              </Box>
            </Box>
            <LinearGradient
              start={[0, 0]}
              end={[0, 1]}
              style={styles.gradient}
              colors={[
                Color(theme.colors.reverse).alpha(1).string(),
                Color(theme.colors.reverse).alpha(0).string(),
              ]}
            />
          </>

          <AnimatedBox
            className="border-continuous overflow-visible flex-row items-center absolute top-[0px] left-[0px] right-[40px] h-[40px] pl-[14px] pr-[5px]"
            style={textStyles}
          >
            <TabIcon type={type} size={16} />
            <Title tabAtom={tabAtom} />
          </AnimatedBox>
        </AnimatedBox>
      </AnimatedTouchableBox>

      {isRemovable && (
        <AnimatedTouchableBox
          className="overflow-hidden border-continuous absolute top-[0px] right-[0px] w-[40px] h-[40px] items-center justify-center"
          style={xStyles}
          onPress={onClose}
        >
          <Box
            className="overflow-hidden border-continuous bg-reverse w-[24px] h-[24px] rounded-[12px] items-center justify-center"
            style={{
              shadowColor: 'rgb(89,131,240)',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 7,
              elevation: 1,
              overflow: 'visible',
            }}
          >
            <FeatherIcon name="x" size={16} />
          </Box>
        </AnimatedTouchableBox>
      )}
    </AnimatedBox>
  )
}

const Title = ({ tabAtom }: { tabAtom: PrimitiveAtom<TabItem> }) => {
  const stylingTheme = useStylingTheme()

  const tab = useAtomValue(tabAtom)
  return (
    <Text
      className="ml-[8px] text-[12px]"
      numberOfLines={1}
      ellipsizeMode="middle"
      style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
    >
      {tab.title}
    </Text>
  )
}

export default TabPreview
