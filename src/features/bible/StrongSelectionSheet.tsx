import { useTheme } from '@emotion/react'
import MaskedView from '@react-native-masked-view/masked-view'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { useAtomValue } from 'jotai/react'
import React, { useEffect, useRef, useState } from 'react'
import {
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import truncHTML from 'trunc-html'

import { Sheet, SheetHeader, SheetView, type SheetRef } from '~common/sheet'
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
    bg="reverse"
    borderRadius={14}
    px={14}
    py={14}
    gap={gap}
    opacity={0.5}
    borderWidth={1}
    borderColor="default"
    style={{ borderStyle: 'dashed' }}
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
  const { t } = useTranslation()
  const theme = useTheme()
  const { width: windowWidth } = useWindowDimensions()
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
    if (!programmaticPreviewScrollRef.current) {
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
    <Sheet
      backdrop={false}
      ref={sheetRef}
      header={<SheetHeader title={sheetTitle} />}
      onDismissStart={onDismissStart}
      onDismiss={onClose}
    >
      <SheetView pt={12} pb={24} gap={14}>
        {!coreAvailable && !downloading && availabilityQuery.isSuccess && (
          <Box px={carouselHorizontalPadding}>
            <ResourceUnavailableView
              identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
              title={t('resource.strong.offlineCopyNeeded')}
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
          <Box px={carouselHorizontalPadding}>
            <StrongDownloadPromptCard gap={10}>
              <HStack gap={12} alignItems="center">
                <FeatherIcon name="loader" size={19} color="default" />
                <Text bold fontSize={14} flex>
                  {t('Téléchargement du lexique Strong')}
                </Text>
                <Text color="default" fontSize={12}>
                  {Math.round(progress * 100)}%
                </Text>
              </HStack>
              <Box height={4} borderRadius={2} bg="border" overflow="hidden">
                <Box height={4} borderRadius={2} bg="primary" width={`${progress * 100}%`} />
              </Box>
            </StrongDownloadPromptCard>
          </Box>
        )}

        {(availabilityQuery.isPending || (coreAvailable && previewQuery.isPending)) && (
          <VStack gap={12}>
            <HStack gap={8} px={carouselHorizontalPadding}>
              <Box width={68} height={34} bg="lightGrey" bgOpacity="050" borderRadius={12} />
              <Box width={62} height={34} bg="lightGrey" bgOpacity="050" borderRadius={12} />
            </HStack>

            <HStack gap={carouselGap} pl={carouselHorizontalPadding}>
              <VStack
                width={windowWidth - carouselHorizontalPadding * 2 - 24}
                height={previewSkeletonHeight}
                bg="lightGrey"
                bgOpacity="050"
                borderRadius={14}
                px={15}
                py={14}
                gap={10}
              >
                <HStack justifyContent="space-between" alignItems="center">
                  <Box width="55%" height={20} bg="border" bgOpacity="050" borderRadius={6} />
                  <Box width={18} height={18} bg="border" bgOpacity="050" borderRadius={9} />
                </HStack>
                <HStack gap={8} alignItems="center">
                  <Box width={52} height={22} bg="border" bgOpacity="050" borderRadius={6} />
                  <Box width={76} height={14} bg="border" bgOpacity="050" borderRadius={5} />
                </HStack>
                <Box width={94} height={12} bg="border" bgOpacity="050" borderRadius={4} />
                <VStack gap={7} mt={2}>
                  <Box width="100%" height={12} bg="border" bgOpacity="050" borderRadius={4} />
                  <Box width="88%" height={12} bg="border" bgOpacity="050" borderRadius={4} />
                  <Box width="68%" height={12} bg="border" bgOpacity="050" borderRadius={4} />
                </VStack>
              </VStack>
              <Box
                width={windowWidth - carouselHorizontalPadding * 2 - 24}
                height={previewSkeletonHeight}
                bg="lightGrey"
                bgOpacity="050"
                borderRadius={14}
              />
            </HStack>
          </VStack>
        )}

        {coreAvailable && !!displayedPreviews?.length && (
          <FadingBox keyProp={previewContentKey} gap={12} skipEntering={false} skipExiting={false}>
            <ScrollView
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
                    key={`${preview.selectedIdentity.kind}:${preview.selectedIdentity.code}`}
                    onPress={() => selectPreview(index)}
                    activeOpacity={0.7}
                  >
                    <Box
                      bg={selected ? 'primary' : 'lightGrey'}
                      bgOpacity={selected ? undefined : '050'}
                      borderRadius={12}
                      px={13}
                      py={8}
                    >
                      <Text color={selected ? 'reverse' : 'default'} bold fontSize={13}>
                        {preview.stepCode}
                      </Text>
                    </Box>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            <ScrollView
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
                    key={`${preview.selectedIdentity.kind}:${preview.selectedIdentity.code}`}
                    width={previewWidth}
                  >
                    <TouchableOpacity
                      onPress={() => openEntry(preview.stepCode, preview.language, morphologyCodes)}
                      activeOpacity={0.7}
                    >
                      <VStack
                        bg="reverse"
                        bgOpacity="050"
                        borderRadius={14}
                        px={15}
                        py={14}
                        gap={9}
                      >
                        <HStack justifyContent="space-between" alignItems="flex-start" gap={12}>
                          <VStack flex gap={4}>
                            <Text bold fontSize={16}>
                              {card.gloss}
                            </Text>
                            <HStack alignItems="baseline" gap={8} wrap>
                              <Text fontSize={17}>{card.original}</Text>
                              {!!card.transliteration && (
                                <Text color="tertiary" fontSize={12}>
                                  {card.transliteration}
                                </Text>
                              )}
                            </HStack>
                            {!!card.morphology && (
                              <Text color="tertiary" fontSize={11} style={{ fontFamily: 'Arial' }}>
                                {card.morphology}
                              </Text>
                            )}
                          </VStack>
                          <FeatherIcon name="chevron-right" size={18} color="tertiary" />
                        </HStack>

                        {descriptionHtml ? (
                          <MaskedView
                            style={{ height: 72 }}
                            maskElement={
                              <LinearGradient
                                colors={['black', 'black', 'transparent']}
                                locations={[0, 0.65, 1]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0, y: 1 }}
                                style={{ flex: 1 }}
                              />
                            }
                          >
                            <StylizedHTMLView
                              value={descriptionHtml}
                              htmlStyle={getStrongSelectionPreviewHtmlStyles(theme)}
                            />
                          </MaskedView>
                        ) : (
                          <Text color="tertiary" fontSize={13} numberOfLines={3}>
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
            </ScrollView>
          </FadingBox>
        )}

        {coreAvailable && displayedPreviews?.length === 0 && (
          <Box minHeight={100} center>
            <Text color="tertiary">{t('Aucune entrée lexicale trouvée')}</Text>
          </Box>
        )}
      </SheetView>
    </Sheet>
  )
}

export default StrongSelectionSheet
