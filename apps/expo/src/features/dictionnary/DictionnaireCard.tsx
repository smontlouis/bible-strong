import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, Theme, useTheme } from '~themes/ThemeProvider'
import * as Icon from '~common/ui/classNameIcons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'
import truncHTML from 'trunc-html'

import type { Theme as AppTheme } from '~themes'

import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

import StylizedHTMLView from '~common/StylizedHTMLView'

import { useRouter } from 'expo-router'
import { useAtomValue } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import { SheetScrollView } from '~common/sheet'
import { StudyNavigateBibleType } from '~common/types'
import { currentStudyIdAtom, openedFromTabAtom } from '~features/studies/atom'
import truncate from '~helpers/truncate'
import { cleanParams, wp } from '~helpers/utils'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const itemWidth = slideWidth

const Container = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('flex-[1] pb-[18px]', className)
  return (
    <Box
      {...props}
      style={
        [
          { width: itemWidth, paddingHorizontal: itemHorizontalMargin },
          props.style,
        ] as UIComponentProps<typeof Box>['style']
      }
      className={twMerge('overflow-hidden border-continuous', resolvedClassName)}
    />
  )
}

const TitleBorder = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('mt-[10px] w-[35px] h-[3px] bg-secondary', className)
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

const OpenStrongIcon = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('pt-[5px] flex-row items-center', className)
  return (
    <NativeUI.TouchableOpacity
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.TouchableOpacity>['style']}
    />
  )
}

const IconFeather = (
  componentProps: Omit<UIComponentProps<typeof Icon.Feather>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('pt-[5px] text-default', className)
  return (
    <Icon.Feather
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof Icon.Feather>['style']}
    />
  )
}

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
  sourceLabel?: string
  routeParams?: {
    entryId: number
    work: string
    resourceId: string
    dictionaryTitle: string
    language: 'fr' | 'en'
    correspondenceId?: string
  }
}

const DictionnaireCard = ({
  dictionnaireRef,
  isSelectionMode,
  sourceLabel,
  routeParams,
}: Props) => {
  const stylingTheme = useStylingTheme()

  const theme = useTheme()
  const router = useRouter()
  const pushRouteOnce = usePushRouteOnce()
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
      pushRouteOnce({
        pathname: '/dictionnary-detail',
        params: { word, ...routeParams },
      })
    }
  }

  if (!word) {
    return <Empty message="Impossible de charger ce mot..." />
  }

  const { html } = truncHTML(definition.replace(/\n/gi, ''), 500)

  return (
    <Container>
      <Box className="overflow-hidden border-continuous pt-[10px]">
        <Box className="overflow-hidden border-continuous">
          <OpenStrongIcon onPress={openDictionnaire}>
            <Text
              className="text-[22px] flex-[1]"
              style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
            >
              {truncate(word, 7)}
            </Text>
            {isSelectionMode ? (
              <IconFeather name="share" size={20} />
            ) : (
              <IconFeather name="maximize-2" size={20} />
            )}
          </OpenStrongIcon>
          {sourceLabel ? <Text className="text-[11px] text-tertiary">{sourceLabel}</Text> : null}
          <TitleBorder />
        </Box>
      </Box>

      <SheetScrollView style={{ marginBottom: 15 }}>
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
      </SheetScrollView>
    </Container>
  )
}

export default DictionnaireCard
