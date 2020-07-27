import React from 'react'
import styled from '@emotion/native'
import compose from 'recompose/compose'
import pure from 'recompose/pure'
import ImmersiveMode from 'react-native-immersive-mode'

import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger,
  renderers,
  withMenuContext,
} from 'react-native-popup-menu'
import { withNavigation } from 'react-navigation'
import * as Animatable from 'react-native-animatable'
import { useTheme } from 'emotion-theming'

import truncate from '~helpers/truncate'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import { FeatherIcon, MaterialIcon, TextIcon } from '~common/ui/Icon'
import Link from '~common/Link'
import Back from '~common/Back'
import useDimensions from '~helpers/useDimensions'
import ParallelIcon from '~common/ParallelIcon'
import { useGlobalContext } from '~helpers/globalContext'
import SnackBar from '~common/SnackBar'
import { getIfDatabaseExists } from '~helpers/database'
import { useTranslation } from 'react-i18next'
import useLanguage from '~helpers/useLanguage'

const { Popover } = renderers

const PopOverMenu = ({ element, popover, ...props }) => {
  const theme = useTheme()
  return (
    <Menu renderer={Popover} rendererProps={{ placement: 'bottom' }} {...props}>
      <MenuTrigger>{element}</MenuTrigger>
      <MenuOptions
        optionsContainerStyle={{
          backgroundColor: theme.colors.reverse,
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          borderRadius: 8,
        }}
      >
        <Box padding={10}>{popover}</Box>
      </MenuOptions>
    </Menu>
  )
}

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
  borderBottomColor: theme.colors.border,
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

const Header = ({
  navigation,
  isReadOnly,
  isSelectionMode,
  hasBackButton,
  book,
  chapter,
  verse,
  focusVerses,
  version,
  onBibleParamsClick,
  addParallelVersion,
  removeAllParallelVersions,
  isParallel,
  setSettingsCommentaires,
  settings: { commentsDisplay },
}) => {
  const { t } = useTranslation()
  const isFR = useLanguage()
  const dimensions = useDimensions()
  const isSmall = dimensions.screen.width < 400

  const onOpenCommentaire = async () => {
    const exists = await getIfDatabaseExists('commentaires-mhy')

    if (!exists) {
      SnackBar.show(t('Téléchargez la base de commentaires Matthew Henry'))
      navigation.navigate('Downloads')
      return
    }

    setSettingsCommentaires(true)
  }

  const {
    fullscreen: [isFullscreen, setIsFullScreen],
  } = useGlobalContext()

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
      style={{ height: isFullscreen ? 25 : 60 }}
    >
      {(isSelectionMode || hasBackButton) && (
        <Box justifyContent="center">
          <Back padding>
            <FeatherIcon name="arrow-left" size={20} />
          </Back>
        </Box>
      )}
      <LinkBox route="BibleSelect" style={{ paddingLeft: 15, paddingRight: 0 }}>
        <TextIcon>
          {isSmall
            ? truncate(`${t(book.Nom)} ${chapter}`, 10)
            : `${t(book.Nom)} ${chapter}`}
        </TextIcon>
      </LinkBox>
      <LinkBox
        route="VersionSelector"
        params={{ version }}
        style={{ marginRight: 'auto' }}
      >
        <TextIcon>{version}</TextIcon>
      </LinkBox>
      {isFullscreen && (
        <LinkBox
          onPress={() => {
            setIsFullScreen(false)
            ImmersiveMode.fullLayout(false)
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
                flexDirection="row"
                alignItems="center"
                justifyContent="center"
                height={60}
                width={50}
                style={{
                  opacity: isFullscreen ? 0 : 1,
                }}
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
                    ImmersiveMode.fullLayout(true)
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

export default compose(pure, withMenuContext, withNavigation)(Header)
