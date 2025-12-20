import * as Sentry from '@sentry/react-native'
import React, { useEffect, useMemo, useState, useCallback } from 'react'

import { Alert, Linking, Image, ActivityIndicator } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { createSelector } from '@reduxjs/toolkit'
import WebView from 'react-native-webview'

import { useTranslation } from 'react-i18next'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import PopOverMenu from '~common/PopOverMenu'
import Snackbar from '~common/SnackBar'
import TagList from '~common/TagList'
import { VerseIds } from '~common/types'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import TextInput from '~common/ui/TextInput'
import orderVerses from '~helpers/orderVerses'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { addLink, updateLink, deleteLink, Link, OpenGraphData } from '~redux/modules/user'
import { HStack, VStack } from '~common/ui/Stack'
import Spacer from '~common/ui/Spacer'
import { useSetAtom } from 'jotai/react'
import { multipleTagsModalAtom } from '../../state/app'
import Fab from '~common/ui/Fab'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomSheetFooter, BottomSheetScrollView } from '@gorhom/bottom-sheet/'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import {
  fetchOpenGraphData,
  isYouTubeUrl,
  getLinkDisplayTitle,
} from '~helpers/fetchOpenGraphData'
import { useTheme } from '@emotion/react'

interface BibleLinkModalProps {
  linkVerses: VerseIds | undefined
  onClosed: () => void
}

// Create a memoized selector factory for current link
const makeCurrentLinkSelector = () =>
  createSelector(
    [(state: RootState) => state.user.bible.links, (_: RootState, linkKey: string) => linkKey],
    (links, linkKey): (Link & { id: string }) | null => {
      if (linkKey && links[linkKey]) {
        return {
          id: linkKey,
          ...links[linkKey],
        }
      }
      return null
    }
  )

const useCurrentLink = ({ linkVerses }: { linkVerses: VerseIds | undefined }) => {
  const selectCurrentLink = useMemo(() => makeCurrentLinkSelector(), [])
  const linkKey = useMemo(() => {
    const orderedVerses = orderVerses(linkVerses || {})
    return Object.keys(orderedVerses).join('/')
  }, [linkVerses])

  const link = useSelector((state: RootState) => selectCurrentLink(state, linkKey))

  return link
}

