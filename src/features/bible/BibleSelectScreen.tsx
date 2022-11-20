import { PrimitiveAtom } from 'jotai'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { NavigationStackScreenProps } from 'react-navigation-stack'
import Header from '~common/Header'
import { LinkBox } from '~common/Link'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import { MAX_WIDTH } from '~helpers/useDimensions'
import BibleSelectTabNavigator from '~navigation/BibleSelectTabNavigator'
import { BibleTab, useBibleTabActions } from '../../state/tabs'

interface BibleSelectProps {
  bibleAtom: PrimitiveAtom<BibleTab>
}

const BibleSelect = ({
  navigation,
}: NavigationStackScreenProps<BibleSelectProps>) => {
  const bibleAtom = navigation.getParam('bibleAtom')
  const [bible, actions] = useBibleTabActions(bibleAtom)

  const {
    data: { selectionMode },
  } = bible

  const { t } = useTranslation()

  useEffect(() => {
    actions.resetTempSelected()
  }, [])

  return (
    <Container>
      <Header
        hasBackButton
        title={t('Références')}
        rightComponent={
          <Box row mr={20}>
            <LinkBox p={5} onPress={actions.toggleSelectionMode}>
              <FeatherIcon
                name="grid"
                size={16}
                color={selectionMode === 'grid' ? 'primary' : 'default'}
              />
            </LinkBox>
            <LinkBox p={5} onPress={actions.toggleSelectionMode}>
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
          screenProps={{ mainNavigation: navigation, bibleAtom }}
          navigation={navigation}
        />
      </Box>
      {/* <SelectorButtons /> */}
    </Container>
  )
}

BibleSelect.router = BibleSelectTabNavigator.router

export default BibleSelect
