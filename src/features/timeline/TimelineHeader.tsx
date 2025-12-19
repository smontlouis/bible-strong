import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import BottomSheet from '@gorhom/bottom-sheet'
import React from 'react'

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Back from '~common/Back'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import useLanguage from '~helpers/useLanguage'

const HeaderBox = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 60,
  marginTop: useSafeAreaInsets().top,
  borderBottomColor: theme.colors.border,
  alignItems: 'stretch',
  zIndex: 1,
}))

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

interface Props {
  title: string
  titleEn: string
  fontSize?: number
  hasBackButton?: boolean
  onPress: () => void
  searchModalRef: React.RefObject<BottomSheet | null>
}

const TimelineHeader = ({
  title,
  titleEn,
  fontSize = 20,
  hasBackButton,
  onPress,
  searchModalRef,
}: Props) => {
  const isFR = useLanguage()

  const openSearch = () => {
    searchModalRef.current?.expand()
  }
  return (
    <HeaderBox row>
      <Box center>
        {hasBackButton && (
          <Back padding>
            <FeatherIcon name={'grid'} size={20} />
          </Back>
        )}
      </Box>
      <Box flex center>
        <Text title fontSize={fontSize}>
          {isFR ? title : titleEn}
        </Text>
      </Box>
      <Box center row>
        <Link paddingSmall onPress={openSearch}>
          <FeatherIcon name="search" size={20} />
        </Link>
        <Link paddingSmall onPress={onPress}>
          <FeatherIcon name="info" size={20} />
        </Link>
      </Box>
    </HeaderBox>
  )
}

export default TimelineHeader
