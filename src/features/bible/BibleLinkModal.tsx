import React, { useEffect, useMemo, useState } from 'react'

import { createSelector } from '@reduxjs/toolkit'
import { ActivityIndicator, Alert, Dimensions, Image, Linking } from 'react-native'
import YoutubePlayer from 'react-native-youtube-iframe'
import { useDispatch, useSelector } from 'react-redux'
import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import { BottomSheetFooter, BottomSheetTextInput } from '@gorhom/bottom-sheet/'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import PopOverMenu from '~common/PopOverMenu'
import Snackbar from '~common/SnackBar'
import TagList from '~common/TagList'
import { VerseIds } from '~common/types'
import Box, { VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Fab from '~common/ui/Fab'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Paragraph from '~common/ui/Paragraph'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import {
  detectLinkType,
  extractVideoId,
  fetchOpenGraphData,
  getLinkDisplayTitle,
  getLinkIcon,
  isValidUrl,
} from '~helpers/fetchOpenGraphData'
import orderVerses from '~helpers/orderVerses'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { addLink, deleteLink, Link } from '~redux/modules/user'
import { multipleTagsModalAtom } from '../../state/app'

interface BibleLinkModalProps {
  linkVerses: VerseIds | undefined
}

const StyledTextInput = styled(BottomSheetTextInput)(({ theme }) => ({
  color: theme.colors.default,
  height: 48,
  borderColor: theme.colors.border,
  borderWidth: 2,
  borderRadius: 10,
  paddingHorizontal: 15,
  fontSize: 16,
}))

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

const getHostname = (url: string) => {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return 'Invalid URL'
  }
}

