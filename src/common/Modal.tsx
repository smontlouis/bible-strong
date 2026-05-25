import styled from '@emotion/native'
import {
  BottomSheetHandle,
  BottomSheetModal,
  BottomSheetModalProps,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import React, { Ref } from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Text, { TextProps } from '~common/ui/Text'
import {
  onAnimateModalClose,
  renderBackdrop,
  useBottomSheetStyles,
} from '~helpers/bottomSheetHelpers'
import { BOTTOM_INSET, MODAL_FOOTER_HEIGHT_BOTTOM_INSET } from '~helpers/constants'
import { FullWindowOverlay } from './ui/FullWindowOverlay'

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

interface ModalBodyProps extends BottomSheetModalProps {
  headerComponent?: React.ReactNode
  children: React.ReactNode
  withPortal?: boolean
  modalRef?: React.RefObject<BottomSheetModal | null>
  style?: StyleProp<ViewStyle>
  onModalClose?: () => void
  enableScrollView?: boolean
  enableContentWrapper?: boolean
  ref?: Ref<BottomSheetModal | null>
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
  enableContentWrapper = true,
  ref,
  ...props
}: ModalBodyProps) => {
  const insets = useSafeAreaInsets()
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  // Use ref to avoid recreating renderHandle when headerComponent changes
  // This prevents the handle from remounting and losing focus in inputs
  const headerComponentRef = React.useRef(headerComponent)
  headerComponentRef.current = headerComponent

  const renderHandle = React.useCallback(
    (handleProps: React.ComponentProps<typeof BottomSheetHandle>) => (
      <>
        <BottomSheetHandle {...handleProps} />
        {headerComponentRef.current}
      </>
    ),
    []
  )

  const renderContainerComponent = React.useCallback(
    ({ children }: { children: React.ReactNode }) => (
      <FullWindowOverlay>{children}</FullWindowOverlay>
    ),
    []
  )

  return (
    <BottomSheetModal
      ref={ref}
      topInset={insets.top}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      containerComponent={renderContainerComponent}
      activeOffsetY={[-20, 20]}
      onAnimate={onAnimateModalClose(props.onModalClose)}
      handleComponent={headerComponent ? renderHandle : undefined}
      key={key}
      {...bottomSheetStyles}
      {...props}
    >
      {!enableContentWrapper ? (
        children
      ) : enableScrollView ? (
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingBottom: props.footerComponent ? MODAL_FOOTER_HEIGHT_BOTTOM_INSET : BOTTOM_INSET,
          }}
        >
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView
          style={{
            flex: 1,
            paddingBottom: props.footerComponent ? MODAL_FOOTER_HEIGHT_BOTTOM_INSET : BOTTOM_INSET,
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