const BibleLinkModal = ({ linkVerses, onClosed }: BibleLinkModalProps) => {
  const { ref, open, close } = useBottomSheetModal()

  const [url, setUrl] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [previewData, setPreviewData] = useState<{
    ogData: OpenGraphData | null
    isYouTube: boolean
    youtubeVideoId: string | null
  } | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [showYouTubePlayer, setShowYouTubePlayer] = useState(false)

  const dispatch = useDispatch()
  const { t } = useTranslation()

  const currentLink = useCurrentLink({ linkVerses })
  const reference = verseToReference(linkVerses)
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const theme = useTheme()

  useEffect(() => {
    if (linkVerses) {
      open()
    }
  }, [linkVerses, open])

  useEffect(() => {
    if (linkVerses) {
      if (currentLink) {
        setIsEditing(false)
        setShowYouTubePlayer(false)
      } else {
        setIsEditing(true)
        setUrl('')
        setCustomTitle('')
        setPreviewData(null)
      }
    } else {
      setUrl('')
      setCustomTitle('')
      setPreviewData(null)
      setShowYouTubePlayer(false)
    }
  }, [linkVerses])

  const fetchMetadata = useCallback(async () => {
    if (!url) return

    setIsLoading(true)
    try {
      const result = await fetchOpenGraphData(url)
      setPreviewData(result)
    } catch (error) {
      console.error('[BibleLinkModal] Error fetching metadata:', error)
      Sentry.captureException(error)
      Snackbar.show(t('Erreur lors de la récupération des métadonnées'))
    } finally {
      setIsLoading(false)
    }
  }, [url, t])

  const onSaveLinkFunc = () => {
    if (!url) return

    const linkData: Link = {
      ...currentLink,
      url,
      customTitle: customTitle || undefined,
      ogData: previewData?.ogData || currentLink?.ogData,
      isYouTube: previewData?.isYouTube ?? currentLink?.isYouTube ?? isYouTubeUrl(url),
      youtubeVideoId: previewData?.youtubeVideoId ?? currentLink?.youtubeVideoId,
      date: Date.now(),
    }

    dispatch(
      // @ts-ignore
      addLink(linkData, linkVerses!)
    )
    setIsEditing(false)
  }

  const deleteLinkFunc = (linkId: string) => {
    Alert.alert(t('Attention'), t('Voulez-vous vraiment supprimer ce lien?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          dispatch(deleteLink(linkId))
          close()
        },
        style: 'destructive',
      },
    ])
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setUrl('')
    setCustomTitle('')
    setPreviewData(null)
  }

  const onEditLink = () => {
    setUrl(currentLink?.url || '')
    setCustomTitle(currentLink?.customTitle || '')
    setPreviewData(
      currentLink
        ? {
            ogData: currentLink.ogData || null,
            isYouTube: currentLink.isYouTube || false,
            youtubeVideoId: currentLink.youtubeVideoId || null,
          }
        : null
    )
    setIsEditing(true)
  }

  const openInBrowser = async () => {
    const urlToOpen = currentLink?.url
    if (!urlToOpen) return

    try {
      const canOpen = await Linking.canOpenURL(urlToOpen)
      if (canOpen) {
        await Linking.openURL(urlToOpen)
      } else {
        Snackbar.show(t('Impossible d\'ouvrir ce lien'))
      }
    } catch (error) {
      console.error('[BibleLinkModal] Error opening URL:', error)
      Snackbar.show(t('Erreur lors de l\'ouverture du lien'))
    }
  }

  const submitIsDisabled = !url

  const displayTitle = currentLink ? getLinkDisplayTitle(currentLink) : ''
  const isCurrentLinkYouTube = currentLink?.isYouTube || false
  const youtubeEmbedUrl = currentLink?.youtubeVideoId
    ? `https://www.youtube.com/embed/${currentLink.youtubeVideoId}?autoplay=0`
    : null

  return (
    <Modal.Body
      ref={ref}
      onModalClose={onClosed}
      topInset={useSafeAreaInsets().top}
      snapPoints={['100%']}
      headerComponent={
        <ModalHeader
          onClose={close}
          title={reference}
          subTitle={t('Lien')}
          rightComponent={
            currentLink ? (
              <PopOverMenu
                width={24}
                height={54}
                popover={
                  <>
                    <MenuOption onSelect={onEditLink}>
                      <Box row alignItems="center">
                        <FeatherIcon name="edit" size={15} />
                        <Text marginLeft={10}>{t('Éditer')}</Text>
                      </Box>
                    </MenuOption>
                    <MenuOption
                      onSelect={() =>
                        setMultipleTagsItem({
                          ...currentLink,
                          id: currentLink.id!,
                          entity: 'links',
                        })
                      }
                    >
                      <Box row alignItems="center">
                        <FeatherIcon name="tag" size={15} />
                        <Text marginLeft={10}>{t('Éditer les tags')}</Text>
                      </Box>
                    </MenuOption>
                    <MenuOption onSelect={() => deleteLinkFunc(currentLink?.id!)}>
                      <Box row alignItems="center">
                        <FeatherIcon name="trash-2" size={15} />
                        <Text marginLeft={10}>{t('Supprimer')}</Text>
                      </Box>
                    </MenuOption>
                  </>
                }
              />
            ) : undefined
          }
        />
      }
      footerComponent={props =>
        isEditing ? (
          <BottomSheetFooter {...props}>
            <HStack
              py={10}
              px={20}
              justifyContent="flex-end"
              h={80 + bottomBarHeight}
              paddingBottom={bottomBarHeight}
            >
              <Box>
                <Button reverse onPress={cancelEditing}>
                  {t('Annuler')}
                </Button>
              </Box>
              <Box>
                <Button disabled={submitIsDisabled} onPress={onSaveLinkFunc}>
                  {t('Sauvegarder')}
                </Button>
              </Box>
            </HStack>
          </BottomSheetFooter>
        ) : (
          <BottomSheetFooter {...props}>
            <HStack
              py={10}
              px={20}
              justifyContent="flex-end"
              h={80 + bottomBarHeight}
              paddingBottom={bottomBarHeight}
            >
              <Box>
                <Fab icon="edit" onPress={onEditLink} />
              </Box>
            </HStack>
          </BottomSheetFooter>
        )
      }
    >
      <BottomSheetScrollView>
        <Box paddingHorizontal={20}>
          {isEditing && (
            <>
              <TextInput
                placeholder={t('URL du lien')}
                onChangeText={setUrl}
                value={url}
                style={{ marginTop: 20 }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Spacer size={10} />
              <TextInput
                placeholder={t('Titre personnalisé (optionnel)')}
                onChangeText={setCustomTitle}
                value={customTitle}
              />
              <Spacer size={10} />
              <Button
                small
                reverse
                onPress={fetchMetadata}
                disabled={!url || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  t('Récupérer l\'aperçu')
                )}
              </Button>

              {/* Preview card */}
              {previewData?.ogData && (
                <Box
                  mt={20}
                  p={15}
                  borderRadius={10}
                  backgroundColor={theme.colors.lightGrey}
                  borderWidth={1}
                  borderColor={theme.colors.border}
                >
                  {previewData.ogData.image && (
                    <Image
                      source={{ uri: previewData.ogData.image }}
                      style={{
                        width: '100%',
                        height: 150,
                        borderRadius: 8,
                        marginBottom: 10,
                      }}
                      resizeMode="cover"
                    />
                  )}
                  <HStack alignItems="center" mb={5}>
                    <FeatherIcon
                      name={previewData.isYouTube ? 'youtube' : 'link'}
                      size={16}
                      color={previewData.isYouTube ? '#FF0000' : theme.colors.grey}
                    />
                    <Text marginLeft={8} color="grey" fontSize={12}>
                      {previewData.ogData.siteName || new URL(url).hostname}
                    </Text>
                  </HStack>
                  {previewData.ogData.title && (
                    <Text bold fontSize={16} mb={5}>
                      {previewData.ogData.title}
                    </Text>
                  )}
                  {previewData.ogData.description && (
                    <Paragraph small color="grey" numberOfLines={3}>
                      {previewData.ogData.description}
                    </Paragraph>
                  )}
                </Box>
              )}
            </>
          )}

          {!isEditing && currentLink && (
            <Box py={20}>
              {/* YouTube Player */}
              {isCurrentLinkYouTube && youtubeEmbedUrl && (
                <Box mb={20}>
                  {showYouTubePlayer ? (
                    <Box
                      borderRadius={10}
                      overflow="hidden"
                      style={{ aspectRatio: 16 / 9 }}
                    >
                      <WebView
                        source={{ uri: youtubeEmbedUrl }}
                        style={{ flex: 1 }}
                        allowsInlineMediaPlayback
                        mediaPlaybackRequiresUserAction={false}
                      />
                    </Box>
                  ) : (
                    <Box position="relative">
                      <Image
                        source={{
                          uri:
                            currentLink.ogData?.image ||
                            `https://img.youtube.com/vi/${currentLink.youtubeVideoId}/hqdefault.jpg`,
                        }}
                        style={{
                          width: '100%',
                          aspectRatio: 16 / 9,
                          borderRadius: 10,
                        }}
                        resizeMode="cover"
                      />
                      <Box
                        position="absolute"
                        top={0}
                        left={0}
                        right={0}
                        bottom={0}
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Button
                          small
                          onPress={() => setShowYouTubePlayer(true)}
                          style={{
                            backgroundColor: 'rgba(255, 0, 0, 0.9)',
                            paddingHorizontal: 20,
                          }}
                        >
                          <HStack alignItems="center">
                            <FeatherIcon name="play" size={20} color="white" />
                            <Text color="white" marginLeft={8}>
                              {t('Voir la vidéo')}
                            </Text>
                          </HStack>
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {/* Link preview card */}
              {!isCurrentLinkYouTube && currentLink.ogData?.image && (
                <Image
                  source={{ uri: currentLink.ogData.image }}
                  style={{
                    width: '100%',
                    height: 180,
                    borderRadius: 10,
                    marginBottom: 15,
                  }}
                  resizeMode="cover"
                />
              )}

              <HStack alignItems="center" mb={10}>
                <FeatherIcon
                  name={isCurrentLinkYouTube ? 'youtube' : 'link'}
                  size={18}
                  color={isCurrentLinkYouTube ? '#FF0000' : theme.colors.primary}
                />
                <Text marginLeft={8} color="grey" fontSize={13}>
                  {currentLink.ogData?.siteName || new URL(currentLink.url).hostname}
                </Text>
              </HStack>

              <Text title fontSize={20} marginBottom={10}>
                {displayTitle}
              </Text>

              {currentLink.ogData?.description && (
                <Paragraph small marginBottom={15}>
                  {currentLink.ogData.description}
                </Paragraph>
              )}

              {/* Open in browser button */}
              {!isCurrentLinkYouTube && (
                <Button small reverse onPress={openInBrowser}>
                  <HStack alignItems="center">
                    <FeatherIcon name="external-link" size={16} />
                    <Text marginLeft={8}>{t('Ouvrir dans le navigateur')}</Text>
                  </HStack>
                </Button>
              )}

              {/* Tags */}
              {/* @ts-ignore */}
              <TagList tags={currentLink?.tags} style={{ marginTop: 15 }} />
            </Box>
          )}
        </Box>
      </BottomSheetScrollView>
    </Modal.Body>
  )
}

export default BibleLinkModal
