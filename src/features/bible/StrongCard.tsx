import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React from 'react'

import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import StylizedHTMLView from '~common/StylizedHTMLView'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import ListenToStrong from './ListenStrong'

import capitalize from '~helpers/capitalize'
import truncate from '~helpers/truncate'
import { cleanParams, wp } from '~helpers/utils'
import { useAtomValue } from 'jotai/react'
import { openedFromTabAtom } from '~features/studies/atom'
import { ScrollView } from 'react-native'
import { StrongReference } from '~common/types'
import { StackNavigationProp } from '@react-navigation/stack'
import { MainStackProps } from '~navigation/type'
import { Theme } from '@emotion/react'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const itemWidth = slideWidth

const Container = styled(Box)(({ isModal }) => ({
  width: itemWidth,
  flex: 1,
  paddingHorizontal: itemHorizontalMargin,

  ...(isModal && {
    width: 'auto',
    paddingHorizontal: 20,
  }),
}))

const TitleBorder = styled.View(({ theme }) => ({
  marginTop: 10,
  width: 35,
  height: 3,
  backgroundColor: theme.colors.primary,
}))

const ViewItem = styled.View(() => ({
  marginTop: 15,
}))

const SubTitle = styled(Text)({
  fontSize: 13,
  marginBottom: 3,
})

const SmallParagraph = styled(Paragraph)({
  fontSize: 14,
  lineHeight: 20,
})

const Header = styled.View(() => ({
  flex: 1,
  paddingTop: 5,
  flexDirection: 'row',
  alignItems: 'center',
  // justifyContent: 'center'
}))

const IconFeather = styled(Icon.Feather)(({ theme }) => ({
  paddingTop: 5,
  color: theme.colors.default,
}))

const smallTextStyle = (theme: Theme) => ({
  lineHeight: 20,
  fontSize: 14,
  color: theme.colors.default,
  fontFamily: theme.fontFamily.paragraph,
})

type Props = {
  index: number
  theme: Theme
  book: string
  strongReference: StrongReference
  navigation: StackNavigationProp<MainStackProps>
  isSelectionMode: boolean
}

const StrongCard = (props: Props) => {
  const { t } = useTranslation()
  const openedFromTab = useAtomValue(openedFromTabAtom)

  const openStrong = () => {
    const {
      book,
      strongReference,
      navigation,
      isSelectionMode,
      strongReference: {
        Code,
        Type,
        Mot,
        Phonetique,
        Definition,
        LSG,
        Hebreu,
        Grec,
      },
    } = props

    if (isSelectionMode) {
      if (openedFromTab)
        navigation.navigate('AppSwitcher', {})
      else { 
        // wrong typing, something is fishy here, unused params perhaps
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
          book,
        })
      }
    } else {
      navigation.navigate('Strong', {
        book,
        strongReference,
      })
    }
  }

  const {
    isSelectionMode,
    strongReference: {
      Code,
      Hebreu,
      Grec,
      Type,
      Mot,
      Phonetique,
      Definition,
      LSG,
    },
    theme,
    isModal,
    onClosed,
  } = props

  return (
    <Container overflow isModal={isModal}>
      {/* <Shadow overflow /> */}
      <Box paddingTop={20}>
        <Box>
          <Box row alignItems="flex-end">
            <Header>
              <Link onPress={openStrong} style={{ flex: 1 }}>
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
              <Box mr={10} mt={3}>
                <ListenToStrong type={Hebreu ? 'hebreu' : 'grec'} code={Code} />
              </Box>
              <Link onPress={openStrong}>
                {isSelectionMode ? (
                  <IconFeather name="share" size={20} />
                ) : (
                  <IconFeather name="maximize-2" size={17} />
                )}
              </Link>
            </Header>
          </Box>
          <Text color="darkGrey" bold fontSize={16} textAlign="left">
            {Hebreu || Grec}
          </Text>
          {/* {!!Type && (
              <Text titleItalic color="darkGrey" fontSize={12}>
                {Type}
              </Text>
            )} */}
          <TitleBorder />
        </Box>
      </Box>

      <ScrollView style={{ marginBottom: 15 }}>
        {!!Definition && (
          <ViewItem>
            <SubTitle color="darkGrey">Définition - {Code}</SubTitle>
            <StylizedHTMLView
              htmlStyle={{
                p: { ...smallTextStyle(theme) },
                em: { ...smallTextStyle(theme) },
                strong: { ...smallTextStyle(theme) },
                a: { ...smallTextStyle(theme) },
                i: { ...smallTextStyle(theme) },
                li: { ...smallTextStyle(theme) },
                ol: { ...smallTextStyle(theme) },
                ul: { ...smallTextStyle(theme) },
              }}
              value={Definition}
              onLinkPress={() => {}}
            />
          </ViewItem>
        )}
        {!!LSG && (
          <ViewItem>
            <SubTitle color="darkGrey">
              {t('Généralement traduit par')}
            </SubTitle>
            <StylizedHTMLView
              htmlStyle={{
                p: { ...smallTextStyle(theme) },
                em: { ...smallTextStyle(theme) },
                strong: { ...smallTextStyle(theme) },
                a: { ...smallTextStyle(theme) },
                i: { ...smallTextStyle(theme) },
                li: { ...smallTextStyle(theme) },
                ol: { ...smallTextStyle(theme) },
                ul: { ...smallTextStyle(theme) },
              }}
              value={LSG}
            />
          </ViewItem>
        )}
      </ScrollView>
    </Container>
  )
}

export default StrongCard
