import { twMerge } from '~common/ui/classNames'

import { forwardRef, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import ChoiceFilterModal from '~common/ChoiceFilterModal'
import { Sheet, SheetHeader, SheetView, type SheetRef } from '~common/sheet'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type { SearchSortOrder } from '~features/resources/bibleSearchAccess'
import type { SearchCanon, SearchSection } from '~state/searchFilters'
type Choice<T> = {
  value: T
  label: string
}

type Props = {
  defaultVersionValue: string
  section: SearchSection
  canon: SearchCanon
  book: number
  selectedVersion: string
  sortOrder: SearchSortOrder
  sectionChoices: Choice<SearchSection>[]
  canonChoices: Choice<SearchCanon>[]
  bookChoices: Choice<number>[]
  versionChoices: Choice<string>[]
  sortOrderChoices: Choice<SearchSortOrder>[]
  onSectionChange: (section: SearchSection) => void
  onCanonChange: (canon: SearchCanon) => void
  onBookChange: (book: number) => void
  onVersionChange: (version: string) => void
  onSortOrderChange: (sortOrder: SearchSortOrder) => void
  onReset: () => void
}

type FilterRowProps = {
  icon: React.ComponentProps<typeof FeatherIcon>['name']
  label: string
  value: string
  active: boolean
  onPress: () => void
}

const FilterRow = ({ icon, label, value, active, onPress }: FilterRowProps) => {
  return (
    <TouchableBox
      className="overflow-hidden border-continuous min-h-[54px] px-[16px] py-[14px]"
      onPress={onPress}
    >
      <HStack className="overflow-hidden border-continuous items-center">
        <FeatherIcon name={icon} size={20} color={active ? 'primary' : 'tertiary'} />
        <Text
          className={twMerge(
            active ? 'text-primary' : 'text-default',
            'flex-[1] ml-[12px] text-[16px]'
          )}
        >
          {label}
        </Text>
        <Text className="text-tertiary text-[14px] mr-[8px] max-w-[210px]" numberOfLines={1}>
          {value}
        </Text>
        <FeatherIcon name="chevron-right" size={20} color="tertiary" />
      </HStack>
    </TouchableBox>
  )
}

const PassageSearchFiltersSheet = forwardRef<SheetRef, Props>(
  (
    {
      defaultVersionValue,
      section,
      canon,
      book,
      selectedVersion,
      sortOrder,
      sectionChoices,
      canonChoices,
      bookChoices,
      versionChoices,
      sortOrderChoices,
      onSectionChange,
      onCanonChange,
      onBookChange,
      onVersionChange,
      onSortOrderChange,
      onReset,
    },
    ref
  ) => {
    const { t } = useTranslation()
    const versionRef = useRef<SheetRef>(null)
    const sectionRef = useRef<SheetRef>(null)
    const canonRef = useRef<SheetRef>(null)
    const bookRef = useRef<SheetRef>(null)
    const sortOrderRef = useRef<SheetRef>(null)
    const activeFilterCount = [
      selectedVersion !== defaultVersionValue,
      section !== '',
      canon !== '',
      book !== 0,
      sortOrder !== 'relevance',
    ].filter(Boolean).length
    const getLabel = <T,>(choices: Choice<T>[], value: T) =>
      choices.find(choice => choice.value === value)?.label || ''

    return (
      <>
        <Sheet
          ref={ref}
          header={
            <SheetHeader
              title={t('search.passageFilters.title')}
              rightComponent={
                activeFilterCount ? (
                  <Box className="overflow-hidden border-continuous mr-[12px]">
                    <TouchableBox
                      className="overflow-hidden border-continuous px-[8px] py-[8px]"
                      onPress={onReset}
                    >
                      <Text className="text-primary text-[14px]">{t('Réinitialiser')}</Text>
                    </TouchableBox>
                  </Box>
                ) : undefined
              }
            />
          }
        >
          <SheetView>
            {versionChoices.length > 1 ? (
              <FilterRow
                icon="book-open"
                label={t('Version')}
                value={getLabel(versionChoices, selectedVersion)}
                active={selectedVersion !== defaultVersionValue}
                onPress={() => versionRef.current?.present()}
              />
            ) : null}
            <FilterRow
              icon="layers"
              label={t('Canon')}
              value={getLabel(canonChoices, canon)}
              active={canon !== ''}
              onPress={() => canonRef.current?.present()}
            />
            <FilterRow
              icon="columns"
              label={t('Section')}
              value={getLabel(sectionChoices, section)}
              active={section !== ''}
              onPress={() => sectionRef.current?.present()}
            />
            <FilterRow
              icon="bookmark"
              label={t('Livre')}
              value={getLabel(bookChoices, book)}
              active={book !== 0}
              onPress={() => bookRef.current?.present()}
            />
            <FilterRow
              icon="list"
              label={t('Ordre')}
              value={getLabel(sortOrderChoices, sortOrder)}
              active={sortOrder !== 'relevance'}
              onPress={() => sortOrderRef.current?.present()}
            />
          </SheetView>
        </Sheet>

        <ChoiceFilterModal
          ref={versionRef}
          title={t('Version')}
          selectedValue={selectedVersion}
          options={versionChoices}
          onSelect={value => {
            onVersionChange(value)
            versionRef.current?.dismiss()
          }}
        />
        <ChoiceFilterModal
          ref={canonRef}
          title={t('Canon')}
          selectedValue={canon}
          options={canonChoices}
          onSelect={value => {
            onCanonChange(value)
            canonRef.current?.dismiss()
          }}
        />
        <ChoiceFilterModal
          ref={sectionRef}
          title={t('Section')}
          selectedValue={section}
          options={sectionChoices}
          onSelect={value => {
            onSectionChange(value)
            sectionRef.current?.dismiss()
          }}
        />
        <ChoiceFilterModal
          ref={bookRef}
          title={t('Livre')}
          selectedValue={String(book)}
          options={bookChoices.map(choice => ({ ...choice, value: String(choice.value) }))}
          onSelect={value => {
            onBookChange(Number(value))
            bookRef.current?.dismiss()
          }}
        />
        <ChoiceFilterModal
          ref={sortOrderRef}
          title={t('Ordre')}
          selectedValue={sortOrder}
          options={sortOrderChoices}
          onSelect={value => {
            onSortOrderChange(value)
            sortOrderRef.current?.dismiss()
          }}
        />
      </>
    )
  }
)

PassageSearchFiltersSheet.displayName = 'PassageSearchFiltersSheet'

export default PassageSearchFiltersSheet
