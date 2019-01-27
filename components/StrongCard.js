import React from 'react'
import styled from '@emotion/native'
import { ScrollView } from 'react-native'
import Box from '@ui/Box'
import Text from '@ui/Text'
import Paragraph from '@ui/Paragraph'
import StylizedHTMLView from '@components/StylizedHTMLView'

import { wp, hp } from '@helpers/utils'
import capitalize from '@helpers/capitalize'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const itemWidth = slideWidth
const itemHeight = hp(45)

const Container = styled(Box)({
  width: itemWidth,
  maxHeight: itemHeight,
  paddingHorizontal: itemHorizontalMargin,
  paddingBottom: 18
})

const TitleBorder = styled.View(({ theme }) => ({
  marginTop: 10,
  width: 35,
  height: 3,
  backgroundColor: theme.colors.primary
}))

const ViewItem = styled.View(() => ({
  marginTop: 15
}))

const SubTitle = styled(Text)({
  fontSize: 13,
  marginBottom: 3
  // fontWeight: 'bold'
})

const SmallParagraph = styled(Paragraph)({
  fontSize: 12,
  lineHeight: 18
})

class StrongCard extends React.Component {
  async componentDidMount () {}
  render () {
    const {
      strongReference: { Code, Mot, Phonetique, Definition, LSG }
    } = this.props
    return (
      <Container overflow>
        {/* <Shadow overflow /> */}
        <ScrollView style={{ marginBottom: 15 }}>
          <Box paddingTop={10}>
            <Text title fontSize={18}>
              {capitalize(Mot)}
              {!!Phonetique && (
                <Text title darkGrey fontSize={16}>
                  {' '}
                  {Phonetique}
                </Text>
              )}
            </Text>
            <TitleBorder />
            {!!Definition && (
              <ViewItem>
                <SubTitle darkGrey>Définition - {Code}</SubTitle>
                <StylizedHTMLView
                  htmlStyle={{
                    p: {
                      lineHeight: 18,
                      fontSize: 12
                    }
                  }}
                  value={Definition}
                  onLinkPress={() => {}}
                />
              </ViewItem>
            )}
            {!!LSG && (
              <ViewItem>
                <SubTitle darkGrey>Généralement traduit par</SubTitle>
                <SmallParagraph>{LSG}</SmallParagraph>
              </ViewItem>
            )}
          </Box>
        </ScrollView>
      </Container>
    )
  }
}

export default StrongCard
