import React, { forwardRef, useEffect, useState } from 'react'

import SearchInput from '~common/SearchInput'
import { Sheet, SheetHeader, SheetView, type SheetRef } from '~common/sheet'

type Props = {
  title: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}

const SearchFilterModal = forwardRef<SheetRef, Props>(
  ({ title, placeholder, value, onChange }, ref) => {
    const [draftState, setDraftState] = useState({ sourceValue: value, draft: value })
    const draft = draftState.sourceValue === value ? draftState.draft : value
    const setDraft = (nextDraft: string) => setDraftState({ sourceValue: value, draft: nextDraft })

    // The delayed callback synchronizes the local input with its external owner.
    // https://react.dev/learn/you-might-not-need-an-effect#fetching-data
    useEffect(() => {
      if (draft === value) return

      const timeout = setTimeout(() => onChange(draft), 300)
      return () => clearTimeout(timeout)
    }, [draft, onChange, value])

    return (
      <Sheet ref={ref} header={<SheetHeader title={title} />}>
        <SheetView px={16} pt={8} pb={16}>
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
