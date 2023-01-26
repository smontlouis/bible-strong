import styled from '@emotion/native'
import React, { useEffect } from 'react'
import { Platform, StatusBar } from 'react-native'
import ImmersiveMode from 'react-native-immersive-mode'

import * as Animatable from 'react-native-animatable'

import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { NavigationStackProp } from 'react-navigation-stack'
import Back from '~common/Back'
import Link from '~common/Link'
import ParallelIcon from '~common/ParallelIcon'
import PopOverMenu from '~common/PopOverMenu'
import SnackBar from '~common/SnackBar'
import Box from '~common/ui/Box'
import { FeatherIcon, MaterialIcon, TextIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import { getIfDatabaseExists } from '~helpers/database'
import truncate from '~helpers/truncate'
import useDimensions from '~helpers/useDimensions'
import useLanguage from '~helpers/useLanguage'
import { fullscreenAtom } from '../../state/app'
import { BibleTab, useBibleTabActions } from '../../state/tabs'

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

const formatVerses = verses =>
  verses.reduce((acc, v, i, array) => {
    if (v === array[i - 1] + 1 && v === array[i + 1] - 1) {
      // if suite > 2
      return acc
    }
    if (v === array[i - 1] + 1 && v !== array[i + 1] - 1) {
      // if endSuite
      return `${acc}-${v}`
    }
    if (array[i - 1] && v - 1 !== array[i - 1]) {
      // if not preceded by - 1
      return `${acc},${v}`
    }
    return acc + v
  }, '')

interface BibleHeaderProps {
  navigation: NavigationStackProp
  bibleAtom: PrimitiveAtom<BibleTab>
  hasBackButton?: boolean
  onBibleParamsClick: () => void
  setSettingsCommentaires: (x: boolean) => void
  commentsDisplay?: boolean
}
const Header = ({
  navigation,
  hasBackButton,
  bibleAtom,
  onBibleParamsClick,
  setSettingsCommentaires,
  commentsDisplay,
}: BibleHeaderProps) => {
  const { t } = useTranslation()
  const isFR = useLanguage()
  const dimensions = useDimensions()
  const isSmall = dimensions.screen.width < 400
  const [bible, actions] = useBibleTabActions(bibleAtom)

  const {
    data: {
      selectedVersion: version,
      selectedBook: book,
      selectedChapter: chapter,
      selectedVerse: verse,
      isReadOnly,
      isSelectionMode,
      focusVerses,
      parallelVersions,
    },
  } = bible

  useEffect(() => {
    actions.setTitle(`${t(book.Nom)} ${chapter} - ${version}`)
  }, [actions, book.Nom, chapter, version, t])

  const isParallel = parallelVersions.length > 0

  const { addParallelVersion, removeAllParallelVersions } = actions

  const onOpenCommentaire = async () => {
    const exists = await getIfDatabaseExists('commentaires-mhy')

    if (!exists) {
      SnackBar.show(t('Téléchargez la base de commentaires Matthew Henry'))
      navigation.navigate('Downloads')
      return
    }

    setSettingsCommentaires(true)
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
            {t(book.Nom)} {chapter}:
            {focusVerses ? formatVerses(focusVerses) : verse} - {version}
          </TextIcon>
        </Box>
        <Box flex />
      </HeaderBox>
    )
  }
  return (
    <AnimatableHeaderBox
      row
      transition="height"
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
      >
        <TextIcon>
          {isSmall
            ? truncate(`${t(book.Nom)} ${chapter}`, 10)
            : `${t(book.Nom)} ${chapter}`}
        </TextIcon>
      </LinkBox>
      <LinkBox
        route="VersionSelector"
        params={{ bibleAtom }}
        style={{ marginRight: 'auto' }}
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
                  <MenuOption onSelect={() => setSettingsCommentaires(false)}>
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

export default Header
