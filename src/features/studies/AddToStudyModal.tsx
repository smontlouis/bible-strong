import BottomSheet from '@gorhom/bottom-sheet'
import React, { useMemo } from 'react'
import { TouchableOpacity } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import distanceInWords from 'date-fns/formatDistance'
import enGB from 'date-fns/locale/en-GB'
import fr from 'date-fns/locale/fr'
import { useTranslation } from 'react-i18next'
import { shallowEqual, useSelector } from 'react-redux'
import BottomSheetSearchInput from '~common/BottomSheetSearchInput'
import Empty from '~common/Empty'
import Modal from '~common/Modal'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import generateUUID from '~helpers/generateUUID'
import useFuzzy from '~helpers/useFuzzy'
import useLanguage from '~helpers/useLanguage'
import type { RootState } from '~redux/modules/reducer'
import type { Study } from '~redux/modules/user'

interface AddToStudyModalProps {
  bottomSheetRef: React.RefObject<BottomSheet>
  onSelectStudy: (studyId: string) => void
  onClose?: () => void
}

const AddToStudyModal = ({
  bottomSheetRef,
  onSelectStudy,
  onClose,
}: AddToStudyModalProps) => {
  const { t } = useTranslation()
  const isFR = useLanguage()

  const studies = useSelector(
    (state: RootState) => Object.values(state.user.bible.studies),
    shallowEqual
  )

  // Sort studies by modified_at (most recent first)
  const sortedStudies = useMemo(() => {
    return [...studies].sort(
      (a, b) => Number(b.modified_at) - Number(a.modified_at)
    )
  }, [studies])

  const { keyword, result, search, resetSearch } = useFuzzy(sortedStudies, {
    keys: ['title'],
  })

  const handleSelectStudy = (studyId: string) => {
    onSelectStudy(studyId)
    resetSearch()
  }

  const handleCreateNewStudy = () => {
    const newStudyId = generateUUID()
    onSelectStudy(newStudyId)
    resetSearch()
  }

  const renderNewStudyButton = () => (
    <TouchableOpacity onPress={handleCreateNewStudy}>
      <HStack
        paddingVertical={16}
        paddingHorizontal={20}
        borderBottomWidth={2}
        borderColor="lightGrey"
        alignItems="center"
        bg="lightPrimary"
      >
        <FeatherIcon name="plus-square" size={24} color="primary" />
        <Box flex marginLeft={16}>
          <Text fontSize={16} bold color="primary">
            {t('study.newStudy')}
          </Text>
        </Box>
        <FeatherIcon name="arrow-right" size={20} color="primary" />
      </HStack>
    </TouchableOpacity>
  )

  const renderStudyItem = ({ item }: { item: Study }) => {
    const formattedDate = distanceInWords(
      Number(item.modified_at),
      Date.now(),
      {
        locale: isFR ? fr : enGB,
      }
    )

    return (
      <TouchableOpacity onPress={() => handleSelectStudy(item.id)}>
        <HStack
          paddingVertical={16}
          paddingHorizontal={20}
          borderBottomWidth={1}
          borderColor="lightGrey"
          alignItems="center"
        >
          <Box flex>
            <Text fontSize={16} bold numberOfLines={1}>
              {item.title}
            </Text>
            <Text fontSize={13} color="tertiary" marginTop={4}>
              {t('Il y a {{formattedDate}}', { formattedDate })}
            </Text>
          </Box>
        </HStack>
      </TouchableOpacity>
    )
  }

  return (
    <Modal.Body
      ref={bottomSheetRef}
      onModalClose={onClose}
      withPortal
      snapPoints={['90%']}
      headerComponent={
        <Box paddingTop={20} paddingBottom={10} paddingHorizontal={20}>
          <Text bold fontSize={18} marginBottom={10}>
            {t('study.selectStudy')}
          </Text>
          <BottomSheetSearchInput
            placeholder={t('study.searchStudy')}
            onChangeText={search}
            onDelete={resetSearch}
            value={keyword}
            returnKeyType="done"
          />
        </Box>
      }
    >
      <FlashList
        ListHeaderComponent={renderNewStudyButton}
        data={result}
        renderItem={renderStudyItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={72}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Box flex justifyContent="center" alignItems="center" padding={40}>
            <Empty
              source={require('~assets/images/empty.json')}
              message={t('study.noStudies')}
            />
          </Box>
        }
      />
    </Modal.Body>
  )
}

export default AddToStudyModal
