import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React, { useCallback, useEffect, useState } from 'react'
import { Share } from 'react-native'
import { useSelector } from 'react-redux'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Link from '~common/Link'
import Loading from '~common/Loading'
import TagList from '~common/TagList'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import ConcordanceVerse from '~features/bible/ConcordanceVerse'
import ListenToStrong from '~features/bible/ListenStrong'

import StylizedHTMLView from '~common/StylizedHTMLView'
import waitForStrongDB from '~common/waitForStrongDB'

import capitalize from '~helpers/capitalize'
import loadFirstFoundVerses from '~helpers/loadFirstFoundVerses'
import loadStrongReference from '~helpers/loadStrongReference'
import loadStrongVersesCount from '~helpers/loadStrongVersesCount'

import produce from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import DetailedHeader from '~common/DetailedHeader'
import PopOverMenu from '~common/PopOverMenu'
import { StrongReference } from '~common/types'
import MenuOption from '~common/ui/MenuOption'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { useTabContext } from '~features/app-switcher/context/TabContext'
import { RootState } from '~redux/modules/reducer'
import { makeStrongTagsSelector } from '~redux/selectors/bible'
import { StrongTab } from '../../state/tabs'
import { historyAtom, unifiedTagsModalAtom } from '../../state/app'
import { timeout } from '~helpers/timeout'

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

interface StrongDetailScreenProps {
  strongAtom: PrimitiveAtom<StrongTab>
}

const StrongDetailScreen = ({ strongAtom }: StrongDetailScreenProps) => {
  const router = useRouter()
  const [strongTab, setStrongTab] = useAtom(strongAtom)
  const { isInTab } = useTabContext()

  const {
    hasBackButton,
    data: { book, reference, strongReference: strongReferenceParam },
  } = strongTab

  const [error, setError] = useState<string | undefined>()
  const [strongReference, setStrongReference] = useState<StrongReference | undefined>()
  const [verses, setVerses] = useState<any[]>([])
  const [count, setCount] = useState<number>(0)
  const [concordanceLoading, setConcordanceLoading] = useState(true)
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)

  const addHistory = useSetAtom(historyAtom)

  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()

  const selectStrongTags = makeStrongTagsSelector()
  const code = strongReferenceParam?.Code || reference || ''
  const isGreek = (book || 1) > 39
  const tags = useSelector((state: RootState) => selectStrongTags(state, code, isGreek))

  const loadData = async () => {
    let loadedStrongReference = strongReferenceParam

    if (reference) {
      loadedStrongReference = await loadStrongReference(reference, book || 1)
      if (loadedStrongReference?.error) {
        setError(loadedStrongReference.error)
        return
      }
    }

    if (!loadedStrongReference) {
      return
    }

    addHistory({
      ...loadedStrongReference,
      book: book || 1,
      date: Date.now(),
      type: 'strong',
    })
    setStrongReference(loadedStrongReference)
    const firstFoundVerses = await loadFirstFoundVerses(book || 1, loadedStrongReference.Code)
    const strongVersesCount = await loadStrongVersesCount(book || 1, loadedStrongReference.Code)

    setVerses(firstFoundVerses)
    setCount(strongVersesCount[0]?.versesCount)
    setConcordanceLoading(false)
  }

  // Go back to list view (for tab context)
  const goBack = useCallback(() => {
    if (isInTab) {
      setStrongTab(
        produce(draft => {
          draft.title = t('Lexique')
          draft.data = {}
        })
      )
    } else {
      router.back()
    }
  }, [isInTab, setStrongTab, router, t])

  useEffect(() => {
    if (!strongReference) return
    setStrongTab(
      produce(draft => {
        draft.title = `${strongReference.Hebreu ? t('Hébreu') : t('Grec')} ${strongReference.Mot}`
      })
    )
  }, [strongReference, t, setStrongTab])

  useEffect(() => {
    loadData()
  }, [reference, book])

  const shareContent = async () => {
    const { Code, Hebreu, Grec, Mot, Phonetique, Definition, Type, LSG } = strongReference!

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
    await timeout(400)
    Share.share({ message: toCopy })
  }

  const linkToStrong = (url: string, ref: number) => {
    if (isInTab) {
      // In tab context, update the tab data instead of navigating
      setStrongTab(
        produce(draft => {
          draft.data.book = book
          draft.data.reference = String(ref)
          draft.data.strongReference = undefined
        })
      )
    } else {
      router.push({
        pathname: '/strong',
        params: {
          book: String(book),
          reference: String(ref),
        },
      })
    }
  }

  if (error) {
    return (
      <Container>
        <Header hasBackButton={!isInTab} onCustomBackPress={goBack} title="Désolé..." />
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
    return (
      <Container>
        <Header hasBackButton={!isInTab} onCustomBackPress={goBack} title={t('Lexique')} />
        <Loading message={t('Chargement...')} />
      </Container>
    )
  }

  const { Code, Hebreu, Grec, Mot, Phonetique, Definition, Origine, Type, LSG } = strongReference

  return (
    <Container>
      <DetailedHeader
        hasBackButton={!isInTab}
        title={capitalize(Mot)}
        detail={Phonetique}
        subtitle={Type}
        rightComponent={
          <PopOverMenu
            popover={
              <>
                <MenuOption
                  onSelect={() =>
                    setUnifiedTagsModal({
                      mode: 'select',
                      id: Code!,
                      title: Mot!,
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
                      id: `strong-${generateUUID()}`,
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
                  <ListenToStrong type={Hebreu ? 'hebreu' : 'grec'} code={Code!} />
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
                  <ListenToStrong type={Hebreu ? 'hebreu' : 'grec'} code={Code!} />
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
              <SubTitle color="tertiary">{t('Généralement traduit par')}</SubTitle>
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
                  <Box px={10} py={5} ml={10} bg="lightPrimary" borderRadius={20}>
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
                <Box my={10}>
                  {verses.map((item, i) => (
                    <ConcordanceVerse
                      router={router}
                      t={t}
                      concordanceFor={Code}
                      verse={item}
                      key={i}
                    />
                  ))}
                </Box>
                {count > 15 && (
                  <Box>
                    <Button
                      onPress={() =>
                        router.push({
                          pathname: '/concordance',
                          params: {
                            strongReference: JSON.stringify(strongReference),
                            book: String(book),
                          },
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

export default waitForStrongDB()(StrongDetailScreen)
