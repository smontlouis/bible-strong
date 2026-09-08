import { SheetFlashList, SheetHeader, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import distanceInWords from 'date-fns/formatDistance'
import React, { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import { shallowEqual, useSelector } from 'react-redux'
import SheetSearchInput from '~common/SheetSearchInput'
import Empty from '~common/Empty'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import generateUUID from '~helpers/generateUUID'
import useFuzzy from '~helpers/useFuzzy'
import useLanguage from '~helpers/useLanguage'
import { getDateLocale } from '~helpers/languageUtils'
import type { RootState } from '~redux/modules/reducer'
import type { Study } from '~redux/modules/user'
import { useMountTime } from '~helpers/useMountTime'
interface AddToStudyModalProps {
  sheetRef: React.RefObject<SheetRef | null>
  onSelectStudy: (studyId: string) => void
  reference?: string
  onClose?: () => void
}

const AddToStudyModal = ({ sheetRef, onSelectStudy, reference, onClose }: AddToStudyModalProps) => {
  const { t } = useTranslation()
  const lang = useLanguage()
  const mountTime = useMountTime()

  const studies = useSelector((state: RootState) => state.user.bible.studies, shallowEqual)

  // Sort studies by modified_at (most recent first)
  const sortedStudies = useMemo(() => {
    return Object.values(studies).sort((a, b) => Number(b.modified_at) - Number(a.modified_at))
  }, [studies])

  const fuzzyOptions = useMemo(() => ({ keys: ['title'] }), [])
  const { keyword, result, search, resetSearch } = useFuzzy(sortedStudies, fuzzyOptions)

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
    <TouchableOpacity accessibilityRole="button" onPress={handleCreateNewStudy}>
      <HStack className="border-continuous overflow-hidden py-[16px] px-[20px] border-b-[2px] border-light-grey items-center">
        <FeatherIcon name="plus-circle" size={24} color="primary" />
        <Box className="overflow-hidden border-continuous flex-[1] ml-[16px]">
          <Text className="text-[16px] font-bold text-primary">{t('study.newStudy')}</Text>
        </Box>
        <FeatherIcon name="arrow-right" size={20} color="primary" />
      </HStack>
    </TouchableOpacity>
  )

  const renderStudyItem = ({ item }: { item: Study }) => {
    const formattedDate = distanceInWords(Number(item.modified_at), mountTime, {
      locale: getDateLocale(lang),
    })

    return (
      <TouchableOpacity accessibilityRole="button" onPress={() => handleSelectStudy(item.id)}>
        <HStack className="border-continuous overflow-hidden py-[16px] px-[20px] border-b-[1px] border-light-grey items-center">
          <Box className="overflow-hidden border-continuous flex-[1]">
            <Text className="text-[16px] font-bold" numberOfLines={1}>
              {item.title}
            </Text>
            <Text className="text-[13px] text-tertiary mt-[4px]">
              {t('Il y a {{formattedDate}}', { formattedDate })}
            </Text>
          </Box>
        </HStack>
      </TouchableOpacity>
    )
  }

  return (
    <Sheet
      ref={sheetRef}
      onDismiss={onClose}
      snapPoints={[1]}
      header={
        <SheetHeader title={t('study.selectStudy')} subTitle={reference}>
          <Box className="overflow-hidden border-continuous px-[20px] pb-[10px]">
            <SheetSearchInput
              placeholder={t('study.searchStudy')}
              onChangeText={search}
              onDelete={resetSearch}
              value={keyword}
              returnKeyType="done"
            />
          </Box>
        </SheetHeader>
      }
    >
      <SheetFlashList
        ListHeaderComponent={renderNewStudyButton}
        data={result.filter(item => item.id)}
        renderItem={renderStudyItem}
        keyExtractor={(item: Study) => item.id}
        estimatedItemSize={72}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Box className="overflow-hidden border-continuous flex-[1] justify-center items-center p-[40px]">
            <Empty
              icon={require('~assets/images/empty-state-icons/study.svg')}
              message={t('study.noStudies')}
            />
          </Box>
        }
      />
    </Sheet>
  )
}

export default memo(AddToStudyModal)
