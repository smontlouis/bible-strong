import React from 'react'
import styled from '@emotion/native'
import { ScrollView } from 'react-native'
import * as Icon from '@expo/vector-icons'
import { withTheme } from 'emotion-theming'
import truncHTML from 'trunc-html'

import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

import StylizedHTMLView from '~common/StylizedHTMLView'

import { wp } from '~helpers/utils'
import truncate from '~helpers/truncate'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const itemWidth = slideWidth

const Container = styled(Box)({
  width: itemWidth,
  flex: 1,
  paddingHorizontal: itemHorizontalMargin,
  paddingBottom: 18,
})

const TitleBorder = styled.View(({ theme }) => ({
  marginTop: 10,
  width: 35,
  height: 3,
  backgroundColor: theme.colors.secondary,
}))

const ViewItem = styled.View(() => ({
  marginTop: 15,
}))

const OpenStrongIcon = styled.TouchableOpacity(() => ({
  paddingTop: 5,
  flexDirection: 'row',
  alignItems: 'center',
}))

const IconFeather = styled(Icon.Feather)(({ theme }) => ({
  paddingTop: 5,
  color: theme.colors.default,
}))

const smallTextStyle = theme => ({
  lineHeight: 18,
  fontSize: 12,
  color: theme.colors.default,
  fontFamily: theme.fontFamily.paragraph,
})

class StrongCard extends React.Component {
  openStrong = () => {
    const {
      navigation,
      isSelectionMode,
      dictionnaireRef: { word },
    } = this.props

    if (isSelectionMode) {
      /** TODO */
    } else {
      navigation.navigate({
        routeName: 'DictionnaryDetail',
        params: { word },
        key: `dictionnary-detail-${word}`,
      })
    }
  }

  render() {
    const {
      isSelectionMode,
      dictionnaireRef: { word, definition } = {},
      theme,
    } = this.props

    if (!word) {
      return (
        <Empty
          source={require('~assets/images/empty.json')}
          message="Impossible de charger ce mot..."
        />
      )
    }

    if (!word) {
      return (
        <Empty
          source={require('~assets/images/empty.json')}
          message="Impossible de charger ce mot..."
        />
      )
    }

    const { html } = truncHTML(definition.replace(/\n/gi, ''), 500)
    return (
      <Container overflow>
        {/* <Shadow overflow /> */}
        <Box paddingTop={10}>
          <Box>
            <OpenStrongIcon onPress={this.openStrong}>
              <Text title fontSize={22} flex>
                {truncate(word, 7)}
              </Text>
              {isSelectionMode ? (
                <IconFeather name="share" size={20} />
              ) : (
                <IconFeather name="maximize-2" size={20} />
              )}
            </OpenStrongIcon>
            <TitleBorder />
          </Box>
        </Box>

        <ScrollView style={{ marginBottom: 15 }}>
          {!!definition && (
            <ViewItem>
              <StylizedHTMLView
                htmlStyle={{
                  p: { ...smallTextStyle(theme) },
                  strong: { ...smallTextStyle(theme) },
                  em: { ...smallTextStyle(theme) },
                  i: { ...smallTextStyle(theme) },
                  a: { ...smallTextStyle(theme) },
                  li: { ...smallTextStyle(theme) },
                  ol: { ...smallTextStyle(theme) },
                  ul: { ...smallTextStyle(theme) },
                  h1: { ...smallTextStyle(theme) },
                  h2: { ...smallTextStyle(theme) },
                  h3: { ...smallTextStyle(theme) },
                }}
                value={html}
                onLinkPress={() => {}}
              />
            </ViewItem>
          )}
        </ScrollView>
      </Container>
    )
  }
}

export default withTheme(StrongCard)
