import { Box, Heading, Link, Text } from '@chakra-ui/react'
import type { MDXComponents } from 'mdx/types'
import Image, { ImageProps } from 'next/image'

// This file allows you to provide custom React components
// to be used in MDX files. You can import and use any
// React component you want, including inline styles,
// components from other libraries, and more.

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <Heading as="h1" size="lg" mt="3">
        {children}
      </Heading>
    ),
    h2: ({ children }) => (
      <Heading as="h2" size="md" mt="2">
        {children}
      </Heading>
    ),
    h3: ({ children }) => (
      <Heading as="h3" size="sm" mt="1">
        {children}
      </Heading>
    ),
    img: (props) => (
      <Box
        as="span"
        display="block"
        position="relative"
        height="300px"
        // width="50vw"
        // left="50%"
        // marginLeft="-25vw"
      >
        <Image
          style={{
            objectFit: 'cover',
          }}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw"
          fill
          {...(props as ImageProps)}
        />
      </Box>
    ),
    p: ({ children }) => (
      <Text fontSize="sm" color="gray.600">
        {children}
      </Text>
    ),
    blockquote: ({ children }) => (
      <Text
        as="blockquote"
        fontStyle="italic"
        fontWeight="bold"
        paddingX="6"
        paddingY="10"
      >
        {children}
      </Text>
    ),
    a: (props) => <Link color="blue.600" {...props} />,
    ...components,
  }
}
