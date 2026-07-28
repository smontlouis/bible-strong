import { useTheme } from '@emotion/react'
import MaskedView from '@react-native-masked-view/masked-view'
import { useQuery } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { useAtomValue } from 'jotai/react'
import React, { useEffect, useRef, useState } from 'react'
import {
  Alert,
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
import Box, { HStack, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { createStrongLexiconModuleDownloadItem } from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import type { StrongIdentity } from '~helpers/strongIdentities'
import {
  getStrongSelectionMorphologyCodes,
  type StrongSelectionMorphology,
} from '~helpers/strongSelection'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'

type StrongSelectionSheetProps = {
  sheetRef: React.RefObject<SheetRef | null>
  version?: string
  book?: number
  chapter?: number
  verse?: number
  word?: string
  identities: StrongIdentity[]
  morphologies: StrongSelectionMorphology[]
  onClose: () => void
}

const StrongSelectionSheet = ({
  sheetRef,
  version,
  book,
  chapter,
  verse,
  word,
  identities,
  morphologies,
  onClose,
}: StrongSelectionSheetProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const { width: windowWidth } = useWindowDimensions()
  const pushRouteOnce = usePushRouteOnce()
  const resources = useResourceAccess()
  const previewPagerRef = useRef<ScrollView>(null)
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
    queryKey: ['strong-lexicon', 'preview', resourceLanguage, identities],
    queryFn: () => resources.strongLexicon.loadPreview(identities, resourceLanguage),
    enabled: coreAvailable && identities.length > 0,
    networkMode: 'always',
  })
  const hasMultiplePreviews = (previewQuery.data?.length ?? 0) > 1
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

  const requestCoreDownload = () => {
    Alert.alert(
      t('Télécharger le lexique Strong ?'),
      t(
        'Le lexique principal est nécessaire pour afficher les définitions, la morphologie et les mots liés.'
      ),
      [
        { text: t('Annuler'), style: 'cancel' },
        {
          text: t('Télécharger'),
          onPress: () => downloadManager.enqueue([createStrongLexiconModuleDownloadItem('core')]),
        },
      ]
    )
  }

  const openEntry = (identity: StrongIdentity) => {
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
      },
    })
  }

  const selectPreview = (index: number) => {
    setSelectedPreviewIndex(index)
    previewPagerRef.current?.scrollTo({
      x: carouselStep * index,
      animated: true,
    })
  }

  const syncSelectedPreview = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / carouselStep)
    setSelectedPreviewIndex(index)
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
      onDismiss={onClose}
    >
      <SheetView pt={12} pb={24} gap={14}>
        {!coreAvailable && !downloading && !availabilityQuery.isPending && (
          <Box px={carouselHorizontalPadding}>
            <TouchableOpacity onPress={requestCoreDownload} activeOpacity={0.7}>
              <HStack bg="lightGrey" borderRadius={14} px={14} py={15} gap={12} alignItems="center">
                <FeatherIcon name="download-cloud" size={20} color="default" />
                <VStack flex gap={3}>
                  <Text bold>{t('Télécharger le lexique Strong')}</Text>
                  <Text color="tertiary" fontSize={12}>
                    {t('Définitions françaises et anglaises, morphologie et mots liés')}
                  </Text>
                </VStack>
              </HStack>
            </TouchableOpacity>
          </Box>
        )}

        {downloading && (
          <Box px={carouselHorizontalPadding}>
            <VStack bg="lightGrey" borderRadius={14} px={14} py={15} gap={10}>
              <HStack alignItems="center" justifyContent="space-between">
                <Text bold>{t('Téléchargement du lexique Strong')}</Text>
                <Text color="tertiary" fontSize={12}>
                  {Math.round(progress * 100)}%
                </Text>
              </HStack>
              <Box height={4} borderRadius={2} bg="border" overflow="hidden">
                <Box height={4} borderRadius={2} bg="primary" width={`${progress * 100}%`} />
              </Box>
            </VStack>
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

        {coreAvailable && !!previewQuery.data?.length && (
          <VStack gap={12}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: 8,
                paddingHorizontal: carouselHorizontalPadding,
              }}
            >
              {previewQuery.data.map((preview, index) => {
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
              scrollEnabled={previewQuery.data.length > 1}
              showsHorizontalScrollIndicator={false}
              snapToInterval={carouselStep}
              snapToAlignment="start"
              decelerationRate="fast"
              onMomentumScrollEnd={syncSelectedPreview}
              scrollEventThrottle={16}
              contentContainerStyle={{
                gap: carouselGap,
                paddingLeft: carouselHorizontalPadding,
                paddingRight: carouselHorizontalPadding + (hasMultiplePreviews ? 24 : 0),
              }}
            >
              {previewQuery.data.map(preview => {
                const descriptionHtml = preview.definitionHtml
                  ? truncHTML(preview.definitionHtml, 360).html
                  : undefined
                const morphologyCodes = getStrongSelectionMorphologyCodes(
                  morphologies,
                  preview.selectedIdentity
                )

                return (
                  <Box
                    key={`${preview.selectedIdentity.kind}:${preview.selectedIdentity.code}`}
                    width={previewWidth}
                  >
                    <TouchableOpacity
                      onPress={() => openEntry(preview.selectedIdentity)}
                      activeOpacity={0.7}
                    >
                      <VStack
                        bg="lightGrey"
                        bgOpacity="050"
                        borderRadius={14}
                        px={15}
                        py={14}
                        gap={9}
                      >
                        <HStack justifyContent="space-between" alignItems="flex-start" gap={12}>
                          <VStack flex gap={5}>
                            <HStack alignItems="baseline" gap={8} wrap>
                              <Text bold fontSize={18}>
                                {preview.gloss}
                              </Text>
                              <Text color="tertiary" fontSize={12}>
                                {preview.stepCode}
                              </Text>
                            </HStack>
                            <HStack alignItems="baseline" gap={8} wrap>
                              <Text fontSize={19}>{preview.original}</Text>
                              {!!preview.transliteration && (
                                <Text color="tertiary" fontSize={13}>
                                  {preview.transliteration}
                                </Text>
                              )}
                            </HStack>
                            {!!morphologyCodes.length && (
                              <HStack alignItems="baseline" gap={6} wrap>
                                <Text color="tertiary" fontSize={11}>
                                  {t('Morphologie')}
                                </Text>
                                <Text
                                  color="tertiary"
                                  fontSize={12}
                                  style={{ fontFamily: 'Arial' }}
                                >
                                  {morphologyCodes.join(' · ')}
                                </Text>
                              </HStack>
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
                              htmlStyle={{
                                p: {
                                  color: theme.colors.tertiary,
                                  fontSize: 13,
                                  lineHeight: 18,
                                  marginTop: 0,
                                  marginBottom: 5,
                                },
                                li: {
                                  color: theme.colors.tertiary,
                                  fontSize: 13,
                                  lineHeight: 18,
                                },
                                ol: {
                                  color: theme.colors.tertiary,
                                  fontSize: 13,
                                  lineHeight: 18,
                                },
                                ul: {
                                  color: theme.colors.tertiary,
                                  fontSize: 13,
                                  lineHeight: 18,
                                },
                                strong: {
                                  color: theme.colors.tertiary,
                                  fontSize: 13,
                                  lineHeight: 18,
                                  fontWeight: 'bold',
                                },
                              }}
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
          </VStack>
        )}

        {coreAvailable && previewQuery.data?.length === 0 && (
          <Box minHeight={100} center>
            <Text color="tertiary">{t('Aucune entrée lexicale trouvée')}</Text>
          </Box>
        )}
      </SheetView>
    </Sheet>
  )
}

export default StrongSelectionSheet
