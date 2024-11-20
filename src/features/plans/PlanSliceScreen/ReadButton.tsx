import React from 'react'
import { useNavigation } from '@react-navigation/native'

import Link from '~common/Link'
import styled from '@emotion/native'
import { MaterialIcon } from '~common/ui/Icon'
import { useDispatch } from 'react-redux'
import { markAsRead } from '~redux/modules/plan'

const StyledLink = styled(Link)(({ theme }) => ({
  backgroundColor: theme.colors.success,
  width: 60,
  height: 60,
  borderRadius: 30,
  justifyContent: 'center',
  alignItems: 'center',
  flexDirection: 'row',
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
}))

interface Props {
  readingSliceId: string
  planId: string
  isRead: boolean
}

const ReadButton = ({ readingSliceId, planId, isRead }: Props) => {
  const navigation = useNavigation()
  const dispatch = useDispatch()

  const onPress = () => {
    dispatch(markAsRead({ readingSliceId, planId }))
    navigation.goBack()
  }
  return (
    <StyledLink onPress={onPress} style={{ opacity: isRead ? 0.3 : 1 }}>
      <MaterialIcon color="white" name="check" size={22} />
    </StyledLink>
  )
}

export default ReadButton
