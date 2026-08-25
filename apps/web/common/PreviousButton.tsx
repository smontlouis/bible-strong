import { Box } from '@chakra-ui/react'
import React from 'react'
import { FiChevronLeft } from 'react-icons/fi'

export const PreviousButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <Box as="button" p="s" borderRadius="full" bg="primary" onClick={onClick}>
      <Box as={FiChevronLeft} fontSize="18px" color="white" />
    </Box>
  )
}

export default PreviousButton
