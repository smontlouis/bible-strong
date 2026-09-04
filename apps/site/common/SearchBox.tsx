import { connectSearchBox } from 'react-instantsearch-dom'
import { SearchBoxProvided } from 'react-instantsearch-core'
import { AiOutlineSearch } from 'react-icons/ai'
import type { InputHTMLAttributes } from 'react'
import { Input } from '@/components/ui/input'

const SearchBox = ({
  currentRefinement,
  refine,
  ...props
}: SearchBoxProvided & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'>) => {
  return (
    <>
      <div className="relative">
        <AiOutlineSearch className="pointer-events-none absolute left-3 top-1/2 size-7 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-12 pl-12"
          type="search"
          placeholder="Rechercher par mot, code, définition..."
          value={currentRefinement}
          onChange={(event) => refine(event.currentTarget.value)}
          {...props}
        />
      </div>
    </>
  )
}

export default connectSearchBox(SearchBox)
