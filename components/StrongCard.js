import React from 'react'
import styled from '@emotion/native'
import { ScrollView } from 'react-native'
import { Icon } from 'expo'

import Box from '@ui/Box'
import Text from '@ui/Text'
import Paragraph from '@ui/Paragraph'

import StylizedHTMLView from '@components/StylizedHTMLView'

import { wp, hp } from '@helpers/utils'
import capitalize from '@helpers/capitalize'
import truncate from '@helpers/truncate'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const itemWidth = slideWidth
const itemHeight = hp(45)

const Container = styled(Box)({
  width: itemWidth,
  height: itemHeight,
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
})

const SmallParagraph = styled(Paragraph)({
  fontSize: 12,
  lineHeight: 18
})

const OpenStrongIcon = styled.TouchableOpacity(() => ({
  marginLeft: 15,
  paddingTop: 5
}))

class StrongCard extends React.Component {
  async componentDidMount () {}
  render () {
    const {
      navigation,
      book,
      strongReference: { Code, Type, Mot, Phonetique, Definition, LSG },
      strongReference
    } = this.props
    return (
      <Container overflow>
        {/* <Shadow overflow /> */}
        <Box paddingTop={10}>
          <Box>
            <Box row alignItems='flex-start'>
              <Text title fontSize={22} flex>
                {truncate(capitalize(Mot), 7)}
                {!!Phonetique && (
                  <Text title darkGrey fontSize={16}>
                    {' '}
                    {truncate(Phonetique, 7)}
                  </Text>
                )}
              </Text>
              <OpenStrongIcon
                onPress={() =>
                  navigation.navigate('BibleStrongDetail', {
                    book,
                    strongReference
                  })
                }
              >
                <Icon.AntDesign name='arrowsalt' size={20} color='black' />
              </OpenStrongIcon>
            </Box>
            {!!Type && (
              <Text titleItalic darkGrey>
                {Type}
              </Text>
            )}
            <TitleBorder />
          </Box>
        </Box>

        <ScrollView style={{ marginBottom: 15 }}>
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
        </ScrollView>
      </Container>
    )
  }
}

export default StrongCard
