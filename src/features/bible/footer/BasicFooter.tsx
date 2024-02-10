import React from 'react'
import { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import AudioButton from './AudioButton'

export interface BasicFooterProps {
  onPlay: () => void
  isPlaying: boolean
  isDisabled?: boolean
  isLoading?: boolean
  hasError: boolean
  onPrevChapter?: () => void
  onNextChapter?: () => void
  type?: 'audio' | 'tts'
}

const BasicFooter = ({
  onPlay,
  isPlaying,
  isDisabled,
  isLoading,
  hasError,
  onPrevChapter,
  onNextChapter,
  type,
}: BasicFooterProps) => {
  return (
    <>
      <TouchableBox
        disabled={isDisabled}
        width={40}
        height={40}
        overflow="visible"
        onPress={onPrevChapter}
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
      <PlayableButtons
        onPlay={onPlay}
        isPlaying={isPlaying}
        isDisabled={isDisabled}
        isLoading={isLoading}
        hasError={hasError}
        type={type}
      />
      <TouchableBox
        disabled={isDisabled}
        width={40}
        height={40}
        center
        overflow="visible"
        onPress={onNextChapter}
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

type PlayableButtonsProps = Pick<
  BasicFooterProps,
  'onPlay' | 'isPlaying' | 'isDisabled' | 'isLoading' | 'hasError' | 'type'
>

const PlayableButtons = ({
  onPlay,
  isPlaying,
  isDisabled,
  isLoading,
  hasError,
  type,
}: PlayableButtonsProps) => {
  return (
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
        width={50}
        height={50}
        disabled={isDisabled}
        activeOpacity={0.5}
        onPress={onPlay}
        bg={isPlaying ? 'primary' : 'reverse'}
        borderWidth={2}
        borderRadius={25}
        borderColor="lightGrey"
        position="relative"
        overflow="visible"
      >
        <AudioButton
          isPlaying={isPlaying}
          isLoading={isLoading}
          error={hasError}
          type={type}
        />
      </TouchableBox>
    </HStack>
  )
}

export default BasicFooter
