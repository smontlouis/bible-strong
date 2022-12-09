import { PrimitiveAtom } from 'jotai'
import React from 'react'
import { useTranslation } from 'react-i18next'
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
      <Box flex center row>
        <Box row wrap center>
          {tabTypes.map(type => (
            <NewTabItem key={type} type={type} newAtom={newAtom} />
          ))}
        </Box>
      </Box>
    </Container>
  )
}

export default NewTabScreen
