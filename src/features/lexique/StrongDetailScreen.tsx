import styled from '@emotion/native'
import React, { useCallback, useEffect, useState } from 'react'
import { MenuView, type MenuAction } from '@expo/ui/community/menu'
import { Share } from 'react-native'
import { useSelector } from 'react-redux'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Link from '~common/Link'
import Loading from '~common/Loading'
import EntityChipList from '~common/EntityChipList'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
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

import { produce } from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { StrongReference, Verse } from '~common/types'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { useTabContext } from '~features/app-switcher/context/TabContext'
import { RootState } from '~redux/modules/reducer'
import { makeStrongTagsSelector } from '~redux/selectors/bible'
import { StrongTab } from '../../state/tabs'
import { historyAtom, unifiedTagsModalAtom } from '../../state/app'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { createStrongEndpoint } from '~features/studyRelations/endpoints'
import type { RelationEndpoint } from '~redux/modules/user'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import booksDesc from '~assets/bible_versions/books-desc'

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

interface StrongDetailScreenProps {
  strongAtom: PrimitiveAtom<StrongTab>
  isFormSheet?: boolean
}

const StrongDetailScreen = ({ strongAtom, isFormSheet = false }: StrongDetailScreenProps) => {
  const router = useRouter()
  const pushRouteOnce = usePushRouteOnce()
  const [strongTab, setStrongTab] = useAtom(strongAtom)
  const { isInTab } = useTabContext()
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : !isInTab

  const {
    data: { book, reference, strongReference: strongReferenceParam },
  } = strongTab

  const [error, setError] = useState<string | undefined>()
  const [strongReference, setStrongReference] = useState<StrongReference | undefined>()
  const [verses, setVerses] = useState<Verse[]>([])
  const [count, setCount] = useState<number>(0)
  const [concordanceLoading, setConcordanceLoading] = useState(true)
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const openEntityRelations = useOpenEntityRelations()

  const addHistory = useSetAtom(historyAtom)

  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()

  const selectStrongTags = makeStrongTagsSelector()
  const code = strongReferenceParam?.Code || reference || ''
  const isGreek = (book || 1) > 39
  const tags = useSelector((state: RootState) => selectStrongTags(state, code, isGreek))
  const strongEndpoint: Extract<RelationEndpoint, { type: 'strong' }> | null = strongReference
    ? createStrongEndpoint({
        language: strongReference.Grec ? 'greek' : 'hebrew',
        code: strongReference.Code,
        labelFallback: strongReference.Mot,
        originalWord: strongReference.Grec || strongReference.Hebreu,
      })
    : null
  const relationCount = useRelationCount(strongEndpoint)

  const loadData = async () => {
    let loadedStrongReference = strongReferenceParam

    if (reference) {
      const result = await loadStrongReference(reference, book || 1)
      if (!result || 'error' in result) {
        setError(result && 'error' in result ? result.error : undefined)
        return
      }
      loadedStrongReference = result
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
    const firstFoundVersesResult = await loadFirstFoundVerses(book || 1, loadedStrongReference.Code)
    const strongVersesCountResult = await loadStrongVersesCount(
      book || 1,
      loadedStrongReference.Code
    )

    if (firstFoundVersesResult && !('error' in firstFoundVersesResult)) {
      setVerses(firstFoundVersesResult)
    }
    if (strongVersesCountResult && !('error' in strongVersesCountResult)) {
      setCount(strongVersesCountResult[0]?.versesCount)
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    Share.share({ message: toCopy })
  }

  const linkToStrong = (str1: string, str2: number) => {
    console.log('linkToStrong', str1, str2)

    let bookNum: string | undefined
    let reference: string | undefined

    // FRENCH STRONG REFERENCES W/ URLS
    if (str1.includes('.htm')) {
      bookNum = String(book)
      reference = str2.toString()
    } else {
      bookNum = String(str2)
      reference = str1
    }

    pushRouteOnce({
      pathname: '/strong',
      params: {
        book: String(bookNum),
        reference: reference,
      },
    })
  }

  const openConcordanceVerse = (verse: Verse) => {
    const bookNumber = Number(verse.Livre)
    const verseNumber = Number(verse.Verset)

    pushRouteOnce({
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
        book: JSON.stringify(booksDesc[bookNumber - 1]),
        chapter: String(verse.Chapitre),
        verse: String(verseNumber),
        focusVerses: JSON.stringify([verseNumber]),
      },
    })
  }

  if (error) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Header hasBackButton={hasBackButton} onCustomBackPress={goBack} title="Désolé..." />
        <Empty
          source={require('~assets/images/empty.json')}
          message={`Impossible de charger la strong pour ce verset...${
            error === 'CORRUPTED_DATABASE'
              ? '\n\nVotre base de données semble être corrompue. Rendez-vous dans la gestion de téléchargements pour retélécharger la base de données.'
              : ''
          }`}
        />
      </FormSheetScreen>
    )
  }

  if (!strongReference) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Header hasBackButton={hasBackButton} onCustomBackPress={goBack} title={t('Lexique')} />
        <Loading message={t('Chargement...')} />
      </FormSheetScreen>
    )
  }

  const { Code, Hebreu, Grec, Mot, Phonetique, Definition, Origine, Type, LSG } = strongReference

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Header
        hasBackButton={hasBackButton}
        title={capitalize(Mot)}
        detail={Phonetique}
        subTitle={Type}
        rightComponent={
          <MenuView
            actions={
              [
                { id: 'tags', title: t('Étiquettes'), image: 'tag' },
                { id: 'share', title: t('Partager'), image: 'square.and.arrow.up' },
                strongEndpoint
                  ? {
                      id: 'relations',
                      title: t('Éditer les relations'),
                      image: 'arrow.triangle.merge',
                    }
                  : null,
                {
                  id: 'open-tab',
                  title: t('tab.openInNewTab'),
                  image: 'arrow.up.forward.square',
                },
              ].filter(Boolean) as MenuAction[]
            }
            onPressAction={({ nativeEvent }) => {
              switch (nativeEvent.event) {
                case 'tags':
                  setUnifiedTagsModal({
                    mode: 'select',
                    id: Code!,
                    title: Mot!,
                    entity: Grec ? 'strongsGrec' : 'strongsHebreu',
                  })
                  break
                case 'share':
                  shareContent()
                  break
                case 'relations':
                  if (strongEndpoint) openEntityRelations(strongEndpoint)
                  break
                case 'open-tab':
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
                  break
              }
            }}
          >
            <Box row center height={60} width={60}>
              <FeatherIcon name="more-vertical" size={18} />
            </Box>
          </MenuView>
        }
      />
      <ScrollView style={{ paddingLeft: 20, paddingRight: 20, flex: 1 }}>
        <Box>
          {tags && (
            <Box marginBottom={10}>
              <EntityChipList
                tags={tags}
                relationCount={relationCount}
                onRelationPress={() => strongEndpoint && openEntityRelations(strongEndpoint)}
              />
            </Box>
          )}
          {!tags && relationCount > 0 && (
            <Box marginBottom={10}>
              <EntityChipList
                relationCount={relationCount}
                onRelationPress={() => strongEndpoint && openEntityRelations(strongEndpoint)}
              />
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
                  <ListenToStrong type={Hebreu ? 'hebreu' : 'grec'} code={Number(Code!)} />
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
                  <ListenToStrong type={Hebreu ? 'hebreu' : 'grec'} code={Number(Code!)} />
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
              <StylizedHTMLView value={LSG} onLinkPress={linkToStrong} />
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
                      onOpenVerse={openConcordanceVerse}
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
                        pushRouteOnce({
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
    </FormSheetScreen>
  )
}

export default waitForStrongDB()(StrongDetailScreen)
