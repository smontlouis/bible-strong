import { useAtomValue } from 'jotai/react'
import React, { memo } from 'react'
import { Book } from '~assets/bible_versions/books-desc'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { useTabAnimations } from '~features/app-switcher/utils/useTabAnimations'
import { playingBibleTabIdAtom } from './atom'
import { useFindTabIndex } from '../../../state/tabs'
import { useTranslation } from 'react-i18next'

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

  return (
    <>
      <TouchableBox
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
        bottom={10}
        left={10}
      >
        <FeatherIcon name="arrow-left" size={20} color="tertiary" />
      </TouchableBox>
      <HStack
        position="absolute"
        alignSelf="center"
        bottom={10}
        row
        bg="lightGrey"
        padding={2}
        borderRadius={50}
        overflow="visible"
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
      </HStack>
      <TouchableBox
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
        bottom={10}
        right={10}
      >
        <FeatherIcon name="arrow-right" size={20} color="tertiary" />
      </TouchableBox>
    </>
  )
}

export default memo(BackToAudioFooter)
