import React from 'react'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import { useTheme } from '@emotion/react'
import truncHTML from 'trunc-html'

import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

import StylizedHTMLView from '~common/StylizedHTMLView'

import { cleanParams, wp } from '~helpers/utils'
import truncate from '~helpers/truncate'
import { useRouter } from 'expo-router'
import { useAtomValue } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { currentStudyIdAtom, openedFromTabAtom } from '~features/studies/atom'
import { StudyNavigateBibleType } from '~common/types'
import { Theme } from '@emotion/react'

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

const smallTextStyle = (theme: Theme) => ({
  lineHeight: 18,
  fontSize: 12,
  color: theme.colors.default,
  fontFamily: theme.fontFamily.paragraph,
})

type DictionnaireRef = {
  word: string
  definition: string
}

type Props = {
  dictionnaireRef: DictionnaireRef
  isSelectionMode?: StudyNavigateBibleType
}

const DictionnaireCard = ({ dictionnaireRef, isSelectionMode }: Props) => {
  const theme = useTheme()
  const router = useRouter()
  const openedFromTab = useAtomValue(openedFromTabAtom)

  const { word, definition } = dictionnaireRef || {}

  const openDictionnaire = () => {
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
          title: word,
        },
      })
    } else {
      router.push({
        pathname: '/dictionnary-detail',
        params: { word },
      })
    }
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
    <Container>
      <Box paddingTop={10}>
        <Box>
          <OpenStrongIcon onPress={openDictionnaire}>
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

      <BottomSheetScrollView style={{ marginBottom: 15 }}>
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
      </BottomSheetScrollView>
    </Container>
  )
}

export default DictionnaireCard
