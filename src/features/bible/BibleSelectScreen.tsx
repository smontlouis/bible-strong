import React, { useEffect } from 'react'
import { NavigationStackProp } from 'react-navigation-stack'
import { useDispatch, useSelector } from 'react-redux'
import Header from '~common/Header'
import { LinkBox } from '~common/Link'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import BibleSelectTabNavigator from '~navigation/BibleSelectTabNavigator'
import { resetTempSelected, toggleSelectionMode } from '~redux/modules/bible'
import { RootState } from '~redux/modules/reducer'
import { MAX_WIDTH } from '~helpers/useDimensions'

interface Props {
  navigation: NavigationStackProp<any>
}

const BibleSelect = ({ navigation }: Props) => {
  const dispatch = useDispatch()
  const selectionMode = useSelector(
    (state: RootState) => state.bible.selectionMode
  )

  useEffect(() => {
    dispatch(resetTempSelected())
  }, [dispatch])

  return (
    <Container>
      <Header
        hasBackButton
        title="Références"
        rightComponent={
          <Box row mr={20}>
            <LinkBox p={5} onPress={() => dispatch(toggleSelectionMode())}>
              <FeatherIcon
                name="grid"
                size={16}
                color={selectionMode === 'grid' ? 'primary' : 'default'}
              />
            </LinkBox>
            <LinkBox p={5} onPress={() => dispatch(toggleSelectionMode())}>
              <FeatherIcon
                name="menu"
                size={16}
                color={selectionMode === 'list' ? 'primary' : 'default'}
              />
            </LinkBox>
          </Box>
        }
      />
      <Box maxWidth={MAX_WIDTH} width="100%" flex alignSelf="center">
        <BibleSelectTabNavigator
          screenProps={{ mainNavigation: navigation }}
          navigation={navigation}
        />
      </Box>
      {/* <SelectorButtons /> */}
    </Container>
  )
}

BibleSelect.router = BibleSelectTabNavigator.router

export default BibleSelect
