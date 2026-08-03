import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React from 'react'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'

import Link from '~common/Link'
import StylizedHTMLView from '~common/StylizedHTMLView'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import ListenToStrong, { hasStrongAudio } from './ListenStrong'

import { cleanParams, wp } from '~helpers/utils'
import { useAtomValue } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import { useRouter } from 'expo-router'
import { currentStudyIdAtom, openedFromTabAtom } from '~features/studies/atom'
import { StudyNavigateBibleType } from '~common/types'
import { Theme } from '@emotion/react'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import { formatStrongContextMorphology } from '~features/lexique/strongContextPresentation'
import type { StrongVerseContext } from './strongResourceCardContext'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const itemWidth = slideWidth

const Container = styled(Box)<{ isModal?: boolean; cardHeight?: number }>(
  ({ isModal, cardHeight }) => ({
    width: itemWidth,
    flex: cardHeight === undefined ? 1 : undefined,
    height: cardHeight,
    maxHeight: cardHeight,
    paddingHorizontal: itemHorizontalMargin,

    ...(isModal && {
      width: 'auto',
      paddingHorizontal: 20,
    }),
  })
)

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

const smallLinkStyle = (theme: Theme) => ({
  ...smallTextStyle(theme),
  color: theme.colors.quart,
  textDecorationLine: 'underline' as const,
  textDecorationColor: theme.colors.quart,
})

type Props = {
  index?: number
  theme: Theme
  book: string
  strongEntry: StrongLexiconEntry
  isSelectionMode?: StudyNavigateBibleType
  isModal?: boolean
  onClosed?: () => void
  strongVerseContext?: StrongVerseContext
  cardHeight?: number
}

const StrongCard = (props: Props) => {
  const router = useRouter()
  const pushRouteOnce = usePushRouteOnce()
  const openedFromTab = useAtomValue(openedFromTabAtom)
  const { t } = useTranslation()

  const linkToStrong = (str1: string, str2: string | number) => {
    const { book } = props

    let bookNum: string | undefined
    let reference: string | undefined

    // FRENCH STRONG REFERENCES W/ URLS
    if (str1.includes('.htm')) {
      bookNum = book
      reference = str2.toString()
    } else {
      bookNum = String(str2)
      reference = str1
    }

    pushRouteOnce({
      pathname: '/strong',
      params: {
        book: bookNum,
        reference: reference,
        strongBibleVersionId: props.strongVerseContext?.strongBibleVersionId,
      },
    })
  }

  const openStrong = () => {
    const { book, strongEntry, isSelectionMode } = props
    const Type = strongEntry.morphology?.meaning ?? ''
    const Mot = strongEntry.gloss
    const Phonetique = strongEntry.transliteration
    const Definition = strongEntry.definitionHtml ?? ''
    const original = strongEntry.original

    if (isSelectionMode) {
      const store = getDefaultStore()
      const currentStudyId = store.get(currentStudyIdAtom)
      const pathname = openedFromTab ? '/' : '/edit-study'
      router.dismissTo({
        pathname,
        params: {
          ...cleanParams(),
          studyId: currentStudyId,
          type: isSelectionMode,
          title: Mot,
          codeStrong: strongEntry.classicStrong,
          strongType: Type,
          phonetique: Phonetique,
          definition: Definition,
          translatedBy: '',
          original,
          book,
        },
      })
    } else {
      pushRouteOnce(
        createStrongDetailRoute('index', {
          ...props.strongVerseContext,
          book: props.strongVerseContext?.book ?? Number(book),
          identityKind: strongEntry.selectedIdentity.kind,
          identityCode: strongEntry.selectedIdentity.code,
        })
      )
    }
  }

  const { isSelectionMode, strongEntry, theme, isModal } = props
  const Mot = strongEntry.gloss
  const Phonetique = strongEntry.transliteration
  const Definition = strongEntry.definitionHtml ?? ''
  const original = strongEntry.original
  const morphology = props.strongVerseContext?.morphologyCodes.length
    ? props.strongVerseContext.morphologyCodes.join(' · ')
    : strongEntry.morphology
      ? formatStrongContextMorphology(strongEntry.morphology)
      : undefined

  return (
    <Container overflow="visible" isModal={isModal} cardHeight={props.cardHeight}>
      <Box
        mt={14}
        px={15}
        py={14}
        flex={1}
        bg="reverse"
        bgOpacity="050"
        borderRadius={14}
        overflow="hidden"
      >
        <Text color="primary" bold fontSize={12} textTransform="uppercase">
          {strongEntry.selectedIdentity.code}
        </Text>
        <Box>
          <Box row alignItems="flex-end">
            <Header>
              <Link onPress={openStrong} style={{ flex: 1 }}>
                <Text bold fontSize={18} flex>
                  {Mot}
                  {!!Phonetique && (
                    <Text color="tertiary" fontSize={12}>
                      {' '}
                      {Phonetique}
                    </Text>
                  )}
                </Text>
              </Link>
              {hasStrongAudio(
                strongEntry.language === 'hebrew' ? 'hebreu' : 'grec',
                strongEntry.baseCode
              ) && (
                <Box mr={10} bg="primary" bgOpacity="010" borderRadius={18} size={36} center>
                  <ListenToStrong
                    type={strongEntry.language === 'hebrew' ? 'hebreu' : 'grec'}
                    code={strongEntry.baseCode}
                    iconSize={16}
                    touchSize={36}
                  />
                </Box>
              )}
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
            {original}
          </Text>
          {!!morphology && (
            <Text color="tertiary" fontSize={11} style={{ fontFamily: 'Arial' }}>
              {morphology}
            </Text>
          )}
          {/* {!!Type && (
              <Text titleItalic color="darkGrey" fontSize={12}>
                {Type}
              </Text>
            )} */}
          <TitleBorder />
        </Box>

        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ flex: 1, marginTop: 15 }}
          contentContainerStyle={{ paddingBottom: 15 }}
        >
          {!!Definition && (
            <ViewItem>
              <SubTitle color="darkGrey">{t('strongDetail.definition.title')}</SubTitle>
              <StylizedHTMLView
                htmlStyle={{
                  p: { ...smallTextStyle(theme) },
                  em: { ...smallTextStyle(theme) },
                  strong: { ...smallTextStyle(theme) },
                  a: { ...smallLinkStyle(theme) },
                  i: { ...smallTextStyle(theme) },
                  li: { ...smallTextStyle(theme) },
                  ol: { ...smallTextStyle(theme) },
                  ul: { ...smallTextStyle(theme) },
                }}
                value={Definition}
                onLinkPress={linkToStrong}
              />
            </ViewItem>
          )}
        </ScrollView>
      </Box>
    </Container>
  )
}

export default StrongCard
