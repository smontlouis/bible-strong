import styled from '@emotion/native'
import {
  BottomSheetModal,
  BottomSheetProps,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetModal as ExpoBottomSheetModal,
} from '~common/bottom-sheet'
import React, { Ref } from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import Text, { TextProps } from '~common/ui/Text'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { BOTTOM_INSET, MODAL_FOOTER_HEIGHT_BOTTOM_INSET } from '~helpers/constants'

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

interface ModalBodyProps extends Omit<
  BottomSheetProps,
  'backdropComponent' | 'footerComponent' | 'ref'
> {
  headerComponent?: React.ReactNode
  children: React.ReactNode
  withPortal?: boolean
  modalRef?: React.RefObject<ExpoBottomSheetModal | null>
  style?: StyleProp<ViewStyle>
  onModalClose?: () => void
  enableScrollView?: boolean
  enableContentWrapper?: boolean
  ref?: Ref<ExpoBottomSheetModal | null>
  backdropComponent?: React.ComponentType<any> | ((props: any) => React.ReactNode)
  footerComponent?: React.ComponentType<any> | ((props: any) => React.ReactNode)
  topInset?: number
  stackBehavior?: string
  bottomInset?: number
  android_keyboardInputMode?: string
  detached?: boolean
}

interface ItemProps {
  children: string
  tag?: string | number
  onPress: () => void
}

export const ContainerComponent = ({ children }: { children?: React.ReactNode }) => <>{children}</>

const Body = ({
  withPortal,
  children,
  headerComponent,
  enableScrollView = true,
  enableContentWrapper = true,
  ref,
  ...props
}: ModalBodyProps) => {
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const {
    onModalClose,
    onDismiss,
    backdropComponent,
    footerComponent,
    modalRef: _modalRef,
    stackBehavior: _stackBehavior,
    topInset: _topInset,
    bottomInset: _bottomInset,
    android_keyboardInputMode: _androidKeyboardInputMode,
    detached: _detached,
    ...bottomSheetProps
  } = props

  return (
    <BottomSheetModal
      ref={ref}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={
        (backdropComponent ?? renderBackdrop) as BottomSheetProps['backdropComponent']
      }
      footerComponent={footerComponent as BottomSheetProps['footerComponent']}
      onDismiss={() => {
        onDismiss?.()
        onModalClose?.()
      }}
      key={key}
      {...bottomSheetStyles}
      {...bottomSheetProps}
    >
      {headerComponent}
      {!enableContentWrapper ? (
        children
      ) : enableScrollView ? (
        <BottomSheetScrollView>{children}</BottomSheetScrollView>
      ) : (
        <BottomSheetView
          style={{
            flex: 1,
          }}
        >
          {children}
        </BottomSheetView>
      )}
    </BottomSheetModal>
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
