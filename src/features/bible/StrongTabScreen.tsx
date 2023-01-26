import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React, { useCallback, useEffect, useState } from 'react'
import { Share } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Link from '~common/Link'
import Loading from '~common/Loading'
import TagList from '~common/TagList'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import FlatList from '~common/ui/FlatList'
import Paragraph from '~common/ui/Paragraph'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import ConcordanceVerse from './ConcordanceVerse'
import ListenToStrong from './ListenStrong'

import StylizedHTMLView from '~common/StylizedHTMLView'
import waitForStrongDB from '~common/waitForStrongDB'

import capitalize from '~helpers/capitalize'
import loadFirstFoundVerses from '~helpers/loadFirstFoundVerses'
import loadStrongReference from '~helpers/loadStrongReference'
import loadStrongVersesCount from '~helpers/loadStrongVersesCount'
import { timeout } from '~helpers/timeout'
import { setHistory } from '~redux/modules/user'

import produce from 'immer'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom, useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { NavigationStackProp } from 'react-navigation-stack'
import DetailedHeader from '~common/DetailedHeader'
import PopOverMenu from '~common/PopOverMenu'
import { StrongReference } from '~common/types'
import MenuOption from '~common/ui/MenuOption'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { RootState } from '~redux/modules/reducer'
import { StrongTab } from '~state/tabs'
import { multipleTagsModalAtom } from '../../state/app'

const LinkBox = Box.withComponent(Link)

const ViewItem = styled.View(() => ({
  marginTop: 15,
}))

const SubTitle = styled(Text)({
  fontSize: 16,
  marginBottom: 3,
})

const Word = styled(Text)(({ theme }) => ({
  fontSize: 18,
  fontWeight: 'bold',
  color: theme.colors.default,
}))

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

interface StrongScreenProps {
  navigation: NavigationStackProp
  strongAtom: PrimitiveAtom<StrongTab>
}

const keyExtractor = item => `${item.Livre}-${item.Chapitre}-${item.Verset}`
const flatListStyle = { paddingTop: 10 }

