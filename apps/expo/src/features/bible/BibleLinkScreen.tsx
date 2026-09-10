import { goBackOrHome } from '~navigation/goBackOrHome'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, useTheme } from '~themes/ThemeProvider'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSetAtom } from 'jotai/react'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React, { useEffect, useState } from 'react'
import * as NativeUI from 'react-native'
import { ActivityIndicator, Dimensions, Image, Linking, ScrollView } from 'react-native'
import {
  KeyboardAvoidingView,
  KeyboardStickyView,
  useKeyboardState,
} from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import { twMerge } from '~common/ui/classNames'

import { MenuView } from '~common/ui/MenuView'
import { pageContentStyle } from '~common/ui/PageContent'
import YoutubePlayer from '~helpers/react-native-youtube-iframe'
import type { Theme as AppTheme } from '~themes'

import { useTranslation } from 'react-i18next'
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
import { IS_FORM_SHEET } from '~helpers/constants'
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

const FOOTER_HEIGHT = 64

const StyledTextInput = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TextInput>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge(
    'text-default h-[48px] border-border border-[2px] rounded-[10px] px-[15px] text-[16px]',
    className
  )
  return (
    <NativeUI.TextInput
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.TextInput>['style']}
    />
  )
}

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
  const stylingTheme = useStylingTheme()

  const params = useLocalSearchParams<{ linkId?: string; verseKeys?: string; version?: string }>()
  const [savedLinkId, setSavedLinkId] = useState<string | null>(null)
  const linkId = savedLinkId || params.linkId || null
  const linkVerses = parseVerseKeys(params.verseKeys)

  const [url, setUrl] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const dispatch = useDispatch()
  const { t } = useTranslation()
  const confirmDeletion = useConfirmDialog()
  const router = useRouter()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const currentLink = useCurrentLink({ linkId })
  const isFormSheet = IS_FORM_SHEET
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : true
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
  const keyboardHeight = useKeyboardState(state => state.height)

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
      ...((currentLink?.version || params.version) && {
        version: currentLink?.version || params.version,
      }),
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

    void confirmDeletion({
      title: t('Attention'),
      message: t('Voulez-vous vraiment supprimer ce lien?'),
      cancelLabel: t('Non'),
      confirmLabel: t('Oui'),
      destructive: true,
    }).then(confirmed => {
      if (!confirmed) return
      dispatch(deleteLink(currentLink.id!))
      goBackOrHome(router)
    })
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
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box className="overflow-hidden border-continuous flex-[1]">
        <Header
          hasBackButton={hasBackButton}
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
                <Box className="overflow-hidden border-continuous flex-row items-center justify-center h-[54px] w-[54px]">
                  <FeatherIcon name="more-vertical" size={18} />
                </Box>
              </MenuView>
            ) : undefined
          }
        />

        <KeyboardAvoidingView automaticOffset style={{ flex: 1 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            contentContainerStyle={[
              pageContentStyle,
              {
                paddingBottom: isEditing ? FOOTER_HEIGHT + keyboardHeight + 20 : 0,
              },
            ]}
          >
            <VStack className="overflow-hidden border-continuous gap-[10px] px-[20px]">
              {isEditing && (
                <VStack className="overflow-hidden border-continuous py-[20px] gap-[20px]">
                  <VStack className="overflow-hidden border-continuous gap-[5px]">
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
                  <VStack className="overflow-hidden border-continuous gap-[5px]">
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
                <Box className="overflow-hidden border-continuous py-[20px]">
                  <EntityChipList
                    tags={currentLink?.tags}
                    relationCount={relationCount}
                    onRelationPress={() => linkEndpoint && openEntityRelations(linkEndpoint)}
                  />

                  {isYoutubeLink && currentLink.videoId && (
                    <Box className="border-continuous overflow-visible mb-[20px] rounded-[10px] bg-light-grey">
                      <YoutubePlayer
                        height={playerHeight}
                        width={playerWidth}
                        videoId={currentLink.videoId}
                        onReady={() => console.log('[BibleLinkScreen] YouTube ready')}
                        onError={e => console.log('[BibleLinkScreen] YouTube error:', e)}
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

                  <HStack className="mb-[10px] items-center">
                    {linkIcon.textIcon ? (
                      <Text className="font-bold text-[16px] text-default">
                        {linkIcon.textIcon}
                      </Text>
                    ) : (
                      <FeatherIcon name={linkIconName} size={18} color={linkIcon.color} />
                    )}
                    <Text className="ml-[8px] text-grey text-[13px]">
                      {currentLink.ogData?.siteName || getHostname(currentLink.url)}
                    </Text>
                  </HStack>

                  <Text
                    className="text-[20px] mb-[10px]"
                    style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
                  >
                    {displayTitle}
                  </Text>

                  {currentLink.ogData?.description && (
                    <Paragraph className="mb-[15px]" small>
                      {currentLink.ogData.description}
                    </Paragraph>
                  )}

                  {!isYoutubeLink && (
                    <Button reverse onPress={openInBrowser}>
                      <HStack className="items-center">
                        <FeatherIcon name="external-link" size={16} />
                        <Text className="ml-[8px]">{t('Ouvrir dans le navigateur')}</Text>
                      </HStack>
                    </Button>
                  )}
                </Box>
              )}
            </VStack>
          </ScrollView>

          {isEditing && (
            <KeyboardStickyView style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
              <HStack className="border-border px-[20px] py-[10px] justify-end border-t-[1px] bg-reverse">
                {currentLink && (
                  <Box className="overflow-hidden border-continuous">
                    <Button reverse onPress={cancelEditing}>
                      {t('Annuler')}
                    </Button>
                  </Box>
                )}
                <Box className="overflow-hidden border-continuous">
                  <Button disabled={submitIsDisabled} onPress={saveLink}>
                    {isSaving ? <ActivityIndicator size="small" color="white" /> : t('Sauvegarder')}
                  </Button>
                </Box>
              </HStack>
            </KeyboardStickyView>
          )}
        </KeyboardAvoidingView>
        {!isEditing && (
          <Box
            className="overflow-hidden border-continuous absolute right-[20px]"
            style={{ bottom: insets.bottom + 20 }}
          >
            <Fab
              accessibilityLabel={t('accessibility.editLink')}
              icon="edit-2"
              onPress={editLink}
            />
          </Box>
        )}
      </Box>
    </FormSheetScreen>
  )
}

export default BibleLinkScreen
