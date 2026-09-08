import { Children, Fragment, isValidElement, type ReactNode } from 'react'
export type SheetHeadingContent = {
  title?: string
  subTitle?: string
  children?: ReactNode
  rightComponent?: ReactNode
  leftComponent?: ReactNode
  hasBackButton?: boolean
  onBackPress?: () => void
}

export function readSheetHeader(header: unknown): SheetHeadingContent | undefined {
  if (!isValidElement<SheetHeadingContent>(header)) return undefined
  if (header.type !== Fragment) return header.props
  const children = Children.toArray(header.props.children)
  const index = children.findIndex(
    child => isValidElement<SheetHeadingContent>(child) && typeof child.props.title === 'string'
  )
  if (index < 0) return { children }
  const heading = readSheetHeader(children[index])
  return {
    ...heading,
    children: (
      <>
        {heading?.children}
        {children.filter((_, childIndex) => childIndex !== index)}
      </>
    ),
  }
}
