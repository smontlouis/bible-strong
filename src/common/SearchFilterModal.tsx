import React, { forwardRef, useEffect, useState } from 'react'

import SearchInput from '~common/SearchInput'
import { Sheet, SheetHeader, SheetView, type SheetRef } from '~common/sheet'
import useDebounce from '~helpers/useDebounce'

type Props = {
  title: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}

const SearchFilterModal = forwardRef<SheetRef, Props>(
  ({ title, placeholder, value, onChange }, ref) => {
    const [draft, setDraft] = useState(value)
    const debouncedDraft = useDebounce(draft, 300)

    useEffect(() => {
      setDraft(value)
    }, [value])

    useEffect(() => {
      if (debouncedDraft !== value) {
        onChange(debouncedDraft)
      }
    }, [debouncedDraft, onChange, value])

    return (
      <Sheet ref={ref} header={<SheetHeader title={title} />}>
        <SheetView px={16} pb={16}>
          <SearchInput
            autoFocus
            placeholder={placeholder}
            value={draft}
            onChangeText={setDraft}
            onDelete={() => setDraft('')}
            returnKeyType="done"
          />
        </SheetView>
      </Sheet>
    )
  }
)

SearchFilterModal.displayName = 'SearchFilterModal'

export default SearchFilterModal
