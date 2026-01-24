import { BottomSheetModal } from '@gorhom/bottom-sheet'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import Modal from '~common/Modal'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import books from '~assets/bible_versions/books-desc'
import type { CrossVersionAnnotation } from '~redux/selectors/bible'
import { VersionCode } from '~state/tabs'
import ModalHeader from '~common/ModalHeader'
import { Chip } from '~common/ui/NewChip'

const ItemRow = styled.View(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  padding: 15,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const IconContainer = styled.View(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: 12,
  backgroundColor: theme.colors.lightGrey,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
}))

interface CrossVersionAnnotationsModalProps {
  bottomSheetRef: React.RefObject<BottomSheetModal | null>
  verseKey: string | null
  versions: CrossVersionAnnotation[]
  onSwitchVersion: (version: VersionCode, verse: number) => void
  onOpenInNewTab: (version: VersionCode) => void
  onClose?: () => void
}

const getBookName = (bookNumber: number): string => {
  const book = books.find(b => b.Numero === bookNumber)
  if (book) return book.Nom
  return `Livre ${bookNumber}`
}

const formatVerseReference = (verseKey: string): string => {
  const parts = verseKey.split('-')
  if (parts.length < 3) return verseKey

  const bookNumber = parseInt(parts[0], 10)
  const chapter = parts[1]
  const verse = parts[2]
  const bookName = getBookName(bookNumber)

  return `${bookName} ${chapter}:${verse}`
}

const CrossVersionAnnotationsModal = ({
  bottomSheetRef,
  verseKey,
  versions,
  onSwitchVersion,
  onOpenInNewTab,
  onClose,
}: CrossVersionAnnotationsModalProps) => {
  const { t } = useTranslation()

  const handleSwitchVersion = (version: VersionCode) => {
    // Extract verse number from verseKey (format: "book-chapter-verse")
    const verse = verseKey ? parseInt(verseKey.split('-')[2], 10) : 1
    onSwitchVersion(version, verse)
    bottomSheetRef.current?.dismiss()
  }

  const handleOpenInNewTab = (version: VersionCode) => {
    onOpenInNewTab(version)
    bottomSheetRef.current?.dismiss()
  }

  const reference = verseKey ? formatVerseReference(verseKey) : ''

  return (
    <Modal.Body
      ref={bottomSheetRef}
      onModalClose={onClose}
      withPortal
      snapPoints={['50%']}
      headerComponent={
        <ModalHeader title={t('bible.crossVersionAnnotations.subtitle')} subTitle={reference} />
      }
    >
      <Box>
        {versions.map((versionData, index) => (
          <ItemRow key={index}>
            <IconContainer>
              <FeatherIcon name="edit-3" size={18} color="secondary" />
            </IconContainer>
            <Box flex>
              <HStack gap={10} alignItems="center">
                <Text fontSize={14} fontWeight="600">
                  {t('bible.crossVersionAnnotations.annotationCount', {
                    count: versionData.count,
                  })}
                </Text>
                <Chip>{versionData.version}</Chip>
              </HStack>
              <HStack gap={12} marginTop={8}>
                <TouchableOpacity
                  onPress={e => {
                    e.stopPropagation()
                    handleSwitchVersion(versionData.version)
                  }}
                >
                  <HStack alignItems="center">
                    <FeatherIcon name="refresh-cw" size={10} color="tertiary" />
                    <Text fontSize={11} color="tertiary" marginLeft={4}>
                      {t('bible.crossVersionAnnotations.switchVersion')}
                    </Text>
                  </HStack>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={e => {
                    e.stopPropagation()
                    handleOpenInNewTab(versionData.version)
                  }}
                >
                  <HStack alignItems="center">
                    <FeatherIcon name="plus-square" size={10} color="tertiary" />
                    <Text fontSize={11} color="tertiary" marginLeft={4}>
                      {t('bible.crossVersionAnnotations.newTab')}
                    </Text>
                  </HStack>
                </TouchableOpacity>
              </HStack>
            </Box>
          </ItemRow>
        ))}
      </Box>
    </Modal.Body>
  )
}

export default CrossVersionAnnotationsModal
