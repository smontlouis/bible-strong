import React from 'react'
import { withNavigation, NavigationInjectedProps } from 'react-navigation'

import Link from '~common/Link'
import styled from '~styled'
import { MaterialIcon } from '~common/ui/Icon'
import { useDispatch, useSelector } from 'react-redux'
import { markAsRead } from '~redux/modules/plan'
import { RootState } from '~redux/modules/reducer'

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
}

const ReadButton = ({
  readingSliceId,
  planId,
  navigation,
}: NavigationInjectedProps & Props) => {
  const dispatch = useDispatch()
  const isRead = useSelector(
    (state: RootState) =>
      state.plan.ongoingPlans
        .find(oP => oP.id === planId)
        ?.readingSlices.find(rSlice => rSlice.id === readingSliceId)?.status ===
      'Completed'
  )

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

export default withNavigation(ReadButton)
