import React from 'react'
import { NavigationStackProp } from 'react-navigation-stack'
import { MenuOption } from 'react-native-popup-menu'

import PopOverMenu from '~common/PopOverMenu'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import Header from '~common/Header'
import { ComputedReadingSlice, EntitySlice } from '~common/types'
import ScrollView from '~common/ui/ScrollView'
import Slice from './Slice'
import PauseText from './PauseText'
import chapterToReference from '~helpers/chapterToReference'
import verseToReference from '~helpers/verseToReference'
import Box from '~common/ui/Box'
import ReadButton from './ReadButton'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import { markAsRead } from '~redux/modules/plan'

interface Props {
  navigation: NavigationStackProp<{ readingSlice: ComputedReadingSlice }>
}

const extractTitle = (slice: EntitySlice) => {
  switch (slice.type) {
    case 'Verse':
      return verseToReference(slice.verses, { isPlan: true })
    case 'Chapter':
      return chapterToReference(slice.chapters)
    default:
      return ''
  }
}

const PlanSliceScreen = ({ navigation }: Props) => {
  const {
    id,
    planId,
    slices,
  }: ComputedReadingSlice & { planId: string } = navigation.getParam(
    'readingSlice',
    {}
  )
  const dispatch = useDispatch()
  const isRead = useSelector(
    (state: RootState) =>
      state.plan.ongoingPlans.find(oP => oP.id === planId)?.readingSlices[
        id
      ] === 'Completed'
  )

  const onMarkAsReadSelect = () => {
    dispatch(markAsRead({ readingSliceId: id, planId }))
    navigation.goBack()
  }

  const mainSlice: EntitySlice | undefined = slices.find(
    s => s.type === 'Chapter' || s.type === 'Verse'
  )
  const title = mainSlice ? extractTitle(mainSlice) : ''
  return (
    <Container>
      <Header
        title={title}
        hasBackButton
        rightComponent={
          <PopOverMenu
            element={
              <Box
                flexDirection="row"
                alignItems="center"
                justifyContent="center"
                height={50}
                width={50}
              >
                <FeatherIcon name="more-vertical" size={18} />
              </Box>
            }
            popover={
              <>
                <MenuOption onSelect={onMarkAsReadSelect}>
                  <Box row alignItems="center">
                    <MaterialIcon name="check" size={20} />
                    <Text marginLeft={10}>
                      {isRead ? 'Marquer comme non lu' : 'Marquer comme lu'}
                    </Text>
                  </Box>
                </MenuOption>
              </>
            }
          />
        }
      />
      <ScrollView>
        <PauseText>
          {
            'Prenez une grande inspiration,\n alors que vous vous apprêtez à passer du\n temps avec Dieu'
          }
        </PauseText>
        {slices.map(slice => (
          <Slice key={slice.id} {...slice} />
        ))}
        <Box height={80} center marginTop={30}>
          <ReadButton isRead={isRead} readingSliceId={id} planId={planId} />
        </Box>
      </ScrollView>
    </Container>
  )
}

export default PlanSliceScreen
