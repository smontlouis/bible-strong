import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import { Portal } from '@gorhom/portal'
import React, { Ref } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Text, { TextProps } from '~common/ui/Text'
import BottomSheet, {
  BottomSheetView,
  BottomSheetProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import {
  onAnimateModalClose,
  renderBackdrop,
  useBottomSheetStyles,
} from '~helpers/bottomSheetHelpers'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'

const Touchy = styled.TouchableOpacity(({ theme }) => ({
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'space-between',
  padding: 20,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  overflow: 'hidden',
}))

const Tag = styled.View(({ theme }) => ({
  marginLeft: 10,
  padding: 3,
  backgroundColor: theme.colors.lightGrey,
  borderRadius: 3,
}))

interface ModalBodyProps extends BottomSheetProps {
  headerComponent?: React.ReactNode
  children: React.ReactNode
  withPortal?: boolean
  modalRef?: React.RefObject<BottomSheet>
  style?: any
  onModalClose?: () => void
  enableScrollView?: boolean
  ref?: Ref<BottomSheet>
}

interface ItemProps {
  children: string
  tag?: string | number
  onPress: () => void
}

const Body = ({
  withPortal,
  children,
  headerComponent,
  enableScrollView = true,
  ref,
  ...props
}: ModalBodyProps) => {
  const Wrapper = withPortal ? Portal : React.Fragment
  const insets = useSafeAreaInsets()
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const { bottomBarHeight } = useBottomBarHeightInTab()
  return (
    <Wrapper>
      <BottomSheet
        ref={ref}
        index={-1}
        topInset={insets.top}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        activeOffsetY={[-20, 20]}
        onAnimate={onAnimateModalClose(props.onModalClose)}
        key={key}
        {...bottomSheetStyles}
        {...props}
      >
        {headerComponent && <BottomSheetView>{headerComponent}</BottomSheetView>}
        {enableScrollView ? (
          <BottomSheetScrollView
            contentContainerStyle={{
              paddingBottom: bottomBarHeight + (props.footerComponent ? 54 : 0),
            }}
          >
            {children}
          </BottomSheetScrollView>
        ) : (
          <BottomSheetView
            style={{
              flex: 1,
              paddingBottom: bottomBarHeight + (props.footerComponent ? 54 : 0),
            }}
          >
            {children}
          </BottomSheetView>
        )}
      </BottomSheet>
    </Wrapper>
  )
}

const Item = ({ children, tag, onPress, ...props }: ItemProps & TextProps) => (
  <Touchy onPress={onPress}>
    <Text {...props}>{children}</Text>
    {Boolean(tag) && (
      <Tag>
        <Text fontSize={12} color="grey" reverse>
          {tag}
        </Text>
      </Tag>
    )}
  </Touchy>
)

export default {
  Body,
  Item,
}
