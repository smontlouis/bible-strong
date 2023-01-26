import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import { NavigationStackProp } from 'react-navigation-stack'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { NewTab, tabTypes } from '../../../../state/tabs'
import NewTabItem from './NewTabItem'

export interface NewTabScreenProps {
  newAtom: PrimitiveAtom<NewTab>
  navigation: NavigationStackProp
}

const NewTabScreen = ({ newAtom }: NewTabScreenProps) => {
  const { t } = useTranslation()

  return (
    <Container>
      <Header title={t('tabs.new')} />
      <ScrollView style={{ flex: 1 }}>
        <Box flex center row>
          <Box row wrap center>
            {tabTypes.map(type => (
              <NewTabItem key={type} type={type} newAtom={newAtom} />
            ))}
          </Box>
        </Box>
      </ScrollView>
    </Container>
  )
}

export default NewTabScreen
