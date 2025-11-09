import React, { useEffect, useMemo } from 'react'
import { TouchableOpacity } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { shallowEqual, useSelector } from 'react-redux'
import distanceInWords from 'date-fns/formatDistance'
import fr from 'date-fns/locale/fr'
import enGB from 'date-fns/locale/en-GB'
import BottomSheetSearchInput from '~common/BottomSheetSearchInput'
import Empty from '~common/Empty'
import Modal from '~common/Modal'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useBottomSheet } from '~helpers/useBottomSheet'
import useFuzzy from '~helpers/useFuzzy'
import useLanguage from '~helpers/useLanguage'
import type { RootState } from '~redux/modules/reducer'
import type { Study } from '~redux/modules/user'

interface AddToStudyModalProps {
  isVisible: boolean
  onClosed: () => void
  onSelectStudy: (studyId: string) => void
}

const AddToStudyModal = ({
  isVisible,
  onClosed,
  onSelectStudy,
}: AddToStudyModalProps) => {
  const { ref, open, close } = useBottomSheet()
  const { t } = useTranslation()
  const isFR = useLanguage()

  useEffect(() => {
    if (isVisible) {
      open()
    } else {
      close()
    }
  }, [isVisible, open, close])

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
      ref={ref}
      onModalClose={onClosed}
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
      {result.length > 0 ? (
        <FlashList
          data={result}
          renderItem={renderStudyItem}
          keyExtractor={(item) => item.id}
          estimatedItemSize={72}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      ) : (
        <Box flex justifyContent="center" alignItems="center" padding={40}>
          <Empty
            source={require('~assets/images/empty.json')}
            message={t('study.noStudies')}
          />
        </Box>
      )}
    </Modal.Body>
  )
}

export default AddToStudyModal
