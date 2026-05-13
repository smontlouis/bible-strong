import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { NewTab, TabItem, tabTypes } from '../../../../state/tabs'
import NewTabItem from './NewTabItem'
import { SelectBibleReferenceModalProvider } from './SelectBibleReferenceModalProvider'

export interface NewTabScreenProps {
  newAtom: PrimitiveAtom<NewTab>
}

const NewTabScreen = ({ newAtom }: NewTabScreenProps) => {
  const { t } = useTranslation()

  return (
    <SelectBibleReferenceModalProvider>
      <Container>
        <Header title={t('tabs.new')} />
        <Box flex center row>
          <Box row wrap center>
            {tabTypes.map(type => (
              <NewTabItem
                key={type}
                type={type}
                newAtom={newAtom as unknown as PrimitiveAtom<TabItem>}
              />
            ))}
          </Box>
        </Box>
      </Container>
    </SelectBibleReferenceModalProvider>
  )
}

export default NewTabScreen
