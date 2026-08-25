import { connectSearchBox } from 'react-instantsearch-dom'
import { SearchBoxProvided } from 'react-instantsearch-core'
import { AiOutlineSearch } from 'react-icons/ai'
import {
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  InputProps,
} from '@chakra-ui/react'

const SearchBox = ({
  currentRefinement,
  refine,
  ...props
}: SearchBoxProvided & InputProps) => {
  return (
    <>
      <InputGroup>
        <InputLeftElement
          top="5px"
          left="10px"
          pointerEvents="none"
          children={
            <Icon as={AiOutlineSearch} fontSize="28px" color="grey_03" />
          }
        />
        <Input
          size="lg"
          pl="2xl"
          type="search"
          placeholder="Rechercher par mot, code, définition..."
          value={currentRefinement}
          onChange={(event) => refine(event.currentTarget.value)}
          {...props}
        />
      </InputGroup>
    </>
  )
}

export default connectSearchBox(SearchBox)