const BibleLinkModal = ({ linkVerses }: BibleLinkModalProps) => {
  const { ref, open, close } = useBottomSheetModal()

  const [url, setUrl] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [isEditing, setIsEditing] = useState(false)

  const dispatch = useDispatch()
  const { t } = useTranslation()

  const currentLink = useCurrentLink({ linkVerses })
  const reference = verseToReference(linkVerses)
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)
  const insets = useSafeAreaInsets()
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
      } else {
        setIsEditing(true)
        setUrl('')
        setCustomTitle('')
      }
    } else {
      setUrl('')
      setCustomTitle('')
    }
  }, [linkVerses, currentLink])

  const onSaveLinkFunc = async () => {
    if (!url) return

    // Valider l'URL
    if (!isValidUrl(url)) {
      Snackbar.show(t('URL invalide'))
      return
    }

    setIsSaving(true)

    try {
      const linkType = detectLinkType(url)
      const videoId = extractVideoId(url, linkType)

      // Déterminer si on doit fetch les OG data
      const shouldFetchOG =
        !currentLink?.ogData?.title || // Nouveau lien ou pas de titre
        currentLink?.url !== url // URL changée

      let ogData = currentLink?.ogData
      if (shouldFetchOG) {
        // Tenter le fetch (retourne null si offline)
        const fetchedData = await fetchOpenGraphData(url)
        if (fetchedData) {
          ogData = fetchedData
        }
      }

      const linkData: Link = {
        ...currentLink,
        url,
        customTitle: customTitle || undefined,
        ogData,
        linkType,
        videoId: videoId || undefined,
        date: Date.now(),
      }

      dispatch(
        // @ts-ignore
        addLink(linkData, linkVerses!)
      )
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
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
  }

  const onEditLink = () => {
    setUrl(currentLink?.url || '')
    setCustomTitle(currentLink?.customTitle || '')
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
        Snackbar.show(t("Impossible d'ouvrir ce lien"))
      }
    } catch (error) {
      console.error('[BibleLinkModal] Error opening URL:', error)
      Snackbar.show(t("Erreur lors de l'ouverture du lien"))
    }
  }

  const submitIsDisabled = !url || isSaving

  const displayTitle = currentLink ? getLinkDisplayTitle(currentLink) : ''
  const isYoutubeLink = currentLink?.linkType === 'youtube'
  const linkIcon = currentLink
    ? getLinkIcon(currentLink)
    : { icon: 'link', color: theme.colors.grey, textIcon: undefined }

  // YouTube player dimensions
  const screenWidth = Dimensions.get('window').width
  const playerWidth = Math.min(screenWidth - 40, 600) // 40 = padding
  const playerHeight = (playerWidth * 9) / 16

  return (
    <Modal.Body
      ref={ref}
      topInset={useSafeAreaInsets().top}
      snapPoints={['70%']}
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
                        <FeatherIcon name="edit-2" size={15} />
                        <Text marginLeft={10}>{t('Éditer')}</Text>
                      </Box>
                    </MenuOption>
                    <MenuOption
                      onSelect={() =>
                        setMultipleTagsItem({
                          ...currentLink,
                          id: currentLink.id!,
                          entity: 'links',
                          title: currentLink.ogData?.title || currentLink.customTitle || '',
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
            <HStack py={10} px={20} justifyContent="flex-end" paddingBottom={insets.bottom}>
              {currentLink && (
                <Box>
                  <Button reverse onPress={cancelEditing}>
                    {t('Annuler')}
                  </Button>
                </Box>
              )}
              <Box>
                <Button disabled={submitIsDisabled} onPress={onSaveLinkFunc}>
                  {isSaving ? <ActivityIndicator size="small" color="white" /> : t('Sauvegarder')}
                </Button>
              </Box>
            </HStack>
          </BottomSheetFooter>
        ) : (
          <BottomSheetFooter {...props}>
            <HStack py={10} px={20} justifyContent="flex-end" paddingBottom={insets.bottom}>
              <Box>
                <Fab icon="edit-2" onPress={onEditLink} />
              </Box>
            </HStack>
          </BottomSheetFooter>
        )
      }
    >
      <VStack gap={10} paddingHorizontal={20} pb={20}>
        {isEditing && (
          <VStack py={20} gap={20}>
            <VStack gap={5}>
              <Text>{t('URL du lien')}</Text>
              <StyledTextInput
                placeholder={t('URL du lien')}
                onChangeText={setUrl}
                value={url}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </VStack>
            <VStack gap={5}>
              <Text>{t('Titre personnalisé (optionnel)')}</Text>

              <StyledTextInput
                placeholder={t('Titre personnalisé (optionnel)')}
                onChangeText={setCustomTitle}
                value={customTitle}
              />
            </VStack>
          </VStack>
        )}

        {!isEditing && currentLink && (
          <Box py={20}>
            {/* YouTube Player */}
            {isYoutubeLink && currentLink.videoId && (
              <Box mb={20} borderRadius={10} overflow="hidden" bg="lightGrey">
                <YoutubePlayer
                  height={playerHeight}
                  width={playerWidth}
                  videoId={currentLink.videoId}
                  onReady={() => console.log('[BibleLinkModal] YouTube ready')}
                  onError={(e: string) => console.log('[BibleLinkModal] YouTube error:', e)}
                  viewContainerStyle={{ borderRadius: 10, overflow: 'hidden' }}
                  webviewStyle={{ borderRadius: 10, overflow: 'hidden' }}
                />
              </Box>
            )}

            {/* Link preview image */}
            {!isYoutubeLink && currentLink.ogData?.image && (
              <Image
                source={{ uri: currentLink.ogData.image }}
                style={{
                  width: '100%',
                  height: 180,
                  borderRadius: 10,
                  marginBottom: 15,
                  backgroundColor: theme.colors.lightGrey,
                }}
                resizeMode="cover"
              />
            )}

            <HStack alignItems="center" mb={10}>
              {linkIcon.textIcon ? (
                <Text bold fontSize={16} color="default">
                  {linkIcon.textIcon}
                </Text>
              ) : (
                <FeatherIcon name={linkIcon.icon as any} size={18} color={linkIcon.color} />
              )}
              <Text marginLeft={8} color="grey" fontSize={13}>
                {currentLink.ogData?.siteName || getHostname(currentLink.url)}
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
            {!isYoutubeLink && (
              <Button reverse onPress={openInBrowser}>
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
      </VStack>
    </Modal.Body>
  )
}

export default BibleLinkModal
