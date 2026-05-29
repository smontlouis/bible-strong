import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import { MenuView } from '@expo/ui/community/menu'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSetAtom } from 'jotai/react'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Dimensions, Image, Linking, ScrollView } from 'react-native'
import YoutubePlayer from 'react-native-youtube-iframe'
import { useDispatch, useSelector } from 'react-redux'

import EntityChipList from '~common/EntityChipList'
import Header from '~common/Header'
import { VerseIds } from '~common/types'
import Box, { VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Fab from '~common/ui/Fab'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import type { RelationEndpoint } from '~features/studyRelations/domain'
import { createExternalLinkEndpointFromLink } from '~features/studyRelations/endpoints'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import {
  detectLinkType,
  extractVideoId,
  fetchOpenGraphData,
  getLinkDisplayTitle,
  getLinkIcon,
  isValidUrl,
} from '~helpers/fetchOpenGraphData'
import { toast } from '~helpers/toast'
import verseToReference from '~helpers/verseToReference'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { RootState } from '~redux/modules/reducer'
import { addLink, deleteLink, Link } from '~redux/modules/user'
import { makeLinkByIdSelector, makeVerseKeysForLinkSelector } from '~redux/selectors/bible'
import { unifiedTagsModalAtom } from '~state/app'
import { useTranslation } from 'react-i18next'

const StyledTextInput = styled.TextInput(({ theme }) => ({
  color: theme.colors.default,
  height: 48,
  borderColor: theme.colors.border,
  borderWidth: 2,
  borderRadius: 10,
  paddingHorizontal: 15,
  fontSize: 16,
}))

const useCurrentLink = ({ linkId }: { linkId?: string | null }) => {
  const selectLinkById = makeLinkByIdSelector()
  return useSelector((state: RootState) => selectLinkById(state, linkId || ''))
}

const getHostname = (url: string) => {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return 'Invalid URL'
  }
}

const parseVerseKeys = (verseKeys?: string): VerseIds | undefined => {
  if (!verseKeys) return undefined
  const keys = verseKeys
    .split(',')
    .map(key => key.trim())
    .filter(Boolean)
  if (!keys.length) return undefined
  return Object.fromEntries(keys.map(key => [key, true])) as VerseIds
}

