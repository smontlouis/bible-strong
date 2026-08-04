import styled from '@emotion/native'
import React from 'react'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'

import StylizedHTMLView from '~common/StylizedHTMLView'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import ListenToStrong, { hasStrongAudio } from './ListenStrong'

import { cleanParams } from '~helpers/utils'
import { useAtomValue } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import { useRouter } from 'expo-router'
import { currentStudyIdAtom, openedFromTabAtom } from '~features/studies/atom'
import { StudyNavigateBibleType } from '~common/types'
import { Theme } from '@emotion/react'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import { createStrongIdentity } from '~helpers/strongIdentities'
import type { StrongVerseContext } from './strongResourceCardContext'

const Container = styled(Box)<{ isModal?: boolean; cardHeight?: number }>(({ cardHeight }) => ({
  flex: cardHeight === undefined ? 1 : undefined,
  height: cardHeight,
  maxHeight: cardHeight,
  paddingHorizontal: 10,
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

const smallTextStyle = (theme: Theme) => ({
  lineHeight: 20,
  fontSize: 14,
  color: theme.colors.default,
  fontFamily: theme.fontFamily.paragraph,
})

const smallLinkStyle = (theme: Theme) => ({
  ...smallTextStyle(theme),
  color: theme.colors.primary,
})

type Props = {
  index?: number
  theme: Theme
  book: string
  strongEntry: StrongLexiconEntry
  isSelectionMode?: StudyNavigateBibleType
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
    const stepStrongCode = strongEntry.stepCode

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
          codeStrong: stepStrongCode,
          strongType: Type,
          phonetique: Phonetique,
          definition: Definition,
          translatedBy: '',
          original,
          book,
        },
      })
    } else {
      const stepStrongIdentity = createStrongIdentity(stepStrongCode, strongEntry.language)
      pushRouteOnce(
        createStrongDetailRoute('index', {
          ...props.strongVerseContext,
          book: props.strongVerseContext?.book ?? Number(book),
          identityKind: stepStrongIdentity.kind,
          identityCode: stepStrongIdentity.code,
        })
      )
    }
  }

  const { isSelectionMode, strongEntry, theme } = props
  const Mot = strongEntry.gloss
  const Phonetique = strongEntry.transliteration
  const Pronunciation = strongEntry.pronunciation
  const Definition = strongEntry.definitionHtml ?? ''
  const original = strongEntry.original
  const clickedWord = props.strongVerseContext?.clickedWord
  const stepStrongCode = strongEntry.stepCode
  const morphology = props.strongVerseContext?.morphologyCodes.length
    ? props.strongVerseContext.morphologyCodes.join(' · ')
    : strongEntry.morphology?.code

  return (
    <Container overflow="visible" cardHeight={props.cardHeight}>
      <Box mt={20} px={15} py={14} flex={1} bg="reverse" borderRadius={14} overflow="hidden">
        <TouchableBox
          onPress={openStrong}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel={`${stepStrongCode} · ${Mot}`}
        >
          <HStack alignItems="flex-start" gap={10}>
            <VStack flex gap={4}>
              <Text color="primary" bold fontSize={12} textTransform="uppercase">
                {stepStrongCode}
              </Text>

              <Text fontWeight="500" fontSize={16}>
                {Mot}
              </Text>

              {!!(Phonetique || Pronunciation || original) && (
                <Text color="tertiary" fontSize={12}>
                  {[Phonetique, Pronunciation, original].filter(Boolean).join(' · ')}
                </Text>
              )}

              {!!morphology && (
                <Text color="tertiary" fontSize={11} style={{ fontFamily: 'Arial' }}>
                  {morphology}
                </Text>
              )}
            </VStack>
            {isSelectionMode ? (
              <Box bg="primary" bgOpacity="010" borderRadius={16} size={32} center>
                <FeatherIcon name="share" size={17} color="primary" />
              </Box>
            ) : hasStrongAudio(
                strongEntry.language === 'hebrew' ? 'hebreu' : 'grec',
                strongEntry.baseCode
              ) ? (
              <Box bg="primary" bgOpacity="010" borderRadius={16} size={32} center>
                <ListenToStrong
                  type={strongEntry.language === 'hebrew' ? 'hebreu' : 'grec'}
                  code={strongEntry.baseCode}
                  iconSize={13}
                  touchSize={32}
                />
              </Box>
            ) : null}
          </HStack>
          <TitleBorder />
        </TouchableBox>

        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ flex: 1, marginTop: 15 }}
          contentContainerStyle={{ paddingBottom: 15 }}
        >
          {!!clickedWord && (
            <Text color="tertiary" fontSize={12}>
              {clickedWord}
            </Text>
          )}
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
