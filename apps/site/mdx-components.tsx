import type { MDXComponents } from 'mdx/types'

// This file allows you to provide custom React components
// to be used in MDX files. You can import and use any
// React component you want, including inline styles,
// components from other libraries, and more.

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="mt-3 text-xl font-bold">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-2 text-lg font-semibold">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-1 font-semibold">
        {children}
      </h3>
    ),
    img: (props) => (
      <span className="relative block h-[300px]">
        <img className="size-full object-cover" {...props} alt={props.alt || ''} />
      </span>
    ),
    p: ({ children }) => (
      <p className="text-sm text-muted-foreground">
        {children}
      </p>
    ),
    blockquote: ({ children }) => (
      <blockquote className="px-6 py-10 font-bold italic">
        {children}
      </blockquote>
    ),
    a: (props) => <a className="text-primary underline" {...props} />,
    ...components,
  }
}
