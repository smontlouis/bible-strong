import styled from '@emotion/native'
import React, { memo, useEffect } from 'react'
import { Platform, StatusBar } from 'react-native'
import ImmersiveMode from 'react-native-immersive-mode'

import * as Animatable from 'react-native-animatable'

import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { StackNavigationProp } from '@react-navigation/stack'
import { useDispatch } from 'react-redux'
import Back from '~common/Back'
import Link from '~common/Link'
import ParallelIcon from '~common/ParallelIcon'
import PopOverMenu from '~common/PopOverMenu'
import SnackBar from '~common/SnackBar'
import Box from '~common/ui/Box'
import { FeatherIcon, MaterialIcon, TextIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import { getIfDatabaseNeedsDownload } from '~helpers/databases'
import truncate from '~helpers/truncate'
import useDimensions from '~helpers/useDimensions'
import useLanguage from '~helpers/useLanguage'
import { setSettingsCommentaires } from '~redux/modules/user'
import { fullscreenAtom } from '../../state/app'
import { BibleTab, useBibleTabActions } from '../../state/tabs'
import { MainStackProps } from '~navigation/type'

const LinkBox = styled(Link)(() => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingLeft: 10,
  paddingRight: 10,
}))

const HeaderBox = styled(Box)(({ theme }) => ({
  maxWidth: 830,
  width: '100%',
  alignSelf: 'center',
  alignItems: 'stretch',
}))

const AnimatableHeaderBox = Animatable.createAnimatableComponent(HeaderBox)

interface BibleHeaderProps {
  navigation: StackNavigationProp<MainStackProps>
  bibleAtom: PrimitiveAtom<BibleTab>
  hasBackButton?: boolean
  onBibleParamsClick: () => void
  commentsDisplay?: boolean
  version: string
  bookName: string
  chapter: number
  verseFormatted: string
  isReadOnly?: boolean
  isSelectionMode?: boolean
  isParallel?: boolean
}
const Header = ({
  navigation,
  hasBackButton,
  bibleAtom,
  onBibleParamsClick,
  commentsDisplay,
  version,
  bookName,
  chapter,
  verseFormatted,
  isReadOnly,
  isSelectionMode,
  isParallel,
}: BibleHeaderProps) => {
  const { t } = useTranslation()
  const isFR = useLanguage()
  const dispatch = useDispatch()
  const dimensions = useDimensions()
  const isSmall = dimensions.screen.width < 400
  const actions = useBibleTabActions(bibleAtom)

  useEffect(() => {
    actions.setTitle(`${t(bookName)} ${chapter} - ${version}`)
  }, [actions, bookName, chapter, version, t])

  const { addParallelVersion, removeAllParallelVersions } = actions

  const onOpenCommentaire = async () => {
    const needsDownload = await getIfDatabaseNeedsDownload('MHY')

    if (needsDownload) {
      SnackBar.show(t('Téléchargez la base de commentaires Matthew Henry'))
      navigation.navigate('Downloads')
      return
    }

    dispatch(setSettingsCommentaires(true))
  }

  const [isFullscreen, setIsFullScreen] = useAtom(fullscreenAtom)

  if (isReadOnly) {
    return (
      <HeaderBox row>
        <Box flex justifyContent="center">
          <Back padding>
            <FeatherIcon name="arrow-left" size={20} />
          </Back>
        </Box>
        <Box grow center>
          <TextIcon>
            {t(bookName)} {chapter}:{verseFormatted} - {version}
          </TextIcon>
        </Box>
        <Box flex />
      </HeaderBox>
    )
  }
  return (
    <AnimatableHeaderBox
      row
      transition="height" // TODO: fix this
      style={{ height: isFullscreen ? 35 : 60 }}
    >
      {(isSelectionMode || hasBackButton) && (
        <Box justifyContent="center">
          <Back padding>
            <FeatherIcon name="arrow-left" size={20} />
          </Back>
        </Box>
      )}
      <LinkBox
        route="BibleSelect"
        params={{ bibleAtom }}
        style={{ paddingLeft: 15, paddingRight: 0 }}
        navigation={navigation}
      >
        <TextIcon>
          {isSmall
            ? truncate(`${t(bookName)} ${chapter}`, 10)
            : `${t(bookName)} ${chapter}`}
        </TextIcon>
      </LinkBox>
      <LinkBox
        route="VersionSelector"
        params={{ bibleAtom }}
        style={{ marginRight: 'auto' }}
        navigation={navigation}
      >
        <TextIcon>{version}</TextIcon>
      </LinkBox>
      {isFullscreen && (
        <LinkBox
          onPress={() => {
            setIsFullScreen(false)
            Platform.OS === 'android' && ImmersiveMode.setBarMode('Normal')
            StatusBar.setHidden(false)
          }}
          style={{ width: 50 }}
        >
          <MaterialIcon name="fullscreen-exit" size={20} />
        </LinkBox>
      )}
      {!isSelectionMode && !isFullscreen && (
        <>
          <LinkBox onPress={onBibleParamsClick} style={{ width: 50 }}>
            <TextIcon style={{ marginRight: 0 }}>Aa</TextIcon>
          </LinkBox>
          <PopOverMenu
            element={
              <Box
                row
                center
                height={60}
                width={50}
                opacity={isFullscreen ? 0 : 1}
              >
                <FeatherIcon name="more-vertical" size={18} />
              </Box>
            }
            popover={
              <>
                {!commentsDisplay && isFR && (
                  <MenuOption onSelect={onOpenCommentaire}>
                    <Box row alignItems="center">
                      <MaterialIcon name="chat" size={20} />
                      <Text marginLeft={10}>{t('Commentaire désactivé')}</Text>
                    </Box>
                  </MenuOption>
                )}
                {commentsDisplay && isFR && (
                  <MenuOption
                    onSelect={() => dispatch(setSettingsCommentaires(false))}
                  >
                    <Box row alignItems="center">
                      <MaterialIcon name="chat" size={20} color="primary" />
                      <Text marginLeft={10}>{t('Commentaire activé')}</Text>
                    </Box>
                  </MenuOption>
                )}
                <MenuOption
                  onSelect={
                    isParallel ? removeAllParallelVersions : addParallelVersion
                  }
                >
                  <Box row alignItems="center">
                    <ParallelIcon color={isParallel ? 'primary' : 'default'} />
                    <Text marginLeft={10}>{t('Affichage parallèle')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption onSelect={() => navigation.navigate('History')}>
                  <Box row alignItems="center">
                    <MaterialIcon name="history" size={20} />
                    <Text marginLeft={10}>{t('Historique')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption
                  onSelect={() => {
                    setIsFullScreen(true)
                    Platform.OS === 'android' &&
                      ImmersiveMode.setBarMode('FullSticky')
                    StatusBar.setHidden(true)
                  }}
                >
                  <Box row alignItems="center">
                    <MaterialIcon name="fullscreen" size={20} />
                    <Text marginLeft={10}>{t('Plein écran')}</Text>
                  </Box>
                </MenuOption>
              </>
            }
          />
        </>
      )}
    </AnimatableHeaderBox>
  )
}

export default memo(Header)