const BibleLinkScreen = () => {
  const params = useLocalSearchParams<{ linkId?: string; verseKeys?: string }>()
  const [savedLinkId, setSavedLinkId] = useState<string | null>(null)
  const linkId = savedLinkId || params.linkId || null
  const linkVerses = parseVerseKeys(params.verseKeys)

  const [url, setUrl] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const dispatch = useDispatch()
  const { t } = useTranslation()
  const router = useRouter()
  const theme = useTheme()
  const currentLink = useCurrentLink({ linkId })
  const canGoBackInStack = useCanGoBackInStack()
  const selectVerseKeysForLink = makeVerseKeysForLinkSelector()
  const relatedVerseKeys = useSelector((state: RootState) =>
    selectVerseKeysForLink(state, currentLink?.id || linkId || '')
  )
  const displayedLinkVerses =
    currentLink && relatedVerseKeys.length
      ? relatedVerseKeys.reduce((acc, key) => {
          acc[key] = true
          return acc
        }, {} as VerseIds)
      : linkVerses
  const reference = verseToReference(displayedLinkVerses)
  const linkEndpoint: RelationEndpoint | null = currentLink?.id
    ? createExternalLinkEndpointFromLink(currentLink.id, currentLink)
    : null
  const relationCount = useRelationCount(linkEndpoint)
  const openEntityRelations = useOpenEntityRelations()
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)

  useEffect(() => {
    if (currentLink) {
      setIsEditing(false)
      return
    }

    setIsEditing(true)
    setUrl('')
    setCustomTitle('')
  }, [currentLink, linkId])

  const saveLink = async () => {
    if (!url) return

    if (!isValidUrl(url)) {
      toast.error(t('URL invalide'))
      return
    }

    setIsSaving(true)

    const linkType = detectLinkType(url)
    const videoId = extractVideoId(url, linkType)
    const shouldFetchOG = !currentLink?.ogData?.title || currentLink?.url !== url

    let ogData = currentLink?.ogData
    if (shouldFetchOG) {
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

    const targetVerses = currentLink && !linkVerses ? {} : linkVerses || displayedLinkVerses || {}
    const action = addLink(linkData, targetVerses)
    if (action) {
      dispatch(action)
      const newLinkId = Object.keys(action.payload)[0]
      if (newLinkId) {
        setSavedLinkId(newLinkId)
      }
    }

    setIsEditing(false)
    setIsSaving(false)
  }

  const deleteCurrentLink = () => {
    if (!currentLink?.id) return

    Alert.alert(t('Attention'), t('Voulez-vous vraiment supprimer ce lien?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          dispatch(deleteLink(currentLink.id!))
          router.back()
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

  const editLink = () => {
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
        toast.error(t("Impossible d'ouvrir ce lien"))
      }
    } catch (error) {
      console.error('[BibleLinkScreen] Error opening URL:', error)
      toast.error(t("Erreur lors de l'ouverture du lien"))
    }
  }

  const submitIsDisabled = !url || isSaving
  const displayTitle = currentLink ? getLinkDisplayTitle(currentLink) : ''
  const isYoutubeLink = currentLink?.linkType === 'youtube'
  const linkIcon = currentLink
    ? getLinkIcon(currentLink)
    : { icon: 'link', color: theme.colors.grey, textIcon: undefined }
  const linkIconName = linkIcon.icon as React.ComponentProps<typeof FeatherIcon>['name']
  const screenWidth = Dimensions.get('window').width
  const playerWidth = Math.min(screenWidth - 40, 600)
  const playerHeight = (playerWidth * 9) / 16

  return (
    <FormSheetScreen isFormSheet>
      <Header
        hasBackButton={canGoBackInStack}
        title={t('Lien')}
        subTitle={reference}
        rightComponent={
          currentLink ? (
            <MenuView
              actions={[
                { id: 'edit', title: t('Éditer'), image: 'pencil' },
                { id: 'tags', title: t('Éditer les tags'), image: 'tag' },
                {
                  id: 'relations',
                  title: t('Éditer les relations'),
                  image: 'point.3.connected.trianglepath.dotted',
                  attributes: linkEndpoint ? undefined : { disabled: true },
                },
                {
                  id: 'delete',
                  title: t('Supprimer'),
                  image: 'trash',
                  attributes: { destructive: true },
                },
              ]}
              onPressAction={({ nativeEvent }) => {
                switch (nativeEvent.event) {
                  case 'edit':
                    editLink()
                    break
                  case 'tags':
                    setUnifiedTagsModal({
                      mode: 'select',
                      id: currentLink.id!,
                      entity: 'links',
                      title:
                        currentLink.ogData?.title ||
                        currentLink.customTitle ||
                        currentLink.url ||
                        '',
                    })
                    break
                  case 'relations':
                    if (linkEndpoint) openEntityRelations(linkEndpoint)
                    break
                  case 'delete':
                    deleteCurrentLink()
                    break
                }
              }}
            >
              <Box row center height={54} width={54}>
                <FeatherIcon name="more-vertical" size={18} />
              </Box>
            </MenuView>
          ) : undefined
        }
      />

      <ScrollView keyboardShouldPersistTaps="handled">
        <VStack gap={10} paddingHorizontal={20}>
          {isEditing && (
            <VStack py={20} gap={20}>
              <VStack gap={5}>
                <Text>{t('URL du lien')}</Text>
                <StyledTextInput
                  placeholder={t('URL du lien')}
                  placeholderTextColor={theme.colors.border}
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
                  placeholderTextColor={theme.colors.border}
                  onChangeText={setCustomTitle}
                  value={customTitle}
                />
              </VStack>
            </VStack>
          )}

          {!isEditing && currentLink && (
            <Box py={20}>
              <EntityChipList
                tags={currentLink?.tags}
                relationCount={relationCount}
                onRelationPress={() => linkEndpoint && openEntityRelations(linkEndpoint)}
              />

              {isYoutubeLink && currentLink.videoId && (
                <Box mb={20} borderRadius={10} overflow="hidden" bg="lightGrey">
                  <YoutubePlayer
                    height={playerHeight}
                    width={playerWidth}
                    videoId={currentLink.videoId}
                    onReady={() => console.log('[BibleLinkScreen] YouTube ready')}
                    onError={(e: string) => console.log('[BibleLinkScreen] YouTube error:', e)}
                    viewContainerStyle={{ borderRadius: 10, overflow: 'hidden' }}
                    webviewStyle={{ borderRadius: 10, overflow: 'hidden' }}
                  />
                </Box>
              )}

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
                  <FeatherIcon name={linkIconName} size={18} color={linkIcon.color} />
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

              {!isYoutubeLink && (
                <Button reverse onPress={openInBrowser}>
                  <HStack alignItems="center">
                    <FeatherIcon name="external-link" size={16} />
                    <Text marginLeft={8}>{t('Ouvrir dans le navigateur')}</Text>
                  </HStack>
                </Button>
              )}
            </Box>
          )}
        </VStack>
      </ScrollView>

      {isEditing ? (
        <HStack py={10} px={20} justifyContent="flex-end" bg="reverse">
          {currentLink && (
            <Box>
              <Button reverse onPress={cancelEditing}>
                {t('Annuler')}
              </Button>
            </Box>
          )}
          <Box>
            <Button disabled={submitIsDisabled} onPress={saveLink}>
              {isSaving ? <ActivityIndicator size="small" color="white" /> : t('Sauvegarder')}
            </Button>
          </Box>
        </HStack>
      ) : (
        <HStack py={5} px={20} justifyContent="flex-end" bg="reverse">
          <Box h={50} center>
            <Fab icon="edit-2" onPress={editLink} />
          </Box>
        </HStack>
      )}
    </FormSheetScreen>
  )
}

export default BibleLinkScreen