const StrongScreen = ({ navigation, strongAtom }: StrongScreenProps) => {
  const [strongTab, setStrongTab] = useAtom(strongAtom)

  let {
    hasBackButton,
    data: { book, reference, strongReference: strongReferenceParam },
  } = strongTab

  const [error, setError] = useState<string | undefined>()
  const [strongReference, setStrongReference] = useState<
    StrongReference | undefined
  >()
  const [verses, setVerses] = useState([])
  const [count, setCount] = useState(0)
  const [concordanceLoading, setConcordanceLoading] = useState(true)
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)

  const dispatch = useDispatch()
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()

  const tags = useSelector((state: RootState) => {
    const code = strongReferenceParam?.Code || reference
    const strongPart = book > 39 ? 'strongsGrec' : 'strongsHebreu'

    // @ts-ignore
    return state.user.bible[strongPart][code]?.tags
  }, shallowEqual)

  const setTitle = (title: string) =>
    setStrongTab(
      produce(draft => {
        draft.title = title
      })
    )

  useEffect(() => {
    setTitle(
      `${strongReference?.Hebreu ? t('Hébreu') : t('Grec')} ${
        strongReference?.Mot
      }`
    )
  }, [strongReference?.Mot, strongReference?.Hebreu, t])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    if (reference) {
      strongReferenceParam = await loadStrongReference(reference, book)
      if (strongReferenceParam?.error) {
        setError(strongReferenceParam.error)
        return
      }
    }

    dispatch(
      setHistory({
        ...strongReferenceParam,
        book,
        type: 'strong',
      })
    )
    setStrongReference(strongReferenceParam)

    await timeout(1500)
    const firstFoundVerses = await loadFirstFoundVerses(
      book,
      strongReferenceParam.Code
    )
    const strongVersesCount = await loadStrongVersesCount(
      book,
      strongReferenceParam.Code
    )

    setVerses(firstFoundVerses)
    setCount(strongVersesCount[0]?.versesCount)
    setConcordanceLoading(false)
  }

  const shareContent = () => {
    const {
      Code,
      Hebreu,
      Grec,
      Mot,
      Phonetique,
      Definition,
      Type,
      LSG,
    } = strongReference!

    let toCopy = Phonetique ? `${Mot} ${Phonetique}\n` : `${Mot}`
    toCopy += Type ? `${Type}\n---\n\n` : '---\n\n'
    toCopy += Hebreu ? `${t('Mot Hébreu')}: ${Hebreu}\n\n` : ''
    toCopy += Grec ? `${t('Mot Grec')}: ${Grec}\n\n` : ''
    if (Definition) {
      let def = Definition.replace('<p>', '')
      def = def.replace('</p>', '')
      def = def.replace(/<\/?[^>]+><\/?[^>]+>/gi, '\n')
      def = def.replace(/<\/?[^>]+>/gi, '\n')
      toCopy += `${t('Définition')} - ${Code}\n${def}\n\n`
    }
    toCopy += LSG ? `${t('Généralement traduit par')}:\n${LSG}` : ''
    toCopy += '\n\n https://bible-strong.app'

    Share.share({ message: toCopy })
  }

  const linkToStrong = (url: string, ref: number) => {
    navigation.navigate({
      routeName: 'Strong',
      params: { book, reference: ref },
      key: `bible-strong-detail-${ref}`,
    })
  }

  const {
    Code,
    Hebreu,
    Grec,
    Mot,
    Phonetique,
    Definition,
    Origine,
    Type,
    LSG,
  } = strongReference || {}

  const flatListRenderItem = useCallback(
    ({ item }) => (
      <ConcordanceVerse
        navigation={navigation}
        concordanceFor={Code}
        verse={item}
      />
    ),
    [navigation, Code]
  )

  if (error) {
    return (
      <Container>
        <Header hasBackButton={hasBackButton} title="Désolé..." />
        <Empty
          source={require('~assets/images/empty.json')}
          message={`Impossible de charger la strong pour ce verset...${
            error === 'CORRUPTED_DATABASE'
              ? '\n\nVotre base de données semble être corrompue. Rendez-vous dans la gestion de téléchargements pour retélécharger la base de données.'
              : ''
          }`}
        />
      </Container>
    )
  }

  if (!strongReference) {
    return null
  }

  return (
    <Container>
      <DetailedHeader
        hasBackButton={hasBackButton}
        title={capitalize(Mot)}
        detail={Phonetique}
        subtitle={Type}
        rightComponent={
          <PopOverMenu
            popover={
              <>
                <MenuOption
                  onSelect={() =>
                    setMultipleTagsItem({
                      id: Code,
                      title: Mot,
                      entity: Grec ? 'strongsGrec' : 'strongsHebreu',
                    })
                  }
                >
                  <Box row alignItems="center">
                    <FeatherIcon name="tag" size={15} />
                    <Text marginLeft={10}>{t('Étiquettes')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption onSelect={shareContent}>
                  <Box row alignItems="center">
                    <FeatherIcon name="share-2" size={15} />
                    <Text marginLeft={10}>{t('Partager')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption
                  onSelect={() => {
                    openInNewTab({
                      id: `strong-${Date.now()}`,
                      title: t('tabs.new'),
                      isRemovable: true,
                      type: 'strong',
                      data: {
                        book,
                        reference: strongReference.Code,
                      },
                    })
                  }}
                >
                  <Box row alignItems="center">
                    <FeatherIcon name="external-link" size={15} />
                    <Text marginLeft={10}>{t('tab.openInNewTab')}</Text>
                  </Box>
                </MenuOption>
              </>
            }
          />
        }
      />
      <ScrollView style={{ paddingLeft: 20, paddingRight: 20, flex: 1 }}>
        <Box>
          {tags && (
            <Box marginBottom={10}>
              <TagList tags={tags} />
            </Box>
          )}

          {!!Hebreu && (
            <ViewItem>
              <Box row alignItems="center">
                <Paragraph color="darkGrey" style={{ fontSize: 15 }}>
                  {t('Mot Hébreu')}:&nbsp;
                  <Word>{Hebreu}</Word>
                </Paragraph>
                <Box ml={15} mb={4}>
                  <ListenToStrong
                    type={Hebreu ? 'hebreu' : 'grec'}
                    code={Code}
                  />
                </Box>
              </Box>
            </ViewItem>
          )}
          {!!Grec && (
            <ViewItem>
              <Box row alignItems="center">
                <Paragraph>
                  {t('Mot Grec')}:&nbsp;
                  <Word>{Grec}</Word>
                </Paragraph>
                <Box ml={15} mb={4}>
                  <ListenToStrong
                    type={Hebreu ? 'hebreu' : 'grec'}
                    code={Code}
                  />
                </Box>
              </Box>
            </ViewItem>
          )}
          {!!Definition && (
            <ViewItem>
              <SubTitle color="tertiary">
                {t('Définition')} - {Code}
              </SubTitle>
              <StylizedHTMLView value={Definition} onLinkPress={linkToStrong} />
            </ViewItem>
          )}
          {!!LSG && (
            <ViewItem>
              <SubTitle color="tertiary">
                {t('Généralement traduit par')}
              </SubTitle>
              <StylizedHTMLView value={LSG} />
            </ViewItem>
          )}
          {!!Origine && (
            <ViewItem>
              <SubTitle color="tertiary">{t('Origine du mot')}</SubTitle>
              <StylizedHTMLView value={Origine} onLinkPress={linkToStrong} />
            </ViewItem>
          )}
          <Box marginTop={40}>
            {concordanceLoading ? (
              <Box row alignItems="center">
                <Text color="darkGrey" fontSize={16} marginRight={10}>
                  {t('Concordance')}
                </Text>
                <Loading style={{ flex: 0, marginLeft: 10 }} />
              </Box>
            ) : (
              <Box>
                <Box row alignItems="center">
                  <Text color="darkGrey" fontSize={16} marginBottom={3}>
                    {t('Concordance')}
                  </Text>
                  <Box
                    px={10}
                    py={5}
                    ml={10}
                    bg="lightPrimary"
                    borderRadius={20}
                  >
                    <Text>{count}</Text>
                  </Box>
                  {count > 15 && (
                    <LinkBox
                      ml="auto"
                      route="Concordance"
                      params={{ strongReference, book }}
                      bg="opacity5"
                      borderRadius={20}
                      px={10}
                      py={5}
                    >
                      <Text>{t('Tout voir')}</Text>
                    </LinkBox>
                  )}
                </Box>
                <FlatList
                  removeClippedSubviews
                  data={verses}
                  keyExtractor={keyExtractor}
                  contentContainerStyle={flatListStyle}
                  renderItem={flatListRenderItem}
                />
                {count > 15 && (
                  <Box>
                    <Button
                      onPress={() =>
                        navigation.navigate({
                          routeName: 'Concordance',
                          params: { strongReference, book },
                          key: `concordance-${strongReference}-${book}`,
                        })
                      }
                    >
                      {t('Tout voir')}
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </ScrollView>
    </Container>
  )
}

export default waitForStrongDB(StrongScreen)
