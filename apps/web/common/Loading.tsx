import { Center, Spinner } from '@chakra-ui/react'
import React from 'react'

const Loading = () => {
  return (
    <Center height="100%">
      <Spinner
        thickness="4px"
        speed="0.65s"
        emptyColor="gray.200"
        color="primary"
        size="xl"
      />
    </Center>
  )
}

export default Loading
