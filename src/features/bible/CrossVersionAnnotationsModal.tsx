import { BottomSheetModal } from '@gorhom/bottom-sheet'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box, { HStack, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import books from '~assets/bible_versions/books-desc'
import type { CrossVersionAnnotation } from '~redux/selectors/bible'
import { VersionCode } from '~state/tabs'

const VersionCard = styled(TouchableOpacity)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  padding: 16,
  marginBottom: 8,
  marginHorizontal: 16,
  borderRadius: 12,
  backgroundColor: theme.colors.lightGrey,
}))

const VersionBadge = styled.View(({ theme }) => ({
  backgroundColor: theme.colors.primary,
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 6,
}))

const ActionButton = styled(TouchableOpacity)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 8,
  backgroundColor: theme.colors.opacity5,
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
        <ModalHeader title={reference} subTitle={t('bible.crossVersionAnnotations.subtitle')} />
      }
    >
      <VStack paddingVertical={16}>
        {versions.map((versionData, index) => (
          <VersionCard key={`${versionData.version}-${index}`} activeOpacity={0.8}>
            <VStack flex gap={12}>
              <HStack alignItems="center" justifyContent="space-between">
                <HStack alignItems="center" gap={12}>
                  <VersionBadge>
                    <Text bold fontSize={14} color="white">
                      {versionData.version}
                    </Text>
                  </VersionBadge>
                  <Text fontSize={13} color="tertiary">
                    {t('bible.crossVersionAnnotations.annotationCount', {
                      count: versionData.count,
                    })}
                  </Text>
                </HStack>
              </HStack>

              <HStack gap={8}>
                <ActionButton onPress={() => handleSwitchVersion(versionData.version)}>
                  <FeatherIcon name="refresh-cw" size={16} />
                  <Text fontSize={13} marginLeft={6}>
                    {t('bible.crossVersionAnnotations.switchVersion')}
                  </Text>
                </ActionButton>

                <ActionButton onPress={() => handleOpenInNewTab(versionData.version)}>
                  <FeatherIcon name="plus-square" size={16} />
                  <Text fontSize={13} marginLeft={6}>
                    {t('bible.crossVersionAnnotations.newTab')}
                  </Text>
                </ActionButton>
              </HStack>
            </VStack>
          </VersionCard>
        ))}
      </VStack>
    </Modal.Body>
  )
}

export default CrossVersionAnnotationsModal
