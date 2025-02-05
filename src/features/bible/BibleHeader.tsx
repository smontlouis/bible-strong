import styled from '@emotion/native'
import { memo, useEffect } from 'react'

import * as Animatable from 'react-native-animatable'

import { StackNavigationProp } from '@react-navigation/stack'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch } from 'react-redux'
import Back from '~common/Back'
import Link, { LinkBox } from '~common/Link'
import ParallelIcon from '~common/ParallelIcon'
import PopOverMenu from '~common/PopOverMenu'
import SnackBar from '~common/SnackBar'
import Box, {
  HStack,
  MotiBox,
  MotiHStack,
  MotiText,
  motiTransition,
  TouchableBox,
} from '~common/ui/Box'
import { FeatherIcon, MaterialIcon, TextIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import { useTabContext } from '~features/app-switcher/context/TabContext'
import { getIfDatabaseNeedsDownload } from '~helpers/databases'
import truncate from '~helpers/truncate'
import useDimensions from '~helpers/useDimensions'
import useLanguage from '~helpers/useLanguage'
import { MainStackProps } from '~navigation/type'
import { setSettingsCommentaires } from '~redux/modules/user'
import { BibleTab, useBibleTabActions } from '../../state/tabs'
import { useBookAndVersionSelector } from './BookSelectorBottomSheet/BookSelectorBottomSheetProvider'
import { VerseSelectorPopup } from './VerseSelectorPopup'
import { useAtomValue } from 'jotai/react'
import { isFullScreenBibleAtom, isFullScreenBibleValue } from 'src/state/app'
import { HEADER_HEIGHT } from '~features/app-switcher/utils/constants'
import { useDerivedValue } from 'react-native-reanimated'

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
  isSelectionMode,
  isParallel,
}: BibleHeaderProps) => {
  const { t } = useTranslation()
  const isFR = useLanguage()
  const dispatch = useDispatch()
  const dimensions = useDimensions()
  const isSmall = dimensions.screen.width < 400
  const actions = useBibleTabActions(bibleAtom)
  const insets = useSafeAreaInsets()
  const { openBookSelector, openVersionSelector } = useBookAndVersionSelector()
  const isFullScreenBible = useAtomValue(isFullScreenBibleAtom)

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

  return (
    <MotiHStack
      width="100%"
      maxWidth={830}
      bg="reverse"
      px={15}
      paddingTop={insets.top}
      height={HEADER_HEIGHT + insets.top}
      alignItems="center"
      borderBottomWidth={1}
      borderColor="border"
      position="absolute"
      top={0}
      left={0}
      // zIndex={1}
      animate={useDerivedValue(() => {
        return {
          height: isFullScreenBibleValue.value
            ? 20 + insets.top
            : HEADER_HEIGHT + insets.top,
        }
      })}
      {...motiTransition}
    >
      {(isSelectionMode || hasBackButton) && (
        <Back>
          <MotiBox
            alignItems="center"
            justifyContent="center"
            width={50}
            height={32}
            animate={useDerivedValue(() => {
              return {
                translateY: isFullScreenBibleValue.value ? -5 : 0,
              }
            })}
            {...motiTransition}
          >
            <FeatherIcon name="arrow-left" size={20} />
          </MotiBox>
        </Back>
      )}
      <HStack alignItems="center" gap={3} marginRight="auto">
        <HStack>
          <TouchableBox
            onPress={() => openBookSelector(bibleAtom)}
            center
            pl={12}
            pr={7}
            height={32}
          >
            <MotiBox
              bg="lightGrey"
              borderTopLeftRadius={20}
              borderBottomLeftRadius={20}
              position="absolute"
              left={0}
              bottom={0}
              right={0}
              top={0}
              animate={useDerivedValue(() => {
                return {
                  opacity: isFullScreenBibleValue.value ? 0 : 1,
                }
              })}
            />
            <MotiText
              fontWeight="bold"
              fontSize={14}
              animate={useDerivedValue(() => {
                return {
                  translateY: isFullScreenBibleValue.value ? -5 : 0,
                }
              })}
              {...motiTransition}
            >
              {isSmall
                ? truncate(`${t(bookName)} ${chapter}`, 10)
                : `${t(bookName)} ${chapter}`}
            </MotiText>
          </TouchableBox>
        </HStack>
        <TouchableBox
          onPress={() => openVersionSelector(bibleAtom)}
          center
          pl={7}
          pr={12}
          height={32}
        >
          <MotiBox
            bg="lightGrey"
            borderTopRightRadius={20}
            borderBottomRightRadius={20}
            position="absolute"
            left={0}
            bottom={0}
            right={0}
            top={0}
            animate={useDerivedValue(() => {
              return {
                opacity: isFullScreenBibleValue.value ? 0 : 1,
              }
            })}
          />
          <MotiText
            fontWeight="bold"
            fontSize={14}
            animate={useDerivedValue(() => {
              return {
                translateY: isFullScreenBibleValue.value ? -5 : 0,
              }
            })}
            {...motiTransition}
          >
            {version}
          </MotiText>
        </TouchableBox>
      </HStack>

      <PopOverMenu
        element={
          <MotiBox
            center
            width={40}
            height="100%"
            animate={useDerivedValue(() => {
              return {
                opacity: isFullScreenBibleValue.value ? 0 : 1,
              }
            })}
          >
            <FeatherIcon
              name="chevrons-down"
              size={20}
              style={{ opacity: 0.3 }}
            />
          </MotiBox>
        }
        popover={<VerseSelectorPopup bibleAtom={bibleAtom} />}
      />
      {!isSelectionMode && (
        <>
          <PopOverMenu
            element={
              <MotiBox
                center
                width={40}
                height="100%"
                animate={useDerivedValue(() => {
                  return {
                    opacity: isFullScreenBibleValue.value ? 0 : 1,
                  }
                })}
              >
                <FeatherIcon name="more-vertical" size={18} />
              </MotiBox>
            }
            popover={
              <>
                <MenuOption onSelect={onBibleParamsClick}>
                  <Box row alignItems="center">
                    <TextIcon style={{ marginRight: 0 }}>Aa</TextIcon>
                    <Text marginLeft={10}>{t('Police et paramêtres')}</Text>
                  </Box>
                </MenuOption>
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
              </>
            }
          />
        </>
      )}
    </MotiHStack>
  )
}

export default memo(Header)
