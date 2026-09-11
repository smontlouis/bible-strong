import HorizontalControlScrollView from '~common/HorizontalControlScrollView'
import StrongSelectionContainer from './StrongSelectionContainer'
import { twMerge } from '~common/ui/classNames'
import { resolveThemeColor, colorWithOpacity } from '~themes/colorValues'
import { useTheme as useStylingTheme, useTheme } from '~themes/ThemeProvider'
import StrongPreviewFade from './StrongPreviewFade'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'
import React, { useEffect, useRef, useState } from 'react'
import {
  Platform,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import truncHTML from 'trunc-html'
import { SheetHeader, SheetView, type SheetRef } from '~common/sheet'
import StylizedHTMLView from '~common/StylizedHTMLView'
import Box, { FadingBox, HStack, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import {
  resourceFailureFromAccessError,
  resourceFailureFromStrongModuleAvailability,
} from '~features/resources/resourceFailure'
import { createStrongIdentity, type StrongIdentity } from '~helpers/strongIdentities'
import {
  getStrongSelectionMorphologyCodes,
  type StrongSelectionMorphology,
} from '~helpers/strongSelection'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import { createStrongSelectionPreviewCard } from './strongSelectionPreviewCard'
import {
  getStrongSelectionPreviewIndex,
  prioritizeStrongSelectionPreview,
} from './strongSelectionPreviewCarousel'
import { getStrongSelectionPreviewHtmlStyles } from './strongSelectionPreviewHtmlStyles'
type StrongSelectionSheetProps = {
  sheetRef: React.RefObject<SheetRef | null>
  version?: string
  book?: number
  chapter?: number
  verse?: number
  word?: string
  identities: StrongIdentity[]
  morphologies: StrongSelectionMorphology[]
  onDismissStart: () => void
  onClose: () => void
}

const StrongDownloadPromptCard = ({
  children,
  gap = 0,
}: {
  children: React.ReactNode
  gap?: number
}) => (
  <VStack
    className="border-continuous overflow-hidden bg-reverse rounded-[14px] px-[14px] py-[14px] opacity-[0.5] border-[1px] border-default"
    style={[{ gap: gap }, { borderStyle: 'dashed' }]}
  >
    {children}
  </VStack>
)

const StrongSelectionSheet = ({
  sheetRef,
  version,
  book,
  chapter,
  verse,
  word,
  identities,
  morphologies,
  onDismissStart,
  onClose,
}: StrongSelectionSheetProps) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const theme = useTheme()
  const { width: viewportWidth } = useWindowDimensions()
  const windowWidth = Platform.OS === 'web' ? Math.min(440, viewportWidth - 32) : viewportWidth
  const pushRouteOnce = usePushRouteOnce()
  const resources = useResourceAccess()
  const previewPagerRef = useRef<ScrollView>(null)
  const programmaticPreviewScrollRef = useRef(false)
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0)
  const resourceLanguage = useAtomValue(resourcesLanguageAtom).STRONG
  const selectionKey = [
    ...identities.map(identity => `${identity.kind}:${identity.code}`),
    ...morphologies.map(
      morphology =>
        `${morphology.identity.kind}:${morphology.identity.code}:${morphology.codes.join(',')}`
    ),
  ].join('|')
  const carouselGap = 12
  const carouselHorizontalPadding = 20
  const previewSkeletonHeight = morphologies.length ? 178 : 153
  const coreDownload = useDownloadItemStatus(
    createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId: 'core' })
  )
  const availabilityQuery = useQuery({
    queryKey: ['strong-lexicon', 'availability', 'core'],
    queryFn: () => resources.strongLexicon.getModuleAvailability('core'),
    networkMode: 'always',
  })
  const coreAvailable = availabilityQuery.data?.status === 'available'
  const previewQuery = useQuery({
    queryKey: ['strong-lexicon', 'preview', resourceLanguage, selectionKey],
    queryFn: async () => ({
      previews: prioritizeStrongSelectionPreview(
        await resources.strongLexicon.loadPreview(identities, resourceLanguage),
        identities[0]
      ),
      morphologies,
    }),
    enabled: coreAvailable && identities.length > 0,
    networkMode: 'always',
    placeholderData: keepPreviousData,
  })
  const displayedPreviews = previewQuery.data?.previews
  const displayedMorphologies = previewQuery.data?.morphologies ?? morphologies
  const previewIdentityKey =
    displayedPreviews
      ?.map(preview => `${preview.selectedIdentity.kind}:${preview.selectedIdentity.code}`)
      .join('|') ?? 'loading'
  const previewMorphologyKey = displayedMorphologies
    .map(
      morphology =>
        `${morphology.identity.kind}:${morphology.identity.code}:${morphology.codes.join(',')}`
    )
    .join('|')
  const previewContentKey = `${previewIdentityKey}|${previewMorphologyKey}`
  const hasMultiplePreviews = (displayedPreviews?.length ?? 0) > 1
  const previewWidth = windowWidth - carouselHorizontalPadding * 2 - (hasMultiplePreviews ? 24 : 0)
  const carouselStep = previewWidth + carouselGap
  const downloading =
    coreDownload?.status === 'queued' ||
    coreDownload?.status === 'downloading' ||
    coreDownload?.status === 'inserting'
  const progress = coreDownload
    ? coreDownload.status === 'inserting'
      ? 0.8 + coreDownload.insertProgress * 0.2
      : coreDownload.downloadProgress * 0.8
    : 0

  useEffect(() => {
    setSelectedPreviewIndex(0)
    previewPagerRef.current?.scrollTo({ x: 0, animated: false })
  }, [selectionKey])

  const openEntry = (stepCode: string, language: 'greek' | 'hebrew', morphologyCodes: string[]) => {
    const identity = createStrongIdentity(stepCode, language)
    sheetRef.current?.dismiss()
    pushRouteOnce({
      pathname: '/strong',
      params: {
        identityKind: identity.kind,
        identityCode: identity.code,
        book: String(book ?? (identity.code.startsWith('G') ? 40 : 1)),
        reference: identity.code,
        bibleVersion: version,
        clickedWord: word,
        bibleChapter: chapter == null ? undefined : String(chapter),
        bibleVerse: verse == null ? undefined : String(verse),
        morphologyCodes: morphologyCodes.length ? JSON.stringify(morphologyCodes) : undefined,
      },
    })
  }

  const selectPreview = (index: number) => {
    programmaticPreviewScrollRef.current = true
    setSelectedPreviewIndex(index)
    previewPagerRef.current?.scrollTo({
      x: carouselStep * index,
      animated: true,
    })
  }

  const syncSelectedPreview = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = getStrongSelectionPreviewIndex(
      event.nativeEvent.contentOffset.x,
      carouselStep,
      displayedPreviews?.length ?? 0
    )
    setSelectedPreviewIndex(index)
  }

  const syncSelectedPreviewDuringSwipe = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (Platform.OS === 'web' || !programmaticPreviewScrollRef.current) {
      syncSelectedPreview(event)
    }
  }

  const finishPreviewScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    programmaticPreviewScrollRef.current = false
    syncSelectedPreview(event)
  }

  const sheetTitle = word
    ? `${word}${version ? ` · ${version}` : ''}`
    : version
      ? `${t('Strong')} · ${version}`
      : t('Strong')

  return (
    <StrongSelectionContainer
      backdrop={false}
      ref={sheetRef}
      header={<SheetHeader title={sheetTitle} />}
      onDismissStart={onDismissStart}
      onDismiss={onClose}
    >
      <SheetView className="pt-[12px] pb-[24px] gap-[14px]">
        {!coreAvailable && !downloading && availabilityQuery.isSuccess && (
          <Box
            className="overflow-hidden border-continuous"
            style={{ paddingHorizontal: carouselHorizontalPadding }}
          >
            <ResourceUnavailableView
              identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
              title={t('resource.strong.offlineCopyNeeded')}
              offlineTitle={t('resource.strong.temporarilyUnavailable')}
              fileSize={35}
              failure={resourceFailureFromStrongModuleAvailability(availabilityQuery.data)}
              size="small"
              onRetry={() => void availabilityQuery.refetch()}
            />
          </Box>
        )}

        {(availabilityQuery.isError || previewQuery.isError) && (
          <ResourceUnavailableView
            identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
            title={t('resource.strong.temporarilyUnavailable')}
            fileSize={35}
            failure={resourceFailureFromAccessError(previewQuery.error ?? availabilityQuery.error)}
            size="small"
            onRetry={() => {
              void availabilityQuery.refetch()
              void previewQuery.refetch()
            }}
          />
        )}

        {downloading && (
          <Box
            className="overflow-hidden border-continuous"
            style={{ paddingHorizontal: carouselHorizontalPadding }}
          >
            <StrongDownloadPromptCard gap={10}>
              <HStack className="overflow-hidden border-continuous gap-[12px] items-center">
                <FeatherIcon name="loader" size={19} color="default" />
                <Text className="font-bold text-[14px] flex-[1]">
                  {t('Téléchargement du lexique Strong')}
                </Text>
                <Text className="text-default text-[12px]">{Math.round(progress * 100)}%</Text>
              </HStack>
              <Box className="border-continuous overflow-visible h-[4px] rounded-[2px] bg-border">
                <Box
                  className="overflow-hidden border-continuous h-[4px] rounded-[2px] bg-primary"
                  style={{ width: `${progress * 100}%` }}
                />
              </Box>
            </StrongDownloadPromptCard>
          </Box>
        )}

        {(availabilityQuery.isPending || (coreAvailable && previewQuery.isPending)) && (
          <VStack className="overflow-hidden border-continuous gap-[12px]">
            <HStack
              className="overflow-hidden border-continuous gap-[8px]"
              style={{ paddingHorizontal: carouselHorizontalPadding }}
            >
              <Box
                className="overflow-hidden border-continuous w-[68px] h-[34px] rounded-[12px]"
                style={{
                  backgroundColor: colorWithOpacity(
                    resolveThemeColor(stylingTheme, 'lightGrey'),
                    0.5
                  ),
                }}
              />
              <Box
                className="overflow-hidden border-continuous w-[62px] h-[34px] rounded-[12px]"
                style={{
                  backgroundColor: colorWithOpacity(
                    resolveThemeColor(stylingTheme, 'lightGrey'),
                    0.5
                  ),
                }}
              />
            </HStack>

            <HStack
              className="overflow-hidden border-continuous"
              style={{ paddingLeft: carouselHorizontalPadding, gap: carouselGap }}
            >
              <VStack
                className="overflow-hidden border-continuous rounded-[14px] px-[15px] py-[14px] gap-[10px]"
                style={{
                  width: windowWidth - carouselHorizontalPadding * 2 - 24,
                  height: previewSkeletonHeight,
                  backgroundColor: colorWithOpacity(
                    resolveThemeColor(stylingTheme, 'lightGrey'),
                    0.5
                  ),
                }}
              >
                <HStack className="overflow-hidden border-continuous justify-between items-center">
                  <Box
                    className="overflow-hidden border-continuous w-[55%] h-[20px] rounded-[6px]"
                    style={{
                      backgroundColor: colorWithOpacity(
                        resolveThemeColor(stylingTheme, 'border'),
                        0.5
                      ),
                    }}
                  />
                  <Box
                    className="overflow-hidden border-continuous w-[18px] h-[18px] rounded-[9px]"
                    style={{
                      backgroundColor: colorWithOpacity(
                        resolveThemeColor(stylingTheme, 'border'),
                        0.5
                      ),
                    }}
                  />
                </HStack>
                <HStack className="overflow-hidden border-continuous gap-[8px] items-center">
                  <Box
                    className="overflow-hidden border-continuous w-[52px] h-[22px] rounded-[6px]"
                    style={{
                      backgroundColor: colorWithOpacity(
                        resolveThemeColor(stylingTheme, 'border'),
                        0.5
                      ),
                    }}
                  />
                  <Box
                    className="overflow-hidden border-continuous w-[76px] h-[14px] rounded-[5px]"
                    style={{
                      backgroundColor: colorWithOpacity(
                        resolveThemeColor(stylingTheme, 'border'),
                        0.5
                      ),
                    }}
                  />
                </HStack>
                <Box
                  className="overflow-hidden border-continuous w-[94px] h-[12px] rounded-[4px]"
                  style={{
                    backgroundColor: colorWithOpacity(
                      resolveThemeColor(stylingTheme, 'border'),
                      0.5
                    ),
                  }}
                />
                <VStack className="overflow-hidden border-continuous gap-[7px] mt-[2px]">
                  <Box
                    className="overflow-hidden border-continuous w-[100%] h-[12px] rounded-[4px]"
                    style={{
                      backgroundColor: colorWithOpacity(
                        resolveThemeColor(stylingTheme, 'border'),
                        0.5
                      ),
                    }}
                  />
                  <Box
                    className="overflow-hidden border-continuous w-[88%] h-[12px] rounded-[4px]"
                    style={{
                      backgroundColor: colorWithOpacity(
                        resolveThemeColor(stylingTheme, 'border'),
                        0.5
                      ),
                    }}
                  />
                  <Box
                    className="overflow-hidden border-continuous w-[68%] h-[12px] rounded-[4px]"
                    style={{
                      backgroundColor: colorWithOpacity(
                        resolveThemeColor(stylingTheme, 'border'),
                        0.5
                      ),
                    }}
                  />
                </VStack>
              </VStack>
              <Box
                className="overflow-hidden border-continuous rounded-[14px]"
                style={{
                  width: windowWidth - carouselHorizontalPadding * 2 - 24,
                  height: previewSkeletonHeight,
                  backgroundColor: colorWithOpacity(
                    resolveThemeColor(stylingTheme, 'lightGrey'),
                    0.5
                  ),
                }}
              />
            </HStack>
          </VStack>
        )}

        {coreAvailable && !!displayedPreviews?.length && (
          <FadingBox
            className="overflow-hidden border-continuous gap-[12px]"
            keyProp={previewContentKey}
            skipEntering={false}
            skipExiting={false}
          >
            <HorizontalControlScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: 8,
                paddingHorizontal: carouselHorizontalPadding,
              }}
            >
              {displayedPreviews.map((preview, index) => {
                const selected = selectedPreviewIndex === index
                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    key={`${preview.selectedIdentity.kind}:${preview.selectedIdentity.code}`}
                    onPress={() => selectPreview(index)}
                    activeOpacity={0.7}
                  >
                    <Box
                      className="overflow-hidden border-continuous rounded-[12px] px-[13px] py-[8px]"
                      style={{
                        backgroundColor: colorWithOpacity(
                          resolveThemeColor(stylingTheme, selected ? 'primary' : 'lightGrey'),
                          selected ? undefined : 0.5
                        ),
                      }}
                    >
                      <Text
                        className={twMerge(
                          selected ? 'text-reverse' : 'text-default',
                          'font-bold text-[13px]'
                        )}
                      >
                        {preview.stepCode}
                      </Text>
                    </Box>
                  </TouchableOpacity>
                )
              })}
            </HorizontalControlScrollView>

            <HorizontalControlScrollView
              ref={previewPagerRef}
              horizontal
              scrollEnabled={displayedPreviews.length > 1}
              showsHorizontalScrollIndicator={false}
              snapToInterval={carouselStep}
              snapToAlignment="start"
              decelerationRate="fast"
              onScrollBeginDrag={() => {
                programmaticPreviewScrollRef.current = false
              }}
              onScroll={syncSelectedPreviewDuringSwipe}
              onMomentumScrollEnd={finishPreviewScroll}
              scrollEventThrottle={16}
              contentContainerStyle={{
                gap: carouselGap,
                paddingLeft: carouselHorizontalPadding,
                paddingRight: carouselHorizontalPadding + (hasMultiplePreviews ? 24 : 0),
              }}
            >
              {displayedPreviews.map(preview => {
                const descriptionHtml = preview.definitionHtml
                  ? truncHTML(preview.definitionHtml, 360).html
                  : undefined
                const morphologyCodes = getStrongSelectionMorphologyCodes(
                  displayedMorphologies,
                  preview.selectedIdentity
                )
                const card = createStrongSelectionPreviewCard(preview, morphologyCodes)

                return (
                  <Box
                    className="overflow-hidden border-continuous"
                    key={`${preview.selectedIdentity.kind}:${preview.selectedIdentity.code}`}
                    style={{ width: previewWidth }}
                  >
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => openEntry(preview.stepCode, preview.language, morphologyCodes)}
                      activeOpacity={0.7}
                    >
                      <VStack
                        className="overflow-hidden border-continuous rounded-[14px] px-[15px] py-[14px] gap-[9px]"
                        style={{
                          backgroundColor: colorWithOpacity(
                            resolveThemeColor(stylingTheme, 'reverse'),
                            0.5
                          ),
                        }}
                      >
                        <HStack className="overflow-hidden border-continuous justify-between items-start gap-[12px]">
                          <VStack className="overflow-hidden border-continuous flex-[1] gap-[4px]">
                            <Text className="font-bold text-[16px]">{card.gloss}</Text>
                            <HStack className="overflow-hidden border-continuous items-baseline gap-[8px] flex-wrap">
                              <Text className="text-[17px]">{card.original}</Text>
                              {!!card.transliteration && (
                                <Text className="text-tertiary text-[12px]">
                                  {card.transliteration}
                                </Text>
                              )}
                            </HStack>
                            {!!card.morphology && (
                              <Text
                                className="text-tertiary text-[11px]"
                                style={{ fontFamily: 'Arial' }}
                              >
                                {card.morphology}
                              </Text>
                            )}
                          </VStack>
                          <FeatherIcon name="chevron-right" size={18} color="tertiary" />
                        </HStack>

                        {descriptionHtml ? (
                          <StrongPreviewFade>
                            <StylizedHTMLView
                              value={descriptionHtml}
                              htmlStyle={getStrongSelectionPreviewHtmlStyles(theme)}
                            />
                          </StrongPreviewFade>
                        ) : (
                          <Text className="text-tertiary text-[13px]" numberOfLines={3}>
                            {t('strongLexicon.definitionUnavailable', {
                              language: resourceLanguage.toUpperCase(),
                            })}
                          </Text>
                        )}
                      </VStack>
                    </TouchableOpacity>
                  </Box>
                )
              })}
            </HorizontalControlScrollView>
          </FadingBox>
        )}

        {coreAvailable && displayedPreviews?.length === 0 && (
          <Box className="overflow-hidden border-continuous min-h-[100px] items-center justify-center">
            <Text className="text-tertiary">{t('Aucune entrée lexicale trouvée')}</Text>
          </Box>
        )}
      </SheetView>
    </StrongSelectionContainer>
  )
}

export default StrongSelectionSheet
