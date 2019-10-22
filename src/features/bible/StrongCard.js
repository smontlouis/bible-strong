import React from 'react'
import styled from '@emotion/native'
import { ScrollView } from 'react-native'
import * as Icon from '@expo/vector-icons'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Link from '~common/Link'
import StylizedHTMLView from '~common/StylizedHTMLView'

import { wp, cleanParams } from '~helpers/utils'
import capitalize from '~helpers/capitalize'
import truncate from '~helpers/truncate'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const itemWidth = slideWidth

const Container = styled(Box)(({ isModal }) => ({
  width: itemWidth,
  flex: 1,
  paddingHorizontal: itemHorizontalMargin,

  ...(isModal && {
    width: 'auto',
    paddingHorizontal: 20
  })
}))

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

const Header = styled.View(() => ({
  flex: 1,
  paddingTop: 5,
  flexDirection: 'row',
  alignItems: 'center'
  // justifyContent: 'center'
}))

const IconFeather = styled(Icon.Feather)(({ theme }) => ({
  paddingTop: 5,
  color: theme.colors.default
}))

const smallTextStyle = theme => ({
  lineHeight: 18,
  fontSize: 12,
  color: theme.colors.default,
  fontFamily: 'literata-book'
})

class StrongCard extends React.Component {
  openStrong = () => {
    const {
      book,
      strongReference,
      navigation,
      isSelectionMode,
      strongReference: { Code, Type, Mot, Phonetique, Definition, LSG, Hebreu, Grec }
    } = this.props

    if (isSelectionMode) {
      navigation.navigate('EditStudy', {
        ...cleanParams(),
        type: isSelectionMode,
        title: Mot,
        codeStrong: Code,
        strongType: Type,
        phonetique: Phonetique,
        definition: Definition,
        translatedBy: LSG,
        original: Hebreu || Grec,
        book
      })
    } else {
      navigation.navigate({
        routeName: 'BibleStrongDetail',
        params: { book, strongReference },
        key: `bible-strong-detail-${strongReference.Code}`
      })
    }
  }

  render() {
    const {
      isSelectionMode,
      strongReference: { Code, Hebreu, Grec, Type, Mot, Phonetique, Definition, LSG },
      theme,
      isModal,
      onClosed
    } = this.props

    return (
      <Container overflow isModal={isModal}>
        {/* <Shadow overflow /> */}
        <Box paddingTop={10}>
          <Box>
            <Box row alignItems="center">
              <Header>
                <Link onPress={this.openStrong} style={{ flex: 1 }}>
                  <Text title fontSize={18} flex>
                    {truncate(capitalize(Mot), 7)}
                    {!!Phonetique && (
                      <Text title color="darkGrey" fontSize={16}>
                        {' '}
                        {truncate(Phonetique, 7)}
                      </Text>
                    )}
                  </Text>
                </Link>
                <Link onPress={this.openStrong}>
                  {isSelectionMode ? (
                    <IconFeather name="share" size={20} />
                  ) : (
                    <IconFeather name="maximize-2" size={20} />
                  )}
                </Link>
              </Header>
              {onClosed && (
                <Link paddingSmall onPress={onClosed} style={{ alignItems: 'flex-end' }}>
                  <IconFeather name="x" size={25} />
                </Link>
              )}
            </Box>
            <Text color="darkGrey" bold fontSIze={18}>
              {Hebreu || Grec}
            </Text>
            {!!Type && (
              <Text titleItalic color="darkGrey" fontSize={12}>
                {Type}
              </Text>
            )}
            <TitleBorder />
          </Box>
        </Box>

        <ScrollView style={{ marginBottom: 5 }}>
          {!!Definition && (
            <ViewItem>
              <SubTitle color="darkGrey">Définition - {Code}</SubTitle>
              <StylizedHTMLView
                htmlStyle={{
                  p: { ...smallTextStyle(theme) },
                  em: { ...smallTextStyle(theme) },
                  a: { ...smallTextStyle(theme) },
                  li: { ...smallTextStyle(theme) },
                  ol: { ...smallTextStyle(theme) },
                  ul: { ...smallTextStyle(theme) }
                }}
                value={Definition}
                onLinkPress={() => {}}
              />
            </ViewItem>
          )}
          {!!LSG && (
            <ViewItem>
              <SubTitle color="darkGrey">Généralement traduit par</SubTitle>
              <SmallParagraph>{LSG}</SmallParagraph>
            </ViewItem>
          )}
        </ScrollView>
      </Container>
    )
  }
}

export default StrongCard
