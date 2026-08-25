import { HiArrowLeft } from 'react-icons/hi'
import { Box, BoxProps } from '@chakra-ui/react'
import { useRouter } from 'next/router'

const GoBackArrow = (props: BoxProps) => {
  const router = useRouter()
  return (
    <Box
      onClick={() => router.push('../')}
      role="button"
      as={HiArrowLeft}
      fontSize="35px"
      color="primary"
      {...props}
    />
  )
}

export default GoBackArrow
