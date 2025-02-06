import { useAtomValue } from 'jotai/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDerivedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isFullScreenBibleValue } from 'src/state/app'
import { Book } from '~assets/bible_versions/books-desc'
import {
  MotiHStack,
  MotiTouchableBox,
  motiTransition,
  TouchableBox,
} from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { HEADER_HEIGHT } from '~features/app-switcher/utils/constants'
import { useTabAnimations } from '~features/app-switcher/utils/useTabAnimations'
import { useFindTabIndex } from '../../../state/tabs'
import { playingBibleTabIdAtom } from './atom'

type BackToAudioFooterProps = {
  book: Book
  chapter: number
  goToNextChapter: () => void
  goToPrevChapter: () => void
  disabled?: boolean
}

const BackToAudioFooter = ({
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  disabled,
}: BackToAudioFooterProps) => {
  const hasPreviousChapter = !(book.Numero === 1 && chapter === 1)
  const hasNextChapter = !(book.Numero === 66 && chapter === 22)
  const { slideToIndex } = useTabAnimations()
  const playingBibleTabId = useAtomValue(playingBibleTabIdAtom)
  const playingBibleTabIndex = useFindTabIndex(playingBibleTabId)
  const { t } = useTranslation()
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const insets = useSafeAreaInsets()

  return (
    <>
      <MotiTouchableBox
        disabled={disabled}
        width={40}
        height={40}
        overflow="visible"
        onPress={hasPreviousChapter ? goToPrevChapter : undefined}
        borderWidth={2}
        borderRadius={20}
        borderColor="lightGrey"
        bg="reverse"
        center
        position="absolute"
        bottom={10 + bottomBarHeight}
        left={10}
        animate={useDerivedValue(() => {
          return {
            translateY: isFullScreenBibleValue.value
              ? HEADER_HEIGHT + insets.bottom + 40
              : 0,
          }
        })}
        {...motiTransition}
      >
        <FeatherIcon name="arrow-left" size={20} color="tertiary" />
      </MotiTouchableBox>
      <MotiHStack
        position="absolute"
        alignSelf="center"
        bottom={10 + bottomBarHeight}
        row
        bg="lightGrey"
        padding={2}
        borderRadius={50}
        overflow="visible"
        animate={useDerivedValue(() => {
          return {
            translateY: isFullScreenBibleValue.value ? HEADER_HEIGHT : 0,
          }
        })}
        {...motiTransition}
      >
        <TouchableBox
          center
          paddingHorizontal={15}
          paddingVertical={10}
          onPress={() => slideToIndex(playingBibleTabIndex)}
          bg={'primary'}
          borderRadius={12}
          borderColor="lightGrey"
          position="relative"
          overflow="visible"
          row
        >
          <Text color="reverse">{t('audio.goBack')}</Text>
          <FeatherIcon
            name="volume-2"
            style={{ marginLeft: 10 }}
            size={20}
            color="reverse"
          />
        </TouchableBox>
      </MotiHStack>
      <MotiTouchableBox
        disabled={disabled}
        width={40}
        height={40}
        center
        overflow="visible"
        onPress={hasNextChapter ? goToNextChapter : undefined}
        borderWidth={2}
        borderRadius={20}
        borderColor="lightGrey"
        bg="reverse"
        position="absolute"
        bottom={10 + bottomBarHeight}
        right={10}
        animate={useDerivedValue(() => {
          return {
            translateY: isFullScreenBibleValue.value
              ? HEADER_HEIGHT + insets.bottom + 40
              : 0,
          }
        })}
        {...motiTransition}
      >
        <FeatherIcon name="arrow-right" size={20} color="tertiary" />
      </MotiTouchableBox>
    </>
  )
}

export default memo(BackToAudioFooter)
