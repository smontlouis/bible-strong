import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import { Portal } from '@gorhom/portal'
import React, { forwardRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Text, { TextProps } from '~common/ui/Text'
import BottomSheet, {
  BottomSheetView,
  BottomSheetProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import {
  renderBackdrop,
  useBottomSheetStyles,
} from '~helpers/bottomSheetHelpers'

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
}

interface ItemProps {
  children: string
  tag?: string | number
  onPress: () => void
}

const Body = forwardRef<BottomSheet, ModalBodyProps>(
  ({ withPortal, children, headerComponent, ...props }, ref) => {
    const Wrapper = withPortal ? Portal : React.Fragment
    const insets = useSafeAreaInsets()
    const bottomSheetStyles = useBottomSheetStyles()

    return (
      <Wrapper>
        <BottomSheet
          ref={ref}
          index={-1}
          topInset={withPortal ? insets.top : undefined}
          snapPoints={['100%']}
          enablePanDownToClose
          backdropComponent={renderBackdrop}
          {...bottomSheetStyles}
          {...props}
        >
          {headerComponent && (
            <BottomSheetView>{headerComponent}</BottomSheetView>
          )}
          <BottomSheetScrollView>{children}</BottomSheetScrollView>
        </BottomSheet>
      </Wrapper>
    )
  }
)

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
