import { resolveThemeColor, colorWithOpacity } from '~themes/colorValues'
import { useTheme as useStylingTheme, Theme } from '~themes/ThemeProvider'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { ScrollView } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'

import StylizedHTMLView from '~common/StylizedHTMLView'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import ListenToStrong, { hasStrongAudio } from './ListenStrong'

import { useRouter } from 'expo-router'
import { useAtomValue } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import { StudyNavigateBibleType } from '~common/types'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import type {
  StrongLexiconEntry,
  StrongLexiconEntryCard,
} from '~features/resources/strongLexiconAccess'
import { currentStudyIdAtom, openedFromTabAtom } from '~features/studies/atom'
import { createStrongIdentity } from '~helpers/strongIdentities'
import { cleanParams } from '~helpers/utils'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { StrongVerseContext } from './strongResourceCardContext'

const TitleBorder = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('mt-[10px] w-[35px] h-[3px] bg-primary', className)
  return (
    <NativeUI.View
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

const ViewItem = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('mt-[15px]', className)
  return (
    <NativeUI.View
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

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
  strongEntry: StrongLexiconEntryCard | StrongLexiconEntry
  isSelectionMode?: StudyNavigateBibleType
  onClosed?: () => void
  strongVerseContext?: StrongVerseContext
}

const StrongCard = (props: Props) => {
  const stylingTheme = useStylingTheme()

  const router = useRouter()
  const pushRouteOnce = usePushRouteOnce()
  const openedFromTab = useAtomValue(openedFromTabAtom)

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
  const stepStrongCode = strongEntry.stepCode
  const morphology = props.strongVerseContext?.morphologyCodes.length
    ? props.strongVerseContext.morphologyCodes.join(' · ')
    : strongEntry.morphology?.code

  return (
    <Box className="overflow-hidden border-continuous flex-[1]">
      <Box className="border-continuous overflow-visible mt-[20px] px-[15px] py-[14px] flex-[1] bg-reverse rounded-[14px]">
        <Box className="overflow-hidden border-continuous">
          <HStack className="overflow-hidden border-continuous items-start gap-[10px]">
            <TouchableBox
              className="overflow-hidden border-continuous flex-[1]"
              onPress={openStrong}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel={`${stepStrongCode} · ${Mot}`}
            >
              <VStack className="overflow-hidden border-continuous gap-[4px]">
                <Text className="text-primary font-bold text-[12px] uppercase">
                  {stepStrongCode}
                </Text>

                <Text className="font-medium text-[16px]">{Mot}</Text>

                {!!(Phonetique || Pronunciation || original) && (
                  <Text className="text-tertiary text-[12px]">
                    {[Phonetique, Pronunciation, original].filter(Boolean).join(' · ')}
                  </Text>
                )}

                {!!morphology && (
                  <Text className="text-tertiary text-[11px]" style={{ fontFamily: 'Arial' }}>
                    {morphology}
                  </Text>
                )}
              </VStack>
            </TouchableBox>
            {isSelectionMode ? (
              <Box
                className="overflow-hidden border-continuous rounded-[16px] items-center justify-center"
                style={{
                  backgroundColor: colorWithOpacity(
                    resolveThemeColor(stylingTheme, 'primary'),
                    0.1
                  ),
                  width: 32,
                  height: 32,
                }}
              >
                <FeatherIcon name="share" size={17} color="primary" />
              </Box>
            ) : hasStrongAudio(
                strongEntry.language === 'hebrew' ? 'hebreu' : 'grec',
                strongEntry.baseCode
              ) ? (
              <Box
                className="overflow-hidden border-continuous rounded-[16px] items-center justify-center"
                style={{
                  backgroundColor: colorWithOpacity(
                    resolveThemeColor(stylingTheme, 'primary'),
                    0.1
                  ),
                  width: 32,
                  height: 32,
                }}
              >
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
        </Box>

        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 15 }}
        >
          {!!Definition && (
            <ViewItem>
              <StylizedHTMLView
                htmlStyle={{
                  p: { ...smallTextStyle(theme) },
                  em: { ...smallTextStyle(theme) },
                  strong: { ...smallTextStyle(theme) },
                  b: { ...smallTextStyle(theme), color: theme.colors.quart },
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
    </Box>
  )
}

export default StrongCard
